-- Migration V5: Fix contracts status CHECK constraint
-- The frontend uses 'functional', 'closed', 'legal_case', 'case_closed'
-- This migration updates the constraint to allow all valid statuses.
--
-- Run this in Supabase SQL Editor BEFORE creating new contracts.

-- Drop the old CHECK constraint
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_status_check;

-- Add updated CHECK constraint with all valid statuses
ALTER TABLE contracts ADD CONSTRAINT contracts_status_check
  CHECK (status IN ('ongoing', 'functional', 'finished', 'closed', 'legal_case', 'case_closed'));

-- Update any existing 'ongoing' rows to 'functional' for consistency
UPDATE contracts SET status = 'functional' WHERE status = 'ongoing';
