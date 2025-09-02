-- Fix API Key Hash in Database
-- Run this in your Supabase SQL Editor

-- First, check what API keys exist
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

-- The correct hash for 'tmp_QZ09tcj8g9k5Vf5TQ3vxhLUJWs48Rt2y' is:
-- 4a44dc15364204a80fe80e9039455cc1608281820fe2b24f1e5233ade6af1dd5

-- Update the API key with the correct hash
UPDATE api_keys 
SET key_hash = '4a44dc15364204a80fe80e9039455cc1608281820fe2b24f1e5233ade6af1dd5'
WHERE key_hash = '3cfb0362eb180d5b6c48ad04091a64647630a6565fcdf2e23f53eb19fc47e07c'
  AND is_active = true;

-- Ensure the key is active and not expired
UPDATE api_keys 
SET is_active = true, expires_at = NULL
WHERE key_hash = '4a44dc15364204a80fe80e9039455cc1608281820fe2b24f1e5233ade6af1dd5';

-- Verify the update
SELECT 
  id,
  name,
  key_hash,
  is_active,
  expires_at,
  'UPDATED' as status
FROM api_keys 
WHERE key_hash = '4a44dc15364204a80fe80e9039455cc1608281820fe2b24f1e5233ade6af1dd5';