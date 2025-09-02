import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Filter,
  BarChart3,
  Users,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Calculator,
  Database,
  ExternalLink,
  Settings,
  Key,
  TrendingUp,
} from "lucide-react";
import {
  supabase,
  testSupabaseConnection,
  validateEnvironmentSetup,
} from "../lib/supabase";
import { Project, Task, User, Receivable, Invoice } from "../types";
import { ProjectCard } from "./ProjectCard";
import { TaskCard } from "./TaskCard";
import { TaskDetailsModal } from "./TaskDetailsModal";
import { CreateProjectModal } from "./CreateProjectModal";
import { EditProjectModal } from "./EditProjectModal";
import { CreateTaskModal } from "./CreateTaskModal";
import { EditTaskModal } from "./EditTaskModal";
import { Analytics } from "./Analytics";
import { ReceivablesManagement } from "./ReceivablesManagement";
import { InvoiceManagement } from "./InvoiceManagement";
import { TaxManagement } from "./TaxManagement";
import { CleanupManagement } from "./CleanupManagement";
import { ApiKeyManagement } from "./ApiKeyManagement";

interface DashboardProps {
  user: User;
  onSignOut: () => void;
}

export function Dashboard({ user, onSignOut }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "projects"
    | "tasks"
    | "analytics"
    | "receivables"
    | "invoices"
    | "tax"
    | "cleanup"
    | "api"
  >("projects");
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [taskToView, setTaskToView] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>("all");

  // State for expanded/collapsed status sections - ALL COLLAPSED BY DEFAULT
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    todo: false,
    in_progress: false,
    review: false,
    completed: false,
    hold: false,
    archived: false,
  });

  useEffect(() => {
    // Check environment setup first
    const envCheck = validateEnvironmentSetup();
    if (!envCheck.isValid) {
      setEnvironmentError(
        `Missing environment variables: ${envCheck.missingVars.join(", ")}`
      );
      setLoading(false);
      return;
    }

    loadData();
  }, []);

  // Auto-refresh data when tab changes
  useEffect(() => {
    if (!environmentError) {
      console.log(`Switching to ${activeTab} tab - refreshing data...`);
      loadData();
    }
  }, [activeTab, environmentError]);

  const loadData = async () => {
    try {
      setLoading(true);
      setConnectionError(null);
      setEnvironmentError(null);

      console.log("Starting data load process...");

      // Test Supabase connection first
      const connectionTest = await testSupabaseConnection();
      if (!connectionTest.success) {
        console.error("Connection test failed:", connectionTest.error);
        setConnectionError(connectionTest.error || "Unknown connection error");
        return;
      }

      console.log("Connection test passed, loading data...");
      await Promise.all([
        loadProjects(),
        loadTasks(),
        loadReceivables(),
        loadInvoices(),
      ]);
      console.log("Data loading completed successfully");
    } catch (error) {
      console.error("Error loading data:", error);

      // Provide more specific error messages
      if (
        error instanceof TypeError &&
        error.message.includes("Failed to fetch")
      ) {
        setConnectionError(
          "Network error: Cannot connect to Supabase. Please check your internet connection and Supabase project status. If using a VPN, try disabling it temporarily."
        );
      } else if (error instanceof Error) {
        setConnectionError(`Data loading failed: ${error.message}`);
      } else {
        setConnectionError(
          "Failed to load data. Please check your connection and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    console.log("Loading projects...");
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading projects:", error);
      throw error;
    }

    console.log(`Loaded ${data?.length || 0} projects`);
    setProjects(data || []);
    if (data && data.length > 0 && !selectedProject) {
      setSelectedProject(data[0]);
    }
  };

  const loadTasks = async () => {
    console.log("Loading tasks...");
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading tasks:", error);
      throw error;
    }

    console.log(`Loaded ${data?.length || 0} tasks`);
    setTasks(data || []);
  };

  const loadReceivables = async () => {
    console.log("Loading receivables...");
    const { data, error } = await supabase
      .from("receivables")
      .select(
        `
        *,
        tasks!inner(title),
        projects!inner(name)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading receivables:", error);
      throw error;
    }

    const formattedReceivables =
      data?.map((receivable) => ({
        ...receivable,
        task_title: receivable.tasks?.title,
        project_name: receivable.projects?.name,
      })) || [];

    console.log(`Loaded ${formattedReceivables.length} receivables`);
    setReceivables(formattedReceivables);
  };

  const loadInvoices = async () => {
    console.log("Loading invoices...");
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        *,
        projects!inner(name)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading invoices:", error);
      throw error;
    }

    const formattedInvoices =
      data?.map((invoice) => ({
        ...invoice,
        project_name: invoice.projects?.name,
      })) || [];

    console.log(`Loaded ${formattedInvoices.length} invoices`);
    setInvoices(formattedInvoices);
  };

  // Handle tab change with auto-refresh
  const handleTabChange = (
    tab:
      | "projects"
      | "tasks"
      | "analytics"
      | "receivables"
      | "invoices"
      | "tax"
      | "cleanup"
      | "api"
  ) => {
    setActiveTab(tab);
    // Data will be refreshed automatically via useEffect
  };

  const handleCreateProject = async (
    projectData: Omit<
      Project,
      "id" | "created_by" | "created_at" | "updated_at"
    >
  ) => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          ...projectData,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setProjects((prev) => [data, ...prev]);
      setShowCreateProject(false);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const handleEditProject = async (
    projectData: Omit<
      Project,
      "id" | "created_by" | "created_at" | "updated_at"
    >
  ) => {
    if (!projectToEdit) return;

    try {
      const { data, error } = await supabase
        .from("projects")
        .update({
          ...projectData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectToEdit.id)
        .select()
        .single();

      if (error) throw error;

      setProjects((prev) =>
        prev.map((p) => (p.id === projectToEdit.id ? data : p))
      );
      setShowEditProject(false);
      setProjectToEdit(null);
    } catch (error) {
      console.error("Error updating project:", error);
    }
  };

  const handleCreateTask = async (
    taskData: Omit<Task, "id" | "created_by" | "created_at" | "updated_at">
  ) => {
    try {
      // Prepare the data for insertion, ensuring we only send fields that exist in the database
      const insertData = {
        title: taskData.title,
        description: taskData.description,
        project_id: taskData.project_id,
        status: taskData.status,
        priority: taskData.priority,
        owner_id: user.id,
        assigned_to: taskData.assigned_to || null,
        due_date: taskData.due_date || null,
        estimated_hours: taskData.estimated_hours || null,
        hours_worked: taskData.hours_worked || 0,
        progress_percentage: taskData.progress_percentage || 0,
        created_on: taskData.created_on || null,
        completed_on: taskData.completed_on || null,
        // Only include ticket_number if it exists and has a value
        ...(taskData.ticket_number && {
          ticket_number: taskData.ticket_number,
        }),
      };

      const { data, error } = await supabase
        .from("tasks")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      setTasks((prev) => [data, ...prev]);
      setShowCreateTask(false);
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Failed to create task: " + (error.message || "Unknown error"));
    }
  };

  const handleEditTask = async (
    taskData: Omit<Task, "id" | "created_by" | "created_at" | "updated_at">
  ) => {
    if (!taskToEdit) return;

    try {
      // Prepare the data for update, ensuring we only send fields that exist in the database
      const updateData = {
        title: taskData.title,
        description: taskData.description,
        project_id: taskData.project_id,
        status: taskData.status,
        priority: taskData.priority,
        assigned_to: taskData.assigned_to || null,
        due_date: taskData.due_date || null,
        estimated_hours: taskData.estimated_hours || null,
        hours_worked: taskData.hours_worked || 0,
        progress_percentage: taskData.progress_percentage || 0,
        created_on: taskData.created_on || null,
        completed_on: taskData.completed_on || null,
        updated_at: new Date().toISOString(),
        // Only include ticket_number if it exists and has a value
        ...(taskData.ticket_number && {
          ticket_number: taskData.ticket_number,
        }),
      };

      const { data, error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskToEdit.id)
        .select()
        .single();

      if (error) throw error;

      setTasks((prev) => prev.map((t) => (t.id === taskToEdit.id ? data : t)));
      setShowEditTask(false);
      setTaskToEdit(null);
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task: " + (error.message || "Unknown error"));
    }
  };

  const handleViewTaskDetails = (task: Task) => {
    setTaskToView(task);
    setShowTaskDetails(true);
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const calculateTotalPipelineAmount = () => {
    return projects.reduce((totalPipeline, project) => {
      const projectTasks = tasks.filter(
        (task) => task.project_id === project.id
      );

      const projectPipelineAmount =
        project.rate_type === "hourly"
          ? projectTasks
              .filter((task) => task.invoice_status === "not_invoiced")
              .reduce((sum, task) => {
                const taskAmount =
                  task.status === "completed"
                    ? (task.hours_worked || 0) * (project.hourly_rate || 0)
                    : (task.estimated_hours || 0) * (project.hourly_rate || 0);
                return sum + taskAmount;
              }, 0)
          : project.fixed_rate || 0;

      return totalPipeline + projectPipelineAmount;
    }, 0);
  };
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.ticket_number &&
        task.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" || task.status === statusFilter;
    const matchesProject =
      projectFilter === "all" || task.project_id === projectFilter;
    const matchesInvoiceStatus =
      invoiceStatusFilter === "all" ||
      task.invoice_status === invoiceStatusFilter;

    return (
      matchesSearch && matchesStatus && matchesProject && matchesInvoiceStatus
    );
  });

  // Group tasks by status
  const tasksByStatus = {
    todo: filteredTasks.filter((task) => task.status === "todo"),
    in_progress: filteredTasks.filter((task) => task.status === "in_progress"),
    review: filteredTasks.filter((task) => task.status === "review"),
    completed: filteredTasks.filter((task) => task.status === "completed"),
    hold: filteredTasks.filter((task) => task.status === "hold"),
    archived: filteredTasks.filter((task) => task.status === "archived"),
  };

  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === "active").length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => t.status === "completed").length,
    totalReceivables: receivables.length,
    totalInvoices: invoices.length,
    totalPipelineAmount: calculateTotalPipelineAmount(),
  };

  // Calculate total pipeline amount across all projects

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Expand all sections
  const expandAllSections = () => {
    setExpandedSections({
      todo: true,
      in_progress: true,
      review: true,
      completed: true,
      hold: true,
      archived: true,
    });
  };

  // Collapse all sections
  const collapseAllSections = () => {
    setExpandedSections({
      todo: false,
      in_progress: false,
      review: false,
      completed: false,
      hold: false,
      archived: false,
    });
  };

  // Get status display name
  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case "todo":
        return "To Do";
      case "in_progress":
        return "In Progress";
      case "review":
        return "In Testing";
      case "completed":
        return "Completed";
      case "hold":
        return "On Hold";
      case "archived":
        return "Archived";
      default:
        return status;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "text-gray-700";
      case "in_progress":
        return "text-blue-700";
      case "review":
        return "text-purple-700";
      case "completed":
        return "text-green-700";
      case "hold":
        return "text-yellow-700";
      case "archived":
        return "text-gray-500";
      default:
        return "text-gray-700";
    }
  };

  // Handle retry connection
  const handleRetryConnection = () => {
    setConnectionError(null);
    setEnvironmentError(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application data...</p>
        </div>
      </div>
    );
  }

  // Show environment error if present
  if (environmentError) {
    const envCheck = validateEnvironmentSetup();

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <h1 className="ml-3 text-xl font-semibold text-gray-900">
                  Task Management Pro
                </h1>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Welcome, {user.full_name}
                </span>
                <button onClick={onSignOut} className="btn-outline">
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Environment Setup Error */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Settings className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                  Environment Configuration Required
                </h3>
                <p className="text-yellow-700 mb-4">{environmentError}</p>
                <div className="bg-yellow-100 border border-yellow-200 rounded-md p-4 mb-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">
                    Setup Instructions:
                  </h4>
                  <ol className="text-sm text-yellow-700 space-y-2 list-decimal list-inside">
                    {envCheck.suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ol>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleRetryConnection}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check Configuration
                  </button>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-yellow-300 text-sm font-medium rounded-md text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Supabase Dashboard
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show connection error if present
  if (connectionError) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <h1 className="ml-3 text-xl font-semibold text-gray-900">
                  Task Management Pro
                </h1>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Welcome, {user.full_name}
                </span>
                <button onClick={onSignOut} className="btn-outline">
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Connection Error */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-red-800 mb-2">
                  Database Connection Error
                </h3>
                <p className="text-red-700 mb-4">{connectionError}</p>
                <div className="bg-red-100 border border-red-200 rounded-md p-4 mb-4">
                  <h4 className="text-sm font-medium text-red-800 mb-2">
                    Troubleshooting Steps:
                  </h4>
                  <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                    <li>Check your internet connection</li>
                    <li>
                      Verify your Supabase project is active and not paused
                    </li>
                    <li>
                      Ensure your .env file contains the correct
                      VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
                    </li>
                    <li>
                      Confirm your Supabase database migrations have been
                      applied
                    </li>
                    <li>
                      Check the browser console for additional error details
                    </li>
                    <li>
                      Try refreshing the page or restarting your development
                      server
                    </li>
                  </ul>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleRetryConnection}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Connection
                  </button>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Supabase Dashboard
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <h1 className="ml-3 text-xl font-semibold text-gray-900">
                Task Management Pro
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user.full_name}
              </span>
              <button onClick={onSignOut} className="btn-outline">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats - Split into two rows */}
<div className="space-y-6 mb-8">
  {/* First Row - Core Stats */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <div className="card p-6">
      <div className="flex items-center">
        <div className="p-2 bg-blue-100 rounded-lg">
          <BarChart3 className="h-6 w-6 text-blue-600" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">Projects</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalProjects}</p>
        </div>
      </div>
    </div>
    
    <div className="card p-6">
      <div className="flex items-center">
        <div className="p-2 bg-green-100 rounded-lg">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">Active</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.activeProjects}</p>
        </div>
      </div>
    </div>
    
    <div className="card p-6">
      <div className="flex items-center">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Clock className="h-6 w-6 text-purple-600" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">Tasks</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalTasks}</p>
        </div>
      </div>
    </div>
    
    <div className="card p-6">
      <div className="flex items-center">
        <div className="p-2 bg-orange-100 rounded-lg">
          <Users className="h-6 w-6 text-orange-600" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">Completed</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.completedTasks}</p>
        </div>
      </div>
    </div>
  </div>

  {/* Second Row - Financial Stats */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div className="card p-6">
      <div className="flex items-center">
        <div className="p-2 bg-yellow-100 rounded-lg">
          <DollarSign className="h-6 w-6 text-yellow-600" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">Receivables</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalReceivables}</p>
        </div>
      </div>
    </div>
    
    <div className="card p-6">
      <div className="flex items-center">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <FileText className="h-6 w-6 text-indigo-600" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">Invoices</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalInvoices}</p>
        </div>
      </div>
    </div>
    
    <div className="card p-6">
      <div className="flex items-center">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <TrendingUp className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">Pipeline</p>
          <p className="text-2xl font-semibold text-gray-900">
            ₹{(stats.totalPipelineAmount || 0).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  </div>
</div>

        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => handleTabChange("projects")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "projects"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => handleTabChange("tasks")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "tasks"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => handleTabChange("receivables")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "receivables"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Receivables
            </button>
            <button
              onClick={() => handleTabChange("invoices")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "invoices"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Invoices
            </button>
            <button
              onClick={() => handleTabChange("tax")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "tax"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Calculator className="h-4 w-4 mr-1 inline" />
              Tax
            </button>
            <button
              onClick={() => handleTabChange("cleanup")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "cleanup"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Database className="h-4 w-4 mr-1 inline" />
              Cleanup
            </button>
            <button
              onClick={() => handleTabChange("api")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "api"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Key className="h-4 w-4 mr-1 inline" />
              API
            </button>
            <button
              onClick={() => handleTabChange("analytics")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "analytics"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Analytics
            </button>
          </div>
        </div>

        {/* Filters and Controls - New separate row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4 flex-wrap gap-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-64"
              />
            </div>

            {activeTab === "tasks" && (
              <>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="input min-w-[150px]"
                >
                  <option value="all">All Projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input min-w-[140px]"
                >
                  <option value="all">All Statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">In Testing</option>
                  <option value="completed">Completed</option>
                  <option value="hold">On Hold</option>
                  <option value="archived">Archived</option>
                </select>

                <select
                  value={invoiceStatusFilter}
                  onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                  className="input min-w-[160px]"
                >
                  <option value="all">All Invoice Status</option>
                  <option value="not_invoiced">Not Invoiced</option>
                  <option value="invoiced">Invoiced</option>
                  <option value="partially_invoiced">Partially Invoiced</option>
                </select>
              </>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {activeTab === "projects" && (
              <button
                onClick={() => setShowCreateProject(true)}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </button>
            )}

            {activeTab === "tasks" && (
              <button
                onClick={() => setShowCreateTask(true)}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {activeTab === "projects" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  tasks={tasks}
                  onEditProject={(project) => {
                    setProjectToEdit(project);
                    setShowEditProject(true);
                  }}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No projects found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating a new project.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCreateProject(true)}
                    className="btn-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Project
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-8">
            {/* Expand/Collapse Controls */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">
                  Section Controls:
                </span>
                <button
                  onClick={expandAllSections}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAllSections}
                  className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                >
                  Collapse All
                </button>
              </div>
              <div className="text-sm text-gray-500">
                Total: {filteredTasks.length} tasks
              </div>
            </div>

            {/* Task Status Sections */}
            {Object.entries(tasksByStatus).map(([status, statusTasks]) => {
              // Only show sections that have tasks or match the current filter
              if (
                statusTasks.length === 0 &&
                statusFilter !== "all" &&
                statusFilter !== status
              ) {
                return null;
              }

              const isExpanded = expandedSections[status];
              const statusDisplayName = getStatusDisplayName(status);
              const statusColor = getStatusColor(status);

              return (
                <div
                  key={status}
                  className="bg-white rounded-lg shadow-sm overflow-hidden"
                >
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(status)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                      <h3 className={`text-lg font-semibold ${statusColor}`}>
                        {statusDisplayName}
                      </h3>
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm font-medium">
                        {statusTasks.length}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {isExpanded ? "Click to collapse" : "Click to expand"}
                    </div>
                  </button>

                  {/* Section Content */}
                  {isExpanded && (
                    <div className="px-6 pb-6">
                      {statusTasks.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {statusTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              projects={projects}
                              onTaskUpdated={loadTasks}
                              onEditTask={(task) => {
                                setTaskToEdit(task);
                                setShowEditTask(true);
                              }}
                              onViewDetails={handleViewTaskDetails}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Clock className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                          <p className="text-sm">
                            No {statusDisplayName.toLowerCase()} tasks found.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* No tasks message */}
            {filteredTasks.length === 0 && (
              <div className="text-center py-12">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No tasks found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating a new task.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCreateTask(true)}
                    className="btn-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "receivables" && (
          <ReceivablesManagement
            receivables={receivables}
            projects={projects}
            onRefresh={loadReceivables}
          />
        )}

        {activeTab === "invoices" && (
          <InvoiceManagement
            invoices={invoices}
            projects={projects}
            tasks={tasks}
            user={user}
            onRefresh={loadInvoices}
          />
        )}

        {activeTab === "tax" && <TaxManagement onRefresh={loadData} />}

        {activeTab === "cleanup" && <CleanupManagement onRefresh={loadData} />}

        {activeTab === "api" && <ApiKeyManagement onRefresh={loadData} />}

        {activeTab === "analytics" && (
          <Analytics
            projects={projects}
            tasks={tasks}
            receivables={receivables}
            invoices={invoices}
          />
        )}
      </div>

      {/* Modals */}
      {showCreateProject && (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onSubmit={handleCreateProject}
        />
      )}

      {showEditProject && projectToEdit && (
        <EditProjectModal
          project={projectToEdit}
          onClose={() => {
            setShowEditProject(false);
            setProjectToEdit(null);
          }}
          onSubmit={handleEditProject}
        />
      )}

      {showCreateTask && (
        <CreateTaskModal
          projects={projects}
          onClose={() => setShowCreateTask(false)}
          onSubmit={handleCreateTask}
        />
      )}

      {showEditTask && taskToEdit && (
        <EditTaskModal
          task={taskToEdit}
          projects={projects}
          onClose={() => {
            setShowEditTask(false);
            setTaskToEdit(null);
          }}
          onSubmit={handleEditTask}
        />
      )}

      {showTaskDetails && taskToView && (
        <TaskDetailsModal
          task={taskToView}
          project={projects.find((p) => p.id === taskToView.project_id)}
          onClose={() => {
            setShowTaskDetails(false);
            setTaskToView(null);
          }}
        />
      )}
    </div>
  );
}