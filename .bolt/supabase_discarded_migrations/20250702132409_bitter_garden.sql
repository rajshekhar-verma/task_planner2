-- This migration works with the existing database schema
-- The database already has profiles, projects, and tasks tables

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
    ALTER TABLE projects ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'status'
  ) THEN
    ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold'));
  END IF;

  -- Add missing columns to tasks table if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE tasks ADD COLUMN due_date DATE;
  END IF;

  -- Ensure tasks table has the right status values
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'status'
  ) THEN
    -- Drop existing constraint if it exists
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
    -- Add new constraint that includes our expected values
    ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
      CHECK (status IN ('initial', 'in_progress', 'testing', 'rework', 'completed', 'hold', 'archived', 'todo', 'review'));
  END IF;

  -- Ensure tasks table has the right priority values
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'priority'
  ) THEN
    -- Drop existing constraint if it exists
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
    -- Add new constraint
    ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check 
      CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;
END $$;

-- Create a view that maps the existing schema to what our app expects
CREATE OR REPLACE VIEW app_users AS
SELECT 
  user_id as id,
  email,
  full_name,
  CASE 
    WHEN role = 'superuser' THEN 'admin'
    WHEN role = 'project_manager' THEN 'manager'
    ELSE 'user'
  END as role,
  created_at,
  updated_at
FROM profiles;

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
    p.id,
    p.email,
    p.full_name,
    CASE 
      WHEN p.role = 'superuser' THEN 'admin'
      WHEN p.role = 'project_manager' THEN 'manager'
      ELSE 'user'
    END as role,
    p.created_at,
    p.updated_at
  FROM profiles p
  WHERE p.user_id = auth.uid();
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
  FROM profiles
  WHERE user_id = auth.uid();
  
  IF profile_id IS NOT NULL THEN
    RETURN profile_id;
  END IF;
  
  -- Get user info from auth.users
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
  INTO user_email, user_name
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Create profile if it doesn't exist
  INSERT INTO profiles (user_id, email, full_name, role)
  VALUES (auth.uid(), user_email, user_name, 'user')
  RETURNING id INTO profile_id;
  
  RETURN profile_id;
END;
$$;

-- Update the handle_new_user function to work with existing schema
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'user'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_user_profile_exists() TO authenticated;
GRANT SELECT ON app_users TO authenticated;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by) WHERE assigned_by IS NOT NULL;

-- Ensure RLS is enabled (it should already be)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Add any missing RLS policies that our app might need
DO $$
BEGIN
  -- Policy for profiles to allow users to read their own profile
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can read own profile via auth'
  ) THEN
    CREATE POLICY "Users can read own profile via auth" ON profiles
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  -- Policy for projects to allow reading all projects
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'projects' AND policyname = 'Users can read all projects via auth'
  ) THEN
    CREATE POLICY "Users can read all projects via auth" ON projects
      FOR SELECT USING (true);
  END IF;

  -- Policy for tasks to allow reading all tasks
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tasks' AND policyname = 'Users can read all tasks via auth'
  ) THEN
    CREATE POLICY "Users can read all tasks via auth" ON tasks
      FOR SELECT USING (true);
  END IF;
END $$;

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
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE p.id IS NULL
  LOOP
    INSERT INTO profiles (user_id, email, full_name, role)
    VALUES (user_record.id, user_record.email, user_record.full_name, 'user')
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Run the fix function
SELECT fix_users_without_profiles();

-- Clean up the fix function
DROP FUNCTION fix_users_without_profiles();