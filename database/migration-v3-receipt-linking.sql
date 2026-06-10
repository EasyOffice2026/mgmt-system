-- Migration V3: Add installment_no column to receipt_vouchers for linking receipts to specific installments
-- Run this in Supabase SQL Editor

-- Add installment_no column to receipt_vouchers table
ALTER TABLE receipt_vouchers ADD COLUMN IF NOT EXISTS installment_no INTEGER DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN receipt_vouchers.installment_no IS 'Index of the installment in the contract installment_schedule JSONB array (0-based). NULL means not linked to a specific installment.';
