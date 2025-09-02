import React, { useState, useEffect } from 'react';
import { X, HelpCircle } from 'lucide-react';
import { Project } from '../types';

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onSubmit: (project: Omit<Project, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => void;
}

export function EditProjectModal({ project, onClose, onSubmit }: EditProjectModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as const,
    priority: 'medium' as const,
    start_date: '',
    end_date: '',
    rate_type: 'hourly' as const,
    hourly_rate: 50,
    fixed_rate: 0,
    inr_conversion_rule: '',
    inr_conversion_factor: 1,
  });
  const [showConversionHelp, setShowConversionHelp] = useState(false);

  useEffect(() => {
    // Initialize form with project data
    setFormData({
      name: project.name,
      description: project.description,
      status: project.status as any,
      priority: project.priority as any,
      start_date: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '',
      end_date: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '',
      rate_type: project.rate_type as any || 'hourly',
      hourly_rate: project.hourly_rate || 50,
      fixed_rate: project.fixed_rate || 0,
      inr_conversion_rule: project.inr_conversion_rule || '',
      inr_conversion_factor: project.inr_conversion_factor || 1,
    });
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      end_date: formData.end_date || undefined,
      fixed_rate: formData.rate_type === 'fixed' ? formData.fixed_rate : undefined,
      inr_conversion_rule: formData.inr_conversion_rule || undefined,
      inr_conversion_factor: formData.inr_conversion_factor || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Edit Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="Enter project name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input min-h-[80px] resize-none"
              placeholder="Enter project description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="input"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="input"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rate Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center space-x-2 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="hourly"
                  checked={formData.rate_type === 'hourly'}
                  onChange={(e) => setFormData({ ...formData, rate_type: e.target.value as any })}
                  className="text-blue-600"
                />
                <span>Hourly Rate</span>
              </label>
              <label className="flex items-center space-x-2 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="fixed"
                  checked={formData.rate_type === 'fixed'}
                  onChange={(e) => setFormData({ ...formData, rate_type: e.target.value as any })}
                  className="text-blue-600"
                />
                <span>Fixed Rate</span>
              </label>
            </div>
          </div>

          {formData.rate_type === 'hourly' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hourly Rate (₹)
              </label>
              <input
                type="number"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: Number(e.target.value) })}
                min="0"
                step="0.01"
                className="input"
                placeholder="4000.00"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fixed Amount (₹)
              </label>
              <input
                type="number"
                value={formData.fixed_rate}
                onChange={(e) => setFormData({ ...formData, fixed_rate: Number(e.target.value) })}
                min="0"
                step="0.01"
                className="input"
                placeholder="400000.00"
              />
            </div>
          )}

          {/* INR Conversion Factor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                INR Conversion Factor (%)
              </label>
              <button 
                type="button"
                onClick={() => setShowConversionHelp(!showConversionHelp)}
                className="text-blue-500 hover:text-blue-700"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <input
              type="number"
              value={formData.inr_conversion_factor * 100}
              onChange={(e) => setFormData({ 
                ...formData, 
                inr_conversion_factor: Number(e.target.value) / 100 
              })}
              min="0"
              step="0.01"
              className="input"
              placeholder="100.00"
            />
            <p className="text-xs text-gray-500 mt-1">
              Percentage adjustment for rupee calculations (e.g., 99.97 for 99.97% of base rate)
            </p>
            
            {showConversionHelp && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <p className="font-medium mb-1">How INR Conversion Works:</p>
                <p className="mb-2">The formula used is: <code>USD amount × Exchange Rate × (Factor/100)</code></p>
                <p>Examples:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Factor = 100%: Standard conversion (100%)</li>
                  <li>Factor = 80%: 80% of standard rate</li>
                  <li>Factor = 99.97%: 99.97% of standard rate</li>
                </ul>
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              Update Project
            </button>
            <button type="button" onClick={onClose} className="btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}