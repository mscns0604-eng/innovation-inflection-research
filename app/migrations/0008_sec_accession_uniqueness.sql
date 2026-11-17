-- 2026-11-17: SEC accession numbers are unique across filers and reporting owners.
-- A Form 4 filer may use a different CIK from the issuer; retain both identities and historical rows.
-- Fail safely if historical duplicate accessions exist; review those rows before applying.
CREATE UNIQUE INDEX IF NOT EXISTS idx_filings_accession_unique ON filings(accession_number);
