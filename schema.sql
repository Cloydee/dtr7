-- Cloudflare D1 Schema for DTR System

-- 1. Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  category TEXT
);

-- 2. DTR Records Table
CREATE TABLE IF NOT EXISTS dtr_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  morning_in TEXT,
  morning_out TEXT,
  afternoon_in TEXT,
  afternoon_out TEXT,
  remarks TEXT,
  UNIQUE(employee_id, date),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- 3. Initial Admin Account
INSERT OR IGNORE INTO employees (name, username, password, role, category) 
VALUES ('Administrative Officer', 'admin', '303991', 'admin', 'ADMIN');

-- 4. Initial Developer Account
INSERT OR IGNORE INTO employees (name, username, password, role, category) 
VALUES ('System Developer', 'cmmc', '2662', 'developer', 'ADMIN');

-- 5. JHS Personnel
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('ABECIA, ANNABELLE M.', 'annabelle', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('BABAISON ADELINA H.', 'adelina', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('BONACHITA, KAREN ROSE S.', 'karen', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('CABUSOG, CLOYD MARK M.', 'cloyd', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('NAMATA, MARIBETH O.', 'maribeth', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('TABALBA, IRFIL B.', 'irfil', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('ROXAS, MARJON A.', 'marjon', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('ROXAS, LUCIA A.', 'lucia', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('MABILANGA, QUEENIE B.', 'queenie', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('CHAVES, MINERVA MARDY R.', 'minerva', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('TUDIO, MARIBEL S.', 'maribel', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('ALON, JOANNIE S.', 'joannie', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('LANO, GLAISA D.', 'glaisa', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('TROPEL, RACHEL ANN S.', 'rachel', '303991', 'employee', 'JHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('RABANES, APRIL ROSE C.', 'april', '303991', 'employee', 'JHS');

-- 6. SHS Personnel
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('WAMINAL DIVINA L.', 'divina', '303991', 'employee', 'SHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('SARIGUMBA, SHERILL A.', 'sherill', '303991', 'employee', 'SHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('BACARRISAS, ELREGINE N.', 'elregine', '303991', 'employee', 'SHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('BADILLA, RAMIE A.', 'ramie', '303991', 'employee', 'SHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('PACUDAN, KEN ROJO A.', 'ken', '303991', 'employee', 'SHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('ROXAS, JOANNA', 'joanna', '303991', 'employee', 'SHS');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('PACTURAN, DREXILE B.', 'drexile', '303991', 'employee', 'SHS');

-- 7. Non-Teaching
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('ALEGADO, CESARIO E.', 'cesario', '303991', 'employee', 'NON_TEACHING');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('OWAB, PALMA ANA S.', 'palma', '303991', 'employee', 'NON_TEACHING');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('QUIPQUIPAN, ALEEN B.', 'aleen', '303991', 'employee', 'NON_TEACHING');
INSERT OR IGNORE INTO employees (name, username, password, role, category) VALUES ('CAGAMPANG, CARYL L.', 'caryl', '303991', 'employee', 'NON_TEACHING');
