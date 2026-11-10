-- IIR Innovation Inflection Research • D1 schema v1
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS companies (
 ticker TEXT PRIMARY KEY CHECK(length(ticker) BETWEEN 1 AND 10),
 name TEXT NOT NULL, cik TEXT UNIQUE, exchange TEXT DEFAULT 'US', industry TEXT NOT NULL,
 theme TEXT, bio_mode TEXT NOT NULL DEFAULT 'NON_BIO' CHECK(bio_mode IN ('NON_BIO','QUALIFIED_BIO')),
 eligible_status TEXT NOT NULL DEFAULT 'ELIGIBLE', inflection_type TEXT NOT NULL DEFAULT 'UNVERIFIED',
 discovery_path TEXT NOT NULL DEFAULT 'A', signal_type TEXT NOT NULL DEFAULT 'UNVERIFIED',
 buyers_count INTEGER, buy_amount_usd REAL, trade_last_date TEXT, disclosed_at_utc TEXT,
 seed_price_usd REAL, seed_price_asof TEXT, historical_seed INTEGER NOT NULL DEFAULT 1,
 research_status TEXT NOT NULL DEFAULT 'WATCH', risk_note TEXT, focus TEXT, summary TEXT,
 verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
 created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(research_status,trade_last_date);
CREATE TABLE IF NOT EXISTS filings (
 id INTEGER PRIMARY KEY AUTOINCREMENT, cik TEXT NOT NULL, company_ticker TEXT NOT NULL,
 accession_number TEXT NOT NULL, filing_type TEXT NOT NULL, accepted_at_utc TEXT,
 published_at_utc TEXT, source_url TEXT NOT NULL, amends_accession TEXT,
 fetched_at_utc TEXT NOT NULL, raw_hash TEXT, parse_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
 UNIQUE(cik, accession_number), FOREIGN KEY(company_ticker) REFERENCES companies(ticker)
);
CREATE INDEX IF NOT EXISTS idx_filings_company_date ON filings(company_ticker,accepted_at_utc DESC);
CREATE TABLE IF NOT EXISTS insider_transactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, filing_id INTEGER NOT NULL,
 transaction_identity TEXT NOT NULL, reporting_owner_key TEXT, reporting_owner_name TEXT,
 trade_date TEXT, code TEXT, shares REAL, price_usd REAL, value_usd REAL, direct_indirect TEXT,
 plan_10b5_1 TEXT DEFAULT 'UNKNOWN', purchase_kind TEXT NOT NULL DEFAULT 'UNKNOWN',
 verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
 UNIQUE(filing_id,transaction_identity), FOREIGN KEY(filing_id) REFERENCES filings(id)
);
CREATE TABLE IF NOT EXISTS candidate_signals (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_ticker TEXT NOT NULL,
 signal_key TEXT NOT NULL UNIQUE, signal_type TEXT NOT NULL, disclosed_at_utc TEXT,
 actor_count_independent INTEGER, aggregate_buy_usd REAL, status TEXT NOT NULL DEFAULT 'UNVERIFIED',
 source_url TEXT NOT NULL, FOREIGN KEY(company_ticker) REFERENCES companies(ticker)
);
CREATE INDEX IF NOT EXISTS idx_signals_disclosed ON candidate_signals(disclosed_at_utc DESC);
CREATE TABLE IF NOT EXISTS evidence (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_ticker TEXT NOT NULL, source_type TEXT NOT NULL,
 title TEXT NOT NULL, url TEXT NOT NULL, event_date TEXT,published_at_utc TEXT,
 retrieved_at_utc TEXT, claim_type TEXT NOT NULL DEFAULT 'UNVERIFIED',
 content_hash TEXT, UNIQUE(company_ticker,url), FOREIGN KEY(company_ticker) REFERENCES companies(ticker)
);
CREATE TABLE IF NOT EXISTS catalysts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_ticker TEXT NOT NULL,
 title TEXT NOT NULL, target_start TEXT, target_end TEXT, date_type TEXT NOT NULL DEFAULT 'UNKNOWN',
 event_type TEXT, status TEXT NOT NULL DEFAULT 'WATCH', source_url TEXT,
 updated_at_utc TEXT, FOREIGN KEY(company_ticker) REFERENCES companies(ticker)
);
CREATE TABLE IF NOT EXISTS score_snapshots (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_ticker TEXT NOT NULL, asof_utc TEXT NOT NULL,
 rubric_version TEXT NOT NULL DEFAULT 'v0.2.0',
 insider INTEGER CHECK(insider BETWEEN 0 AND 25),theme INTEGER CHECK(theme BETWEEN 0 AND 20),
 technology INTEGER CHECK(technology BETWEEN 0 AND 20),external_validation INTEGER CHECK(external_validation BETWEEN 0 AND 10),
 financial INTEGER CHECK(financial BETWEEN 0 AND 10),price INTEGER CHECK(price BETWEEN 0 AND 10),
 macro INTEGER CHECK(macro BETWEEN 0 AND 5), research_status TEXT,entry_risk_status TEXT,
 reason_summary TEXT, UNIQUE(company_ticker,asof_utc,rubric_version),
 FOREIGN KEY(company_ticker) REFERENCES companies(ticker)
);
CREATE INDEX IF NOT EXISTS idx_scores_latest ON score_snapshots(company_ticker,asof_utc DESC);
CREATE TABLE IF NOT EXISTS market_snapshots (
 company_ticker TEXT NOT NULL,price_date TEXT NOT NULL,close_usd REAL,
 adjustment_type TEXT, source_name TEXT,retrieved_at_utc TEXT,
 PRIMARY KEY(company_ticker,price_date,source_name),
 FOREIGN KEY(company_ticker) REFERENCES companies(ticker)
);
CREATE TABLE IF NOT EXISTS pipeline_runs (
 id TEXT PRIMARY KEY,job_name TEXT NOT NULL,started_at_utc TEXT NOT NULL,
 finished_at_utc TEXT,state TEXT NOT NULL,checked_count INTEGER NOT NULL DEFAULT 0,
 changed_count INTEGER NOT NULL DEFAULT 0,cursor INTEGER NOT NULL DEFAULT 0,
 error_code TEXT,error_summary TEXT,version TEXT NOT NULL DEFAULT '1'
);
CREATE TABLE IF NOT EXISTS pipeline_state (
 job_name TEXT PRIMARY KEY,lock_owner TEXT,lease_expires_at_utc TEXT,
 last_attempt_at_utc TEXT,last_success_at_utc TEXT,last_error TEXT,
 cursor INTEGER NOT NULL DEFAULT 0,enabled INTEGER NOT NULL DEFAULT 1,error_count INTEGER NOT NULL DEFAULT 0,
 last_run_state TEXT NOT NULL DEFAULT 'NOT_CONFIGURED'
);
INSERT OR IGNORE INTO pipeline_state(job_name,enabled,last_run_state) VALUES('sec_form4',1,'NOT_CONFIGURED');
