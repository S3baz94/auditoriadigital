CREATE TABLE IF NOT EXISTS scrape_jobs (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_found INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  username TEXT NOT NULL,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  bio TEXT,
  location TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  is_verified INTEGER DEFAULT 0,
  email_status TEXT DEFAULT 'unknown',
  source_type TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES scrape_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_job ON leads(job_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_username ON leads(username);

CREATE TABLE IF NOT EXISTS smtp_accounts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  secure INTEGER NOT NULL DEFAULT 1,
  user TEXT NOT NULL,
  pass TEXT NOT NULL,
  from_name TEXT,
  from_email TEXT NOT NULL,
  daily_limit INTEGER NOT NULL DEFAULT 200,
  sent_today INTEGER NOT NULL DEFAULT 0,
  last_reset_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  smtp_account_id TEXT,
  send_delay_ms INTEGER NOT NULL DEFAULT 45000,
  include_unsubscribe INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (smtp_account_id) REFERENCES smtp_accounts(id)
);

CREATE TABLE IF NOT EXISTS campaign_leads (
  campaign_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  sent_at TEXT,
  opened_at TEXT,
  clicked_at TEXT,
  error_message TEXT,
  PRIMARY KEY (campaign_id, lead_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Digital audit module
CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft',
  business_name TEXT NOT NULL,
  industry TEXT,
  country TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  website_url TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  tiktok_url TEXT,
  linkedin_url TEXT,
  youtube_url TEXT,
  google_business_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at);

CREATE TABLE IF NOT EXISTS audit_answers (
  audit_id TEXT NOT NULL,
  section TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (audit_id, section),
  FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_reports (
  audit_id TEXT PRIMARY KEY,
  overall_score INTEGER NOT NULL,
  scores_json TEXT NOT NULL,
  financials_json TEXT NOT NULL,
  recommendations_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
);
