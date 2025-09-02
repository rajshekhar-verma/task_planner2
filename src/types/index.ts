export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'user';
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on_hold';
  priority: 'low' | 'medium' | 'high';
  start_date: string;
  end_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  hourly_rate?: number;
  fixed_rate?: number;
  rate_type?: 'hourly' | 'fixed';
  conversion_rule?: string;
  conversion_factor?: number;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'hold' | 'archived';
  priority: 'low' | 'medium' | 'high';
  assigned_to?: string;
  due_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  hours_worked?: number;
  estimated_hours?: number;
  progress_percentage?: number;
  invoice_status?: 'not_invoiced' | 'created' | 'invoiced' | 'paid' | 'cancelled';
  ticket_number?: string;
  created_on?: string;
  completed_on?: string;
  previous_status?: string;
  archived_at?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface Receivable {
  id: string;
  task_id: string;
  project_id: string;
  amount: number;
  hours_billed: number;
  rate_used: number;
  status: 'open' | 'paid' | 'cancelled';
  created_at: string;
  paid_at?: string;
  notes?: string;
  task_title?: string;
  project_name?: string;
}

export interface RevenueRecord {
  id: string;
  receivable_id: string;
  amount: number;
  recorded_at: string;
  notes?: string;
}

export interface ReceivableWithRevenue extends Receivable {
  revenue_records: RevenueRecord[];
  total_revenue: number;
  remaining_amount: number;
}

export interface Invoice {
  id: string;
  project_id: string;
  invoice_number: string;
  recipient_email: string;
  recipient_name?: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date?: string;
  sent_at?: string;
  paid_at?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  project_name?: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  task_id: string;
  description: string;
  hours_billed: number;
  rate: number;
  amount: number;
  created_at: string;
  task_title?: string;
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

export interface TaskForInvoicing {
  id: string;
  title: string;
  description: string;
  hours_worked: number;
  status: string;
  invoice_status: string;
  completed_at?: string;
  project_rate: number;
  rate_type: 'hourly' | 'fixed';
}

export interface AnalyticsData {
  statusDistribution: Record<string, number>;
  priorityDistribution: Record<string, number>;
  hoursWorkedByDate: { date: string; hours: number }[];
  totalHours: number;
  completionRate: number;
  averageTaskDuration: number;
}

export interface ExchangeRateResponse {
  success: boolean;
  timestamp: number;
  base: string;
  date: string;
  rates: {
    INR: number;
    [key: string]: number;
  };
}