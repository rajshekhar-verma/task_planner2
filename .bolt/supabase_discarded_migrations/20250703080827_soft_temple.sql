/*
  # Add ticket_number column to tasks table

  1. Changes
    - Add `ticket_number` column to `tasks` table
    - Column is nullable text type to store ticket identifiers like "TASK-123"
    - Add index for better query performance on ticket numbers

  2. Security
    - No RLS changes needed as existing policies will apply to the new column
*/

-- Add ticket_number column to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'ticket_number'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ticket_number text;
  END IF;
END $$;

-- Add index for ticket_number for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_ticket_number ON tasks(ticket_number);