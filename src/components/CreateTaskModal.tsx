import React, { useState, useRef } from 'react';
import { X, Upload, Image, Trash2, Clipboard } from 'lucide-react';
import { Task, Project } from '../types';

interface CreateTaskModalProps {
  projects: Project[];
  onClose: () => void;
  onSubmit: (task: Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => void;
}

export function CreateTaskModal({ projects, onClose, onSubmit }: CreateTaskModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: projects[0]?.id || '',
    status: 'todo' as const,
    priority: 'medium' as const,
    assigned_to: '',
    due_date: '',
    estimated_hours: 0,
    hours_worked: 0,
    progress_percentage: 0,
    ticket_number: '',
    created_on: new Date().toISOString().split('T')[0], // Default to today
    completed_on: ''
  });
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setUploading(true);
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setScreenshots(prev => [...prev, result]);
          setUploading(false);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check if the item is an image
      if (item.type.startsWith('image/')) {
        event.preventDefault(); // Prevent default paste behavior for images
        
        const file = item.getAsFile();
        if (file) {
          setUploading(true);
          
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            setScreenshots(prev => [...prev, result]);
            setUploading(false);
            
            // Add a note to the description about the pasted screenshot
            const currentDescription = formData.description;
            const newDescription = currentDescription + (currentDescription ? '\n\n' : '') + `[Screenshot pasted - see attachments below]`;
            setFormData(prev => ({ ...prev, description: newDescription }));
          };
          reader.readAsDataURL(file);
        }
        break; // Only handle the first image found
      }
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  // Handle status change to auto-set completed_on
  const handleStatusChange = (status: string) => {
    setFormData(prev => ({
      ...prev,
      status: status as any,
      completed_on: status === 'completed' && !prev.completed_on 
        ? new Date().toISOString().split('T')[0] 
        : status !== 'completed' 
        ? '' 
        : prev.completed_on
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Extract clean description without existing screenshots
    const cleanDescription = formData.description.replace(/!\[Screenshot\]\((data:image\/[^)]+)\)/g, '').trim();
    
    // Combine description with screenshots
    let finalDescription = cleanDescription;
    if (screenshots.length > 0) {
      const screenshotMarkdown = screenshots.map((screenshot, index) => 
        `\n\n![Screenshot](${screenshot})`
      ).join('');
      finalDescription += screenshotMarkdown;
    }

    // Prepare task data, only including fields that exist in the database
    const taskData = {
      title: formData.title,
      description: finalDescription,
      project_id: formData.project_id,
      status: formData.status,
      priority: formData.priority,
      assigned_to: formData.assigned_to || undefined,
      due_date: formData.due_date || undefined,
      estimated_hours: formData.estimated_hours || undefined,
      hours_worked: formData.hours_worked || 0,
      progress_percentage: formData.progress_percentage || 0,
      created_on: formData.created_on || undefined,
      completed_on: formData.completed_on || undefined,
      // Only include ticket_number if it has a value
      ...(formData.ticket_number && { ticket_number: formData.ticket_number })
    };

    onSubmit(taskData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Create New Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input"
                placeholder="Enter task title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ticket Number
              </label>
              <input
                type="text"
                value={formData.ticket_number}
                onChange={(e) => setFormData({ ...formData, ticket_number: e.target.value })}
                className="input"
                placeholder="e.g., TASK-123"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <div className="relative">
              <textarea
                ref={descriptionRef}
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                onPaste={handlePaste}
                className="input min-h-[100px] resize-none pr-10"
                placeholder="Enter task description (you can paste screenshots directly here with Ctrl+V)"
              />
              <div className="absolute top-2 right-2 text-gray-400">
                <Clipboard className="h-4 w-4" title="You can paste screenshots here" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              💡 Tip: Copy a screenshot to your clipboard and paste it directly in the description field (Ctrl+V)
            </p>
          </div>

          {/* Screenshot Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Screenshots
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <div className="text-center">
                <Image className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <label className="cursor-pointer">
                  <span className="text-sm text-blue-600 hover:text-blue-500">
                    Click to upload screenshots
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB each</p>
                <p className="text-xs text-gray-400 mt-1">Or paste screenshots directly in the description field above</p>
              </div>
            </div>

            {/* Screenshot Preview */}
            {screenshots.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Attached Screenshots ({screenshots.length})
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {screenshots.map((screenshot, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={screenshot}
                        alt={`Screenshot ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removeScreenshot(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove screenshot"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                        #{index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploading && (
              <div className="mt-2 text-sm text-blue-600 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Processing screenshot...
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              required
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              className="input"
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
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
                onChange={(e) => handleStatusChange(e.target.value)}
                className="input"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Testing</option>
                <option value="completed">Completed</option>
                <option value="hold">On Hold</option>
              </select>
            </div>
          </div>

          {/* Date Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Created On
              </label>
              <input
                type="date"
                value={formData.created_on}
                onChange={(e) => setFormData({ ...formData, created_on: e.target.value })}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">Date when the task was created</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Completed On
              </label>
              <input
                type="date"
                value={formData.completed_on}
                onChange={(e) => setFormData({ ...formData, completed_on: e.target.value })}
                className="input"
                disabled={formData.status !== 'completed'}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.status === 'completed' 
                  ? 'Date when the task was completed' 
                  : 'Available when status is "Completed"'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Hours
            </label>
            <input
              type="number"
              value={formData.estimated_hours}
              onChange={(e) => setFormData({ ...formData, estimated_hours: Number(e.target.value) })}
              min="0"
              step="0.5"
              className="input"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="input"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button 
              type="submit" 
              className="btn-primary flex-1"
              disabled={uploading}
            >
              {uploading ? 'Processing...' : 'Create Task'}
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