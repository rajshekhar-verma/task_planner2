-- Add INR conversion rule columns to projects table
DO $$
BEGIN
  -- Add inr_conversion_rule column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'inr_conversion_rule'
  ) THEN
    ALTER TABLE projects ADD COLUMN inr_conversion_rule TEXT;
    COMMENT ON COLUMN projects.inr_conversion_rule IS 'Custom formula for USD to INR conversion';
  END IF;

  -- Add inr_conversion_factor column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'inr_conversion_factor'
  ) THEN
    ALTER TABLE projects ADD COLUMN inr_conversion_factor NUMERIC(10,4) DEFAULT 1;
    COMMENT ON COLUMN projects.inr_conversion_factor IS 'Multiplier for standard USD to INR conversion rate';
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_inr_conversion_factor ON projects(inr_conversion_factor);