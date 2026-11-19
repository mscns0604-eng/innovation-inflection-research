-- ClinicalTrials.gov official study registry polling for already mapped NCT IDs only.
-- No automatic new-company/asset discovery and no inferred trial efficacy.
PRAGMA foreign_keys=ON;
INSERT OR IGNORE INTO pipeline_state(job_name,enabled,last_run_state)
 VALUES('clinical_trials',1,'NEVER_RUN');
