/*
  # Fix Receivables and Invoice Logic

  This migration fixes the logic so that:
  1. When tasks are completed, they become available for invoicing (no receivables created yet)
  2. When tasks are invoiced, receivables are created
  3. When invoices are paid, receivables are marked as paid

  ## Changes Made
  1. Remove automatic receivable creation on task completion
  2. Update invoice creation process to create receivables
  3. Ensure proper flow: Task Completion → Available for Invoice → Invoice Created → Receivables Created → Payment → Receivables Paid
*/

-- Drop the trigger that automatically creates receivables on task completion
DROP TRIGGER IF EXISTS create_receivable_trigger ON tasks;

-- Update the create_receivable_on_completion function to NOT create receivables automatically
CREATE OR REPLACE FUNCTION create_receivable_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- This function now only handles task completion logic without creating receivables
  -- Receivables will be created when tasks are invoiced, not when completed
  
  -- Set completed_at when status changes to completed
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
    NEW.completed_at := NOW();
    -- Set completed_on to today if not already set
    IF NEW.completed_on IS NULL THEN
      NEW.completed_on := CURRENT_DATE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a new function to handle receivable creation when invoices are finalized
CREATE OR REPLACE FUNCTION create_receivables_on_invoice_finalization()
RETURNS TRIGGER AS $$
DECLARE
  item_record RECORD;
  project_rate NUMERIC(10,2);
  project_rate_type TEXT;
  calculated_amount NUMERIC(10,2);
BEGIN
  -- Only create receivables when invoice status changes to 'sent' (finalized)
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'sent' THEN
    
    -- Get project rate information
    SELECT hourly_rate, rate_type INTO project_rate, project_rate_type
    FROM projects 
    WHERE id = NEW.project_id;
    
    -- Create receivables for each task in this invoice
    FOR item_record IN 
      SELECT task_id, hours_billed, rate, amount
      FROM invoice_items 
      WHERE invoice_id = NEW.id
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
      WHERE id = item_record.task_id;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for receivable creation on invoice finalization
DROP TRIGGER IF EXISTS create_receivables_on_invoice_finalization_trigger ON invoices;
CREATE TRIGGER create_receivables_on_invoice_finalization_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_receivables_on_invoice_finalization();

-- Update the task invoice status function to handle proper status transitions
CREATE OR REPLACE FUNCTION update_task_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update task invoice status based on invoice status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE tasks 
    SET invoice_status = CASE NEW.status
      WHEN 'paid' THEN 'paid'
      WHEN 'sent' THEN 'invoiced'
      WHEN 'draft' THEN 'not_invoiced'  -- Draft invoices don't count as invoiced yet
      WHEN 'overdue' THEN 'invoiced'
      WHEN 'cancelled' THEN 'not_invoiced'
      ELSE 'not_invoiced'
    END
    WHERE id IN (
      SELECT task_id 
      FROM invoice_items 
      WHERE invoice_id = NEW.id
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

-- Clean up any existing receivables for tasks that haven't been invoiced yet
-- This removes receivables that were created automatically on task completion
DELETE FROM receivables 
WHERE task_id IN (
  SELECT t.id 
  FROM tasks t 
  WHERE t.invoice_status = 'not_invoiced' OR t.invoice_status IS NULL
);

-- Reset invoice_status for completed tasks that haven't been properly invoiced
UPDATE tasks 
SET invoice_status = 'not_invoiced'
WHERE status = 'completed' 
  AND (invoice_status IS NULL OR invoice_status = 'invoiced')
  AND id NOT IN (
    SELECT DISTINCT task_id 
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    WHERE i.status IN ('sent', 'paid', 'overdue')
  );