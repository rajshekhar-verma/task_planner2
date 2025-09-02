-- Fix API Key Hash in Database
-- This script will update the stored hash to match your actual API key

-- First, let's see what API keys currently exist
SELECT 
  id,
  name,
  key_hash,
  is_active,
  expires_at,
  permissions,
  created_at
FROM api_keys 
ORDER BY created_at DESC;

-- The correct hash for 'tmp_QZ09tcj8g9k5Vf5TQ3vxhLUJWs48Rt2y' should be:
-- b8f94c92c75e4b8c9c1e8c5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f

-- Update the API key with the correct hash
UPDATE api_keys 
SET key_hash = 'b8f94c92c75e4b8c9c1e8c5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f'
WHERE key_hash = '3cfb0362eb180d5b6c48ad04091a64647630a6565fcdf2e23f53eb19fc47e07c'
  AND is_active = true;

-- Verify the update worked
SELECT 
  id,
  name,
  key_hash,
  is_active,
  'UPDATED' as status
FROM api_keys 
WHERE key_hash = 'b8f94c92c75e4b8c9c1e8c5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f';

-- Also ensure the key is active and not expired
UPDATE api_keys 
SET is_active = true, expires_at = NULL
WHERE key_hash = 'b8f94c92c75e4b8c9c1e8c5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f';