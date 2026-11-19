-- Per-company SEC Form 4 scan coverage, not proof that no purchases ever occurred.
-- Deliberately append-only schema; prior filing/trade/signal/history data remain intact.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS company_sec_scan_state (
  company_ticker TEXT PRIMARY KEY REFERENCES companies(ticker),
  last_attempt_at_utc TEXT,
  last_success_at_utc TEXT,
  last_result TEXT NOT NULL DEFAULT 'NOT_SCANNED',
  examined_form4_count INTEGER NOT NULL DEFAULT 0,
  detected_new_p_rows INTEGER NOT NULL DEFAULT 0,
  scan_window_days INTEGER NOT NULL DEFAULT 180,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_company_sec_scan_last ON company_sec_scan_state(last_success_at_utc);
