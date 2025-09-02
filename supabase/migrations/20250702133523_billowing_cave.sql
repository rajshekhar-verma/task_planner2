-- This migration works with the existing database schema

-- First, let's ensure we have the basic structure that matches our app expectations

-- Check if we need to add any missing columns to existing tables
DO $$
BEGIN
  -- Add missing columns to projects table if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN start_date DATE DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN end_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'priority'
  ) THEN
    ALTER TABLE projects ADD COLUMN priority TEXT DEFAULT 'medium';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'status'
  ) THEN
    ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active';
  END IF;

  -- Add missing columns to tasks table if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE tasks ADD COLUMN due_date DATE;
  END IF;
END $$;

-- Create a view that maps the existing schema to what our app expects
CREATE OR REPLACE VIEW app_users AS
SELECT 
  id,
  email,
  full_name,
  role,
  created_at,
  updated_at
FROM users;

-- Create a function to get user profile by auth.uid()
CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  updated_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.created_at,
    u.updated_at
  FROM users u
  WHERE u.id = auth.uid();
END;
$$;

-- Create a function to ensure user profile exists
CREATE OR REPLACE FUNCTION ensure_user_profile_exists()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_id uuid;
  user_email text;
  user_name text;
BEGIN
  -- Check if profile exists
  SELECT id INTO profile_id
  FROM users
  WHERE id = auth.uid();
  
  IF profile_id IS NOT NULL THEN
    RETURN profile_id;
  END IF;
  
  -- Get user info from auth.users
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
  INTO user_email, user_name
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Create profile if it doesn't exist
  INSERT INTO users (id, email, full_name, role)
  VALUES (auth.uid(), user_email, user_name, 'user')
  RETURNING id INTO profile_id;
  
  RETURN profile_id;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_user_profile_exists() TO authenticated;
GRANT SELECT ON app_users TO authenticated;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON tasks(owner_id);

-- Create a function to fix any existing users without profiles
CREATE OR REPLACE FUNCTION fix_users_without_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
BEGIN
  FOR user_record IN 
    SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.email) as full_name
    FROM auth.users u
    LEFT JOIN users p ON u.id = p.id
    WHERE p.id IS NULL
  LOOP
    INSERT INTO users (id, email, full_name, role)
    VALUES (user_record.id, user_record.email, user_record.full_name, 'user')
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$;

-- Run the fix function
SELECT fix_users_without_profiles();

-- Clean up the fix function
DROP FUNCTION fix_users_without_profiles();