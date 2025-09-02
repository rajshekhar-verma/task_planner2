import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, CheckCircle, Clock, Plus, Eye, FileText, TrendingUp, Filter, RefreshCw, IndianRupee, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, testSupabaseConnection } from '../lib/supabase';
import { Receivable, Project, ReceivableWithRevenue, RevenueRecord } from '../types';
import { format } from 'date-fns';
import { useExchangeRate } from '../hooks/useExchangeRate';

interface ReceivablesManagementProps {
  receivables: Receivable[];
  projects: Project[];
  onRefresh: () => Promise<void>;
}

export function ReceivablesManagement({ receivables, projects, onRefresh }: ReceivablesManagementProps) {
  const [receivablesWithRevenue, setReceivablesWithRevenue] = useState<ReceivableWithRevenue[]>([]);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableWithRevenue | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true); // Default to expanded
  const { exchangeRate, loading: rateLoading, lastUpdated, convertUSDtoINR, refreshRate } = useExchangeRate();

  useEffect(() => {
    loadReceivablesWithRevenue();
  }, [receivables, exchangeRate]);

  const loadReceivablesWithRevenue = async () => {
    try {
      console.log('Loading receivables with revenue data...');
      setLoading(true);
      setConnectionError(null);
      
      // Test Supabase connection first
      const connectionTest = await testSupabaseConnection();
      if (!connectionTest.success) {
        throw new Error(`Supabase connection failed: ${connectionTest.error}`);
      }
      
      console.log('Connection test successful, fetching revenue records...');
      
      // Fetch all revenue records
      const { data: revenueData, error: revenueError } = await supabase
        .from('revenue_records')
        .select('*')
        .order('recorded_at', { ascending: false });
      
      if (revenueError) {
        console.error('Revenue records fetch error:', revenueError);
        throw new Error(`Failed to fetch revenue records: ${revenueError.message}`);
      }
      
      console.log(`Fetched ${revenueData?.length || 0} revenue records`);
      
      // Group revenue records by receivable_id
      const revenueByReceivable: Record<string, RevenueRecord[]> = {};
      
      revenueData?.forEach(record => {
        if (!revenueByReceivable[record.receivable_id]) {
          revenueByReceivable[record.receivable_id] = [];
        }
        
        revenueByReceivable[record.receivable_id].push({
          id: record.id,
          receivable_id: record.receivable_id,
          amount: record.amount,
          amount_inr: record.amount_inr || undefined,
          recorded_at: record.recorded_at,
          notes: record.notes,
          exchange_rate: record.exchange_rate || undefined
        });
      });
      
      console.log('Processing receivables with revenue data...');
      
      // Process receivables with revenue data
      const processed: ReceivableWithRevenue[] = receivables.map(receivable => {
        const revenueRecords = revenueByReceivable[receivable.id] || [];
        const totalRevenue = revenueRecords.reduce((sum, record) => sum + record.amount, 0);
        
        // Find the project for this receivable
        const project = projects.find(p => p.id === receivable.project_id);
        
        // Calculate INR amounts using project-specific conversion if available
        const totalRevenueInr = revenueRecords.reduce((sum, record) => {
          if (record.amount_inr) {
            return sum + record.amount_inr;
          } else {
            return sum + convertUSDtoINR(record.amount, project);
          }
        }, 0);
        
        const remainingAmount = Math.max(0, receivable.amount - totalRevenue);
        const remainingAmountInr = convertUSDtoINR(remainingAmount, project);
        
        return {
          ...receivable,
          revenue_records: revenueRecords,
          total_revenue: totalRevenue,
          total_revenue_inr: totalRevenueInr,
          remaining_amount: remainingAmount,
          remaining_amount_inr: remainingAmountInr,
          exchange_rate: receivable.exchange_rate || exchangeRate || undefined
        };
      });
      
      console.log(`Processed ${processed.length} receivables with revenue data`);
      setReceivablesWithRevenue(processed);
    } catch (error) {
      console.error('Error loading receivables with revenue:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setConnectionError(errorMessage);
      
      // If there's a connection error, still show the receivables without revenue data
      const fallbackProcessed: ReceivableWithRevenue[] = receivables.map(receivable => ({
        ...receivable,
        revenue_records: [],
        total_revenue: 0,
        total_revenue_inr: 0,
        remaining_amount: receivable.amount,
        remaining_amount_inr: convertUSDtoINR(receivable.amount, projects.find(p => p.id === receivable.project_id)),
        exchange_rate: receivable.exchange_rate || exchangeRate || undefined
      }));
      
      setReceivablesWithRevenue(fallbackProcessed);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = (receivable: ReceivableWithRevenue) => {
    setSelectedReceivable(receivable);
    setPaymentAmount(receivable.remaining_amount);
    setPaymentNotes('');
    setShowMarkPaidModal(true);
  };

  const processPayment = async () => {
    if (!selectedReceivable || paymentAmount <= 0) return;

    setIsProcessing(true);
    try {
      // Test connection before proceeding
      const connectionTest = await testSupabaseConnection();
      if (!connectionTest.success) {
        throw new Error(`Supabase connection failed: ${connectionTest.error}`);
      }
      
      // Find the project for this receivable
      const project = projects.find(p => p.id === selectedReceivable.project_id);
      
      // Calculate INR amount using project-specific conversion if available
      const amountInr = convertUSDtoINR(paymentAmount, project);
      
      // Create revenue record with INR conversion
      const { error: revenueError } = await supabase
        .from('revenue_records')
        .insert({
          receivable_id: selectedReceivable.id,
          amount: paymentAmount,
          amount_inr: amountInr,
          exchange_rate: exchangeRate,
          notes: paymentNotes.trim() || null
        });

      if (revenueError) {
        console.error('Revenue record creation error:', revenueError);
        throw new Error(`Failed to create revenue record: ${revenueError.message}`);
      }

      // Check if this payment completes the receivable
      const newTotalRevenue = selectedReceivable.total_revenue + paymentAmount;
      const isFullyPaid = newTotalRevenue >= selectedReceivable.amount;

      if (isFullyPaid) {
        // Update receivable status to paid
        const { error: updateError } = await supabase
          .from('receivables')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            exchange_rate: exchangeRate
          })
          .eq('id', selectedReceivable.id);

        if (updateError) throw updateError;
        
        // Update task invoice status
        const { error: taskUpdateError } = await supabase
          .from('tasks')
          .update({
            invoice_status: 'paid'
          })
          .eq('id', selectedReceivable.task_id);
          
        if (taskUpdateError) {
          console.warn('Error updating task invoice status:', taskUpdateError);
        }
        
        // Also update any related invoices
        const { data: invoiceItems } = await supabase
          .from('invoice_items')
          .select('invoice_id')
          .eq('task_id', selectedReceivable.task_id);
          
        if (invoiceItems && invoiceItems.length > 0) {
          for (const item of invoiceItems) {
            // Check if all tasks in this invoice are paid
            const { data: otherItems } = await supabase
              .from('invoice_items')
              .select(`
                task_id,
                tasks!inner(id, invoice_status)
              `)
              .eq('invoice_id', item.invoice_id);
              
            const allPaid = otherItems?.every(i => i.tasks.invoice_status === 'paid');
            
            if (allPaid) {
              // Mark invoice as paid
              await supabase
                .from('invoices')
                .update({
                  status: 'paid',
                  paid_at: new Date().toISOString()
                })
                .eq('id', item.invoice_id);
            }
          }
        }
      }

      // Reload data
      await onRefresh();
      await loadReceivablesWithRevenue();
      
      // Close modal
      setShowMarkPaidModal(false);
      setSelectedReceivable(null);
      setPaymentAmount(0);
      setPaymentNotes('');
      
      alert(`Payment of $${paymentAmount.toFixed(2)} (₹${amountInr.toFixed(2)}) recorded successfully!`);
    } catch (error) {
      console.error('Error processing payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to process payment: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-orange-100 text-orange-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredReceivables = receivablesWithRevenue.filter(r => {
    const matchesProject = filterProject === 'all' || r.project_id === filterProject;
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesProject && matchesStatus;
  });

  const getTotalStats = () => {
    // Only count non-cancelled receivables for totals
    const activeReceivables = filteredReceivables.filter(r => r.status !== 'cancelled');
    
    const totalReceivables = activeReceivables.reduce((sum, r) => sum + r.amount, 0);
    const totalRevenue = activeReceivables.reduce((sum, r) => sum + r.total_revenue, 0);
    const totalRevenueInr = activeReceivables.reduce((sum, r) => {
      const project = projects.find(p => p.id === r.project_id);
      return sum + (r.total_revenue_inr || convertUSDtoINR(r.total_revenue, project));
    }, 0);
    const totalOutstanding = activeReceivables.reduce((sum, r) => sum + r.remaining_amount, 0);
    const openReceivables = filteredReceivables.filter(r => r.status === 'open').length;
    const cancelledReceivables = filteredReceivables.filter(r => r.status === 'cancelled').length;

    return { 
      totalReceivables,
      totalRevenue, 
      totalRevenueInr,
      totalOutstanding,
      openReceivables,
      cancelledReceivables
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
      {/* Connection Error Alert */}
      {connectionError && (
        <div className="card p-4 bg-red-50 border-red-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Database Connection Error</h3>
              <p className="text-sm text-red-700 mt-1">{connectionError}</p>
              <div className="mt-3 text-xs text-red-600">
                <p><strong>Troubleshooting steps:</strong></p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Check if your Supabase project is active and running</li>
                  <li>Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file</li>
                  <li>Restart your development server after updating .env</li>
                  <li>Run 'npm run setup' to reconfigure Supabase credentials</li>
                </ul>
              </div>
              <button
                onClick={loadReceivablesWithRevenue}
                className="mt-3 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header and Stats */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">Receivables & Revenue</h2>
            {connectionError && (
              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                Limited Mode
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Exchange Rate Info */}
            <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-lg">
              <span className="text-sm text-blue-700">
                Exchange Rate: ₹{exchangeRate?.toFixed(2) || '...'} per USD
              </span>
              <button 
                onClick={refreshRate}
                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full"
                title="Refresh exchange rate"
                disabled={rateLoading}
              >
                <RefreshCw className={`h-3 w-3 ${rateLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Updated: {format(lastUpdated, 'HH:mm')}
              </span>
            )}
            
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
                <option value="open">Open</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <button
              onClick={() => onRefresh().then(() => loadReceivablesWithRevenue())}
              className="btn-outline py-1 px-3 h-auto"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Total Receivables</p>
                <p className="text-2xl font-bold text-blue-900">₹{stats.totalReceivables.toFixed(2)}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-green-900">₹{stats.totalRevenue.toFixed(2)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">Outstanding</p>
                <p className="text-2xl font-bold text-orange-900">₹{stats.totalOutstanding.toFixed(2)}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Open Items</p>
                <p className="text-2xl font-bold text-purple-900">{stats.openReceivables}</p>
              </div>
              <Eye className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Cancelled</p>
                <p className="text-2xl font-bold text-red-900">{stats.cancelledReceivables}</p>
              </div>
              <X className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Receivables List */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <span>Receivables List</span>
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
                <span>Expand ({filteredReceivables.length})</span>
              </>
            )}
          </button>
        </div>
        
        {isExpanded && (
          <>
            {filteredReceivables.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No receivables found.</p>
                <p className="text-sm">Receivables are automatically created when invoices are finalized.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReceivables.map(receivable => {
                  // Find the project for this receivable to use its conversion rule
                  const project = projects.find(p => p.id === receivable.project_id);
                  
                  return (
                    <div key={receivable.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-medium text-gray-900">{receivable.task_title}</h4>
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(receivable.status)}`}>
                              {receivable.status.toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                            <div>
                              <span className="font-medium">Project:</span> {receivable.project_name}
                            </div>
                            <div>
                              <span className="font-medium">Hours:</span> {receivable.hours_billed}h @ ${receivable.rate_used}/hr
                            </div>
                            <div>
                              <span className="font-medium">Created:</span> {format(new Date(receivable.created_at), 'MMM dd, yyyy')}
                            </div>
                          </div>

                          {/* Financial Summary */}
                          <div className="bg-gray-50 rounded p-3 mb-3">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="font-medium text-gray-700">Total Amount</div>
                                <div className="text-lg font-bold text-gray-900">₹{receivable.amount.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="font-medium text-gray-700">Revenue Recorded</div>
                                <div className="text-lg font-bold text-green-600">₹{receivable.total_revenue.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="font-medium text-gray-700">
                                  {receivable.status === 'cancelled' ? 'Was Remaining' : 'Remaining'}
                                </div>
                                <div className={`text-lg font-bold ${receivable.status === 'cancelled' ? 'text-red-600' : 'text-orange-600'}`}>
                                  ₹{receivable.remaining_amount.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Revenue Records */}
                          {receivable.revenue_records.length > 0 && (
                            <div className="mt-3">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">Payment History</h5>
                              <div className="space-y-1">
                                {receivable.revenue_records.map(record => (
                                  <div key={record.id} className="flex justify-between items-center text-xs text-gray-600 bg-green-50 px-2 py-1 rounded">
                                    <span>
                                      ₹{record.amount.toFixed(2)}
                                      - {format(new Date(record.recorded_at), 'MMM dd, yyyy')}
                                    </span>
                                    {record.notes && <span className="italic">"{record.notes}"</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Cancellation Notice */}
                          {receivable.status === 'cancelled' && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="flex items-center text-sm text-red-800">
                                <X className="h-4 w-4 mr-2" />
                                <span className="font-medium">This receivable has been cancelled.</span>
                              </div>
                              {receivable.notes && (
                                <p className="text-sm text-red-700 mt-1 italic">{receivable.notes}</p>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {receivable.remaining_amount > 0 && receivable.status === 'open' && !connectionError && (
                          <button
                            onClick={() => handleMarkAsPaid(receivable)}
                            className="ml-4 flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Record Payment</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mark as Paid Modal */}
      {showMarkPaidModal && selectedReceivable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Payment</h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 rounded p-3">
                <div className="text-sm text-gray-600">
                  <div><strong>Task:</strong> {selectedReceivable.task_title}</div>
                  <div className="flex justify-between">
                    <span><strong>Total Amount:</strong></span>
                    <span>₹{selectedReceivable.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span><strong>Already Paid:</strong></span>
                    <span>₹{selectedReceivable.total_revenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span><strong>Remaining:</strong></span>
                    <span>₹{selectedReceivable.remaining_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                    <span><strong>Exchange Rate:</strong></span>
                    <span>1 USD = ₹{exchangeRate?.toFixed(2) || '...'}</span>
                  </div>
                  
                  {/* Show project-specific conversion rule if applicable */}
                  {selectedReceivable && projects.find(p => p.id === selectedReceivable.project_id)?.inr_conversion_factor !== 1 && (
                    <div className="flex justify-between mt-1">
                      <span><strong>Project Conversion:</strong></span>
                      <span>{(projects.find(p => p.id === selectedReceivable.project_id)?.inr_conversion_factor || 1) * 100}% of standard rate</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  min="0"
                  max={selectedReceivable.remaining_amount}
                  step="0.01"
                  className="input"
                  disabled={isProcessing}
                />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-500">
                    Maximum: ₹{selectedReceivable.remaining_amount.toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="Payment method, reference number, etc."
                  disabled={isProcessing}
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={processPayment}
                disabled={isProcessing || paymentAmount <= 0 || paymentAmount > selectedReceivable.remaining_amount}
                className="btn-primary flex-1"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                <span>{isProcessing ? 'Processing...' : 'Record Payment'}</span>
              </button>
              <button
                onClick={() => {
                  setShowMarkPaidModal(false);
                  setSelectedReceivable(null);
                  setPaymentAmount(0);
                  setPaymentNotes('');
                }}
                disabled={isProcessing}
                className="btn-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}