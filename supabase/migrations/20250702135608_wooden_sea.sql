/*
  # Update Task Status Options

  1. Changes
    - Update the status check constraint in tasks table to include 'hold' and 'archived'
    - Add migration to support the new task statuses
*/

-- Update the status check constraint in tasks table
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('todo', 'in_progress', 'review', 'completed', 'hold', 'archived'));

-- Add completed_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add last_progress_update column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'last_progress_update'
  ) THEN
    ALTER TABLE tasks ADD COLUMN last_progress_update TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create function to update task progress on status change
CREATE OR REPLACE FUNCTION update_task_progress_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set progress based on status changes
  IF NEW.status != OLD.status THEN
    CASE NEW.status
      WHEN 'todo' THEN NEW.progress_percentage = 0;
      WHEN 'in_progress' THEN NEW.progress_percentage = GREATEST(NEW.progress_percentage, 30);
      WHEN 'review' THEN NEW.progress_percentage = GREATEST(NEW.progress_percentage, 80);
      WHEN 'completed' THEN 
        NEW.progress_percentage = 100;
        NEW.completed_at = COALESCE(NEW.completed_at, now());
        -- If estimated hours exist and hours_worked is 0, use estimated hours
        IF NEW.estimated_hours IS NOT NULL AND NEW.estimated_hours > 0 AND (NEW.hours_worked IS NULL OR NEW.hours_worked = 0) THEN
          NEW.hours_worked = NEW.estimated_hours;
        END IF;
      -- For hold, keep current progress
    END CASE;
    
    NEW.last_progress_update = now();
  END IF;
  
  -- Update progress timestamp when progress changes
  IF NEW.progress_percentage != OLD.progress_percentage THEN
    NEW.last_progress_update = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for progress updates
DROP TRIGGER IF EXISTS update_task_progress_trigger ON tasks;
CREATE TRIGGER update_task_progress_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_progress_on_status_change();

-- Create function to handle project status changes
CREATE OR REPLACE FUNCTION handle_project_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When project becomes on_hold, set all in_progress tasks to hold
  IF NEW.status = 'on_hold' AND (OLD.status IS NULL OR OLD.status != 'on_hold') THEN
    UPDATE tasks
    SET status = 'hold', updated_at = now()
    WHERE project_id = NEW.id AND status = 'in_progress';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for project status changes
DROP TRIGGER IF EXISTS handle_project_status_change_trigger ON projects;
CREATE TRIGGER handle_project_status_change_trigger
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION handle_project_status_change();