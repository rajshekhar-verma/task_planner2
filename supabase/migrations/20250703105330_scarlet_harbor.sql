/*
  # Fix Invoice Workflow Logic

  1. Updates
    - Update task invoice_status enum to include 'created' status
    - Ensure proper workflow: not_invoiced -> created -> invoiced -> paid

  2. Changes
    - Tasks start with 'not_invoiced' when completed
    - When invoice is created (draft), tasks become 'created'
    - When invoice is finalized (sent), tasks become 'invoiced' and receivables are created
    - When invoice is paid, tasks become 'paid'
*/

-- Update the invoice_status values to include 'created'
-- First, let's see what constraint exists
DO $$
BEGIN
  -- We need to handle the invoice_status properly
  -- Since it's not an enum in the current schema, we can just update the values
  
  -- Reset any existing invoice statuses to follow the new workflow
  UPDATE tasks 
  SET invoice_status = 'not_invoiced'
  WHERE status = 'completed' 
    AND (invoice_status IS NULL OR invoice_status NOT IN ('not_invoiced', 'created', 'invoiced', 'paid'));
    
  -- Update tasks that are in draft invoices to 'created'
  UPDATE tasks 
  SET invoice_status = 'created'
  WHERE id IN (
    SELECT DISTINCT ii.task_id 
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    WHERE i.status = 'draft'
  );
  
  -- Update tasks that are in sent/overdue invoices to 'invoiced'
  UPDATE tasks 
  SET invoice_status = 'invoiced'
  WHERE id IN (
    SELECT DISTINCT ii.task_id 
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    WHERE i.status IN ('sent', 'overdue')
  );
  
  -- Update tasks that are in paid invoices to 'paid'
  UPDATE tasks 
  SET invoice_status = 'paid'
  WHERE id IN (
    SELECT DISTINCT ii.task_id 
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    WHERE i.status = 'paid'
  );
END $$;

-- Update the task invoice status function to handle the new 'created' status
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
      WHEN 'draft' THEN 'created'  -- Draft invoices mark tasks as 'created'
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

-- Clean up any orphaned receivables (those without corresponding sent/paid invoices)
DELETE FROM receivables 
WHERE task_id IN (
  SELECT t.id 
  FROM tasks t 
  WHERE t.invoice_status IN ('not_invoiced', 'created')
);

-- Add comment to document the new workflow
COMMENT ON COLUMN tasks.invoice_status IS 'Invoice status: not_invoiced -> created (draft invoice) -> invoiced (sent invoice) -> paid';