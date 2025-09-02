-- Check what API keys exist in the database
SELECT 
  id,
  name,
  key_hash,
  is_active,
  expires_at,
  permissions,
  created_at
FROM api_keys 
WHERE is_active = true
ORDER BY created_at DESC;

-- Check if our expected hash exists
SELECT 
  id,
  name,
  'FOUND' as status
FROM api_keys 
WHERE key_hash = 'b8f94c92c75e4b8c9c1e8c5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f';

-- Check what hash exists for the key we're looking for
SELECT 
  id,
  name,
  key_hash,
  'EXISTING' as status
FROM api_keys 
WHERE key_hash = '3cfb0362eb180d5b6c48ad04091a64647630a6565fcdf2e23f53eb19fc47e07c';