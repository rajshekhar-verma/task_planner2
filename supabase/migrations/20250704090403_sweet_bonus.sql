/*
  # Create tax_payments table

  1. New Tables
    - `tax_payments`
      - `id` (uuid, primary key)
      - `amount` (numeric, tax payment amount in USD)
      - `amount_inr` (numeric, tax payment amount in INR)
      - `payment_date` (date, when the tax was paid)
      - `notes` (text, optional notes about the payment)
      - `created_at` (timestamp, when the record was created)

  2. Security
    - Enable RLS on `tax_payments` table
    - Add policy for users to manage tax payments
*/

CREATE TABLE IF NOT EXISTS tax_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(10,2) NOT NULL,
  amount_inr numeric(10,2),
  payment_date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tax_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage tax payments" ON tax_payments
  FOR ALL USING (true) WITH CHECK (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tax_payments_payment_date ON tax_payments (payment_date);
CREATE INDEX IF NOT EXISTS idx_tax_payments_created_at ON tax_payments (created_at);