-- IIR market price pipeline: separate daily closing-price state from SEC ingestion.
-- Preserve 2026-11-09 research seed prices and all prior market snapshots.
INSERT OR IGNORE INTO pipeline_state(job_name,enabled,last_run_state)
VALUES('market_close',1,'NEVER_RUN');
CREATE INDEX IF NOT EXISTS idx_market_latest ON market_snapshots(company_ticker,price_date DESC,retrieved_at_utc DESC);