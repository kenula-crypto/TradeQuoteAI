-- Migration: add notes and ai_notes columns to quotes table
-- Run this in your Supabase SQL Editor before deploying the updated app.

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ai_notes text;

-- Ensure customers table exists (create if not present)
CREATE TABLE IF NOT EXISTS customers (
  id           text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  company_name text,
  email        text,
  phone        text,
  address      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS for customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "customers_owner"
  ON customers
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
