/*
  # Add INR currency fields for receivables and revenue records

  1. New Columns
    - `amount_inr` - Store the INR equivalent of the USD amount
    - `exchange_rate` - Store the exchange rate used for conversion

  2. Updates
    - Add columns to receivables table
    - Add columns to revenue_records table
    - Ensure proper indexing for performance
*/

-- Add INR amount and exchange rate columns to receivables table
ALTER TABLE receivables 
ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,4);

-- Add INR amount and exchange rate columns to revenue_records table
ALTER TABLE revenue_records 
ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,4);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_receivables_amount_inr ON receivables(amount_inr);
CREATE INDEX IF NOT EXISTS idx_revenue_records_amount_inr ON revenue_records(amount_inr);

-- Update the create_receivable_on_completion function to include INR conversion
-- Note: The actual conversion will happen in the application since we need to fetch
-- the exchange rate from an external API
CREATE OR REPLACE FUNCTION create_receivable_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create receivable if task status changed to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get project details for rate calculation
    INSERT INTO receivables (task_id, project_id, amount, hours_billed, rate_used)
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
      END as rate_used
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