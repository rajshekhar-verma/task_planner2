import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, FileText, TrendingUp, Calendar, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Zap, Plus, CheckCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useExchangeRate } from '../hooks/useExchangeRate';

interface TaxRecord {
  period: string;
  totalRevenue: number;
  totalRevenueInr: number;
  taxAmount: number;
  taxAmountInr: number;
  taxRate: number;
}

interface TaxPayment {
  id: string;
  amount: number;
  amount_inr: number;
  payment_date: string;
  notes?: string;
  created_at: string;
}

interface TaxManagementProps {
  onRefresh?: () => Promise<void>;
}

export function TaxManagement({ onRefresh }: TaxManagementProps) {
  const [taxRecords, setTaxRecords] = useState<TaxRecord[]>([]);
  const [taxPayments, setTaxPayments] = useState<TaxPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const { exchangeRate, convertUSDtoINR } = useExchangeRate();

  const TAX_RATE = 0.15; // 15% tax rate

  useEffect(() => {
    initializeTaxData();
  }, [exchangeRate]);

  const initializeTaxData = async () => {
    try {
      setLoading(true);
      
      // Load all data
      await Promise.all([
        loadTaxData(),
        loadTaxPayments()
      ]);
      
    } catch (error) {
      console.error('Error initializing tax data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTaxData = async () => {
    try {
      // Fetch revenue records from active receivables only (non-cancelled)
      const { data: revenueData, error } = await supabase
        .from('revenue_records')
        .select(`
          *,
          receivables!inner(
            id,
            status
          )
        `)
        .eq('receivables.status', 'paid') // Only include revenue from paid receivables
        .order('recorded_at', { ascending: false });

      if (error) {
        console.error('Error fetching active revenue data:', error);
        return;
      }

      // Group revenue by month/year
      const revenueByPeriod: Record<string, { revenue: number; revenueInr: number }> = {};
      
      revenueData?.forEach(record => {
        const date = new Date(record.recorded_at);
        const period = format(date, 'yyyy-MM'); // Group by year-month
        
        if (!revenueByPeriod[period]) {
          revenueByPeriod[period] = { revenue: 0, revenueInr: 0 };
        }
        
        revenueByPeriod[period].revenue += record.amount;
        revenueByPeriod[period].revenueInr += record.amount_inr || convertUSDtoINR(record.amount);
      });

      // Calculate tax for each period
      const taxRecords: TaxRecord[] = Object.entries(revenueByPeriod)
        .map(([period, data]) => ({
          period,
          totalRevenue: data.revenue,
          totalRevenueInr: data.revenueInr,
          taxAmount: data.revenue * TAX_RATE,
          taxAmountInr: data.revenueInr * TAX_RATE,
          taxRate: TAX_RATE
        }))
        .sort((a, b) => b.period.localeCompare(a.period)); // Sort by period descending

      setTaxRecords(taxRecords);
    } catch (error) {
      console.error('Error loading tax data:', error);
    }
  };

  const loadTaxPayments = async () => {
    try {
      const { data: taxPaymentsData, error } = await supabase
        .from('tax_payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('Error fetching tax payments:', error);
        return;
      }

      setTaxPayments(taxPaymentsData || []);
    } catch (error) {
      console.error('Error loading tax payments:', error);
      setTaxPayments([]);
    }
  };

  const handleAddTaxPayment = async () => {
    if (paymentAmount <= 0) return;

    setIsProcessingPayment(true);
    try {
      const amountInr = convertUSDtoINR(paymentAmount);
      
      const { data, error } = await supabase
        .from('tax_payments')
        .insert({
          amount: paymentAmount,
          amount_inr: amountInr,
          payment_date: paymentDate,
          notes: paymentNotes.trim() || null
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Add to local state
      setTaxPayments(prev => [data, ...prev]);
      
      // Close modal and reset form
      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentNotes('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      
      alert(`Tax payment of $${paymentAmount.toFixed(2)} (₹${amountInr.toFixed(2)}) recorded successfully!`);
    } catch (error) {
      console.error('Error recording tax payment:', error);
      alert(`Failed to record tax payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const refreshTaxCalculation = async () => {
    try {
      setRefreshing(true);
      
      // First, refresh the main data if callback is provided
      if (onRefresh) {
        await onRefresh();
      }
      
      // Then reload tax data with fresh revenue information
      await loadTaxData();
      await loadTaxPayments();
      
      // Show success message
      const totalTax = taxRecords.reduce((sum, record) => sum + record.taxAmount, 0);
      const totalPaid = taxPayments.reduce((sum, payment) => sum + payment.amount, 0);
      alert(`Tax calculation refreshed successfully! Current tax liability: $${totalTax.toFixed(2)}, Paid: $${totalPaid.toFixed(2)}`);
      
    } catch (error) {
      console.error('Error refreshing tax calculation:', error);
      alert('Failed to refresh tax calculation. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const getTotalTaxStats = () => {
    const filteredRecords = selectedPeriod === 'all' 
      ? taxRecords 
      : taxRecords.filter(record => record.period === selectedPeriod);

    const totalRevenue = filteredRecords.reduce((sum, record) => sum + record.totalRevenue, 0);
    const totalRevenueInr = filteredRecords.reduce((sum, record) => sum + record.totalRevenueInr, 0);
    const totalTax = filteredRecords.reduce((sum, record) => sum + record.taxAmount, 0);
    const totalTaxInr = filteredRecords.reduce((sum, record) => sum + record.taxAmountInr, 0);
    
    // Calculate total tax payments
    const totalTaxPaid = taxPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalTaxPaidInr = taxPayments.reduce((sum, payment) => sum + payment.amount_inr, 0);
    
    // Calculate remaining tax liability
    const remainingTaxLiability = Math.max(0, totalTax - totalTaxPaid);
    const remainingTaxLiabilityInr = Math.max(0, totalTaxInr - totalTaxPaidInr);

    return {
      totalRevenue,
      totalRevenueInr,
      totalTax,
      totalTaxInr,
      totalTaxPaid,
      totalTaxPaidInr,
      remainingTaxLiability,
      remainingTaxLiabilityInr,
      recordCount: filteredRecords.length
    };
  };

  const stats = getTotalTaxStats();
  const filteredRecords = selectedPeriod === 'all' 
    ? taxRecords 
    : taxRecords.filter(record => record.period === selectedPeriod);

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    return format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy');
  };

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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 space-y-4 lg:space-y-0">
          <div className="flex items-center space-x-3">
            <Calculator className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Tax Management</h2>
            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
              15% Tax Rate
            </span>
            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
              Active Revenue Only
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Period Filter */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="input py-2 px-3 h-auto text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500 min-w-[160px]"
            >
              <option value="all">All Periods</option>
              {taxRecords.map(record => (
                <option key={record.period} value={record.period}>
                  {formatPeriod(record.period)}
                </option>
              ))}
            </select>
            
            {/* Enhanced Refresh Tax Calculation Button - Properly Contained */}
            <div className="flex space-x-3">
              <button
                onClick={refreshTaxCalculation}
                disabled={refreshing}
                className="group relative flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-purple-400 disabled:to-purple-500 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none transition-all duration-200 min-w-[160px] max-w-[200px] whitespace-nowrap"
                title="Refresh tax calculation based on current active revenue"
              >
                {/* Animated background effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-purple-600 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                
                {/* Icon with enhanced animation */}
                <div className="relative flex items-center space-x-2 flex-shrink-0">
                  {refreshing ? (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                        <div className="w-1 h-1 bg-white rounded-full animate-pulse delay-75"></div>
                        <div className="w-1 h-1 bg-white rounded-full animate-pulse delay-150"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <Zap className="w-5 h-5 group-hover:animate-pulse" />
                      <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-300" />
                    </div>
                  )}
                </div>
                
                {/* Button text with proper sizing */}
                <span className="relative text-sm font-bold tracking-wide flex-shrink-0 overflow-hidden text-ellipsis">
                  {refreshing ? 'Refreshing...' : 'Refresh Tax'}
                </span>
                
                {/* Subtle glow effect */}
                <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>
              </button>
              
              {/* Standard refresh button with improved styling */}
              <button
                onClick={() => onRefresh?.().then(() => loadTaxData())}
                className="flex items-center justify-center space-x-2 px-4 py-3 bg-white hover:bg-gray-50 border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap min-w-[120px]"
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm">Refresh Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Refresh Info */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 p-2 bg-purple-100 rounded-lg">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-purple-900 font-bold text-lg mb-2 flex items-center space-x-2">
                <span>Smart Tax Calculation Refresh</span>
                <span className="px-2 py-1 text-xs bg-purple-200 text-purple-800 rounded-full">
                  Real-time
                </span>
              </h3>
              <p className="text-purple-800 text-sm leading-relaxed mb-3">
                The <strong>"Refresh Tax"</strong> button intelligently recalculates your tax liability based on the most current active revenue data. 
                It automatically fetches the latest revenue records from paid receivables and updates all tax calculations in real-time.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="flex items-center space-x-2 text-purple-700">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>Fetches latest revenue data</span>
                </div>
                <div className="flex items-center space-x-2 text-purple-700">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>Applies 15% tax rate automatically</span>
                </div>
                <div className="flex items-center space-x-2 text-purple-700">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>Updates all period calculations</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid - Updated with Tax Liability and Tax Paid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-700 text-sm font-semibold">Active Revenue</p>
                <p className="text-2xl font-bold text-blue-900">₹{stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-blue-200 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-700" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-5 border border-red-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-700 text-sm font-semibold">Tax Liability (15%)</p>
                <p className="text-2xl font-bold text-red-900">₹{stats.remainingTaxLiability.toFixed(2)}</p>
                <p className="text-xs text-red-500 mt-1">Remaining to pay</p>
              </div>
              <div className="p-3 bg-red-200 rounded-lg">
                <Calculator className="w-6 h-6 text-red-700" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-700 text-sm font-semibold">Tax Paid</p>
                <p className="text-2xl font-bold text-green-900">₹{stats.totalTaxPaid.toFixed(2)}</p>
                <div className="flex items-center mt-1">
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="flex items-center space-x-1 text-xs text-green-700 hover:text-green-900 font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Payment</span>
                  </button>
                </div>
              </div>
              <div className="p-3 bg-green-200 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-700" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-700 text-sm font-semibold">After-Tax Revenue</p>
                <p className="text-2xl font-bold text-purple-900">₹{(stats.totalRevenue - stats.totalTax).toFixed(2)}</p>
              </div>
              <div className="p-3 bg-purple-200 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-700" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-700 text-sm font-semibold">Tax Periods</p>
                <p className="text-2xl font-bold text-orange-900">{stats.recordCount}</p>
                <p className="text-sm text-orange-600">
                  {selectedPeriod === 'all' ? 'All periods' : formatPeriod(selectedPeriod)}
                </p>
              </div>
              <div className="p-3 bg-orange-200 rounded-lg">
                <Calendar className="w-6 h-6 text-orange-700" />
              </div>
            </div>
          </div>
        </div>

        {/* Tax Calculation Info */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-purple-900 font-bold text-lg mb-3 flex items-center space-x-2">
            <Calculator className="w-5 h-5" />
            <span>Tax Calculation Method</span>
          </h3>
          <p className="text-purple-800 text-sm leading-relaxed">
            Tax is calculated as <strong>15% of active revenue</strong> for each period. 
            Only revenue from paid receivables (non-cancelled) is included in the calculation.
            This is a simplified calculation based on gross active revenue and does not account for deductions, 
            expenses, or other tax considerations. Please consult with a tax professional for accurate tax planning.
          </p>
        </div>
      </div>

      {/* Tax Paid Section */}
      {taxPayments.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span>Tax Payments History</span>
          </h3>
          <div className="space-y-3">
            {taxPayments.map(payment => (
              <div key={payment.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-lg font-semibold text-green-900">
                        ₹{payment.amount.toFixed(2)}
                      </span>
                      <span className="px-2 py-1 text-xs bg-green-200 text-green-800 rounded-full">
                        PAID
                      </span>
                    </div>
                    <div className="text-sm text-green-700">
                      <span className="font-medium">Payment Date:</span> {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                    </div>
                    {payment.notes && (
                      <div className="text-sm text-green-600 mt-1 italic">
                        "{payment.notes}"
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-green-500">
                    Recorded: {format(new Date(payment.created_at), 'MMM dd, yyyy')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tax Records List */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <span>Tax Records by Period</span>
            {selectedPeriod !== 'all' && (
              <span className="text-sm font-normal text-gray-500">
                - {formatPeriod(selectedPeriod)}
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
                <span>Expand ({filteredRecords.length})</span>
              </>
            )}
          </button>
        </div>
        
        {isExpanded && (
          <>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No tax records found.</p>
                <p className="text-sm">Tax records are generated based on active revenue data from paid receivables.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRecords.map(record => (
                  <div key={record.period} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h4 className="text-lg font-medium text-gray-900">
                            {formatPeriod(record.period)}
                          </h4>
                          <span className="px-2 py-1 text-xs rounded-full font-medium bg-purple-100 text-purple-800">
                            {(record.taxRate * 100).toFixed(0)}% TAX RATE
                          </span>
                          <span className="px-2 py-1 text-xs rounded-full font-medium bg-green-100 text-green-800">
                            ACTIVE REVENUE
                          </span>
                        </div>
                        
                        {/* Financial Summary */}
                        <div className="bg-gray-50 rounded p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="font-medium text-gray-700">Active Revenue</div>
                              <div className="text-lg font-bold text-gray-900">₹{record.totalRevenue.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="font-medium text-gray-700">Tax Liability</div>
                              <div className="text-lg font-bold text-purple-600">₹{record.taxAmount.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="font-medium text-gray-700">After-Tax Revenue</div>
                              <div className="text-lg font-bold text-green-600">
                                ₹{(record.totalRevenue - record.taxAmount).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="font-medium text-gray-700">Tax Percentage</div>
                              <div className="text-lg font-bold text-orange-600">
                                {((record.taxAmount / record.totalRevenue) * 100).toFixed(1)}%
                              </div>
                              <div className="text-sm text-orange-500">of active revenue</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Tax Summary */}
      {filteredRecords.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Summary</h3>
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-purple-800 font-semibold mb-3">USD Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Revenue:</span>
                    <span className="font-semibold">₹{stats.totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Tax Liability (15%):</span>
                    <span className="font-semibold text-purple-600">₹{stats.totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax Paid:</span>
                    <span className="font-semibold text-green-600">₹{stats.totalTaxPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-purple-200 pt-2">
                    <span className="text-gray-600">Remaining Tax Liability:</span>
                    <span className="font-bold text-red-600">₹{stats.remainingTaxLiability.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">After-Tax Revenue:</span>
                    <span className="font-bold text-green-600">₹{(stats.totalRevenue - stats.totalTax).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-purple-800 font-semibold mb-3">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Revenue:</span>
                    <span className="font-semibold">₹{stats.totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Tax Liability (15%):</span>
                    <span className="font-semibold text-purple-600">₹{stats.totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax Paid:</span>
                    <span className="font-semibold text-green-600">₹{stats.totalTaxPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-purple-200 pt-2">
                    <span className="text-gray-600">Remaining Tax Liability:</span>
                    <span className="font-bold text-red-600">₹{stats.remainingTaxLiability.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">After-Tax Revenue:</span>
                    <span className="font-bold text-green-600">₹{(stats.totalRevenue - stats.totalTax).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Tax Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Record Tax Payment</h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-red-50 rounded p-3 border border-red-200">
                <div className="text-sm text-red-800">
                  <div className="flex justify-between">
                    <span><strong>Total Tax Liability:</strong></span>
                    <span>₹{stats.totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span><strong>Already Paid:</strong></span>
                    <span>₹{stats.totalTaxPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-red-300">
                    <span><strong>Remaining:</strong></span>
                    <span>₹{stats.remainingTaxLiability.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span><strong>Exchange Rate:</strong></span>
                    <span>₹{exchangeRate?.toFixed(2) || '...'} per USD</span>
                  </div>
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
                  step="0.01"
                  className="input"
                  disabled={isProcessingPayment}
                />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-500">
                    Maximum recommended: ₹{stats.remainingTaxLiability.toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="input"
                  disabled={isProcessingPayment}
                />
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
                  disabled={isProcessingPayment}
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleAddTaxPayment}
                disabled={isProcessingPayment || paymentAmount <= 0}
                className="btn-primary flex-1"
              >
                {isProcessingPayment ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                <span>{isProcessingPayment ? 'Recording...' : 'Record Payment'}</span>
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount(0);
                  setPaymentNotes('');
                  setPaymentDate(new Date().toISOString().split('T')[0]);
                }}
                disabled={isProcessingPayment}
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