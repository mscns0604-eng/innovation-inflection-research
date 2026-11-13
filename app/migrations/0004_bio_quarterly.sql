-- IIR v0.3.0 | Quarterly discovery and bio research without a "hold" list
-- Additive migration. Never replace historical seed, prices, filings or existing research snapshots.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bio_profiles (
  company_ticker TEXT PRIMARY KEY REFERENCES companies(ticker),
  classification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK(classification_status IN ('UNVERIFIED','SOURCE_REVIEWED')),
  inclusion_basis TEXT NOT NULL DEFAULT 'UNVERIFIED',
  platform_summary TEXT, source_url TEXT, reviewed_at_utc TEXT,
  updated_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS bio_company_topics (
  company_ticker TEXT NOT NULL REFERENCES companies(ticker),
  topic_code TEXT NOT NULL CHECK(topic_code IN ('DEMENTIA','AGING','CANCER','ALOPECIA','APPLIED_AI')),
  evidence_level TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK(evidence_level IN ('HISTORICAL_SEED','UNVERIFIED','PRIMARY_CONFIRMED')),
  source_url TEXT, note TEXT,
  PRIMARY KEY(company_ticker,topic_code)
);
CREATE INDEX IF NOT EXISTS idx_bio_topics ON bio_company_topics(topic_code,company_ticker);

CREATE TABLE IF NOT EXISTS bio_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_ticker TEXT NOT NULL REFERENCES companies(ticker),
  asset_name TEXT NOT NULL,modality TEXT,asset_kind TEXT NOT NULL DEFAULT 'UNVERIFIED',
  phase_label TEXT NOT NULL DEFAULT 'UNVERIFIED',phase_verified INTEGER NOT NULL DEFAULT 0 CHECK(phase_verified IN(0,1)),
  evidence_level TEXT NOT NULL DEFAULT 'UNVERIFIED',source_url TEXT,checked_at_utc TEXT,
  UNIQUE(company_ticker,asset_name)
);
CREATE INDEX IF NOT EXISTS idx_bio_assets_company ON bio_assets(company_ticker);

CREATE TABLE IF NOT EXISTS bio_asset_topics (
  asset_id INTEGER NOT NULL REFERENCES bio_assets(id),
  topic_code TEXT NOT NULL CHECK(topic_code IN ('DEMENTIA','AGING','CANCER','ALOPECIA','APPLIED_AI')),
  evidence_level TEXT NOT NULL DEFAULT 'UNVERIFIED',source_url TEXT,
  PRIMARY KEY(asset_id,topic_code)
);

CREATE TABLE IF NOT EXISTS bio_trials (
  nct_id TEXT PRIMARY KEY CHECK(length(nct_id)=11 AND substr(nct_id,1,3)='NCT'),
  public_title TEXT,phase TEXT,status TEXT,start_date TEXT,primary_completion_date TEXT,
  result_publication_date TEXT,source_url TEXT NOT NULL,last_checked_at_utc TEXT
);
CREATE TABLE IF NOT EXISTS bio_asset_trials (
  asset_id INTEGER NOT NULL REFERENCES bio_assets(id),
  nct_id TEXT NOT NULL REFERENCES bio_trials(nct_id),
  PRIMARY KEY(asset_id,nct_id)
);

CREATE TABLE IF NOT EXISTS bio_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_ticker TEXT NOT NULL REFERENCES companies(ticker),asset_id INTEGER REFERENCES bio_assets(id),
  event_kind TEXT NOT NULL,description TEXT NOT NULL,
  target_start TEXT,target_end TEXT,
  date_confidence TEXT NOT NULL DEFAULT 'UNVERIFIED',
  outcome TEXT NOT NULL DEFAULT 'PENDING',
  source_url TEXT,verified_at_utc TEXT,
  UNIQUE(company_ticker,asset_id,event_kind,target_start,description)
);
CREATE INDEX IF NOT EXISTS idx_bio_milestones ON bio_milestones(company_ticker,target_start);

CREATE TABLE IF NOT EXISTS bio_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_ticker TEXT NOT NULL REFERENCES companies(ticker),
  asof_utc TEXT NOT NULL,quarter_id TEXT NOT NULL,verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  evidence_summary TEXT,clinical_risk TEXT,financing_risk TEXT,next_check_trigger TEXT,
  source_url TEXT,
  UNIQUE(company_ticker,asof_utc)
);

CREATE TABLE IF NOT EXISTS research_quarters (
  quarter_id TEXT PRIMARY KEY CHECK(length(quarter_id)=6),
  start_date TEXT NOT NULL,end_date TEXT NOT NULL,
  intake_target_min INTEGER NOT NULL DEFAULT 20,
  intake_target_max INTEGER NOT NULL DEFAULT 40,
  created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS research_quarter_entries (
  quarter_id TEXT NOT NULL REFERENCES research_quarters(quarter_id),
  company_ticker TEXT NOT NULL REFERENCES companies(ticker),
  track TEXT NOT NULL CHECK(track IN ('TECH','BIO')),
  origin TEXT NOT NULL CHECK(origin IN ('NEW','CARRYOVER','LEGACY_SEED')),
  review_status TEXT NOT NULL DEFAULT 'RESEARCHING'
    CHECK(review_status IN ('RESEARCHING','CARRY_FORWARD','EXCLUDED')),
  carried_from_quarter TEXT,
  next_check_date TEXT,next_check_trigger TEXT,
  decision_reason TEXT,decision_source_url TEXT,decided_at_utc TEXT,
  last_reviewed_at_utc TEXT,
  PRIMARY KEY(quarter_id,company_ticker)
);
CREATE INDEX IF NOT EXISTS idx_quarter_track_status ON research_quarter_entries(quarter_id,track,review_status);

-- Existing 10 candidates are *legacy entries*, not new discoveries or verified 2026-Q4 reviews.
INSERT OR IGNORE INTO research_quarters(quarter_id,start_date,end_date)
 VALUES('2026Q4','2026-10-01','2026-12-31');
INSERT OR IGNORE INTO research_quarter_entries(quarter_id,company_ticker,track,origin)
 SELECT '2026Q4',ticker,CASE WHEN bio_mode='QUALIFIED_BIO' THEN 'BIO' ELSE 'TECH' END,'LEGACY_SEED'
 FROM companies WHERE eligible_status IN('ELIGIBLE','CONDITIONAL');

INSERT OR IGNORE INTO bio_profiles(company_ticker,classification_status,inclusion_basis,platform_summary)
 VALUES('SOPH','UNVERIFIED','CANCER_AND_APPLIED_AI','Historical research: AI cancer diagnostic analytics; source validation pending');
INSERT OR IGNORE INTO bio_profiles(company_ticker,classification_status,inclusion_basis,platform_summary)
 VALUES('ANIX','UNVERIFIED','CANCER','Historical research: oncology therapeutic pipeline; source validation pending');
INSERT OR IGNORE INTO bio_company_topics(company_ticker,topic_code,evidence_level,note)
 VALUES('SOPH','CANCER','HISTORICAL_SEED','Existing 2026-11-09 manual research; not independently reverified');
INSERT OR IGNORE INTO bio_company_topics(company_ticker,topic_code,evidence_level,note)
 VALUES('SOPH','APPLIED_AI','HISTORICAL_SEED','Existing 2026-11-09 manual research; not independently reverified');
INSERT OR IGNORE INTO bio_company_topics(company_ticker,topic_code,evidence_level,note)
 VALUES('ANIX','CANCER','HISTORICAL_SEED','Existing 2026-11-09 manual research; not independently reverified');
