-- Migration V10: Add discount column to legal_cases
-- Balance Amount = Case Amount - Rcvd from Court - Discount

ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS discount DECIMAL(12,3) DEFAULT 0;
