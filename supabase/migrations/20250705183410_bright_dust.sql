/*
  # Update API Key Permissions for Task Updates

  1. New Permissions
    - Add write:tasks permission for task updates
    - Add update:tasks permission for task status updates
  
  2. Security
    - Maintain existing RLS policies
    - Ensure only authorized API keys can update tasks
*/

-- Add new permissions to existing API keys that should have write access
UPDATE api_keys 
SET permissions = array_append(permissions, 'write:tasks')
WHERE 'read:tasks' = ANY(permissions) 
  AND NOT ('write:tasks' = ANY(permissions))
  AND is_active = true;

-- Also add update:tasks permission
UPDATE api_keys 
SET permissions = array_append(permissions, 'update:tasks')
WHERE 'read:tasks' = ANY(permissions) 
  AND NOT ('update:tasks' = ANY(permissions))
  AND is_active = true;

-- Verify the permissions update
SELECT 
  id,
  name,
  permissions,
  is_active,
  'UPDATED_PERMISSIONS' as status
FROM api_keys 
WHERE is_active = true
ORDER BY created_at DESC;