-- IIR v0.2.0 manual research priority (not an investment recommendation).
-- Preserve prior scores, historical company seed, and unknown component scores.
-- Nullable: legacy rows remain readable; unique rank applies only within a review timestamp.
ALTER TABLE score_snapshots ADD COLUMN review_rank INTEGER CHECK(review_rank BETWEEN 1 AND 100);
CREATE INDEX IF NOT EXISTS idx_iir_score_review_rank ON score_snapshots(asof_utc DESC,review_rank);
