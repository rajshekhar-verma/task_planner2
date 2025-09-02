import React, { useState } from 'react';
import { Trash2, AlertTriangle, RefreshCw, Database, CheckCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CleanupStats {
  projects: number;
  tasks: number;
  receivables: number;
  revenueRecords: number;
  invoices: number;
  invoiceItems: number;
  taskAttachments: number;
  apiKeys: number;
  apiUsageLogs: number;
  apiRateLimits: number;
  taxGroups: number;
  taxRecords: number;
}

interface CleanupManagementProps {
  onRefresh?: () => Promise<void>;
}

export function CleanupManagement({ onRefresh }: CleanupManagementProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<CleanupStats | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResults, setDeleteResults] = useState<Record<string, number> | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Get count of records from each table (excluding user-related tables)
      const [
        projectsCount,
        tasksCount,
        receivablesCount,
        revenueRecordsCount,
        invoicesCount,
        invoiceItemsCount,
        taskAttachmentsCount,
        apiKeysCount,
        apiUsageLogsCount,
        apiRateLimitsCount,
        taxGroupsCount,
        taxRecordsCount
      ] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }),
        supabase.from('receivables').select('id', { count: 'exact', head: true }),
        supabase.from('revenue_records').select('id', { count: 'exact', head: true }),
        supabase.from('invoices').select('id', { count: 'exact', head: true }),
        supabase.from('invoice_items').select('id', { count: 'exact', head: true }),
        supabase.from('task_attachments').select('id', { count: 'exact', head: true }),
        supabase.from('api_keys').select('id', { count: 'exact', head: true }),
        supabase.from('api_usage_logs').select('id', { count: 'exact', head: true }),
        supabase.from('api_rate_limits').select('id', { count: 'exact', head: true }),
        supabase.from('tax_groups').select('id', { count: 'exact', head: true }),
        supabase.from('tax_records').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        projects: projectsCount.count || 0,
        tasks: tasksCount.count || 0,
        receivables: receivablesCount.count || 0,
        revenueRecords: revenueRecordsCount.count || 0,
        invoices: invoicesCount.count || 0,
        invoiceItems: invoiceItemsCount.count || 0,
        taskAttachments: taskAttachmentsCount.count || 0,
        apiKeys: apiKeysCount.count || 0,
        apiUsageLogs: apiUsageLogsCount.count || 0,
        apiRateLimits: apiRateLimitsCount.count || 0,
        taxGroups: taxGroupsCount.count || 0,
        taxRecords: taxRecordsCount.count || 0
      });
    } catch (error) {
      console.error('Error loading cleanup stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const performCleanup = async () => {
    try {
      setIsDeleting(true);
      const results: Record<string, number> = {};

      // Delete in order to respect foreign key constraints
      // Start with dependent tables first, then parent tables

      // 1. Delete tax records
      const { count: taxRecordsDeleted } = await supabase
        .from('tax_records')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.taxRecords = taxRecordsDeleted || 0;

      // 2. Delete revenue records
      const { count: revenueRecordsDeleted } = await supabase
        .from('revenue_records')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.revenueRecords = revenueRecordsDeleted || 0;

      // 3. Delete invoice items
      const { count: invoiceItemsDeleted } = await supabase
        .from('invoice_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.invoiceItems = invoiceItemsDeleted || 0;

      // 4. Delete task attachments
      const { count: taskAttachmentsDeleted } = await supabase
        .from('task_attachments')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.taskAttachments = taskAttachmentsDeleted || 0;

      // 5. Delete API usage logs
      const { count: apiUsageLogsDeleted } = await supabase
        .from('api_usage_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.apiUsageLogs = apiUsageLogsDeleted || 0;

      // 6. Delete API rate limits
      const { count: apiRateLimitsDeleted } = await supabase
        .from('api_rate_limits')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.apiRateLimits = apiRateLimitsDeleted || 0;

      // 7. Delete API keys
      const { count: apiKeysDeleted } = await supabase
        .from('api_keys')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.apiKeys = apiKeysDeleted || 0;

      // 8. Delete receivables
      const { count: receivablesDeleted } = await supabase
        .from('receivables')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.receivables = receivablesDeleted || 0;

      // 9. Delete invoices
      const { count: invoicesDeleted } = await supabase
        .from('invoices')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.invoices = invoicesDeleted || 0;

      // 10. Delete tasks
      const { count: tasksDeleted } = await supabase
        .from('tasks')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.tasks = tasksDeleted || 0;

      // 11. Delete projects
      const { count: projectsDeleted } = await supabase
        .from('projects')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.projects = projectsDeleted || 0;

      // 12. Delete tax groups (independent table)
      const { count: taxGroupsDeleted } = await supabase
        .from('tax_groups')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      results.taxGroups = taxGroupsDeleted || 0;

      setDeleteResults(results);
      
      // Refresh data if callback provided
      if (onRefresh) {
        await onRefresh();
      }
      
      // Reload stats
      await loadStats();
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      alert(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
      setShowConfirmModal(false);
      setConfirmText('');
    }
  };

  const handleCleanupClick = () => {
    setShowConfirmModal(true);
    setConfirmText('');
    setDeleteResults(null);
  };

  const canConfirmDelete = confirmText.toLowerCase() === 'delete all data';

  const getTotalRecords = () => {
    if (!stats) return 0;
    return Object.values(stats).reduce((sum, count) => sum + count, 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Database className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-gray-900">Database Cleanup</h2>
            <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
              Danger Zone
            </span>
          </div>
          
          <button
            onClick={loadStats}
            disabled={loading}
            className="btn-outline py-1 px-3 h-auto"
            title="Refresh stats"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh Stats
          </button>
        </div>

        {/* Warning */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-red-800 font-semibold mb-2">⚠️ Critical Warning</h3>
              <p className="text-red-700 text-sm mb-2">
                This action will permanently delete ALL data from the following tables:
              </p>
              <ul className="text-red-700 text-sm list-disc list-inside space-y-1">
                <li>Projects and all associated tasks</li>
                <li>Invoices and invoice items</li>
                <li>Receivables and revenue records</li>
                <li>Task attachments and API logs</li>
                <li>Tax groups and tax records</li>
              </ul>
              <p className="text-red-700 text-sm mt-2 font-semibold">
                User accounts and profiles will NOT be affected.
              </p>
              <p className="text-red-700 text-sm mt-1">
                This action cannot be undone. Make sure you have a backup if needed.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-blue-600 text-xs font-medium">Projects</div>
              <div className="text-xl font-bold text-blue-900">{stats.projects}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-purple-600 text-xs font-medium">Tasks</div>
              <div className="text-xl font-bold text-purple-900">{stats.tasks}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-green-600 text-xs font-medium">Invoices</div>
              <div className="text-xl font-bold text-green-900">{stats.invoices}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-yellow-600 text-xs font-medium">Receivables</div>
              <div className="text-xl font-bold text-yellow-900">{stats.receivables}</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <div className="text-indigo-600 text-xs font-medium">Revenue Records</div>
              <div className="text-xl font-bold text-indigo-900">{stats.revenueRecords}</div>
            </div>
            <div className="bg-pink-50 rounded-lg p-3 text-center">
              <div className="text-pink-600 text-xs font-medium">API Keys</div>
              <div className="text-xl font-bold text-pink-900">{stats.apiKeys}</div>
            </div>
          </div>
        )}

        {/* Total Records */}
        {stats && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-gray-800 font-semibold">Total Records to Delete</h3>
                <p className="text-gray-600 text-sm">Across all non-user tables</p>
              </div>
              <div className="text-3xl font-bold text-red-600">
                {getTotalRecords().toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-center">
          <button
            onClick={handleCleanupClick}
            disabled={loading || !stats || getTotalRecords() === 0}
            className="flex items-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            <span>Delete All Data</span>
          </button>
        </div>
      </div>

      {/* Detailed Breakdown */}
      {stats && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(stats).map(([table, count]) => (
              <div key={table} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-gray-700 capitalize">
                  {table.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="font-semibold text-gray-900">
                  {count.toLocaleString()} records
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Confirm Data Deletion</h3>
            </div>
            
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-red-800 text-sm font-medium mb-2">
                  You are about to permanently delete {getTotalRecords().toLocaleString()} records!
                </p>
                <p className="text-red-700 text-sm">
                  This action will remove all projects, tasks, invoices, receivables, and related data.
                  User accounts and profiles will remain intact.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type "delete all data" to confirm:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="input"
                  placeholder="delete all data"
                  disabled={isDeleting}
                />
              </div>

              {deleteResults && (
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-green-800 font-medium text-sm">Cleanup Completed</span>
                  </div>
                  <div className="text-green-700 text-xs space-y-1">
                    {Object.entries(deleteResults).map(([table, count]) => (
                      <div key={table} className="flex justify-between">
                        <span>{table}:</span>
                        <span>{count} deleted</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
              {!deleteResults && (
                <button
                  onClick={performCleanup}
                  disabled={!canConfirmDelete || isDeleting}
                  className="btn-primary flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  <span>{isDeleting ? 'Deleting...' : 'Delete All Data'}</span>
                </button>
              )}
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmText('');
                  setDeleteResults(null);
                }}
                disabled={isDeleting}
                className="btn-outline flex-1"
              >
                {deleteResults ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}