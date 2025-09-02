/*
  # Create API Management Tables

  1. New Tables
    - `api_keys` - Store API keys for third-party access
    - `api_usage_logs` - Log API usage for monitoring
    - `api_rate_limits` - Configure rate limits per API key

  2. Security
    - Enable RLS on all tables
    - Add policies for superusers and key owners
    - Create indexes for performance

  3. Functions
    - Add trigger for updated_at timestamp
*/

-- Create API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text UNIQUE NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  rate_limit integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used timestamptz,
  expires_at timestamptz
);

-- Create API Usage Logs table
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  ip_address text NOT NULL,
  user_agent text,
  response_status integer NOT NULL,
  response_time_ms integer NOT NULL,
  request_size_bytes integer,
  response_size_bytes integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Create API Rate Limits table
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint_pattern text NOT NULL,
  requests_per_minute integer NOT NULL DEFAULT 60,
  requests_per_hour integer NOT NULL DEFAULT 1000,
  requests_per_day integer NOT NULL DEFAULT 10000,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_key_id ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON api_usage_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key_id ON api_rate_limits(api_key_id);

-- Drop existing policies if they exist and recreate them
DO $$
BEGIN
  -- Drop existing policies for api_keys
  DROP POLICY IF EXISTS "Superusers can manage API keys" ON api_keys;
  DROP POLICY IF EXISTS "Users can read own API keys" ON api_keys;
  
  -- Drop existing policies for api_usage_logs
  DROP POLICY IF EXISTS "Superusers can read all API logs" ON api_usage_logs;
  DROP POLICY IF EXISTS "Users can read logs for their API keys" ON api_usage_logs;
  
  -- Drop existing policies for api_rate_limits
  DROP POLICY IF EXISTS "Superusers can manage rate limits" ON api_rate_limits;
END $$;

-- RLS Policies for API Keys
CREATE POLICY "Superusers can manage API keys"
  ON api_keys
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'superuser'
    )
  );

CREATE POLICY "Users can read own API keys"
  ON api_keys
  FOR SELECT
  TO authenticated
  USING (
    created_by = (
      SELECT profiles.id FROM profiles 
      WHERE profiles.user_id = auth.uid()
    )
  );

-- RLS Policies for API Usage Logs
CREATE POLICY "Superusers can read all API logs"
  ON api_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'superuser'
    )
  );

CREATE POLICY "Users can read logs for their API keys"
  ON api_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_keys ak
      JOIN profiles p ON ak.created_by = p.id
      WHERE ak.id = api_usage_logs.api_key_id
      AND p.user_id = auth.uid()
    )
  );

-- RLS Policies for API Rate Limits
CREATE POLICY "Superusers can manage rate limits"
  ON api_rate_limits
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'superuser'
    )
  );

-- Create trigger for updating updated_at (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_api_keys_updated_at' 
    AND tgrelid = 'api_keys'::regclass
  ) THEN
    CREATE TRIGGER update_api_keys_updated_at
      BEFORE UPDATE ON api_keys
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;