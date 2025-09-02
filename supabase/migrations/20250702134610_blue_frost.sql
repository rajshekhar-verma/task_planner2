-- First, clean up any orphaned data that would violate foreign key constraints

-- Clean up project_users table - remove entries with non-existent project_id
DELETE FROM project_users
WHERE project_id NOT IN (SELECT id FROM projects);

-- Clean up tasks table - remove entries with non-existent project_id
DELETE FROM tasks
WHERE project_id NOT IN (SELECT id FROM projects);

-- Clean up receivables table - remove entries with non-existent task_id or project_id
DELETE FROM receivables
WHERE task_id NOT IN (SELECT id FROM tasks)
   OR project_id NOT IN (SELECT id FROM projects);

-- Clean up invoice_items table - remove entries with non-existent task_id
DELETE FROM invoice_items
WHERE task_id NOT IN (SELECT id FROM tasks);

-- Clean up invoices table - remove entries with non-existent project_id
DELETE FROM invoices
WHERE project_id NOT IN (SELECT id FROM projects);

-- Clean up task_attachments table - remove entries with non-existent task_id
DELETE FROM task_attachments
WHERE task_id NOT IN (SELECT id FROM tasks);

-- Now add the foreign key constraints

-- Add foreign key from receivables.task_id to tasks.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_receivables_task'
    AND table_name = 'receivables'
  ) THEN
    ALTER TABLE receivables ADD CONSTRAINT fk_receivables_task 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from receivables.project_id to projects.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_receivables_project'
    AND table_name = 'receivables'
  ) THEN
    ALTER TABLE receivables ADD CONSTRAINT fk_receivables_project 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from invoices.project_id to projects.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_invoices_project'
    AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT fk_invoices_project 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from invoice_items.task_id to tasks.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_invoice_items_task'
    AND table_name = 'invoice_items'
  ) THEN
    ALTER TABLE invoice_items ADD CONSTRAINT fk_invoice_items_task 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from tasks.project_id to projects.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tasks_project'
    AND table_name = 'tasks'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT fk_tasks_project 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from project_users.project_id to projects.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_project_users_project'
    AND table_name = 'project_users'
  ) THEN
    ALTER TABLE project_users ADD CONSTRAINT fk_project_users_project 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from task_attachments.task_id to tasks.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_task_attachments_task'
    AND table_name = 'task_attachments'
  ) THEN
    ALTER TABLE task_attachments ADD CONSTRAINT fk_task_attachments_task 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Note: We're skipping the user-related foreign keys since they might be causing issues
-- with the current schema structure. We'll handle those in a separate migration if needed.