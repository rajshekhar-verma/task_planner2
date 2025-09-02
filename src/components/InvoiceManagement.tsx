import React, { useState, useEffect } from 'react';
import { FileText, Plus, Eye, Send, DollarSign, Calendar, User, Edit, Trash2, X, AlertTriangle, CheckCircle, Clock, Filter, RefreshCw, Mail, CreditCard, Ban, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Invoice, InvoiceItem, Project, Task, User as UserType, InvoiceWithItems, TaskForInvoicing } from '../types';
import { format } from 'date-fns';

interface InvoiceManagementProps {
  invoices: Invoice[];
  projects: Project[];
  tasks: Task[];
  user: UserType;
  onRefresh: () => Promise<void>;
}

export function InvoiceManagement({ invoices, projects, tasks, user, onRefresh }: InvoiceManagementProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithItems | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Create Invoice Modal State
  const [createFormData, setCreateFormData] = useState({
    project_id: '',
    recipient_email: '',
    recipient_name: '',
    tax_amount: 0,
    discount_amount: 0,
    notes: '',
    due_date: '',
    bill_to_address: '',
    bill_from_address: '',
    bank_details: ''
  });
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAvailableTasksForProject = (projectId: string): TaskForInvoicing[] => {
    if (!projectId) return [];
    
    const project = projects.find(p => p.id === projectId);
    if (!project) return [];

    return tasks
      .filter(task => 
        task.project_id === projectId && 
        task.status === 'completed' && 
        (!task.invoice_status || task.invoice_status === 'not_invoiced')
      )
      .map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        hours_worked: task.hours_worked || 0,
        status: task.status,
        invoice_status: task.invoice_status || 'not_invoiced',
        completed_at: task.updated_at,
        project_rate: project.rate_type === 'hourly' ? (project.hourly_rate || 0) : (project.fixed_rate || 0),
        rate_type: project.rate_type || 'hourly'
      }));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTasks.length === 0) {
      alert('Please select at least one task to invoice.');
      return;
    }

    setIsProcessing(true);
    try {
      const project = projects.find(p => p.id === createFormData.project_id);
      if (!project) throw new Error('Project not found');

      const tasksToInvoice = getAvailableTasksForProject(createFormData.project_id)
        .filter(task => selectedTasks.includes(task.id));

      // Calculate totals
      let totalAmount = 0;
      const invoiceItems = tasksToInvoice.map(task => {
        const amount = project.rate_type === 'hourly' 
          ? task.hours_worked * (project.hourly_rate || 0)
          : (project.fixed_rate || 0) / tasksToInvoice.length;
        
        totalAmount += amount;
        
        return {
          task_id: task.id,
          description: task.title,
          hours_billed: task.hours_worked,
          rate: project.rate_type === 'hourly' ? (project.hourly_rate || 0) : (project.fixed_rate || 0),
          amount: amount
        };
      });

      const finalAmount = totalAmount + createFormData.tax_amount - createFormData.discount_amount;

      // Generate invoice number
      const invoiceCount = invoices.length + 1;
      const invoiceNumber = `INV-${new Date().getFullYear()}-${invoiceCount.toString().padStart(4, '0')}`;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          project_id: createFormData.project_id,
          invoice_number: invoiceNumber,
          recipient_email: createFormData.recipient_email,
          recipient_name: createFormData.recipient_name || null,
          total_amount: totalAmount,
          tax_amount: createFormData.tax_amount,
          discount_amount: createFormData.discount_amount,
          final_amount: finalAmount,
          status: 'draft',
          issue_date: new Date().toISOString().split('T')[0],
          due_date: createFormData.due_date || null,
          notes: createFormData.notes || null,
          created_by: user.id,
          bill_to_address: createFormData.bill_to_address || null,
          bill_from_address: createFormData.bill_from_address || null,
          bank_details: createFormData.bank_details || null
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const itemsWithInvoiceId = invoiceItems.map(item => ({
        ...item,
        invoice_id: invoice.id
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsWithInvoiceId);

      if (itemsError) throw itemsError;

      // Update task invoice status
      const { error: taskUpdateError } = await supabase
        .from('tasks')
        .update({ invoice_status: 'created' })
        .in('id', selectedTasks);

      if (taskUpdateError) throw taskUpdateError;

      // Refresh data
      await onRefresh();
      
      // Reset form
      setCreateFormData({
        project_id: '',
        recipient_email: '',
        recipient_name: '',
        tax_amount: 0,
        discount_amount: 0,
        notes: '',
        due_date: '',
        bill_to_address: '',
        bill_from_address: '',
        bank_details: ''
      });
      setSelectedTasks([]);
      setShowCreateModal(false);
      
      alert('Invoice created successfully!');
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalizeInvoice = async (invoiceId: string) => {
    if (!window.confirm('Are you sure you want to finalize this invoice? This will create receivables and cannot be undone.')) return;

    setIsProcessing(true);
    try {
      // Update invoice status to sent (finalized)
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

              const { error: taskUpdateError } = await supabase
        .from('tasks')
        .update({ invoice_status: 'invoiced' })
        .in('id', selectedTasks);

        if (taskUpdateError) throw taskUpdateError;

      if (error) throw error;

      await onRefresh();
      alert('Invoice finalized successfully! Receivables have been created.');
    } catch (error) {
      console.error('Error finalizing invoice:', error);
      alert('Failed to finalize invoice: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    setLoading(true);
    try {
      const { data: invoiceItems, error } = await supabase
        .from('invoice_items')
        .select(`
          *,
          tasks!inner(title)
        `)
        .eq('invoice_id', invoice.id);

      if (error) throw error;

      const invoiceWithItems: InvoiceWithItems = {
        ...invoice,
        items: invoiceItems.map(item => ({
          ...item,
          task_title: item.tasks?.title
        }))
      };

      setSelectedInvoice(invoiceWithItems);
      setShowViewModal(true);
    } catch (error) {
      console.error('Error loading invoice details:', error);
      alert('Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvoice = async (invoiceId: string) => {
    if (!window.confirm('Are you sure you want to send this invoice?')) return;

    setIsProcessing(true);
    try {
      // Call the edge function to send email
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: { invoiceId }
      });

      if (error) throw error;

      await onRefresh();
      alert(data.message || 'Invoice sent successfully!');
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    if (!window.confirm('Are you sure you want to mark this invoice as paid? This will update existing receivables and create revenue records.')) return;

    setIsProcessing(true);
    try {
      // First, get the invoice details with items
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_items(
            *,
            tasks!inner(id, title, hours_worked)
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;
      if (!invoice) throw new Error('Invoice not found');

      // Update invoice status to paid
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // For each task in the invoice, find and update the existing receivable
      for (const item of invoice.invoice_items) {
        // Find the existing receivable for this task
        const { data: existingReceivables, error: receivableError } = await supabase
          .from('receivables')
          .select('*')
          .eq('task_id', item.task_id)
          .eq('project_id', invoice.project_id);

        if (receivableError) throw receivableError;

        if (existingReceivables && existingReceivables.length > 0) {
          const receivable = existingReceivables[0];

          // Update the receivable status to paid
          const { error: updateReceivableError } = await supabase
            .from('receivables')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              notes: `Payment received for invoice ${invoice.invoice_number}`
            })
            .eq('id', receivable.id);

          if (updateReceivableError) throw updateReceivableError;

          // Create a revenue record for the full receivable amount
          const { error: revenueError } = await supabase
            .from('revenue_records')
            .insert({
              receivable_id: receivable.id,
              amount: receivable.amount,
              recorded_at: new Date().toISOString(),
              notes: `Revenue recorded from invoice ${invoice.invoice_number} payment`
            });

          if (revenueError) throw revenueError;
        }
      }

      // Update task invoice status to paid
      const taskIds = invoice.invoice_items.map(item => item.task_id);
      const { error: taskUpdateError } = await supabase
        .from('tasks')
        .update({ invoice_status: 'paid' })
        .in('id', taskIds);

      if (taskUpdateError) throw taskUpdateError;

      await onRefresh();
      alert('Invoice marked as paid successfully! Receivables and revenue records have been updated.');
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      alert('Failed to mark invoice as paid: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelInvoice = (invoice: Invoice) => {
    setInvoiceToCancel(invoice);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const processCancellation = async () => {
    if (!invoiceToCancel || !cancellationReason.trim()) {
      alert('Please provide a cancellation reason.');
      return;
    }

    setIsProcessing(true);
    try {
      // Get original amounts for notes
      const originalTotal = invoiceToCancel.total_amount;
      const originalFinal = invoiceToCancel.final_amount;

      // Create cancellation note with original amounts (only once)
      const cancellationNote = `[CANCELLED on ${format(new Date(), 'MMM dd, yyyy')}] Reason: ${cancellationReason.trim()}. Original total amount: $${originalTotal.toFixed(2)}, Original final amount: $${originalFinal.toFixed(2)}`;
      
      const updatedNotes = invoiceToCancel.notes 
        ? `${invoiceToCancel.notes}\n\n${cancellationNote}`
        : cancellationNote;

      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          status: 'cancelled',
          total_amount: 0,
          final_amount: 0,
          notes: updatedNotes
        })
        .eq('id', invoiceToCancel.id);

      if (invoiceError) throw invoiceError;

      // Get all tasks related to this invoice
      const { data: invoiceItems, error: itemsError } = await supabase
        .from('invoice_items')
        .select('task_id')
        .eq('invoice_id', invoiceToCancel.id);

      if (itemsError) throw itemsError;

      const taskIds = invoiceItems.map(item => item.task_id);

      // Update all related tasks
      if (taskIds.length > 0) {
        // Get current task data to update descriptions
        const { data: currentTasks, error: tasksError } = await supabase
          .from('tasks')
          .select('id, description, status')
          .in('id', taskIds);

        if (tasksError) throw tasksError;

        // Update each task
        for (const task of currentTasks) {
          let updatedDescription = task.description;
          
          // Add cancellation message to completed tasks
          if (task.status === 'completed') {
            const cancellationMessage = '\n\n[INVOICE CANCELLED] To invoice again, create new task.';
            if (!updatedDescription.includes('[INVOICE CANCELLED]')) {
              updatedDescription += cancellationMessage;
            }
          }

          const { error: taskUpdateError } = await supabase
            .from('tasks')
            .update({
              invoice_status: 'cancelled',
              description: updatedDescription
            })
            .eq('id', task.id);

          if (taskUpdateError) throw taskUpdateError;
        }
      }

      // Update related receivables
      const { error: receivablesError } = await supabase
        .from('receivables')
        .update({
          status: 'cancelled',
          notes: `Cancelled due to invoice cancellation. Reason: ${cancellationReason.trim()}`
        })
        .eq('project_id', invoiceToCancel.project_id)
        .in('task_id', taskIds);

      if (receivablesError) throw receivablesError;

      // Refresh all data
      await onRefresh();
      
      // Close modal and reset
      setShowCancelModal(false);
      setInvoiceToCancel(null);
      setCancellationReason('');
      
      alert('Invoice cancelled successfully!');
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      alert('Failed to cancel invoice: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesProject = filterProject === 'all' || invoice.project_id === filterProject;
    const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus;
    return matchesProject && matchesStatus;
  });

  const getTotalStats = () => {
    const activeInvoices = filteredInvoices.filter(i => i.status !== 'cancelled');
    const cancelledInvoices = filteredInvoices.filter(i => i.status === 'cancelled');
    
    const totalValue = activeInvoices.reduce((sum, i) => sum + i.final_amount, 0);
    const paidValue = activeInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.final_amount, 0);
    const cancelledValue = cancelledInvoices.reduce((sum, i) => {
      // Extract original amount from notes if available
      const notesMatch = i.notes?.match(/Original final amount: \$([0-9,]+\.?[0-9]*)/);
      if (notesMatch) {
        return sum + parseFloat(notesMatch[1].replace(/,/g, ''));
      }
      return sum;
    }, 0);

    return {
      totalInvoices: filteredInvoices.length,
      activeInvoices: activeInvoices.length,
      totalValue,
      paidValue,
      outstandingValue: totalValue - paidValue,
      cancelledInvoices: cancelledInvoices.length,
      cancelledValue
    };
  };

  const stats = getTotalStats();

  return (
    <div className="space-y-6">
      {/* Header and Stats */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Invoice Management</h2>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Filters */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="input py-1 px-3 h-auto"
              >
                <option value="all">All Projects</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input py-1 px-3 h-auto"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <button
              onClick={onRefresh}
              className="btn-outline py-1 px-3 h-auto"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </button>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Total Invoices</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalInvoices}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Active Invoices</p>
                <p className="text-2xl font-bold text-green-900">{stats.activeInvoices}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Total Value</p>
                <p className="text-2xl font-bold text-purple-900">${stats.totalValue.toFixed(0)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-medium">Paid</p>
                <p className="text-2xl font-bold text-yellow-900">${stats.paidValue.toFixed(0)}</p>
              </div>
              <CreditCard className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">Outstanding</p>
                <p className="text-2xl font-bold text-orange-900">${stats.outstandingValue.toFixed(0)}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Cancelled</p>
                <p className="text-2xl font-bold text-red-900">${stats.cancelledValue.toFixed(0)}</p>
                <p className="text-xs text-red-600">({stats.cancelledInvoices} invoices)</p>
              </div>
              <Ban className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Invoices List
          {(filterProject !== 'all' || filterStatus !== 'all') && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              - {filterProject !== 'all' && projects.find(p => p.id === filterProject)?.name}
              {filterProject !== 'all' && filterStatus !== 'all' && ' • '}
              {filterStatus !== 'all' && filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
            </span>
          )}
        </h3>
        
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No invoices found.</p>
            <p className="text-sm">Create your first invoice to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInvoices.map(invoice => (
              <div key={invoice.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h4 className="text-xl font-semibold text-gray-900">{invoice.invoice_number}</h4>
                      {/* Only show one status badge - if cancelled, show cancelled, otherwise show regular status */}
                      <span className={`px-3 py-1 text-sm rounded-full font-medium ${getStatusColor(invoice.status)}`}>
                        {invoice.status === 'cancelled' ? (
                          <>
                            <Ban className="h-4 w-4 mr-1 inline" />
                            CANCELLED
                          </>
                        ) : (
                          invoice.status.toUpperCase()
                        )}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
                      <div>
                        <span className="font-medium text-gray-700">Project:</span> 
                        <div className="text-gray-900">{invoice.project_name}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Recipient:</span> 
                        <div className="text-gray-900">{invoice.recipient_email}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Amount:</span> 
                        <div className="text-gray-900">
                          {invoice.status === 'cancelled' ? (
                            <span className="line-through text-red-600">
                              ${invoice.final_amount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="font-semibold">${invoice.final_amount.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Date:</span> 
                        <div className="text-gray-900">{format(new Date(invoice.issue_date), 'MMM dd, yyyy')}</div>
                      </div>
                    </div>

                    {/* Cancellation Info */}
                    {invoice.status === 'cancelled' && invoice.notes && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center text-sm text-red-800 mb-2">
                          <Ban className="h-4 w-4 mr-2" />
                          <span className="font-medium">Cancellation Details</span>
                        </div>
                        <p className="text-sm text-red-700 whitespace-pre-wrap">{invoice.notes}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 ml-6">
                    {/* View Button - Always visible */}
                    <button
                      onClick={() => handleViewInvoice(invoice)}
                      className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View invoice details"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="text-sm font-medium">View</span>
                    </button>
                    
                    {/* Finalize Button - Only for draft invoices */}
                    {invoice.status === 'draft' && (
                      <button
                        onClick={() => handleFinalizeInvoice(invoice.id)}
                        disabled={isProcessing}
                        className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 border border-green-200 hover:border-green-300"
                        title="Finalize invoice (creates receivables)"
                      >
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">Finalize</span>
                      </button>
                    )}
                    
                    {/* Send Button - Only for draft invoices */}
                    {invoice.status === 'draft' && (
                      <button
                        onClick={() => handleSendInvoice(invoice.id)}
                        disabled={isProcessing}
                        className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Send invoice via email"
                      >
                        <Send className="w-4 h-4" />
                        <span className="text-sm font-medium">Send</span>
                      </button>
                    )}
                    
                    {/* Mark as Paid Button - Only for sent/overdue invoices */}
                    {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                      <button
                        onClick={() => handleMarkAsPaid(invoice.id)}
                        disabled={isProcessing}
                        className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Mark as paid"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Mark Paid</span>
                      </button>
                    )}
                    
                    {/* Cancel Button - Only for PAID invoices */}
                    {invoice.status === 'paid' && (
                      <button
                        onClick={() => handleCancelInvoice(invoice)}
                        disabled={isProcessing}
                        className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 border border-red-200 hover:border-red-300"
                        title="Cancel paid invoice"
                      >
                        <Ban className="w-4 h-4" />
                        <span className="text-sm font-medium">Cancel</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Invoice Modal */}
      {showCancelModal && invoiceToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                Cancel Paid Invoice
              </h3>
              <button 
                onClick={() => setShowCancelModal(false)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-sm text-red-800">
                  <div className="font-medium mb-2">⚠️ Warning: This action will:</div>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Set invoice amounts to $0.00</li>
                    <li>Mark all related tasks as 'cancelled'</li>
                    <li>Mark all related receivables as 'cancelled'</li>
                    <li>Add cancellation message to completed tasks</li>
                    <li>Update analytics to reflect cancellation</li>
                    <li><strong>This is typically used for refunds or payment disputes</strong></li>
                  </ul>
                </div>
              </div>

              <div className="bg-gray-50 rounded p-3">
                <div className="text-sm text-gray-600">
                  <div><strong>Invoice:</strong> {invoiceToCancel.invoice_number}</div>
                  <div><strong>Amount:</strong> ${invoiceToCancel.final_amount.toFixed(2)}</div>
                  <div><strong>Status:</strong> {invoiceToCancel.status.toUpperCase()}</div>
                  <div><strong>Paid Date:</strong> {invoiceToCancel.paid_at ? format(new Date(invoiceToCancel.paid_at), 'MMM dd, yyyy') : 'N/A'}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="e.g., Client requested refund, Payment dispute, Service not delivered as agreed..."
                  disabled={isProcessing}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Please provide a detailed reason for cancelling this paid invoice.
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={processCancellation}
                disabled={isProcessing || !cancellationReason.trim()}
                className="btn-primary bg-red-600 hover:bg-red-700 flex-1"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <Ban className="w-4 h-4 mr-2" />
                )}
                <span>{isProcessing ? 'Cancelling...' : 'Cancel Paid Invoice'}</span>
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isProcessing}
                className="btn-outline"
              >
                Keep Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create New Invoice</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-6">
              {/* Project Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project *
                </label>
                <select
                  required
                  value={createFormData.project_id}
                  onChange={(e) => {
                    setCreateFormData({ ...createFormData, project_id: e.target.value });
                    setSelectedTasks([]);
                  }}
                  className="input"
                >
                  <option value="">Select a project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>

              {/* Task Selection */}
              {createFormData.project_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Tasks to Invoice *
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {getAvailableTasksForProject(createFormData.project_id).length === 0 ? (
                      <p className="text-gray-500 text-sm">No completed tasks available for invoicing in this project.</p>
                    ) : (
                      <div className="space-y-2">
                        {getAvailableTasksForProject(createFormData.project_id).map(task => (
                          <label key={task.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                            <input
                              type="checkbox"
                              checked={selectedTasks.includes(task.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTasks([...selectedTasks, task.id]);
                                } else {
                                  setSelectedTasks(selectedTasks.filter(id => id !== task.id));
                                }
                              }}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{task.title}</div>
                              <div className="text-sm text-gray-600">
                                {task.hours_worked}h worked • ${task.project_rate}/hr • 
                                ${(task.hours_worked * task.project_rate).toFixed(2)}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recipient Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={createFormData.recipient_email}
                    onChange={(e) => setCreateFormData({ ...createFormData, recipient_email: e.target.value })}
                    className="input"
                    placeholder="client@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    value={createFormData.recipient_name}
                    onChange={(e) => setCreateFormData({ ...createFormData, recipient_name: e.target.value })}
                    className="input"
                    placeholder="Client Name"
                  />
                </div>
              </div>

              {/* Financial Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Amount ($)
                  </label>
                  <input
                    type="number"
                    value={createFormData.tax_amount}
                    onChange={(e) => setCreateFormData({ ...createFormData, tax_amount: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Amount ($)
                  </label>
                  <input
                    type="number"
                    value={createFormData.discount_amount}
                    onChange={(e) => setCreateFormData({ ...createFormData, discount_amount: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={createFormData.due_date}
                    onChange={(e) => setCreateFormData({ ...createFormData, due_date: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bill To Address
                  </label>
                  <textarea
                    value={createFormData.bill_to_address}
                    onChange={(e) => setCreateFormData({ ...createFormData, bill_to_address: e.target.value })}
                    rows={3}
                    className="input"
                    placeholder="Client's billing address..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bill From Address
                  </label>
                  <textarea
                    value={createFormData.bill_from_address}
                    onChange={(e) => setCreateFormData({ ...createFormData, bill_from_address: e.target.value })}
                    rows={3}
                    className="input"
                    placeholder="Your business address..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Details
                  </label>
                  <textarea
                    value={createFormData.bank_details}
                    onChange={(e) => setCreateFormData({ ...createFormData, bank_details: e.target.value })}
                    rows={3}
                    className="input"
                    placeholder="Bank account details for payment..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={createFormData.notes}
                    onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                    rows={3}
                    className="input"
                    placeholder="Additional notes or terms..."
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button 
                  type="submit" 
                  className="btn-primary flex-1"
                  disabled={isProcessing || selectedTasks.length === 0}
                >
                  {isProcessing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  <span>{isProcessing ? 'Creating...' : 'Create Invoice'}</span>
                </button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-outline">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {showViewModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Invoice Details</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-blue-900">{selectedInvoice.invoice_number}</h2>
                    <p className="text-blue-700">Project: {selectedInvoice.project_name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedInvoice.status)}`}>
                    {selectedInvoice.status.toUpperCase()}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600 font-medium">Issue Date:</span>
                    <div className="text-blue-900">{format(new Date(selectedInvoice.issue_date), 'MMM dd, yyyy')}</div>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">Due Date:</span>
                    <div className="text-blue-900">
                      {selectedInvoice.due_date ? format(new Date(selectedInvoice.due_date), 'MMM dd, yyyy') : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">Recipient:</span>
                    <div className="text-blue-900">{selectedInvoice.recipient_email}</div>
                  </div>
                  <div>
                    <span className="text-blue-600 font-medium">Status:</span>
                    <div className="text-blue-900">{selectedInvoice.status.toUpperCase()}</div>
                  </div>
                </div>
              </div>

              {/* Invoice Items */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Invoice Items</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Hours</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Rate</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedInvoice.items.map(item => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.task_title || item.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.hours_billed}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">${item.rate.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">${item.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invoice Totals */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-900 font-medium">${selectedInvoice.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax:</span>
                    <span className="text-gray-900 font-medium">${selectedInvoice.tax_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount:</span>
                    <span className="text-gray-900 font-medium">-${selectedInvoice.discount_amount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-900 font-semibold">Total:</span>
                      <span className="text-gray-900 font-bold text-lg">
                        {selectedInvoice.status === 'cancelled' ? (
                          <span className="line-through text-red-600">${selectedInvoice.final_amount.toFixed(2)}</span>
                        ) : (
                          `$${selectedInvoice.final_amount.toFixed(2)}`
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Notes</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedInvoice.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setShowViewModal(false)} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}