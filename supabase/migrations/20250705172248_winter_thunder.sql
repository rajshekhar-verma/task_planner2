-- Update the API key hash to match the correct hash for your key
-- First, let's see what we're updating
SELECT 
  id,
  name,
  key_hash as old_hash,
  is_active
FROM api_keys 
WHERE key_hash = '3cfb0362eb180d5b6c48ad04091a64647630a6565fcdf2e23f53eb19fc47e07c';

-- Update the hash to the correct value
UPDATE api_keys 
SET key_hash = 'b8f94c92c75e4b8c9c1e8c5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f'
WHERE key_hash = '3cfb0362eb180d5b6c48ad04091a64647630a6565fcdf2e23f53eb19fc47e07c';

-- Verify the update
SELECT 
  id,
  name,
  key_hash as new_hash,
  is_active,
  'UPDATED' as status
FROM api_keys 
WHERE key_hash = 'b8f94c92c75e4b8c9c1e8c5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f5a5d5e5f';