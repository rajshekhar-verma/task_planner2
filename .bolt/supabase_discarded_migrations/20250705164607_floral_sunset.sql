/*
  # Create API System for Third-Party Access

  1. New Tables
    - `api_keys`
      - `id` (uuid, primary key)
      - `name` (text, API key name/description)
      - `key_hash` (text, hashed API key)
      - `permissions` (text array, permissions granted)
      - `rate_limit` (integer, requests per minute)
      - `is_active` (boolean, whether key is active)
      - `created_by` (uuid, user who created the key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `last_used` (timestamp, when key was last used)
      - `expires_at` (timestamp, optional expiration)

    - `api_usage_logs`
      - `id` (uuid, primary key)
      - `api_key_id` (uuid, foreign key to api_keys)
      - `endpoint` (text, API endpoint accessed)
      - `method` (text, HTTP method)
      - `ip_address` (text, client IP)
      - `user_agent` (text, client user agent)
      - `response_status` (integer, HTTP response status)
      - `response_time_ms` (integer, response time)
      - `request_size_bytes` (integer, request size)
      - `response_size_bytes` (integer, response size)
      - `error_message` (text, error if any)
      - `created_at` (timestamp)

    - `api_rate_limits`
      - `id` (uuid, primary key)
      - `api_key_id` (uuid, foreign key to api_keys)
      - `endpoint_pattern` (text, endpoint pattern for rate limiting)
      - `requests_per_minute` (integer)
      - `requests_per_hour` (integer)
      - `requests_per_day` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for API key management
    - Add indexes for performance
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

-- Create trigger for updating updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();