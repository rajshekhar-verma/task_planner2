/*
  # Add Exchange Rate Support for Receivables and Revenue Records

  1. New Columns
    - `amount_inr` - Amount in Indian Rupees (INR) for both tables
    - `exchange_rate` - USD to INR exchange rate used for conversion

  2. Documentation
    - Add comments to explain the purpose of new columns
    - Create indexes for better query performance

  3. Function Updates
    - Update the create_receivable_on_completion function to handle INR conversion
*/

-- Add INR amount and exchange rate columns to receivables table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receivables' AND column_name = 'amount_inr'
  ) THEN
    ALTER TABLE receivables ADD COLUMN amount_inr NUMERIC(10,2);
    COMMENT ON COLUMN receivables.amount_inr IS 'Amount in Indian Rupees converted from USD using exchange_rate';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receivables' AND column_name = 'exchange_rate'
  ) THEN
    ALTER TABLE receivables ADD COLUMN exchange_rate NUMERIC(10,4);
    COMMENT ON COLUMN receivables.exchange_rate IS 'USD to INR exchange rate used for conversion';
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
    COMMENT ON COLUMN revenue_records.amount_inr IS 'Revenue amount in Indian Rupees converted from USD using exchange_rate';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'revenue_records' AND column_name = 'exchange_rate'
  ) THEN
    ALTER TABLE revenue_records ADD COLUMN exchange_rate NUMERIC(10,4);
    COMMENT ON COLUMN revenue_records.exchange_rate IS 'USD to INR exchange rate used for conversion';
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_receivables_amount_inr ON receivables(amount_inr);
CREATE INDEX IF NOT EXISTS idx_receivables_exchange_rate ON receivables(exchange_rate);
CREATE INDEX IF NOT EXISTS idx_revenue_records_amount_inr ON revenue_records(amount_inr);
CREATE INDEX IF NOT EXISTS idx_revenue_records_exchange_rate ON revenue_records(exchange_rate);

-- Update the create_receivable_on_completion function to include INR conversion
-- Note: The actual conversion will happen in the application since we need to fetch
-- the exchange rate from an external API
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