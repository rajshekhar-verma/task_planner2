import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Calendar, TrendingUp, Clock, Target, Filter, X } from 'lucide-react';
import { Task, Project, Receivable, Invoice, AnalyticsData } from '../types';
import { format, subDays, parseISO } from 'date-fns';

interface AnalyticsProps {
  tasks: Task[];
  projects: Project[];
  receivables: Receivable[];
  invoices: Invoice[];
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export function Analytics({ tasks, projects, receivables, invoices }: AnalyticsProps) {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [filterProject, setFilterProject] = useState<string>('all');

  // Filter tasks based on project selection and date range
  const filteredTasks = tasks.filter(task => {
    const taskDate = new Date(task.created_at);
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999); // End of day
    
    const dateInRange = taskDate >= startDate && taskDate <= endDate;
    const projectMatches = filterProject === 'all' || task.project_id === filterProject;
    
    return dateInRange && projectMatches;
  });

  // Calculate analytics data
  const analytics: AnalyticsData = {
    statusDistribution: {},
    priorityDistribution: {},
    hoursWorkedByDate: [],
    totalHours: 0,
    completionRate: 0,
    averageTaskDuration: 0
  };

  // Status distribution
  filteredTasks.forEach(task => {
    analytics.statusDistribution[task.status] = (analytics.statusDistribution[task.status] || 0) + 1;
  });

  // Priority distribution
  filteredTasks.forEach(task => {
    analytics.priorityDistribution[task.priority] = (analytics.priorityDistribution[task.priority] || 0) + 1;
  });

  // Hours worked by date
  const hoursByDate: Record<string, number> = {};
  filteredTasks.forEach(task => {
    const date = format(new Date(task.created_at), 'yyyy-MM-dd');
    hoursByDate[date] = (hoursByDate[date] || 0) + (task.hours_worked || 0);
  });

  analytics.hoursWorkedByDate = Object.entries(hoursByDate).map(([date, hours]) => ({
    date,
    hours
  })).sort((a, b) => a.date.localeCompare(b.date));

  // Total hours
  analytics.totalHours = filteredTasks.reduce((sum, task) => sum + (task.hours_worked || 0), 0);

  // Completion rate
  const completedTasks = filteredTasks.filter(task => task.status === 'completed').length;
  analytics.completionRate = filteredTasks.length > 0 ? (completedTasks / filteredTasks.length) * 100 : 0;

  // Average task duration (in days)
  const completedTasksWithDates = filteredTasks.filter(task => 
    task.status === 'completed' && task.created_at && task.updated_at
  );
  
  if (completedTasksWithDates.length > 0) {
    const totalDuration = completedTasksWithDates.reduce((sum, task) => {
      const startDate = new Date(task.created_at);
      const endDate = new Date(task.updated_at);
      const durationMs = endDate.getTime() - startDate.getTime();
      return sum + (durationMs / (1000 * 60 * 60 * 24)); // Convert to days
    }, 0);
    
    analytics.averageTaskDuration = totalDuration / completedTasksWithDates.length;
  }

  // Calculate revenue with proper cancellation handling
  const activeReceivables = receivables.filter(r => r.status !== 'cancelled');
  const cancelledReceivables = receivables.filter(r => r.status === 'cancelled');
  
  const totalRevenue = activeReceivables.reduce((sum, receivable) => sum + receivable.amount, 0);
  const paidRevenue = activeReceivables
    .filter(receivable => receivable.status === 'paid')
    .reduce((sum, receivable) => sum + receivable.amount, 0);
  const cancelledAmount = cancelledReceivables.reduce((sum, receivable) => sum + receivable.amount, 0);

  // Calculate invoice metrics with cancellation handling
  const activeInvoices = invoices.filter(i => i.status !== 'cancelled');
  const cancelledInvoices = invoices.filter(i => i.status === 'cancelled');
  const cancelledInvoiceAmount = cancelledInvoices.reduce((sum, invoice) => {
    // Extract original amount from notes if available
    const notesMatch = invoice.notes?.match(/Original (?:final|total) amount: \$([0-9,]+\.?[0-9]*)/);
    if (notesMatch) {
      return sum + parseFloat(notesMatch[1].replace(/,/g, ''));
    }
    return sum;
  }, 0);

  // Prepare chart data
  const statusData = Object.entries(analytics.statusDistribution).map(([status, count]) => ({
    name: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: count
  }));

  const priorityData = Object.entries(analytics.priorityDistribution).map(([priority, count]) => ({
    name: priority.charAt(0).toUpperCase() + priority.slice(1),
    value: count
  }));

  // Revenue breakdown data for pie chart
  const revenueBreakdownData = [
    { name: 'Collected', value: paidRevenue, color: '#10B981' },
    { name: 'Outstanding', value: totalRevenue - paidRevenue, color: '#F59E0B' },
    { name: 'Cancelled', value: cancelledAmount, color: '#EF4444' }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <BarChart className="w-6 h-6 text-blue-600" />
            <span>Analytics Dashboard</span>
          </h2>
          
          <div className="flex items-center space-x-4">
            {/* Project Filter */}
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
            </div>
            
            {/* Date Range */}
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                className="input py-1 px-3 h-auto"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                className="input py-1 px-3 h-auto"
              />
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Total Tasks</p>
                <p className="text-2xl font-bold text-blue-900">{filteredTasks.length}</p>
              </div>
              <Target className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Completion Rate</p>
                <p className="text-2xl font-bold text-green-900">{analytics.completionRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Total Hours</p>
                <p className="text-2xl font-bold text-purple-900">{analytics.totalHours.toFixed(1)}h</p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-medium">Active Revenue</p>
                <p className="text-2xl font-bold text-yellow-900">${totalRevenue.toFixed(0)}</p>
              </div>
              <span className="text-2xl">💰</span>
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Cancelled</p>
                <p className="text-2xl font-bold text-red-900">${cancelledAmount.toFixed(0)}</p>
              </div>
              <X className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Status Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Hours Worked Over Time */}
        {analytics.hoursWorkedByDate.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Hours Worked Over Time</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.hoursWorkedByDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="hours" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Revenue Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h3>
            {revenueBreakdownData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueBreakdownData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name} $${value.toFixed(0)} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {revenueBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <p>No revenue data available</p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg border border-green-200">
                <div className="flex justify-between items-center">
                  <span className="text-green-700 font-medium">Total Active Revenue</span>
                  <span className="text-2xl font-bold text-green-900">${totalRevenue.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 font-medium">Collected Revenue</span>
                  <span className="text-2xl font-bold text-blue-900">${paidRevenue.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-orange-200">
                <div className="flex justify-between items-center">
                  <span className="text-orange-700 font-medium">Outstanding</span>
                  <span className="text-2xl font-bold text-orange-900">${(totalRevenue - paidRevenue).toFixed(2)}</span>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-red-200">
                <div className="flex justify-between items-center">
                  <span className="text-red-700 font-medium">Cancelled Amount</span>
                  <span className="text-2xl font-bold text-red-900">${cancelledAmount.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <div className="flex justify-between items-center">
                  <span className="text-purple-700 font-medium">Collection Rate</span>
                  <span className="text-2xl font-bold text-purple-900">
                    {totalRevenue > 0 ? ((paidRevenue / totalRevenue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Analysis */}
        <div className="bg-gray-50 rounded-lg p-4 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Analysis</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-sm text-gray-500">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-sm text-gray-500">Active Invoices</p>
              <p className="text-2xl font-bold text-blue-600">{activeInvoices.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-sm text-gray-500">Paid Invoices</p>
              <p className="text-2xl font-bold text-green-600">
                {activeInvoices.filter(i => i.status === 'paid').length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-sm text-gray-500">Cancelled Invoices</p>
              <p className="text-2xl font-bold text-red-600">{cancelledInvoices.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center">
              <p className="text-sm text-gray-500">Cancelled Value</p>
              <p className="text-xl font-bold text-red-600">${cancelledInvoiceAmount.toFixed(0)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}