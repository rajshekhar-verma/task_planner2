/*
  # Add created on and completed on fields to tasks

  1. New Columns
    - `created_on` (date) - Date when task was created (editable)
    - `completed_on` (date) - Date when task was completed (editable)

  2. Functions
    - Update trigger to automatically set completed_on when status changes to completed
    - Set created_on to current date for new tasks

  3. Indexes
    - Add indexes for better performance on date queries
*/

-- Add created_on and completed_on columns to tasks table
DO $$
BEGIN
  -- Add created_on column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'created_on'
  ) THEN
    ALTER TABLE tasks ADD COLUMN created_on DATE DEFAULT CURRENT_DATE;
  END IF;

  -- Add completed_on column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'completed_on'
  ) THEN
    ALTER TABLE tasks ADD COLUMN completed_on DATE;
  END IF;
END $$;

-- Update existing tasks to set created_on from created_at if not already set
UPDATE tasks 
SET created_on = DATE(created_at) 
WHERE created_on IS NULL;

-- Update existing completed tasks to set completed_on from updated_at if not already set
UPDATE tasks 
SET completed_on = DATE(updated_at) 
WHERE status = 'completed' AND completed_on IS NULL;

-- Create function to automatically set completed_on when task status changes to completed
CREATE OR REPLACE FUNCTION update_task_completion_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing to completed and completed_on is not already set
  IF NEW.status = 'completed' AND (OLD.status != 'completed' OR OLD.status IS NULL) THEN
    -- Only set completed_on if it's not already set (to preserve manual edits)
    IF NEW.completed_on IS NULL THEN
      NEW.completed_on = CURRENT_DATE;
    END IF;
  END IF;
  
  -- If status is changing from completed to something else, clear completed_on
  IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
    NEW.completed_on = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task completion date
DROP TRIGGER IF EXISTS update_task_completion_date_trigger ON tasks;
CREATE TRIGGER update_task_completion_date_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_completion_date();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_created_on ON tasks(created_on);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_on ON tasks(completed_on);

-- Add comment to document the columns
COMMENT ON COLUMN tasks.created_on IS 'Date when the task was created (editable)';
COMMENT ON COLUMN tasks.completed_on IS 'Date when the task was completed (editable, auto-set when status changes to completed)';