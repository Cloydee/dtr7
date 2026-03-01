interface Env {
  DB: D1Database;
}

const jhsPersonnel = [
  "ABECIA, ANNABELLE M.", "BABAISON ADELINA H.", "BONACHITA, KAREN ROSE S.",
  "CABUSOG, CLOYD MARK M.", "NAMATA, MARIBETH O.", "TABALBA, IRFIL B.",
  "ROXAS, MARJON A.", "ROXAS, LUCIA A.", "MABILANGA, QUEENIE B.",
  "CHAVES, MINERVA MARDY R.", "TUDIO, MARIBEL S.", "ALON, JOANNIE S.",
  "LANO, GLAISA D.", "TROPEL, RACHEL ANN S.", "RABANES, APRIL ROSE C."
];

const shsPersonnel = [
  "WAMINAL DIVINA L.", "SARIGUMBA, SHERILL A.", "BACARRISAS, ELREGINE N.",
  "BADILLA, RAMIE A.", "PACUDAN, KEN ROJO A.", "ROXAS, JOANNA", "PACTURAN, DREXILE B."
];

const nonTeachingPersonnel = [
  "ALEGADO, CESARIO E.", "OWAB, PALMA ANA S.", "QUIPQUIPAN, ALEEN B.", "CAGAMPANG, CARYL L."
];

const employeeData = [
  ...jhsPersonnel.map(name => ({ name, category: 'JHS' })),
  ...shsPersonnel.map(name => ({ name, category: 'SHS' })),
  ...nonTeachingPersonnel.map(name => ({ name, category: 'NON_TEACHING' }))
];

// Initialize database schema and seed data using Batching for stability
async function ensureDatabase(db: D1Database) {
  // Check if already initialized
  const tableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employees'").first();
  if (tableCheck) {
    // Check if admin exists, if not, we might need a quick seed
    const adminCheck = await db.prepare("SELECT id FROM employees WHERE username = 'admin'").first();
    if (adminCheck) return; 
  }

  const batch: D1PreparedStatement[] = [];

  // 1. Schema
  batch.push(db.prepare(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      category TEXT
    )
  `));

  batch.push(db.prepare(`
    CREATE TABLE IF NOT EXISTS dtr_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      morning_in TEXT,
      morning_out TEXT,
      afternoon_in TEXT,
      afternoon_out TEXT,
      remarks TEXT,
      UNIQUE(employee_id, date)
    )
  `));

  // 2. Core Accounts
  batch.push(db.prepare("INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES (?, ?, ?, ?, ?)")
    .bind("Administrative Officer", "admin", "303991", "admin", "ADMIN"));
  batch.push(db.prepare("INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES (?, ?, ?, ?, ?)")
    .bind("System Developer", "cmmc", "2662", "developer", "ADMIN"));

  // 3. Personnel Seeding
  for (const data of employeeData) {
    let firstName = data.name.includes(',') ? data.name.split(',')[1].trim().split(' ')[0] : (data.name.trim().split(/\s+/)[1] || data.name.trim().split(/\s+/)[0]);
    const username = firstName.toLowerCase();
    batch.push(db.prepare("INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES (?, ?, ?, ?, ?)")
      .bind(data.name, username, "303991", "employee", data.category));
  }

  await db.batch(batch);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  };

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1 Database binding 'DB' not found. Please check your Cloudflare Pages settings." }), { status: 500, headers: corsHeaders });
  }

  try {
    // Ensure DB is ready
    await ensureDatabase(env.DB);

    // Auth Helper
    const getAuthUser = async () => {
      const userId = request.headers.get('x-user-id');
      if (!userId) return null;
      return await env.DB.prepare("SELECT * FROM employees WHERE id = ?").bind(userId).first();
    };

    // API Routes
    if (path === "/api/login" && method === "POST") {
      const { username, password } = await request.json() as any;
      if (!username || !password) return new Response(JSON.stringify({ error: "Missing username or password" }), { status: 400, headers: corsHeaders });
      
      const user = await env.DB.prepare("SELECT * FROM employees WHERE LOWER(username) = LOWER(?) AND password = ?")
        .bind(username, password)
        .first();
        
      if (user) {
        const { password: _, ...userWithoutPassword } = user as any;
        return Response.json(userWithoutPassword, { headers: corsHeaders });
      }
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: corsHeaders });
    }

    const user = await getAuthUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    if (path === "/api/employees" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT id, name, role, category, username FROM employees ORDER BY name ASC").all();
      return Response.json(results, { headers: corsHeaders });
    }

    if (path === "/api/employees/update-credentials" && method === "POST") {
      if ((user as any).role !== 'developer') return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      const { employeeId, newUsername, newPassword } = await request.json() as any;
      await env.DB.prepare("UPDATE employees SET username = ?, password = ? WHERE id = ?").bind(newUsername, newPassword, employeeId).run();
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (path === "/api/employees/add" && method === "POST") {
      if ((user as any).role !== 'admin' && (user as any).role !== 'developer') return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      const { name, category } = await request.json() as any;
      let firstName = name.includes(',') ? name.split(',')[1].trim().split(' ')[0] : (name.trim().split(/\s+/)[1] || name.trim().split(/\s+/)[0]);
      const username = firstName.toLowerCase();
      const result = await env.DB.prepare("INSERT INTO employees (name, username, password, role, category) VALUES (?, ?, ?, ?, ?)")
        .bind(name, username, "303991", "employee", category)
        .run();
      return Response.json({ success: true, id: result.meta.last_row_id }, { headers: corsHeaders });
    }

    if (path.startsWith("/api/records/month/") && method === "GET") {
      const parts = path.split("/");
      const year = parts[4];
      const month = parts[5];
      const datePrefix = `${year}-${month.padStart(2, '0')}%`;
      const query = (user as any).role === 'admin' 
        ? "SELECT r.*, e.name as employee_name FROM dtr_records r JOIN employees e ON r.employee_id = e.id WHERE r.date LIKE ?"
        : "SELECT r.*, e.name as employee_name FROM dtr_records r JOIN employees e ON r.employee_id = e.id WHERE r.date LIKE ? AND r.employee_id = ?";
      const stmt = (user as any).role === 'admin' 
        ? env.DB.prepare(query).bind(datePrefix)
        : env.DB.prepare(query).bind(datePrefix, (user as any).id);
      const { results } = await stmt.all();
      return Response.json(results, { headers: corsHeaders });
    }

    if (path.startsWith("/api/records/all/") && method === "GET") {
      if ((user as any).role !== 'admin') return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      const parts = path.split("/");
      const year = parts[4];
      const month = parts[5];
      const datePrefix = `${year}-${month.padStart(2, '0')}%`;
      const { results } = await env.DB.prepare("SELECT r.*, e.name as employee_name, e.category FROM dtr_records r JOIN employees e ON r.employee_id = e.id WHERE r.date LIKE ?").bind(datePrefix).all();
      return Response.json(results, { headers: corsHeaders });
    }

    if (path.startsWith("/api/records/employee/") && method === "GET") {
      const parts = path.split("/");
      const employeeId = parts[4];
      const year = parts[5];
      const month = parts[6];
      if ((user as any).role !== 'admin' && (user as any).id !== Number(employeeId)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      const datePrefix = `${year}-${month.padStart(2, '0')}%`;
      const { results } = await env.DB.prepare("SELECT r.*, e.name as employee_name FROM dtr_records r JOIN employees e ON r.employee_id = e.id WHERE r.date LIKE ? AND r.employee_id = ?").bind(datePrefix, employeeId).all();
      return Response.json(results, { headers: corsHeaders });
    }

    if (path === "/api/records" && method === "POST") {
      const { employee_id, date, morning_in, morning_out, afternoon_in, afternoon_out, remarks } = await request.json() as any;
      if ((user as any).role !== 'admin' && (user as any).id !== Number(employee_id)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      
      const sql = `INSERT INTO dtr_records (employee_id, date, morning_in, morning_out, afternoon_in, afternoon_out, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(employee_id, date) DO UPDATE SET
           morning_in = excluded.morning_in, morning_out = excluded.morning_out,
           afternoon_in = excluded.afternoon_in, afternoon_out = excluded.afternoon_out,
           remarks = excluded.remarks`;
      
      await env.DB.prepare(sql).bind(employee_id, date, morning_in, morning_out, afternoon_in, afternoon_out, remarks).run();
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: corsHeaders });

  } catch (error: any) {
    console.error("D1 Error:", error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), { status: 500, headers: corsHeaders });
  }
};
