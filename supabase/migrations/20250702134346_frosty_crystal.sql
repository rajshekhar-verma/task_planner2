-- Add new columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hours_worked NUMERIC(10,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'not_invoiced';

-- Add rate information to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2) DEFAULT 50.00;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fixed_rate NUMERIC(10,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rate_type TEXT DEFAULT 'hourly';

-- Create receivables table
CREATE TABLE IF NOT EXISTS receivables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  hours_billed NUMERIC(10,2) NOT NULL DEFAULT 0,
  rate_used NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Create revenue records table
CREATE TABLE IF NOT EXISTS revenue_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receivable_id UUID NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  final_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  hours_billed NUMERIC(10,2) NOT NULL DEFAULT 0,
  rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Create policies for receivables
CREATE POLICY "Users can read all receivables" ON receivables
  FOR SELECT USING (true);

CREATE POLICY "Users can create receivables" ON receivables
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update receivables" ON receivables
  FOR UPDATE USING (true);

-- Create policies for revenue_records
CREATE POLICY "Users can read all revenue records" ON revenue_records
  FOR SELECT USING (true);

CREATE POLICY "Users can create revenue records" ON revenue_records
  FOR INSERT WITH CHECK (true);

-- Create policies for invoices
CREATE POLICY "Users can read all invoices" ON invoices
  FOR SELECT USING (true);

CREATE POLICY "Users can create invoices" ON invoices
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update invoices" ON invoices
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete invoices" ON invoices
  FOR DELETE USING (true);

-- Create policies for invoice_items
CREATE POLICY "Users can read all invoice items" ON invoice_items
  FOR SELECT USING (true);

CREATE POLICY "Users can create invoice items" ON invoice_items
  FOR INSERT WITH CHECK (true);

-- Create function to create receivable when task is completed
CREATE OR REPLACE FUNCTION create_receivable_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create receivable if task status changed to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get project details for rate calculation
    INSERT INTO receivables (task_id, project_id, amount, hours_billed, rate_used)
    SELECT 
      NEW.id,
      NEW.project_id,
      CASE 
        WHEN p.rate_type = 'hourly' THEN NEW.hours_worked * p.hourly_rate
        WHEN p.rate_type = 'fixed' AND p.fixed_rate IS NOT NULL THEN 
          p.fixed_rate * (NEW.progress_percentage / 100.0)
        ELSE 0
      END as amount,
      NEW.hours_worked,
      CASE 
        WHEN p.rate_type = 'hourly' THEN p.hourly_rate
        WHEN p.rate_type = 'fixed' AND p.fixed_rate IS NOT NULL THEN p.fixed_rate
        ELSE 0
      END as rate_used
    FROM projects p
    WHERE p.id = NEW.project_id
    ON CONFLICT (task_id) DO UPDATE SET
      amount = EXCLUDED.amount,
      hours_billed = EXCLUDED.hours_billed,
      rate_used = EXCLUDED.rate_used;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for receivable creation
DROP TRIGGER IF EXISTS create_receivable_trigger ON tasks;
CREATE TRIGGER create_receivable_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION create_receivable_on_completion();

-- Function to update invoice totals
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the invoice totals when items are added/updated/deleted
  UPDATE invoices
  SET 
    total_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM invoice_items
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ),
    final_amount = (
      SELECT COALESCE(SUM(amount), 0) + COALESCE(tax_amount, 0) - COALESCE(discount_amount, 0)
      FROM invoice_items
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for invoice totals
DROP TRIGGER IF EXISTS update_invoice_totals_trigger ON invoice_items;
CREATE TRIGGER update_invoice_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_totals();

-- Function to update task invoice status
CREATE OR REPLACE FUNCTION update_task_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When invoice status changes to 'sent', update all related tasks
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    -- Update task invoice status
    UPDATE tasks
    SET invoice_status = 'invoiced'
    WHERE id IN (
      SELECT task_id
      FROM invoice_items
      WHERE invoice_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task invoice status
DROP TRIGGER IF EXISTS update_task_invoice_status_trigger ON invoices;
CREATE TRIGGER update_task_invoice_status_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_task_invoice_status();

-- Check if the trigger already exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_invoices_updated_at' 
    AND tgrelid = 'invoices'::regclass
  ) THEN
    -- Add updated_at trigger for invoices
    CREATE TRIGGER update_invoices_updated_at
      BEFORE UPDATE ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_receivables_project_id ON receivables(project_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_created_at ON receivables(created_at);
CREATE INDEX IF NOT EXISTS idx_revenue_records_receivable_id ON revenue_records(receivable_id);
CREATE INDEX IF NOT EXISTS idx_revenue_records_recorded_at ON revenue_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_task_id ON invoice_items(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_invoice_status ON tasks(invoice_status);