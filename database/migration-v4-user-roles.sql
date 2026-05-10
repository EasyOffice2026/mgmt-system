-- Migration: Add salesman and accountant roles
-- Run this in Supabase SQL Editor on existing databases

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('owner', 'admin', 'salesman', 'accountant', 'staff'));
