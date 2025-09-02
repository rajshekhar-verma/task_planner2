/*
  # Add cancelled status to receivables and update invoice cancellation logic

  1. Schema Updates
    - Add 'cancelled' status to receivables status enum
    - Add 'cancelled' status to task invoice_status
    - Update constraints to include new statuses

  2. Functions
    - Update functions to handle cancelled status properly
    - Add logic for invoice cancellation workflow

  3. Comments
    - Document the cancellation workflow
*/

-- Update receivables status to include 'cancelled'
DO $$
BEGIN
  -- Check if we need to update the receivable_status enum
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receivable_status') THEN
    -- Add 'cancelled' to the enum if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'receivable_status')
      AND enumlabel = 'cancelled'
    ) THEN
      ALTER TYPE receivable_status ADD VALUE 'cancelled';
    END IF;
  END IF;
END $$;

-- Update task invoice_status to include 'cancelled'
-- Since invoice_status is a text field, we just need to document the new value
COMMENT ON COLUMN tasks.invoice_status IS 'Invoice status: not_invoiced -> created (draft invoice) -> invoiced (sent invoice) -> paid -> cancelled (invoice cancelled)';

-- Create function to handle invoice cancellation
CREATE OR REPLACE FUNCTION handle_invoice_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when invoice status changes to 'cancelled'
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    
    -- Update all tasks in this invoice
    UPDATE tasks 
    SET invoice_status = CASE 
      WHEN tasks.status = 'completed' THEN 'cancelled'
      ELSE tasks.invoice_status -- Keep current status for non-completed tasks
    END
    WHERE tasks.id IN (
      SELECT ii.task_id 
      FROM invoice_items ii
      WHERE ii.invoice_id = NEW.id
    );
    
    -- Mark all receivables for this invoice as cancelled
    UPDATE receivables
    SET 
      status = 'cancelled',
      notes = CASE 
        WHEN receivables.notes IS NULL THEN 'Cancelled due to invoice cancellation'
        ELSE receivables.notes || E'\n\nCancelled due to invoice cancellation'
      END
    WHERE receivables.task_id IN (
      SELECT ii.task_id 
      FROM invoice_items ii
      WHERE ii.invoice_id = NEW.id
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoice cancellation
DROP TRIGGER IF EXISTS handle_invoice_cancellation_trigger ON invoices;
CREATE TRIGGER handle_invoice_cancellation_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION handle_invoice_cancellation();

-- Add indexes for better performance on cancelled items
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
CREATE INDEX IF NOT EXISTS idx_tasks_invoice_status ON tasks(invoice_status);

-- Add comments to document the cancellation workflow
COMMENT ON FUNCTION handle_invoice_cancellation() IS 'Handles invoice cancellation by updating task invoice_status and marking receivables as cancelled while preserving revenue records';