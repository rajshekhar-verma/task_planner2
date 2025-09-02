/*
  # Fix ambiguous total_amount column reference

  1. Database Changes
    - Update the update_invoice_totals function to properly qualify column references
    - Ensure all triggers use fully qualified column names
    - Fix any ambiguous references in the invoice creation process

  2. Function Updates
    - Modify update_invoice_totals to use qualified table names
    - Update any other functions that might reference total_amount ambiguously
*/

-- Drop and recreate the update_invoice_totals function with proper table qualification
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  invoice_id_to_update UUID;
  calculated_total_amount NUMERIC(10,2);
  invoice_tax_amount NUMERIC(10,2);
  invoice_discount_amount NUMERIC(10,2);
BEGIN
  -- Determine which invoice to update
  invoice_id_to_update := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.invoice_id
    ELSE NEW.invoice_id
  END;
  
  -- Calculate total amount for the invoice from invoice_items
  SELECT COALESCE(SUM(ii.amount), 0) INTO calculated_total_amount
  FROM invoice_items ii
  WHERE ii.invoice_id = invoice_id_to_update;
  
  -- Get current tax and discount amounts from invoices table
  SELECT 
    COALESCE(i.tax_amount, 0),
    COALESCE(i.discount_amount, 0)
  INTO 
    invoice_tax_amount,
    invoice_discount_amount
  FROM invoices i
  WHERE i.id = invoice_id_to_update;
  
  -- Update the invoice totals with fully qualified column names
  UPDATE invoices
  SET 
    total_amount = calculated_total_amount,
    final_amount = calculated_total_amount + invoice_tax_amount - invoice_discount_amount,
    updated_at = NOW()
  WHERE invoices.id = invoice_id_to_update;
  
  RETURN CASE TG_OP
    WHEN 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS update_invoice_totals_trigger ON invoice_items;
CREATE TRIGGER update_invoice_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_totals();

-- Update the create_receivables_on_invoice_finalization function to avoid ambiguity
CREATE OR REPLACE FUNCTION create_receivables_on_invoice_finalization()
RETURNS TRIGGER AS $$
DECLARE
  item_record RECORD;
  project_rate NUMERIC(10,2);
  project_rate_type TEXT;
BEGIN
  -- Only create receivables when invoice status changes to 'sent' (finalized)
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'sent' THEN
    
    -- Get project rate information
    SELECT p.hourly_rate, p.rate_type INTO project_rate, project_rate_type
    FROM projects p
    WHERE p.id = NEW.project_id;
    
    -- Create receivables for each task in this invoice
    FOR item_record IN 
      SELECT ii.task_id, ii.hours_billed, ii.rate, ii.amount
      FROM invoice_items ii
      WHERE ii.invoice_id = NEW.id
    LOOP
      -- Insert receivable record for each task
      INSERT INTO receivables (
        task_id,
        project_id,
        amount,
        hours_billed,
        rate_used,
        status
      ) VALUES (
        item_record.task_id,
        NEW.project_id,
        item_record.amount,
        item_record.hours_billed,
        item_record.rate,
        'open'
      )
      ON CONFLICT (task_id) DO UPDATE SET
        amount = item_record.amount,
        hours_billed = item_record.hours_billed,
        rate_used = item_record.rate,
        status = 'open';
      
      -- Update task invoice status to 'invoiced'
      UPDATE tasks 
      SET invoice_status = 'invoiced'
      WHERE tasks.id = item_record.task_id;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists for receivable creation on invoice finalization
DROP TRIGGER IF EXISTS create_receivables_on_invoice_finalization_trigger ON invoices;
CREATE TRIGGER create_receivables_on_invoice_finalization_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_receivables_on_invoice_finalization();

-- Update the task invoice status function with proper table qualification
CREATE OR REPLACE FUNCTION update_task_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update task invoice status based on invoice status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE tasks 
    SET invoice_status = CASE NEW.status
      WHEN 'paid' THEN 'paid'
      WHEN 'sent' THEN 'invoiced'
      WHEN 'overdue' THEN 'invoiced'
      WHEN 'draft' THEN 'created'
      WHEN 'cancelled' THEN 'not_invoiced'
      ELSE 'not_invoiced'
    END
    WHERE tasks.id IN (
      SELECT ii.task_id 
      FROM invoice_items ii
      WHERE ii.invoice_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists for task invoice status updates
DROP TRIGGER IF EXISTS update_task_invoice_status_trigger ON invoices;
CREATE TRIGGER update_task_invoice_status_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_task_invoice_status();