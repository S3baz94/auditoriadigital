import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Schema inline para que entre al bundle serverless de Vercel
// (los .sql externos no se incluyen en el bundle de @vercel/node).
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS diagnostics (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  niche TEXT NOT NULL,
  size TEXT NOT NULL,
  geo TEXT,
  status TEXT NOT NULL DEFAULT 'started',
  segment TEXT,
  overall_score INTEGER,
  survey_json TEXT,
  audit_json TEXT,
  report_json TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_diag_created_at ON diagnostics(created_at);
CREATE INDEX IF NOT EXISTS idx_diag_niche ON diagnostics(niche);
CREATE INDEX IF NOT EXISTS idx_diag_segment ON diagnostics(segment);
`;

let db: Database.Database | null = null;

export function getDbPath(): string {
  // Vercel serverless: solo /tmp es escribible (efímero, se borra entre cold starts).
  if (process.env.VERCEL) return "/tmp/diagnostico.db";
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "diagnostico.db");
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA_SQL);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
