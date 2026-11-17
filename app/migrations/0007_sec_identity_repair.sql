-- 2026-11-17 SEC CIK repair: preserve price, signal, filing and research history.
-- Identity must be checked against live SEC submissions tickers again before new ingestion.
PRAGMA foreign_keys=ON;
UPDATE companies SET cik='0001477845' WHERE ticker='ANVS' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='ANVS' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1477845/%');
UPDATE companies SET cik='0001828108' WHERE ticker='AUR' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='AUR' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1828108/%');
UPDATE companies SET cik='0001501796' WHERE ticker='AURA' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='AURA' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1501796/%');
UPDATE companies SET cik='0001709941' WHERE ticker='BIOA' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='BIOA' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1709941/%');
UPDATE companies SET cik='0001991792' WHERE ticker='CGON' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='CGON' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1991792/%');
UPDATE companies SET cik='0001434316' WHERE ticker='FATE' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='FATE' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1434316/%');
UPDATE companies SET cik='0001827635' WHERE ticker='MANE' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='MANE' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1827635/%');
UPDATE companies SET cik='0001816581' WHERE ticker='OUST' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='OUST' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1816581/%');
UPDATE companies SET cik='0001601830' WHERE ticker='RXRX' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='RXRX' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1601830/%');
UPDATE companies SET cik='0001832483' WHERE ticker='SERV' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='SERV' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1832483/%');
UPDATE companies SET cik='0001756262' WHERE ticker='TMDX' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='TMDX' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1756262/%');
UPDATE companies SET cik='0001640266' WHERE ticker='VYGR' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='VYGR' AND v.eligibility_status='US_CONFIRMED'
 AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1640266/%');
-- PRCT's former CIK belonged to a different issuer; correct only the known stale value.
UPDATE companies SET cik='0001588978' WHERE ticker='PRCT' AND (cik IS NULL OR cik='0001440660')
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='PRCT' AND v.verification_source_url LIKE 'https://www.sec.gov/Archives/edgar/data/1588978/%');
-- CADL company verification now references the SEC 2026-Q3 10-Q rather than the IR FAQ.
UPDATE company_listing_verification SET verification_source_url='https://www.sec.gov/Archives/edgar/data/1841387/000119312526458380/cadl-20260930.htm',
 verified_on='2026-11-17',verification_note=verification_note || ' / 2026Q3 SEC 10-Q 확인'
 WHERE company_ticker='CADL' AND verification_source_url='https://ir.candeltx.com/resources/investor-faqs/';
UPDATE companies SET cik='0001841387' WHERE ticker='CADL' AND cik IS NULL
 AND EXISTS(SELECT 1 FROM company_listing_verification v WHERE v.company_ticker='CADL' AND v.verification_source_url='https://www.sec.gov/Archives/edgar/data/1841387/000119312526458380/cadl-20260930.htm');
