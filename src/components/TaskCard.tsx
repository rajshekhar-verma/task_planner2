import React, { useState } from 'react';
import { Calendar, User, AlertCircle, Folder, Clock, ArrowRight, RotateCcw, CheckCircle, Pause, Play, Edit, Hash, Image as ImageIcon, Eye, Archive, Undo } from 'lucide-react';
import { Task, Project } from '../types';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

interface TaskCardProps {
  task: Task;
  projects: Project[];
  onTaskUpdated?: () => void;
  onEditTask?: (task: Task) => void;
  onViewDetails?: (task: Task) => void;
}

export function TaskCard({ task, projects, onTaskUpdated, onEditTask, onViewDetails }: TaskCardProps) {
  const project = projects.find(p => p.id === task.project_id);
  const [isUpdating, setIsUpdating] = useState(false);
  const [actualHours, setActualHours] = useState(task.hours_worked || 0);
  const [showHoursInput, setShowHoursInput] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'review':
        return 'bg-purple-100 text-purple-800';
      case 'todo':
        return 'bg-gray-100 text-gray-800';
      case 'hold':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-500';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'todo':
        return 'in_progress';
      case 'in_progress':
        return 'review';
      case 'review':
        return 'completed';
      case 'hold':
        return 'in_progress';
      default:
        return currentStatus;
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      let updateData: any = {
        status: newStatus,
      };

      // If archiving, store the previous status and set archived_at
      if (newStatus === 'archived') {
        updateData.previous_status = task.status;
        updateData.archived_at = new Date().toISOString();
      }

      // If unarchiving, restore the previous status and clear archived_at
      if (task.status === 'archived' && newStatus !== 'archived') {
        updateData.previous_status = null;
        updateData.archived_at = null;
      }

      // If moving to completed, ask for actual hours
      if (newStatus === 'completed' && !showHoursInput) {
        setShowHoursInput(true);
        setIsUpdating(false);
        return;
      }

      // Update progress percentage based on status
      switch (newStatus) {
        case 'todo':
          updateData.progress_percentage = 0;
          break;
        case 'in_progress':
          updateData.progress_percentage = 30;
          break;
        case 'review':
          updateData.progress_percentage = 80;
          break;
        case 'completed':
          updateData.progress_percentage = 100;
          updateData.hours_worked = actualHours;
          // Set completed_on to today if not already set
          if (!task.completed_on) {
            updateData.completed_on = new Date().toISOString().split('T')[0];
          }
          break;
        case 'hold':
          // Keep current progress
          break;
        case 'archived':
          // Keep current progress
          break;
      }

      // If moving away from completed, clear completed_on
      if (task.status === 'completed' && newStatus !== 'completed') {
        updateData.completed_on = null;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', task.id);

      if (error) throw error;
      
      if (onTaskUpdated) onTaskUpdated();
      
      if (newStatus === 'completed') {
        setShowHoursInput(false);
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmitHours = () => {
    handleStatusChange('completed');
  };

  const handleArchive = () => {
    if (window.confirm('Are you sure you want to archive this task? Archived tasks are hidden from the main view but can be restored later.')) {
      handleStatusChange('archived');
    }
  };

  const handleUnarchive = () => {
    if (window.confirm('Are you sure you want to restore this task from archive?')) {
      // Restore to previous status or default to 'todo'
      const restoreStatus = task.previous_status || 'todo';
      handleStatusChange(restoreStatus);
    }
  };

  const getInvoiceStatusColor = (invoiceStatus: string) => {
  switch (invoiceStatus) {
    case 'invoiced':
      return 'bg-green-100 text-green-700';
    case 'not_invoiced':
      return 'bg-red-100 text-red-700';
    case 'partially_invoiced':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

  // Extract screenshots from description
  const extractScreenshots = (description: string) => {
    const imageRegex = /!\[Screenshot\]\((data:image\/[^)]+)\)/g;
    const matches = [...description.matchAll(imageRegex)];
    return matches.map(match => match[1]);
  };

  // Remove screenshots from description for display
  const getCleanDescription = (description: string) => {
    return description.replace(/!\[Screenshot\]\((data:image\/[^)]+)\)/g, '').trim();
  };

  const screenshots = extractScreenshots(task.description);
  const cleanDescription = getCleanDescription(task.description);

  return (
    <div className="card p-6 hover:shadow-lg transition-all duration-200 border border-gray-200 hover:border-gray-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-start space-x-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900 break-words leading-tight flex-1">
              {task.title}
            </h3>
            {task.ticket_number && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full whitespace-nowrap flex-shrink-0">
                <Hash className="h-3 w-3 mr-1" />
                {task.ticket_number}
              </span>
            )}
          </div>
          {screenshots.length > 0 && (
            <div className="flex items-center text-xs text-gray-500 mb-2">
              <ImageIcon className="h-3 w-3 mr-1 flex-shrink-0" />
              <span>{screenshots.length} screenshot{screenshots.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        <div className="flex items-start space-x-2 flex-shrink-0">
          <AlertCircle className={`h-4 w-4 ${getPriorityColor(task.priority)} flex-shrink-0`} />
          <span className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${getStatusColor(task.status)}`}>
            {task.status.replace('_', ' ')}
          </span>
          {onEditTask && (
            <button 
              onClick={() => onEditTask(task)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded flex-shrink-0 transition-colors"
              title="Edit task"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Show previous status for archived tasks */}
      {task.status === 'archived' && task.previous_status && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center text-sm text-yellow-800">
            <Archive className="h-4 w-4 mr-2" />
            <span>Previously: <span className="font-medium capitalize">{task.previous_status.replace('_', ' ')}</span></span>
            {task.archived_at && (
              <span className="ml-2 text-yellow-600">
                • Archived {format(new Date(task.archived_at), 'MMM dd, yyyy')}
              </span>
            )}
          </div>
        </div>
      )}
      
      <p className="text-gray-600 text-sm mb-4 break-words line-clamp-3">{cleanDescription}</p>
      
      <div className="space-y-2 mb-4">
        {project && (
          <div className="flex items-center text-sm text-gray-500">
            <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">{project.name}</span>
          </div>
        )}
        
        {task.due_date && (
          <div className="flex items-center text-sm text-gray-500">
            <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>Due {format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
          </div>
        )}

        {/* Date Information */}
        <div className="space-y-1">
          {task.created_on && (
            <div className="flex items-center text-sm text-gray-500">
              <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Created {format(new Date(task.created_on), 'MMM dd, yyyy')}</span>
            </div>
          )}
          
          {task.completed_on && (
            <div className="flex items-center text-sm text-green-600">
              <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Completed {format(new Date(task.completed_on), 'MMM dd, yyyy')}</span>
            </div>
          )}
        </div>

  {task.invoice_status && (
  <div className="flex items-center text-sm">
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getInvoiceStatusColor(task.invoice_status)}`}>
      {task.invoice_status.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  </div>
)}


        <div className="flex items-center text-sm text-gray-500">
          <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>
            {task.hours_worked || 0} hours worked
            {task.estimated_hours ? ` / ${task.estimated_hours} estimated` : ''}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{task.progress_percentage || 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${task.progress_percentage || 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Hours Input Section */}
      {showHoursInput && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter actual hours worked:
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={actualHours}
              onChange={(e) => setActualHours(Number(e.target.value))}
              min="0"
              step="0.5"
              className="input flex-1"
            />
            <button 
              onClick={handleSubmitHours}
              className="btn-primary whitespace-nowrap"
              disabled={isUpdating}
            >
              {isUpdating ? 'Saving...' : 'Save'}
            </button>
          </div>
          {task.estimated_hours && (
            <p className="text-xs text-gray-500 mt-1">
              Estimated hours: {task.estimated_hours}
            </p>
          )}
        </div>
      )}

      {/* Enhanced Action Buttons Section */}
      {!showHoursInput && (
        <div className="bg-gray-50 rounded-lg p-4 border-t border-gray-200">
          {/* Primary Actions */}
          <div className="flex flex-wrap gap-2 mb-3">
            {task.status === 'archived' ? (
              <button
                onClick={handleUnarchive}
                disabled={isUpdating}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Undo className="h-4 w-4" />
                <span>Restore from Archive</span>
              </button>
            ) : (
              <>
                {task.status !== 'completed' && (
                  <>
                    {task.status === 'hold' ? (
                      <button
                        onClick={() => handleStatusChange('in_progress')}
                        disabled={isUpdating}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="h-4 w-4" />
                        <span>Resume Task</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(getNextStatus(task.status))}
                        disabled={isUpdating}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ArrowRight className="h-4 w-4" />
                        <span>
                          {task.status === 'review' ? 'Complete Task' : `Move to ${getNextStatus(task.status).replace('_', ' ')}`}
                        </span>
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Secondary Actions */}
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex flex-wrap gap-2">
              {task.status !== 'archived' && (
                <>
                  {/* Hold Button */}
                  {(task.status === 'todo' || task.status === 'in_progress' || task.status === 'review') && task.status !== 'hold' && (
                    <button
                      onClick={() => handleStatusChange('hold')}
                      disabled={isUpdating}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                      title="Put task on hold"
                    >
                      <Pause className="h-3 w-3" />
                      <span>Hold</span>
                    </button>
                  )}

                  {/* Back to Progress Button */}
                  {task.status === 'review' && (
                    <button
                      onClick={() => handleStatusChange('in_progress')}
                      disabled={isUpdating}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Back to Progress</span>
                    </button>
                  )}

                  {/* Archive Button */}
                  <button
                    onClick={handleArchive}
                    disabled={isUpdating}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                    title="Archive task"
                  >
                    <Archive className="h-3 w-3" />
                    <span>Archive</span>
                  </button>
                </>
              )}
            </div>
            
            {/* View Details Button - Always visible on the right */}
            <button
              onClick={() => onViewDetails?.(task)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-md text-xs font-medium transition-colors"
            >
              <Eye className="h-3 w-3" />
              <span>View Details</span>
            </button>
          </div>

          {/* Loading indicator */}
          {isUpdating && (
            <div className="flex items-center justify-center mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Updating task...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}