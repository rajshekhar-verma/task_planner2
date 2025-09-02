/*
  # Fix CASE statement functions

  1. Database Functions
    - Update `update_task_progress_on_status_change` function to include ELSE clause
    - Update `update_task_completion_date` function to include ELSE clause
    - Update `create_receivable_on_completion` function to handle all status cases
    - Update `handle_project_status_change` function if needed

  2. Security
    - Maintain existing RLS policies
    - Ensure all CASE statements have proper ELSE clauses

  3. Changes
    - Add missing ELSE clauses to prevent "case not found" errors
    - Handle all possible status values including new ones like 'archived'
*/

-- Drop and recreate the update_task_progress_on_status_change function with proper CASE handling
CREATE OR REPLACE FUNCTION update_task_progress_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update progress if it's not explicitly set and status is changing
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.progress_percentage = OLD.progress_percentage THEN
    NEW.progress_percentage := CASE NEW.status
      WHEN 'todo' THEN 0
      WHEN 'in_progress' THEN 30
      WHEN 'review' THEN 80
      WHEN 'completed' THEN 100
      WHEN 'hold' THEN OLD.progress_percentage -- Keep current progress
      WHEN 'archived' THEN OLD.progress_percentage -- Keep current progress
      ELSE OLD.progress_percentage -- Default: keep current progress
    END;
  END IF;
  
  -- Update last_progress_update timestamp
  NEW.last_progress_update := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the update_task_completion_date function with proper CASE handling
CREATE OR REPLACE FUNCTION update_task_completion_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Set completed_at when status changes to completed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'completed' THEN
        NEW.completed_at := NOW();
        -- Set completed_on to today if not already set
        IF NEW.completed_on IS NULL THEN
          NEW.completed_on := CURRENT_DATE;
        END IF;
      ELSE
        -- If moving away from completed, clear completed_at but keep completed_on
        IF OLD.status = 'completed' THEN
          NEW.completed_at := NULL;
        END IF;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the create_receivable_on_completion function with proper CASE handling
CREATE OR REPLACE FUNCTION create_receivable_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  project_rate NUMERIC(10,2);
  project_rate_type TEXT;
  calculated_amount NUMERIC(10,2);
BEGIN
  -- Only create receivable when task moves to completed status
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
    -- Get project rate information
    SELECT hourly_rate, rate_type INTO project_rate, project_rate_type
    FROM projects 
    WHERE id = NEW.project_id;
    
    -- Calculate amount based on rate type
    calculated_amount := CASE project_rate_type
      WHEN 'hourly' THEN COALESCE(NEW.hours_worked, 0) * COALESCE(project_rate, 0)
      WHEN 'fixed' THEN COALESCE(project_rate, 0)
      ELSE 0 -- Default case for unknown rate types
    END;
    
    -- Insert receivable record
    INSERT INTO receivables (
      task_id,
      project_id,
      amount,
      hours_billed,
      rate_used,
      status
    ) VALUES (
      NEW.id,
      NEW.project_id,
      calculated_amount,
      CASE project_rate_type
        WHEN 'hourly' THEN COALESCE(NEW.hours_worked, 0)
        ELSE 0
      END,
      COALESCE(project_rate, 0),
      'open'
    )
    ON CONFLICT (task_id) DO UPDATE SET
      amount = calculated_amount,
      hours_billed = CASE project_rate_type
        WHEN 'hourly' THEN COALESCE(NEW.hours_worked, 0)
        ELSE 0
      END,
      rate_used = COALESCE(project_rate, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the handle_project_status_change function with proper CASE handling
CREATE OR REPLACE FUNCTION handle_project_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle project status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'completed' THEN
        -- Update all incomplete tasks to completed when project is completed
        UPDATE tasks 
        SET status = 'completed', 
            progress_percentage = 100,
            completed_at = NOW(),
            completed_on = CURRENT_DATE
        WHERE project_id = NEW.id 
          AND status NOT IN ('completed', 'archived');
      
      WHEN 'on_hold' THEN
        -- Put all active tasks on hold when project is put on hold
        UPDATE tasks 
        SET status = 'hold'
        WHERE project_id = NEW.id 
          AND status IN ('todo', 'in_progress', 'review');
      
      WHEN 'active' THEN
        -- Resume tasks from hold when project becomes active again
        UPDATE tasks 
        SET status = CASE 
          WHEN status = 'hold' THEN 'todo'
          ELSE status
        END
        WHERE project_id = NEW.id;
      
      ELSE
        -- Default case: do nothing for other status changes
        NULL;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the update_task_invoice_status function with proper CASE handling
CREATE OR REPLACE FUNCTION update_task_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update task invoice status based on invoice status
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE tasks 
    SET invoice_status = CASE NEW.status
      WHEN 'paid' THEN 'invoiced_paid'
      WHEN 'sent' THEN 'invoiced_sent'
      WHEN 'draft' THEN 'invoiced_draft'
      WHEN 'overdue' THEN 'invoiced_overdue'
      WHEN 'cancelled' THEN 'not_invoiced'
      ELSE 'not_invoiced' -- Default case
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

-- Drop and recreate the update_invoice_totals function with proper CASE handling
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  invoice_id_to_update UUID;
  total_amount NUMERIC(10,2);
BEGIN
  -- Determine which invoice to update
  invoice_id_to_update := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.invoice_id
    ELSE NEW.invoice_id
  END;
  
  -- Calculate total amount for the invoice
  SELECT COALESCE(SUM(amount), 0) INTO total_amount
  FROM invoice_items
  WHERE invoice_id = invoice_id_to_update;
  
  -- Update the invoice totals
  UPDATE invoices
  SET 
    total_amount = total_amount,
    final_amount = total_amount + COALESCE(tax_amount, 0) - COALESCE(discount_amount, 0)
  WHERE id = invoice_id_to_update;
  
  RETURN CASE TG_OP
    WHEN 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql;