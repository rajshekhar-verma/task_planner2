import React, { useState } from 'react';
import { Calendar, User, AlertCircle, CheckCircle, Clock, DollarSign, Edit, IndianRupee, Settings } from 'lucide-react';
import { Project, Task } from '../types';
import { format } from 'date-fns';

interface ProjectCardProps {
  project: Project;
  tasks?: Task[];
  onEditProject?: (project: Project) => void;
}

export function ProjectCard({ project, tasks = [], onEditProject }: ProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800';
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

  // Filter tasks for this project
  const projectTasks = tasks.filter(task => task.project_id === project.id);
  
  // Calculate task statistics
  const todoTasks = projectTasks.filter(task => task.status === 'todo').length;
  const inProgressTasks = projectTasks.filter(task => task.status === 'in_progress').length;
  const inTestingTasks = projectTasks.filter(task => task.status === 'review').length;
  const completedTasks = projectTasks.filter(task => task.status === 'completed').length;
  const holdTasks = projectTasks.filter(task => task.status === 'hold').length;
  
  // Calculate financial metrics
  const totalHoursWorked = projectTasks.reduce((sum, task) => sum + (task.hours_worked || 0), 0);
  
  // Calculate receivables
  const openTasks = projectTasks.filter(task => 
    task.status === 'completed' && 
    (!task.invoice_status || task.invoice_status === 'not_invoiced')
  );
  


    const openAmount = projectTasks
  .filter(task => task.invoice_status === 'invoiced')
  .reduce((sum, task) => {
    const taskAmount = project.rate_type === 'hourly' 
      ? (task.hours_worked || 0) * (project.hourly_rate || 0)
      : ( 0) / 1;
    return sum + taskAmount;
  }, 0);

  //const pipelineAmount = projectTasks
 // .filter(task => task.invoice_status === 'not_invoiced')
 // .reduce((sum, task) => {
 //   const taskAmount = project.rate_type === 'hourly' 
 //     ? (task.estimated_hours || 0) * (project.hourly_rate || 0)
 //     : (project.fixed_rate || 0) / 1;
 //   return sum + taskAmount;
 // }, 0);

const pipelineAmount = (() => {
  if (project.rate_type === 'hourly') {
    // For hourly projects, calculate based on tasks and their status
    return projectTasks
      .filter(task => task.invoice_status === 'not_invoiced')
      .reduce((sum, task) => {
        let taskAmount = 0;
        
        if (task.status === 'completed') {
          // Use actual hours worked for completed tasks
          taskAmount = (task.hours_worked || 0) * (project.hourly_rate || 0);
        } else {
          // Use estimated hours for non-completed tasks
          taskAmount = (task.estimated_hours || 0) * (project.hourly_rate || 0);
        }
        
        return sum + taskAmount;
      }, 0);
  } else {
    // For fixed rate projects, just return the fixed rate
    return project.fixed_rate || 0;
  }
})();
  const totalReceivables = projectTasks
    .filter(task => ( task.status === 'completed' && ( task.invoice_status === 'invoiced' || task.invoice_status === 'paid' )) )
    .reduce((sum, task) => {
      const taskAmount = project.rate_type === 'hourly' 
        ? (task.hours_worked || 0) * (project.hourly_rate || 0)
        : (project.fixed_rate || 0) / projectTasks.length;
      return sum + taskAmount;
    }, 0);

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h3>
        <div className="flex items-center space-x-2">
          <AlertCircle className={`h-4 w-4 ${getPriorityColor(project.priority)}`} />
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
            {project.status.replace('_', ' ')}
          </span>
          {onEditProject && (
            <button 
              onClick={() => onEditProject(project)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{project.description}</p>
      
      <div className="space-y-2 mb-3">
        <div className="flex items-center text-sm text-gray-500">
          <Calendar className="h-4 w-4 mr-2" />
          <span>Started {format(new Date(project.start_date), 'MMM dd, yyyy')}</span>
        </div>
        
        {project.end_date && (
          <div className="flex items-center text-sm text-gray-500">
            <Calendar className="h-4 w-4 mr-2" />
            <span>Due {format(new Date(project.end_date), 'MMM dd, yyyy')}</span>
          </div>
        )}
        
        <div className="flex items-center text-sm text-gray-500">
          <DollarSign className="h-4 w-4 mr-2" />
          <span>
            {project.rate_type === 'hourly' 
              ? `₹${project.hourly_rate}/hour` 
              : `₹${project.fixed_rate} (fixed)`}
          </span>
        </div>
        
        {project.inr_conversion_factor && project.inr_conversion_factor !== 1 && (
          <div className="flex items-center text-sm text-gray-500">
            <IndianRupee className="h-4 w-4 mr-2" />
            <span>INR Conversion: {(project.inr_conversion_factor * 100).toFixed(2)}% of standard rate</span>
          </div>
        )}
      </div>
      
      {/* Task Statistics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-gray-50 p-2 rounded text-center">
          <div className="text-xs text-gray-500">To Do</div>
          <div className="font-semibold">{todoTasks}</div>
        </div>
        <div className="bg-blue-50 p-2 rounded text-center">
          <div className="text-xs text-blue-500">In Progress</div>
          <div className="font-semibold">{inProgressTasks}</div>
        </div>
        <div className="bg-purple-50 p-2 rounded text-center">
          <div className="text-xs text-purple-500">Testing</div>
          <div className="font-semibold">{inTestingTasks}</div>
        </div>
      </div>
      
      {/* Financial Summary */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-green-50 p-2 rounded">
          <div className="text-xs text-green-500">Hours Worked</div>
          <div className="font-semibold">{totalHoursWorked.toFixed(1)}h</div>
        </div>
        <div className="bg-yellow-50 p-2 rounded">
          <div className="text-xs text-yellow-500">Total Receivables</div>
          <div className="font-semibold">₹{totalReceivables.toFixed(2)}</div>
        </div>
        <div className="bg-yellow-50 p-2 rounded">
          <div className="text-xs text-yellow-500">Amount In Pipeline</div>
          <div className="font-semibold">₹{pipelineAmount.toFixed(2)}</div>
        </div>
        <div className="bg-orange-50 p-2 rounded">
          <div className="text-xs text-orange-500">Outstanding</div>
          <div className="font-semibold">₹{openAmount.toFixed(2)}</div>
        </div>
        <div className="bg-indigo-50 p-2 rounded">
          <div className="text-xs text-indigo-500">Open Items</div>
          <div className="font-semibold">{openTasks.length}</div>
        </div>
      </div>
      
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="btn-outline py-1 px-3 h-auto text-xs w-full"
      >
        {isExpanded ? 'Show Less' : 'Show More'}
      </button>
      
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Project Details</h4>
          <div className="space-y-2 text-sm text-gray-600">
            <p><span className="font-medium">Created:</span> {format(new Date(project.created_at), 'MMM dd, yyyy')}</p>
            <p><span className="font-medium">Last Updated:</span> {format(new Date(project.updated_at), 'MMM dd, yyyy')}</p>
            <p><span className="font-medium">Status:</span> {project.status}</p>
            <p><span className="font-medium">Priority:</span> {project.priority}</p>
            <p><span className="font-medium">Rate Type:</span> {project.rate_type}</p>
            {project.rate_type === 'hourly' ? (
              <p><span className="font-medium">Hourly Rate:</span> ₹{project.hourly_rate}/hour</p>
            ) : (
              <p><span className="font-medium">Fixed Rate:</span> ₹{project.fixed_rate}</p>
            )}
            {project.inr_conversion_factor && (
              <p><span className="font-medium">INR Conversion Factor:</span> {(project.inr_conversion_factor * 100).toFixed(2)}%</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}