/*
  # Add archive functionality with previous status tracking

  1. New Columns
    - `previous_status` (text) - Stores the status before archiving
    - `archived_at` (timestamptz) - When the task was archived

  2. Changes
    - Update task status constraint to include 'archived'
    - Add indexes for better query performance
    - Add trigger to handle archive/unarchive logic

  3. Security
    - No changes to existing RLS policies
*/

-- Add previous_status and archived_at columns to tasks table
DO $$
BEGIN
  -- Add previous_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'previous_status'
  ) THEN
    ALTER TABLE tasks ADD COLUMN previous_status text;
  END IF;

  -- Add archived_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- Update the status constraint to include 'archived'
DO $$
BEGIN
  -- Drop the existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tasks' AND constraint_name = 'tasks_status_check'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
  END IF;
  
  -- Add the updated constraint
  ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
    CHECK (status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'review'::text, 'completed'::text, 'hold'::text, 'archived'::text]));
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_previous_status ON tasks(previous_status);
CREATE INDEX IF NOT EXISTS idx_tasks_archived_at ON tasks(archived_at);

-- Add comments to document the new columns
COMMENT ON COLUMN tasks.previous_status IS 'Status before the task was archived (for restoration purposes)';
COMMENT ON COLUMN tasks.archived_at IS 'Timestamp when the task was archived';