import React, { useState, useEffect } from 'react';
import { Key, Plus, Copy, Eye, EyeOff, Trash2, Calendar, Activity, Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface ApiKey {
  id: string;
  name: string;
  key_hash: string;
  permissions: string[];
  rate_limit: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_used?: string;
  expires_at?: string;
}

interface ApiUsageLog {
  id: string;
  endpoint: string;
  method: string;
  ip_address: string;
  response_status: number;
  response_time_ms: number;
  created_at: string;
  error_message?: string;
}

interface ApiKeyManagementProps {
  onRefresh?: () => Promise<void>;
}

export function ApiKeyManagement({ onRefresh }: ApiKeyManagementProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [usageLogs, setUsageLogs] = useState<ApiUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUsageLogs, setShowUsageLogs] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read:projects', 'read:tasks']);
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(60);
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);

  const availablePermissions = [
    'read:projects',
    'read:tasks',
    'read:analytics'
  ];

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsageLogs = async (keyId: string) => {
    try {
      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .eq('api_key_id', keyId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setUsageLogs(data || []);
    } catch (error) {
      console.error('Error loading usage logs:', error);
    }
  };

  const generateApiKey = (): string => {
    // Generate a secure random API key
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'tmp_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const hashApiKey = async (apiKey: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    try {
      const apiKey = generateApiKey();
      const keyHash = await hashApiKey(apiKey);

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          name: newKeyName.trim(),
          key_hash: keyHash,
          permissions: newKeyPermissions,
          rate_limit: newKeyRateLimit,
          created_by: profile?.id,
          expires_at: newKeyExpiry || null
        })
        .select()
        .single();

      if (error) throw error;

      setGeneratedKey(apiKey);
      setShowGeneratedKey(true);
      setShowCreateModal(false);
      setNewKeyName('');
      setNewKeyPermissions(['read:projects', 'read:tasks']);
      setNewKeyRateLimit(60);
      setNewKeyExpiry('');
      
      await loadApiKeys();
    } catch (error) {
      console.error('Error creating API key:', error);
      alert('Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleApiKey = async (keyId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: !isActive })
        .eq('id', keyId);

      if (error) throw error;
      await loadApiKeys();
    } catch (error) {
      console.error('Error toggling API key:', error);
    }
  };

  const deleteApiKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to delete the API key "${keyName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;
      await loadApiKeys();
    } catch (error) {
      console.error('Error deleting API key:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const getStatusColor = (isActive: boolean, expiresAt?: string) => {
    if (!isActive) return 'bg-red-100 text-red-800';
    if (expiresAt && new Date(expiresAt) < new Date()) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (isActive: boolean, expiresAt?: string) => {
    if (!isActive) return 'Inactive';
    if (expiresAt && new Date(expiresAt) < new Date()) return 'Expired';
    return 'Active';
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
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Key className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">API Key Management</h2>
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
              Third-Party Access
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={loadApiKeys}
              className="btn-outline py-1 px-3 h-auto"
              title="Refresh API keys"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </button>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create API Key
            </button>
          </div>
        </div>

        {/* API Documentation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-blue-900 font-semibold mb-2 flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>API Documentation</span>
          </h3>
          <div className="text-blue-800 text-sm space-y-2">
            <p><strong>Endpoint:</strong> <code className="bg-blue-100 px-2 py-1 rounded">/functions/v1/third-party-api</code></p>
            <p><strong>Method:</strong> GET</p>
            <p><strong>Authentication:</strong> Include <code className="bg-blue-100 px-2 py-1 rounded">X-API-Key: your_api_key</code> header</p>
            <div>
              <p><strong>Query Parameters:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><code>project_id</code> - Filter by specific project ID</li>
                <li><code>project_status</code> - Filter by project status (active, completed, on_hold)</li>
                <li><code>task_status</code> - Filter by task status (todo, in_progress, review, completed, hold)</li>
                <li><code>limit</code> - Number of records to return (max 1000, default 100)</li>
                <li><code>offset</code> - Number of records to skip (for pagination)</li>
              </ul>
            </div>
            <p><strong>Response:</strong> JSON with project names, task details, and status information (attachments are automatically removed from descriptions)</p>
          </div>
        </div>

        {/* API Keys List */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">API Keys</h3>
          
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Key className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No API keys found.</p>
              <p className="text-sm">Create your first API key to enable third-party access.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map(key => (
                <div key={key.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{key.name}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(key.is_active, key.expires_at)}`}>
                          {getStatusText(key.is_active, key.expires_at)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="font-medium">Permissions:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {key.permissions.map(permission => (
                              <span key={permission} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                {permission}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Rate Limit:</span> {key.rate_limit}/min
                        </div>
                        <div>
                          <span className="font-medium">Created:</span> {format(new Date(key.created_at), 'MMM dd, yyyy')}
                        </div>
                        <div>
                          <span className="font-medium">Last Used:</span> {key.last_used ? format(new Date(key.last_used), 'MMM dd, yyyy') : 'Never'}
                        </div>
                      </div>

                      {key.expires_at && (
                        <div className="text-sm text-orange-600 mb-2">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          Expires: {format(new Date(key.expires_at), 'MMM dd, yyyy')}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedKeyId(key.id);
                          loadUsageLogs(key.id);
                          setShowUsageLogs(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View usage logs"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => toggleApiKey(key.id, key.is_active)}
                        className={`p-2 rounded-lg transition-colors ${
                          key.is_active 
                            ? 'text-orange-600 hover:bg-orange-50' 
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={key.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {key.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={() => deleteApiKey(key.id, key.name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete API key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New API Key</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Name *
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="input"
                  placeholder="e.g., Mobile App Integration"
                  disabled={isCreating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permissions
                </label>
                <div className="space-y-2">
                  {availablePermissions.map(permission => (
                    <label key={permission} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newKeyPermissions.includes(permission)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyPermissions([...newKeyPermissions, permission]);
                          } else {
                            setNewKeyPermissions(newKeyPermissions.filter(p => p !== permission));
                          }
                        }}
                        className="rounded border-gray-300"
                        disabled={isCreating}
                      />
                      <span className="text-sm text-gray-700">{permission}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate Limit (requests per minute)
                </label>
                <input
                  type="number"
                  value={newKeyRateLimit}
                  onChange={(e) => setNewKeyRateLimit(Number(e.target.value))}
                  min="1"
                  max="1000"
                  className="input"
                  disabled={isCreating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={newKeyExpiry}
                  onChange={(e) => setNewKeyExpiry(e.target.value)}
                  className="input"
                  disabled={isCreating}
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={createApiKey}
                disabled={isCreating || !newKeyName.trim() || newKeyPermissions.length === 0}
                className="btn-primary flex-1"
              >
                {isCreating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <Key className="w-4 h-4 mr-2" />
                )}
                <span>{isCreating ? 'Creating...' : 'Create API Key'}</span>
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyName('');
                  setNewKeyPermissions(['read:projects', 'read:tasks']);
                  setNewKeyRateLimit(60);
                  setNewKeyExpiry('');
                }}
                disabled={isCreating}
                className="btn-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated API Key Modal */}
      {showGeneratedKey && generatedKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">API Key Created Successfully</h3>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-yellow-800 text-sm">
                  <p className="font-medium mb-1">Important Security Notice</p>
                  <p>This is the only time you'll see this API key. Please copy and store it securely.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your API Key
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={generatedKey}
                    readOnly
                    className="input flex-1 font-mono text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedKey)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  <strong>Usage:</strong> Include this key in the <code>X-API-Key</code> header when making requests to the API.
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowGeneratedKey(false);
                  setGeneratedKey(null);
                }}
                className="btn-primary"
              >
                I've Saved the Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Logs Modal */}
      {showUsageLogs && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">API Usage Logs</h3>
              <button 
                onClick={() => setShowUsageLogs(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            {usageLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No usage logs found for this API key.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {usageLogs.map(log => (
                  <div key={log.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          log.response_status >= 200 && log.response_status < 300 
                            ? 'bg-green-100 text-green-800'
                            : log.response_status >= 400 && log.response_status < 500
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {log.response_status}
                        </span>
                        <span className="font-mono text-sm">{log.method} {log.endpoint}</span>
                        <span className="text-sm text-gray-500">{log.ip_address}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')} • {log.response_time_ms}ms
                      </div>
                    </div>
                    {log.error_message && (
                      <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                        {log.error_message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}