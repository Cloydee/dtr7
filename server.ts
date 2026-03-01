import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { sql } from "@vercel/postgres";
import path from "path";

const isVercel = process.env.VERCEL === '1';
const usePostgres = isVercel && !!process.env.POSTGRES_URL;
// Cloudflare D1 is accessed via the 'DB' binding in the environment
const getD1 = (req?: any) => (req?.env?.DB || (globalThis as any).DB);
const useD1 = !!getD1();

// Database Abstraction
const dbInterface = {
  async query(text: string, params: any[] = [], req?: any) {
    if (useD1) {
      const db = getD1(req);
      const { results } = await db.prepare(text).bind(...params).all();
      return results;
    } else if (usePostgres) {
      // Convert ? to $1, $2, etc for Postgres
      let i = 1;
      const pgQuery = text.replace(/\?/g, () => `$${i++}`);
      const { rows } = await sql.query(pgQuery, params);
      return rows;
    } else {
      const stmt = localDb.prepare(text);
      return stmt.all(...params);
    }
  },
  async exec(text: string, req?: any) {
    if (useD1) {
      const db = getD1(req);
      await db.exec(text);
    } else if (usePostgres) {
      await sql.query(text);
    } else {
      localDb.exec(text);
    }
  },
  async get(text: string, params: any[] = [], req?: any) {
    const rows = await this.query(text, params, req);
    return rows[0];
  },
  async run(text: string, params: any[] = [], req?: any) {
    if (useD1) {
      const db = getD1(req);
      const result = await db.prepare(text).bind(...params).run();
      return { lastInsertRowid: result.meta.last_row_id || 0 };
    } else if (usePostgres) {
      let i = 1;
      let pgQuery = text.replace(/\?/g, () => `$${i++}`);
      if (pgQuery.toUpperCase().startsWith('INSERT') && !pgQuery.toUpperCase().includes('RETURNING')) {
        pgQuery += ' RETURNING id';
      }
      const result = await sql.query(pgQuery, params);
      return { lastInsertRowid: (result.rows[0] as any)?.id || 0 };
    } else {
      const stmt = localDb.prepare(text);
      const result = stmt.run(...params);
      return { lastInsertRowid: result.lastInsertRowid };
    }
  }
};

let localDb: any;
if (!usePostgres && !useD1) {
  // On Vercel, we MUST use :memory: if no Postgres is connected because the file system is read-only.
  const dbPath = isVercel ? ':memory:' : 'dtr.db';
  localDb = new Database(dbPath);
  console.log(`Local SQLite initialized: ${dbPath} (Mode: ${isVercel ? 'Serverless/Ephemeral' : 'Persistent'})`);
} else {
  console.log(useD1 ? "Cloudflare D1 initialized" : "Vercel Postgres initialized");
}

// Initialize database schema
async function initSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      category TEXT
    );

    CREATE TABLE IF NOT EXISTS dtr_records (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      morning_in TEXT,
      morning_out TEXT,
      afternoon_in TEXT,
      afternoon_out TEXT,
      remarks TEXT,
      UNIQUE(employee_id, date)
    );
  `;
  
  // Adjust schema for SQLite if needed
  const adjustedSchema = usePostgres ? schema : schema.replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT');
  await dbInterface.exec(adjustedSchema);

  // Migrations
  try {
    if (usePostgres) {
      // Postgres migration check
      await dbInterface.exec("ALTER TABLE employees ADD COLUMN IF NOT EXISTS category TEXT");
      await dbInterface.exec("ALTER TABLE dtr_records ADD COLUMN IF NOT EXISTS remarks TEXT");
    } else {
      // SQLite migration check
      const empInfo = localDb.prepare("PRAGMA table_info(employees)").all() as any[];
      if (!empInfo.some(col => col.name === 'category')) {
        localDb.exec("ALTER TABLE employees ADD COLUMN category TEXT");
      }
      const recInfo = localDb.prepare("PRAGMA table_info(dtr_records)").all() as any[];
      if (!recInfo.some(col => col.name === 'remarks')) {
        localDb.exec("ALTER TABLE dtr_records ADD COLUMN remarks TEXT");
      }
    }
  } catch (err) {
    console.error("Migration failed", err);
  }
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

async function seedData() {
  // Ensure Admin/Developer
  await dbInterface.run(
    "INSERT INTO employees (name, username, password, role, category) VALUES (?, ?, ?, ?, ?) ON CONFLICT (name) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password",
    ["Administrative Officer", "admin", "303991", "admin", "ADMIN"]
  );
  await dbInterface.run(
    "INSERT INTO employees (name, username, password, role, category) VALUES (?, ?, ?, ?, ?) ON CONFLICT (name) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password",
    ["System Developer", "cmmc", "2662", "developer", "ADMIN"]
  );

  // Sync Employees
  for (const data of employeeData) {
    let firstName = '';
    if (data.name.includes(',')) {
      firstName = data.name.split(',')[1].trim().split(' ')[0];
    } else {
      const parts = data.name.trim().split(/\s+/);
      firstName = parts.length > 1 ? parts[1] : parts[0];
    }
    const username = firstName.toLowerCase();
    await dbInterface.run(
      "INSERT INTO employees (name, username, password, role, category) VALUES (?, ?, ?, ?, ?) ON CONFLICT (name) DO NOTHING",
      [data.name, username, "303991", "employee", data.category]
    );
  }

  // Final credential reset migration
  const allUsers = await dbInterface.query("SELECT id, name, role FROM employees");
  for (const emp of allUsers) {
    let newUsername = '';
    let newPassword = '303991';
    if (emp.role === 'admin') {
      newUsername = 'admin';
    } else if (emp.role === 'developer') {
      newUsername = 'cmmc';
      newPassword = '2662';
    } else {
      let firstName = '';
      if (emp.name.includes(',')) {
        firstName = emp.name.split(',')[1].trim().split(' ')[0];
      } else {
        const parts = emp.name.trim().split(/\s+/);
        firstName = parts.length > 1 ? parts[1] : parts[0];
      }
      newUsername = firstName.toLowerCase();
    }
    await dbInterface.run("UPDATE employees SET username = ?, password = ? WHERE id = ?", [newUsername, newPassword, emp.id]);
  }
}

async function createApp() {
  await initSchema();
  await seedData();

  const app = express();
  app.use(express.json());

  const auth = async (req: any, res: any, next: any) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await dbInterface.get("SELECT * FROM employees WHERE id = ?", [userId]);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    req.user = user;
    next();
  };

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await dbInterface.get("SELECT * FROM employees WHERE LOWER(username) = LOWER(?) AND password = ?", [username, password]);
    if (user) {
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/employees", auth, async (req: any, res) => {
    const rows = await dbInterface.query("SELECT id, name, role, category, username FROM employees ORDER BY name ASC");
    res.json(rows);
  });

  app.post("/api/employees/update-credentials", auth, async (req: any, res) => {
    if (req.user.role !== 'developer') return res.status(403).json({ error: "Forbidden" });
    const { employeeId, newUsername, newPassword } = req.body;
    await dbInterface.run("UPDATE employees SET username = ?, password = ? WHERE id = ?", [newUsername, newPassword, employeeId]);
    res.json({ success: true });
  });

  app.post("/api/employees/add", auth, async (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'developer') return res.status(403).json({ error: "Forbidden" });
    const { name, category } = req.body;
    let firstName = name.includes(',') ? name.split(',')[1].trim().split(' ')[0] : (name.trim().split(/\s+/)[1] || name.trim().split(/\s+/)[0]);
    const username = firstName.toLowerCase();
    const result = await dbInterface.run("INSERT INTO employees (name, username, password, role, category) VALUES (?, ?, ?, ?, ?)", [name, username, "303991", "employee", category]);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.get("/api/records/month/:year/:month", auth, async (req: any, res) => {
    const { year, month } = req.params;
    const datePrefix = `${year}-${month.padStart(2, '0')}%`;
    const query = req.user.role === 'admin' 
      ? "SELECT r.*, e.name as employee_name FROM dtr_records r JOIN employees e ON r.employee_id = e.id WHERE r.date LIKE ?"
      : "SELECT r.*, e.name as employee_name FROM dtr_records r JOIN employees e ON r.employee_id = e.id WHERE r.date LIKE ? AND r.employee_id = ?";
    const params = req.user.role === 'admin' ? [datePrefix] : [datePrefix, req.user.id];
    const rows = await dbInterface.query(query, params);
    res.json(rows);
  });

  app.get("/api/records/all/:year/:month", auth, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { year, month } = req.params;
    const datePrefix = `${year}-${month.padStart(2, '0')}%`;
    const rows = await dbInterface.query("SELECT r.*, e.name as employee_name, e.category FROM dtr_records r JOIN employees e ON r.employee_id = e.id WHERE r.date LIKE ?", [datePrefix]);
    res.json(rows);
  });

  app.get("/api/records/employee/:employeeId/:year/:month", auth, async (req: any, res) => {
    const { employeeId, year, month } = req.params;
    if (req.user.role !== 'admin' && req.user.id !== Number(employeeId)) return res.status(403).json({ error: "Forbidden" });
    const datePrefix = `${year}-${month.padStart(2, '0')}%`;
    const rows = await dbInterface.query("SELECT r.*, e.name as employee_name FROM dtr_records r JOIN employees e ON r.employee_id = e.id WHERE r.date LIKE ? AND r.employee_id = ?", [datePrefix, employeeId]);
    res.json(rows);
  });

  app.post("/api/records", auth, async (req: any, res) => {
    const { employee_id, date, morning_in, morning_out, afternoon_in, afternoon_out, remarks } = req.body;
    if (req.user.role !== 'admin' && req.user.id !== Number(employee_id)) return res.status(403).json({ error: "Forbidden" });
    
    const sql = usePostgres 
      ? `INSERT INTO dtr_records (employee_id, date, morning_in, morning_out, afternoon_in, afternoon_out, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(employee_id, date) DO UPDATE SET
           morning_in = EXCLUDED.morning_in, morning_out = EXCLUDED.morning_out,
           afternoon_in = EXCLUDED.afternoon_in, afternoon_out = EXCLUDED.afternoon_out,
           remarks = EXCLUDED.remarks`
      : `INSERT INTO dtr_records (employee_id, date, morning_in, morning_out, afternoon_in, afternoon_out, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(employee_id, date) DO UPDATE SET
           morning_in = excluded.morning_in, morning_out = excluded.morning_out,
           afternoon_in = excluded.afternoon_in, afternoon_out = excluded.afternoon_out,
           remarks = excluded.remarks`;
    
    await dbInterface.run(sql, [employee_id, date, morning_in, morning_out, afternoon_in, afternoon_out, remarks]);
    res.json({ success: true });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  return app;
}

const app = await createApp();
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(3000, "0.0.0.0", () => console.log(`Server running on http://localhost:3000`));
}

export default app;
