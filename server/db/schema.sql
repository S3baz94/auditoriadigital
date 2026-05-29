-- Diagnóstico digital de negocios

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
