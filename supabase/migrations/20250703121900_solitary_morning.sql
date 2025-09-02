/*
  # Fix Invoice Cancellation Flow

  This migration ensures the invoice cancellation flow works correctly:
  1. Custom modal for cancellation reason
  2. Proper database updates for all related tables
  3. Auto refresh after completion

  ## Changes Made:
  1. Update handle_invoice_cancellation function to properly handle all aspects
  2. Ensure task invoice_status updates work correctly
  3. Add proper message handling for cancelled tasks
  4. Ensure receivables are marked as cancelled
  5. Preserve revenue records for audit purposes
*/

-- Update the handle_invoice_cancellation function to follow the exact flow specified
CREATE OR REPLACE FUNCTION handle_invoice_cancellation()
RETURNS TRIGGER AS $$
DECLARE
  task_record RECORD;
  receivable_record RECORD;
  updated_tasks_count INTEGER := 0;
  updated_receivables_count INTEGER := 0;
BEGIN
  -- Only process when invoice status changes to 'cancelled'
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    
    RAISE NOTICE 'Processing invoice cancellation for invoice ID: %', NEW.id;
    
    -- Step 1: Update all tasks in this invoice
    FOR task_record IN 
      SELECT t.id, t.status, t.invoice_status, t.title
      FROM tasks t
      INNER JOIN invoice_items ii ON t.id = ii.task_id
      WHERE ii.invoice_id = NEW.id
    LOOP
      -- Update task invoice status to cancelled for ALL tasks in the invoice
      -- Add message for completed tasks about creating new task for re-invoicing
      UPDATE tasks 
      SET 
        invoice_status = 'cancelled',
        description = CASE 
          WHEN task_record.status = 'completed' THEN 
            tasks.description || E'\n\n[INVOICE CANCELLED] To invoice again, create new task.'
          ELSE 
            tasks.description
        END
      WHERE id = task_record.id;
      
      updated_tasks_count := updated_tasks_count + 1;
      
      RAISE NOTICE 'Updated task % (status: %, title: %) to invoice_status: cancelled', 
        task_record.id, task_record.status, task_record.title;
    END LOOP;
    
    -- Step 2: Mark all receivables for this invoice as cancelled
    FOR receivable_record IN
      SELECT r.id, r.amount, r.status
      FROM receivables r
      INNER JOIN invoice_items ii ON r.task_id = ii.task_id
      WHERE ii.invoice_id = NEW.id
    LOOP
      UPDATE receivables
      SET 
        status = 'cancelled',
        notes = CASE 
          WHEN receivables.notes IS NULL THEN 
            'Cancelled due to invoice cancellation on ' || CURRENT_DATE || '. Original amount: $' || receivable_record.amount
          ELSE 
            receivables.notes || E'\n\nCancelled due to invoice cancellation on ' || CURRENT_DATE || '. Original amount: $' || receivable_record.amount
        END
      WHERE id = receivable_record.id;
      
      updated_receivables_count := updated_receivables_count + 1;
      
      RAISE NOTICE 'Updated receivable % (amount: $%) to status: cancelled', 
        receivable_record.id, receivable_record.amount;
    END LOOP;
    
    -- Step 3: Update invoice totals to reflect cancellation (set to 0 for reporting)
    -- Note: We preserve the original amounts in the notes for audit purposes
    UPDATE invoices 
    SET 
      notes = CASE 
        WHEN OLD.notes IS NULL THEN 
          'CANCELLED: ' || COALESCE(NEW.notes, 'No reason provided') || 
          E'\nOriginal amount: $' || OLD.final_amount || 
          E'\nCancelled on: ' || CURRENT_DATE
        ELSE 
          OLD.notes || E'\n\nCANCELLED: ' || COALESCE(NEW.notes, 'No reason provided') || 
          E'\nOriginal amount: $' || OLD.final_amount || 
          E'\nCancelled on: ' || CURRENT_DATE
      END,
      -- Set amounts to 0 for cancelled invoices in reporting
      total_amount = 0,
      final_amount = 0
    WHERE id = NEW.id;
    
    RAISE NOTICE 'Invoice cancellation completed. Updated % tasks and % receivables. Revenue records preserved.', 
      updated_tasks_count, updated_receivables_count;
    
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

-- Update any existing cancelled invoices to ensure consistency
DO $$
DECLARE
  cancelled_invoice RECORD;
  task_record RECORD;
  receivable_record RECORD;
BEGIN
  -- Find all cancelled invoices and fix their related data
  FOR cancelled_invoice IN 
    SELECT id, final_amount FROM invoices WHERE status = 'cancelled'
  LOOP
    RAISE NOTICE 'Fixing cancelled invoice: %', cancelled_invoice.id;
    
    -- Fix task statuses
    FOR task_record IN 
      SELECT t.id, t.status
      FROM tasks t
      INNER JOIN invoice_items ii ON t.id = ii.task_id
      WHERE ii.invoice_id = cancelled_invoice.id
        AND t.invoice_status != 'cancelled'
    LOOP
      UPDATE tasks 
      SET 
        invoice_status = 'cancelled',
        description = CASE 
          WHEN task_record.status = 'completed' THEN 
            tasks.description || E'\n\n[INVOICE CANCELLED] To invoice again, create new task.'
          ELSE 
            tasks.description
        END
      WHERE id = task_record.id;
      
      RAISE NOTICE 'Fixed task % invoice_status to cancelled', task_record.id;
    END LOOP;
    
    -- Fix receivable statuses
    FOR receivable_record IN
      SELECT r.id, r.amount
      FROM receivables r
      INNER JOIN invoice_items ii ON r.task_id = ii.task_id
      WHERE ii.invoice_id = cancelled_invoice.id
        AND r.status != 'cancelled'
    LOOP
      UPDATE receivables
      SET 
        status = 'cancelled',
        notes = CASE 
          WHEN receivables.notes IS NULL THEN 
            'Cancelled due to invoice cancellation. Original amount: $' || receivable_record.amount
          ELSE 
            receivables.notes || E'\n\nCancelled due to invoice cancellation. Original amount: $' || receivable_record.amount
        END
      WHERE id = receivable_record.id;
      
      RAISE NOTICE 'Fixed receivable % status to cancelled', receivable_record.id;
    END LOOP;
    
    -- Fix invoice amounts
    UPDATE invoices 
    SET 
      total_amount = 0,
      final_amount = 0,
      notes = CASE 
        WHEN notes IS NULL THEN 
          'CANCELLED: Invoice cancelled (data migration fix)' || 
          E'\nOriginal amount: $' || cancelled_invoice.final_amount
        WHEN notes NOT LIKE '%CANCELLED:%' THEN
          notes || E'\n\nCANCELLED: Invoice cancelled (data migration fix)' || 
          E'\nOriginal amount: $' || cancelled_invoice.final_amount
        ELSE 
          notes -- Already has cancellation info
      END
    WHERE id = cancelled_invoice.id;
    
  END LOOP;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_tasks_invoice_status ON tasks(invoice_status);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);

-- Add comments to document the updated function
COMMENT ON FUNCTION handle_invoice_cancellation() IS 'Handles invoice cancellation by: 1) Setting invoice totals to 0, 2) Marking receivables as cancelled, 3) Updating task invoice_status to cancelled, 4) Adding message to completed tasks about re-invoicing, 5) Preserving revenue records for audit';