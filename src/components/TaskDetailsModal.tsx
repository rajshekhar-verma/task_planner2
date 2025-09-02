import React, { useState } from 'react';
import { X, Calendar, User, AlertCircle, Folder, Clock, Hash, Image as ImageIcon, CheckCircle, DollarSign, ArrowLeft, Target, TrendingUp, BarChart3, Archive, Undo } from 'lucide-react';
import { Task, Project } from '../types';
import { format } from 'date-fns';

interface TaskDetailsModalProps {
  task: Task;
  project?: Project;
  onClose: () => void;
}

export function TaskDetailsModal({ task, project, onClose }: TaskDetailsModalProps) {
  const [enlargedImage, setEnlargedImage] = useState<{ src: string; index: number } | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'review':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'todo':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'hold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'archived':
        return 'bg-gray-100 text-gray-500 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'invoiced':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'not_invoiced':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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

  // Calculate task duration if both dates are available
  const getTaskDuration = () => {
    if (task.created_on && task.completed_on) {
      const startDate = new Date(task.created_on);
      const endDate = new Date(task.completed_on);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    }
    return null;
  };

  const taskDuration = getTaskDuration();

  // Calculate time variance
  const getTimeVariance = () => {
    if (task.estimated_hours && task.hours_worked) {
      return task.hours_worked - task.estimated_hours;
    }
    return null;
  };

  const timeVariance = getTimeVariance();

  // Handle screenshot click to enlarge
  const handleScreenshotClick = (screenshot: string, index: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setEnlargedImage({ src: screenshot, index });
  };

  // Handle closing enlarged image
  const handleCloseEnlargedImage = (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setEnlargedImage(null);
  };

  // Handle keyboard events for enlarged image
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleCloseEnlargedImage();
    }
  };

  // If image is enlarged, show full-screen image viewer
  if (enlargedImage) {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 z-[60]"
        onClick={handleCloseEnlargedImage}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
          {/* Header with back button */}
          <div className="absolute top-4 left-4 z-10">
            <button
              onClick={handleCloseEnlargedImage}
              className="flex items-center space-x-2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Details</span>
            </button>
          </div>
          
          {/* Image info */}
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg">
              <span className="text-sm">Screenshot {enlargedImage.index + 1} of {screenshots.length}</span>
            </div>
          </div>
          
          {/* Enlarged image */}
          <img
            src={enlargedImage.src}
            alt={`Screenshot ${enlargedImage.index + 1}`}
            className="max-w-full max-h-full object-contain cursor-pointer"
            onClick={handleCloseEnlargedImage}
          />
          
          {/* Click anywhere to close hint */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg text-sm">
              Click anywhere to close • Press ESC to close
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center space-x-3 mb-3">
                <h2 className="text-2xl font-bold text-white break-words leading-tight">
                  {task.title}
                </h2>
                {task.ticket_number && (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-semibold bg-white bg-opacity-20 text-white rounded-full whitespace-nowrap backdrop-blur-sm">
                    <Hash className="h-4 w-4 mr-1" />
                    {task.ticket_number}
                  </span>
                )}
              </div>
              
              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-3">
                <span className={`px-4 py-2 text-sm font-semibold rounded-full border ${getStatusColor(task.status)} bg-white`}>
                  {task.status === 'archived' && (
                    <Archive className="h-4 w-4 mr-1 inline" />
                  )}
                  {task.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className={`px-4 py-2 text-sm font-semibold rounded-full border ${getPriorityColor(task.priority)} bg-white`}>
                  <AlertCircle className="h-4 w-4 mr-1 inline" />
                  {task.priority.toUpperCase()} PRIORITY
                </span>
                {task.invoice_status && (
                  <span className={`px-4 py-2 text-sm font-semibold rounded-full border ${getInvoiceStatusColor(task.invoice_status)} bg-white`}>
                    <DollarSign className="h-4 w-4 mr-1 inline" />
                    {task.invoice_status.replace('_', ' ').toUpperCase()}
                  </span>
                )}
              </div>

              {/* Archive Information */}
              {task.status === 'archived' && (
                <div className="mt-3 p-3 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                  <div className="flex items-center text-white text-sm">
                    <Archive className="h-4 w-4 mr-2" />
                    <span>
                      Archived on {task.archived_at ? format(new Date(task.archived_at), 'MMM dd, yyyy') : 'Unknown date'}
                      {task.previous_status && (
                        <span className="ml-2">
                          • Previously: <span className="font-semibold capitalize">{task.previous_status.replace('_', ' ')}</span>
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={onClose} 
              className="flex-shrink-0 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(95vh-140px)]">
          <div className="p-8">
            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Progress Card */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-purple-600 rounded-lg">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-purple-900">{task.progress_percentage || 0}%</span>
                </div>
                <h4 className="text-purple-700 font-semibold">Progress</h4>
                <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${task.progress_percentage || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Hours Worked Card */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-blue-900">{task.hours_worked || 0}h</span>
                </div>
                <h4 className="text-blue-700 font-semibold">Hours Worked</h4>
                {task.estimated_hours && (
                  <p className="text-blue-600 text-sm mt-1">of {task.estimated_hours}h estimated</p>
                )}
              </div>

              {/* Duration Card */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-600 rounded-lg">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-green-900">
                    {taskDuration ? `${taskDuration}d` : '—'}
                  </span>
                </div>
                <h4 className="text-green-700 font-semibold">Duration</h4>
                <p className="text-green-600 text-sm mt-1">
                  {taskDuration ? `${taskDuration} day${taskDuration > 1 ? 's' : ''}` : 'In progress'}
                </p>
              </div>

              {/* Value Card */}
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-yellow-600 rounded-lg">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-yellow-900">
                    {project && project.rate_type === 'hourly' && task.hours_worked 
                      ? `$${((task.hours_worked || 0) * (project.hourly_rate || 0)).toFixed(0)}`
                      : '—'
                    }
                  </span>
                </div>
                <h4 className="text-yellow-700 font-semibold">Estimated Value</h4>
                <p className="text-yellow-600 text-sm mt-1">
                  {project?.rate_type === 'hourly' ? `$${project.hourly_rate || 0}/hour` : 'Fixed rate'}
                </p>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Left Column - Description and Project */}
              <div className="xl:col-span-2 space-y-8">
                {/* Description */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                      <BarChart3 className="h-5 w-5 text-gray-600" />
                      <span>Description</span>
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="prose prose-gray max-w-none">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-base">
                        {cleanDescription || 'No description provided'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Project Information */}
                {project && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="p-6 border-b border-gray-100">
                      <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                        <Folder className="h-5 w-5 text-blue-600" />
                        <span>Project Details</span>
                      </h3>
                    </div>
                    <div className="p-6">
                      <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="text-xl font-bold text-blue-900 mb-2">{project.name}</h4>
                            <p className="text-blue-700 leading-relaxed">{project.description}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <div className="text-blue-600 text-sm font-semibold mb-1">Status</div>
                            <div className="text-blue-900 font-bold capitalize">{project.status.replace('_', ' ')}</div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <div className="text-blue-600 text-sm font-semibold mb-1">Priority</div>
                            <div className="text-blue-900 font-bold capitalize">{project.priority}</div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <div className="text-blue-600 text-sm font-semibold mb-1">Rate Type</div>
                            <div className="text-blue-900 font-bold capitalize">{project.rate_type || 'hourly'}</div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <div className="text-blue-600 text-sm font-semibold mb-1">Rate</div>
                            <div className="text-blue-900 font-bold">
                              {project.rate_type === 'fixed' 
                                ? `$${project.fixed_rate || 0}` 
                                : `$${project.hourly_rate || 0}/h`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Screenshots */}
                {screenshots.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="p-6 border-b border-gray-100">
                      <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                        <ImageIcon className="h-5 w-5 text-gray-600" />
                        <span>Screenshots ({screenshots.length})</span>
                      </h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {screenshots.map((screenshot, index) => (
                          <div key={index} className="relative group">
                            <div className="relative overflow-hidden rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                              <img
                                src={screenshot}
                                alt={`Screenshot ${index + 1}`}
                                className="w-full h-64 object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                                onClick={(e) => handleScreenshotClick(screenshot, index, e)}
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-90 text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg">
                                  Click to enlarge
                                </div>
                              </div>
                              <div className="absolute top-3 left-3 bg-black bg-opacity-75 text-white text-sm font-semibold px-3 py-1 rounded-full">
                                #{index + 1}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Dates and Time Tracking */}
              <div className="space-y-8">
                {/* Important Dates */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-green-600" />
                      <span>Timeline</span>
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {task.created_on && (
                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-600 rounded-lg">
                            <Calendar className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="text-green-700 font-semibold">Created On</div>
                            <div className="text-green-900 font-bold">
                              {format(new Date(task.created_on), 'MMM dd, yyyy')}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {task.due_date && (
                      <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-100">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-orange-600 rounded-lg">
                            <AlertCircle className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="text-orange-700 font-semibold">Due Date</div>
                            <div className="text-orange-900 font-bold">
                              {format(new Date(task.due_date), 'MMM dd, yyyy')}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {task.completed_on && (
                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-600 rounded-lg">
                            <CheckCircle className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="text-green-700 font-semibold">Completed On</div>
                            <div className="text-green-900 font-bold">
                              {format(new Date(task.completed_on), 'MMM dd, yyyy')}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {task.archived_at && (
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-gray-600 rounded-lg">
                            <Archive className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="text-gray-700 font-semibold">Archived On</div>
                            <div className="text-gray-900 font-bold">
                              {format(new Date(task.archived_at), 'MMM dd, yyyy')}
                            </div>
                            {task.previous_status && (
                              <div className="text-gray-600 text-sm mt-1">
                                Previous status: <span className="capitalize">{task.previous_status.replace('_', ' ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Time Analysis */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                      <span>Time Analysis</span>
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {/* Time Variance */}
                    {timeVariance !== null && (
                      <div className={`p-4 rounded-lg border ${
                        timeVariance > 0 
                          ? 'bg-red-50 border-red-100' 
                          : timeVariance < 0 
                          ? 'bg-green-50 border-green-100' 
                          : 'bg-gray-50 border-gray-100'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className={`font-semibold ${
                              timeVariance > 0 ? 'text-red-700' : timeVariance < 0 ? 'text-green-700' : 'text-gray-700'
                            }`}>
                              Time Variance
                            </div>
                            <div className={`text-sm ${
                              timeVariance > 0 ? 'text-red-600' : timeVariance < 0 ? 'text-green-600' : 'text-gray-600'
                            }`}>
                              {timeVariance > 0 && 'Over estimate'}
                              {timeVariance < 0 && 'Under estimate'}
                              {timeVariance === 0 && 'On target'}
                            </div>
                          </div>
                          <div className={`text-xl font-bold ${
                            timeVariance > 0 ? 'text-red-900' : timeVariance < 0 ? 'text-green-900' : 'text-gray-900'
                          }`}>
                            {timeVariance > 0 ? '+' : ''}{timeVariance.toFixed(1)}h
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Efficiency */}
                    {task.estimated_hours && task.hours_worked && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-blue-700 font-semibold">Efficiency</div>
                            <div className="text-blue-600 text-sm">
                              {task.hours_worked}h / {task.estimated_hours}h
                            </div>
                          </div>
                          <div className="text-xl font-bold text-blue-900">
                            {((task.estimated_hours / task.hours_worked) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* System Information */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-xl font-semibold text-gray-900">System Information</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-3">
                      <div>
                        <div className="text-gray-600 text-sm font-semibold mb-1">Created</div>
                        <div className="text-gray-900 font-medium">
                          {format(new Date(task.created_at), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-gray-500 text-sm">
                          {format(new Date(task.created_at), 'HH:mm:ss')}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-gray-600 text-sm font-semibold mb-1">Last Updated</div>
                        <div className="text-gray-900 font-medium">
                          {format(new Date(task.updated_at), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-gray-500 text-sm">
                          {format(new Date(task.updated_at), 'HH:mm:ss')}
                        </div>
                      </div>
                      
                      {task.assigned_to && (
                        <div>
                          <div className="text-gray-600 text-sm font-semibold mb-1">Assigned To</div>
                          <div className="text-gray-900 font-medium">{task.assigned_to}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-8 py-4">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="btn-primary px-8 py-3 text-base font-semibold"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}