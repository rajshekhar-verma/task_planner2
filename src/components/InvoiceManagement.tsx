import React, { useState, useEffect } from 'react';
import { FileText, Plus, Eye, Send, CheckCircle, X, Calendar, DollarSign, User, Edit, Trash2, RefreshCw, AlertTriangle, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Invoice, InvoiceWithItems, InvoiceItem, Project, Task, User as UserType, TaskForInvoicing } from '../types';
import { format } from 'date-fns';

interface InvoiceManagementProps {
  invoices: Invoice[];
  projects: Project[];
  tasks: Task[];
  user: UserType;
  onRefresh: () => Promise<void>;
}

export function InvoiceManagement({ invoices, projects, tasks, user, onRefresh }: InvoiceManagementProps) {
  const [invoicesWithItems, setInvoicesWithItems] = useState<InvoiceWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithItems | null>(null);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Create invoice form state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadInvoicesWithItems();
  }, [invoices]);

  const loadInvoicesWithItems = async () => {
    try {
      setLoading(true);
      
      const invoicesWithItemsData: InvoiceWithItems[] = await Promise.all(
        invoices.map(async (invoice) => {
          const { data: items, error } = await supabase
            .from('invoice_items')
            .select(`
              *,
              tasks:task_id(title)
            `)
            .eq('invoice_id', invoice.id);

          if (error) {
            console.error('Error loading invoice items:', error);
            return { ...invoice, items: [] };
          }

          const formattedItems: InvoiceItem[] = items?.map(item => ({
            ...item,
            task_title: item.tasks?.title
          })) || [];

          return { ...invoice, items: formattedItems };
        })
      );

      setInvoicesWithItems(invoicesWithItemsData);
    } catch (error) {
      console.error('Error loading invoices with items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableTasksForInvoicing = (projectId: string): TaskForInvoicing[] => {
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
        project_rate: project.hourly_rate || 0,
        rate_type: project.rate_type || 'hourly'
      }));
  };

  const calculateInvoiceTotal = () => {
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return { subtotal: 0, total: 0 };

    const selectedTasksData = getAvailableTasksForInvoicing(selectedProjectId)
      .filter(task => selectedTasks.includes(task.id));

    const subtotal = selectedTasksData.reduce((sum, task) => {
      if (project.rate_type === 'hourly') {
        return sum + (task.hours_worked * project.hourly_rate!);
      } else {
        return sum + (project.fixed_rate! / selectedTasksData.length);
      }
    }, 0);

    const total = subtotal + taxAmount - discountAmount;
    return { subtotal, total };
  };

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}${day}-${random}`;
  };

  const handleCreateInvoice = async () => {
    if (!selectedProjectId || selectedTasks.length === 0 || !recipientEmail) {
      alert('Please fill in all required fields and select at least one task.');
      return;
    }

    setIsCreating(true);
    try {
      const project = projects.find(p => p.id === selectedProjectId)!;
      const selectedTasksData = getAvailableTasksForInvoicing(selectedProjectId)
        .filter(task => selectedTasks.includes(task.id));

      const { subtotal, total } = calculateInvoiceTotal();
      const invoiceNumber = generateInvoiceNumber();

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          project_id: selectedProjectId,
          invoice_number: invoiceNumber,
          recipient_email: recipientEmail,
          recipient_name: recipientName || null,
          total_amount: subtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          final_amount: total,
          status: 'draft',
          issue_date: new Date().toISOString().split('T')[0],
          due_date: dueDate || null,
          notes: notes || null,
          created_by: user.id
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const invoiceItems = selectedTasksData.map(task => ({
        invoice_id: invoice.id,
        task_id: task.id,
        description: task.title,
        hours_billed: task.hours_worked,
        rate: project.hourly_rate || 0,
        amount: project.rate_type === 'hourly' 
          ? task.hours_worked * (project.hourly_rate || 0)
          : (project.fixed_rate || 0) / selectedTasksData.length
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      // Update task invoice status
      const { error: taskUpdateError } = await supabase
        .from('tasks')
        .update({ invoice_status: 'created' })
        .in('id', selectedTasks);

      if (taskUpdateError) throw taskUpdateError;

      // Reset form
      setSelectedProjectId('');
      setRecipientEmail('');
      setRecipientName('');
      setSelectedTasks([]);
      setTaxAmount(0);
      setDiscountAmount(0);
      setNotes('');
      setDueDate('');
      setShowCreateModal(false);

      // Refresh data
      await onRefresh();
      await loadInvoicesWithItems();

      alert('Invoice created successfully!');
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendInvoice = async (invoice: InvoiceWithItems) => {
    if (invoice.status !== 'draft') {
      alert('Only draft invoices can be sent.');
      return;
    }

    setIsSending(true);
    try {
      // Call the send-invoice-email edge function
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: { invoiceId: invoice.id }
      });

      if (error) throw error;

      alert(data.message || 'Invoice sent successfully!');
      
      // Refresh data
      await onRefresh();
      await loadInvoicesWithItems();
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice');
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelInvoice = async (invoice: InvoiceWithItems) => {
    if (!confirm(`Are you sure you want to cancel invoice ${invoice.invoice_number}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Update invoice status to cancelled and add cancellation note
      const cancellationNote = `Invoice cancelled on ${format(new Date(), 'MMM dd, yyyy')}. Original final amount: ₹${invoice.final_amount.toFixed(2)}`;
      
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'cancelled',
          notes: invoice.notes ? `${invoice.notes}\n\n${cancellationNote}` : cancellationNote
        })
        .eq('id', invoice.id);

      if (error) throw error;

      // Refresh data
      await onRefresh();
      await loadInvoicesWithItems();

      alert('Invoice cancelled successfully');
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      alert('Failed to cancel invoice');
    }
  };

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

  const filteredInvoices = invoicesWithItems.filter(invoice => {
    const matchesProject = filterProject === 'all' || invoice.project_id === filterProject;
    const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus;
    return matchesProject && matchesStatus;
  });

  const getTotalStats = () => {
    const activeInvoices = filteredInvoices.filter(i => i.status !== 'cancelled');
    const cancelledInvoices = filteredInvoices.filter(i => i.status === 'cancelled');
    
    const totalAmount = activeInvoices.reduce((sum, invoice) => sum + invoice.final_amount, 0);
    const paidAmount = activeInvoices.filter(i => i.status === 'paid').reduce((sum, invoice) => sum + invoice.final_amount, 0);
    const outstandingAmount = totalAmount - paidAmount;
    
    // Calculate cancelled amount from notes
    const cancelledAmount = cancelledInvoices.reduce((sum, invoice) => {
      const notesMatch = invoice.notes?.match(/Original final amount: ₹([0-9,]+\.?[0-9]*)/);
      if (notesMatch) {
        return sum + parseFloat(notesMatch[1].replace(/,/g, ''));
      }
      return sum + invoice.final_amount; // Fallback to current amount
    }, 0);

    return { 
      totalAmount, 
      paidAmount, 
      outstandingAmount, 
      cancelledAmount,
      activeCount: activeInvoices.length,
      cancelledCount: cancelledInvoices.length
    };
  };

  const stats = getTotalStats();

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
              onClick={() => onRefresh().then(() => loadInvoicesWithItems())}
              className="btn-outline py-1 px-3 h-auto"
              title="Refresh invoices"
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Total Active</p>
                <p className="text-2xl font-bold text-blue-900">₹{stats.totalAmount.toFixed(2)}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Paid</p>
                <p className="text-2xl font-bold text-green-900">₹{stats.paidAmount.toFixed(2)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">Outstanding</p>
                <p className="text-2xl font-bold text-orange-900">₹{stats.outstandingAmount.toFixed(2)}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Active Count</p>
                <p className="text-2xl font-bold text-purple-900">{stats.activeCount}</p>
              </div>
              <Eye className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Cancelled</p>
                <p className="text-2xl font-bold text-red-900">₹{stats.cancelledAmount.toFixed(2)}</p>
                <p className="text-xs text-red-500">{stats.cancelledCount} invoices</p>
              </div>
              <X className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <span>Invoices List</span>
            {(filterProject !== 'all' || filterStatus !== 'all') && (
              <span className="text-sm font-normal text-gray-500">
                - {filterProject !== 'all' && projects.find(p => p.id === filterProject)?.name}
                {filterProject !== 'all' && filterStatus !== 'all' && ' • '}
                {filterStatus !== 'all' && filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
              </span>
            )}
          </h3>
          
          {/* Expand/Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Expand ({filteredInvoices.length})</span>
              </>
            )}
          </button>
        </div>
        
        {isExpanded && (
          <>
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No invoices found.</p>
                <p className="text-sm">Create your first invoice from completed tasks.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredInvoices.map(invoice => (
                  <div key={invoice.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-medium text-gray-900">{invoice.invoice_number}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(invoice.status)}`}>
                            {invoice.status.toUpperCase()}
                          </span>
                          {invoice.status === 'cancelled' && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                              CANCELLED
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                          <div>
                            <span className="font-medium">Project:</span> {invoice.project_name}
                          </div>
                          <div>
                            <span className="font-medium">Recipient:</span> {invoice.recipient_email}
                          </div>
                          <div>
                            <span className="font-medium">Issue Date:</span> {format(new Date(invoice.issue_date), 'MMM dd, yyyy')}
                          </div>
                          <div>
                            <span className="font-medium">Amount:</span> ₹{invoice.final_amount.toFixed(2)}
                          </div>
                        </div>

                        {/* Invoice Items Summary */}
                        <div className="bg-gray-50 rounded p-3 mb-3">
                          <div className="text-sm">
                            <div className="flex justify-between mb-1">
                              <span>Subtotal:</span>
                              <span>₹{invoice.total_amount.toFixed(2)}</span>
                            </div>
                            {invoice.tax_amount > 0 && (
                              <div className="flex justify-between mb-1">
                                <span>Tax:</span>
                                <span>₹{invoice.tax_amount.toFixed(2)}</span>
                              </div>
                            )}
                            {invoice.discount_amount > 0 && (
                              <div className="flex justify-between mb-1">
                                <span>Discount:</span>
                                <span>-₹{invoice.discount_amount.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold border-t border-gray-200 pt-1">
                              <span>Total:</span>
                              <span>₹{invoice.final_amount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Cancellation Notice */}
                        {invoice.status === 'cancelled' && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center text-sm text-red-800">
                              <X className="h-4 w-4 mr-2" />
                              <span className="font-medium">This invoice has been cancelled.</span>
                            </div>
                            {invoice.notes && (
                              <p className="text-sm text-red-700 mt-1 italic">{invoice.notes}</p>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowViewModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View invoice details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {invoice.status === 'draft' && (
                          <button
                            onClick={() => handleSendInvoice(invoice)}
                            disabled={isSending}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Send invoice"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        
                        {invoice.status !== 'cancelled' && (
                          <button
                            onClick={() => handleCancelInvoice(invoice)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancel invoice"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create New Invoice</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project *
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      setSelectedTasks([]);
                    }}
                    className="input"
                    required
                  >
                    <option value="">Select a project</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Email *
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="input"
                    placeholder="client@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="input"
                    placeholder="Client Name"
                  />
                </div>
              </div>

              {/* Task Selection */}
              {selectedProjectId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Completed Tasks *
                  </label>
                  <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                    {getAvailableTasksForInvoicing(selectedProjectId).length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p>No completed tasks available for invoicing.</p>
                        <p className="text-sm">Complete some tasks first to create an invoice.</p>
                      </div>
                    ) : (
                      <div className="p-4 space-y-2">
                        {getAvailableTasksForInvoicing(selectedProjectId).map(task => (
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
                                {task.hours_worked}h worked • ₹{(task.hours_worked * task.project_rate).toFixed(2)}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Financial Details */}
              {selectedTasks.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Invoice Calculation</h4>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tax Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(Number(e.target.value))}
                        min="0"
                        step="0.01"
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(Number(e.target.value))}
                        min="0"
                        step="0.01"
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{calculateInvoiceTotal().subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>₹{taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span>-₹{discountAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-gray-200 pt-2">
                      <span>Total:</span>
                      <span>₹{calculateInvoiceTotal().total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="Additional notes for the invoice..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleCreateInvoice}
                disabled={isCreating || !selectedProjectId || selectedTasks.length === 0 || !recipientEmail}
                className="btn-primary flex-1"
              >
                {isCreating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                <span>{isCreating ? 'Creating...' : 'Create Invoice'}</span>
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="btn-outline"
              >
                Cancel
              </button>
            </div>
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
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {/* Invoice Header */}
            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-blue-900 mb-2">{selectedInvoice.invoice_number}</h2>
                  <p className="text-blue-700">Project: {selectedInvoice.project_name}</p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedInvoice.status)}`}>
                    {selectedInvoice.status.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                <div>
                  <span className="text-blue-600 font-medium">Issue Date:</span>
                  <div className="text-blue-900">{format(new Date(selectedInvoice.issue_date), 'MMM dd, yyyy')}</div>
                </div>
                {selectedInvoice.due_date && (
                  <div>
                    <span className="text-blue-600 font-medium">Due Date:</span>
                    <div className="text-blue-900">{format(new Date(selectedInvoice.due_date), 'MMM dd, yyyy')}</div>
                  </div>
                )}
                <div>
                  <span className="text-blue-600 font-medium">Recipient:</span>
                  <div className="text-blue-900">{selectedInvoice.recipient_email}</div>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Total Amount:</span>
                  <div className="text-blue-900 font-bold">₹{selectedInvoice.final_amount.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="mb-6">
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
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{item.hours_billed}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">₹{item.rate.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">₹{item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invoice Totals */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{selectedInvoice.total_amount.toFixed(2)}</span>
                </div>
                {selectedInvoice.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>₹{selectedInvoice.tax_amount.toFixed(2)}</span>
                  </div>
                )}
                {selectedInvoice.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-₹{selectedInvoice.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg border-t border-gray-200 pt-2">
                  <span>Total:</span>
                  <span>₹{selectedInvoice.final_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {selectedInvoice.notes && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Notes</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedInvoice.notes}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              {selectedInvoice.status === 'draft' && (
                <button
                  onClick={() => handleSendInvoice(selectedInvoice)}
                  disabled={isSending}
                  className="btn-primary"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  <span>{isSending ? 'Sending...' : 'Send Invoice'}</span>
                </button>
              )}
              <button onClick={() => setShowViewModal(false)} className="btn-outline">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}