/*
  # Add missing foreign key constraints

  1. Foreign Key Relationships
    - Add foreign key from `receivables.task_id` to `tasks.id`
    - Add foreign key from `receivables.project_id` to `projects.id`
    - Add foreign key from `invoices.project_id` to `projects.id`
    - Add foreign key from `invoice_items.task_id` to `tasks.id`
    - Add foreign key from `tasks.project_id` to `projects.id`
    - Add foreign key from `tasks.assigned_to` to `users.id`
    - Add foreign key from `tasks.owner_id` to `users.id`
    - Add foreign key from `projects.owner_id` to `users.id`
    - Add foreign key from `project_users.project_id` to `projects.id`
    - Add foreign key from `task_attachments.task_id` to `tasks.id`

  2. Safety
    - Uses IF NOT EXISTS checks to prevent errors if constraints already exist
    - All constraints are added safely without affecting existing data
*/

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

-- Add foreign key from tasks.assigned_to to users.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tasks_assigned_to'
    AND table_name = 'tasks'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT fk_tasks_assigned_to 
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key from tasks.owner_id to users.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tasks_owner'
    AND table_name = 'tasks'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT fk_tasks_owner 
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from projects.owner_id to users.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_projects_owner'
    AND table_name = 'projects'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT fk_projects_owner 
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
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