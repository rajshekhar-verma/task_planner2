/*
  # Fix Invoice Cancellation Task Status Update

  1. Database Changes
    - Update handle_invoice_cancellation function to properly update task invoice_status
    - Ensure all tasks in cancelled invoice get their invoice_status updated to 'cancelled'
    - Add proper error handling and logging

  2. Security
    - Maintain existing RLS policies
    - Preserve audit trail through revenue records
*/

-- Update the handle_invoice_cancellation function to properly update task invoice_status
CREATE OR REPLACE FUNCTION handle_invoice_cancellation()
RETURNS TRIGGER AS $$
DECLARE
  task_record RECORD;
  updated_tasks_count INTEGER := 0;
BEGIN
  -- Only process when invoice status changes to 'cancelled'
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    
    -- Debug: Log the cancellation attempt
    RAISE NOTICE 'Processing invoice cancellation for invoice ID: %', NEW.id;
    
    -- Update all tasks in this invoice to cancelled status
    FOR task_record IN 
      SELECT t.id, t.status, t.invoice_status
      FROM tasks t
      INNER JOIN invoice_items ii ON t.id = ii.task_id
      WHERE ii.invoice_id = NEW.id
    LOOP
      -- Update task invoice status to cancelled for all tasks in the invoice
      UPDATE tasks 
      SET invoice_status = 'cancelled'
      WHERE id = task_record.id;
      
      updated_tasks_count := updated_tasks_count + 1;
      
      RAISE NOTICE 'Updated task % (status: %, old invoice_status: %) to invoice_status: cancelled', 
        task_record.id, task_record.status, task_record.invoice_status;
    END LOOP;
    
    -- Mark all receivables for this invoice as cancelled
    UPDATE receivables
    SET 
      status = 'cancelled',
      notes = CASE 
        WHEN receivables.notes IS NULL THEN 'Cancelled due to invoice cancellation on ' || CURRENT_DATE
        ELSE receivables.notes || E'\n\nCancelled due to invoice cancellation on ' || CURRENT_DATE
      END
    WHERE receivables.task_id IN (
      SELECT ii.task_id 
      FROM invoice_items ii
      WHERE ii.invoice_id = NEW.id
    );
    
    -- Update invoice notes to include cancellation reason if provided
    IF NEW.notes IS NOT NULL AND NEW.notes != OLD.notes THEN
      -- Notes were updated, likely with cancellation reason
      UPDATE invoices 
      SET notes = CASE 
        WHEN OLD.notes IS NULL THEN 'CANCELLED: ' || NEW.notes
        ELSE OLD.notes || E'\n\nCANCELLED: ' || NEW.notes
      END
      WHERE id = NEW.id;
    END IF;
    
    RAISE NOTICE 'Invoice cancellation completed. Updated % tasks and their receivables.', updated_tasks_count;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS handle_invoice_cancellation_trigger ON invoices;
CREATE TRIGGER handle_invoice_cancellation_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION handle_invoice_cancellation();

-- Update any existing cancelled invoices to ensure task statuses are correct
DO $$
DECLARE
  cancelled_invoice RECORD;
  task_record RECORD;
BEGIN
  -- Find all cancelled invoices and fix their task statuses
  FOR cancelled_invoice IN 
    SELECT id FROM invoices WHERE status = 'cancelled'
  LOOP
    -- Update all tasks in this cancelled invoice
    FOR task_record IN 
      SELECT t.id
      FROM tasks t
      INNER JOIN invoice_items ii ON t.id = ii.task_id
      WHERE ii.invoice_id = cancelled_invoice.id
        AND t.invoice_status != 'cancelled'
    LOOP
      UPDATE tasks 
      SET invoice_status = 'cancelled'
      WHERE id = task_record.id;
      
      RAISE NOTICE 'Fixed task % invoice_status to cancelled for cancelled invoice %', 
        task_record.id, cancelled_invoice.id;
    END LOOP;
  END LOOP;
END $$;

-- Add index for better performance on invoice cancellation queries
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_tasks_invoice_status ON tasks(invoice_status);

-- Add comment to document the updated function
COMMENT ON FUNCTION handle_invoice_cancellation() IS 'Handles invoice cancellation by updating ALL task invoice_status to cancelled and marking receivables as cancelled while preserving revenue records';