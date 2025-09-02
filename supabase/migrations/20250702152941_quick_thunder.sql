/*
  # Add INR Exchange Rate Support to Receivables

  1. New Columns
    - Add `amount_inr` to receivables table for INR equivalent amounts
    - Add `exchange_rate` to receivables table to store the USD to INR rate used
    - Add `amount_inr` to revenue_records table for INR equivalent amounts
    - Add `exchange_rate` to revenue_records table to store the USD to INR rate used

  2. Indexes
    - Add indexes for better query performance on INR amounts

  3. Function Updates
    - Update the receivable creation function to handle new fields
    - The actual INR conversion will be handled by the application
*/

-- Add INR amount and exchange rate columns to receivables table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receivables' AND column_name = 'amount_inr'
  ) THEN
    ALTER TABLE receivables ADD COLUMN amount_inr NUMERIC(10,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receivables' AND column_name = 'exchange_rate'
  ) THEN
    ALTER TABLE receivables ADD COLUMN exchange_rate NUMERIC(10,4);
  END IF;
END $$;

-- Add INR amount and exchange rate columns to revenue_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'revenue_records' AND column_name = 'amount_inr'
  ) THEN
    ALTER TABLE revenue_records ADD COLUMN amount_inr NUMERIC(10,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'revenue_records' AND column_name = 'exchange_rate'
  ) THEN
    ALTER TABLE revenue_records ADD COLUMN exchange_rate NUMERIC(10,4);
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_receivables_amount_inr ON receivables(amount_inr);
CREATE INDEX IF NOT EXISTS idx_revenue_records_amount_inr ON revenue_records(amount_inr);
CREATE INDEX IF NOT EXISTS idx_receivables_exchange_rate ON receivables(exchange_rate);
CREATE INDEX IF NOT EXISTS idx_revenue_records_exchange_rate ON revenue_records(exchange_rate);

-- Update the create_receivable_on_completion function to include new fields
CREATE OR REPLACE FUNCTION create_receivable_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create receivable if task status changed to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get project details for rate calculation
    INSERT INTO receivables (task_id, project_id, amount, hours_billed, rate_used, amount_inr, exchange_rate)
    SELECT 
      NEW.id,
      NEW.project_id,
      CASE 
        WHEN p.rate_type = 'hourly' THEN NEW.hours_worked * p.hourly_rate
        WHEN p.rate_type = 'fixed' AND p.fixed_rate IS NOT NULL THEN 
          p.fixed_rate * (NEW.progress_percentage / 100.0)
        ELSE 0
      END as amount,
      NEW.hours_worked,
      CASE 
        WHEN p.rate_type = 'hourly' THEN p.hourly_rate
        WHEN p.rate_type = 'fixed' AND p.fixed_rate IS NOT NULL THEN p.fixed_rate
        ELSE 0
      END as rate_used,
      NULL as amount_inr, -- Will be updated by the application when exchange rate is fetched
      NULL as exchange_rate -- Will be updated by the application when exchange rate is fetched
    FROM projects p
    WHERE p.id = NEW.project_id
    ON CONFLICT (task_id) DO UPDATE SET
      amount = EXCLUDED.amount,
      hours_billed = EXCLUDED.hours_billed,
      rate_used = EXCLUDED.rate_used;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for the new columns (they inherit from existing table policies)
-- No additional policies needed as the new columns are part of existing tables

-- Add comments for documentation
COMMENT ON COLUMN receivables.amount_inr IS 'Amount in Indian Rupees converted from USD using exchange_rate';
COMMENT ON COLUMN receivables.exchange_rate IS 'USD to INR exchange rate used for conversion';
COMMENT ON COLUMN revenue_records.amount_inr IS 'Revenue amount in Indian Rupees converted from USD using exchange_rate';
COMMENT ON COLUMN revenue_records.exchange_rate IS 'USD to INR exchange rate used for conversion';