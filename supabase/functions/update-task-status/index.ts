import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

interface UpdateTaskStatusRequest {
  task_id: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'hold' | 'archived';
  hours_worked?: number;
  progress_percentage?: number;
  notes?: string;
}

interface ApiUsageLog {
  api_key_id: string;
  endpoint: string;
  method: string;
  ip_address: string;
  user_agent?: string;
  response_status: number;
  response_time_ms: number;
  request_size_bytes?: number;
  response_size_bytes?: number;
  error_message?: string;
}

// Helper function to hash API key
function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

// Helper function to get client IP
function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  return forwarded?.split(',')[0] || realIP || cfConnectingIP || 'unknown';
}

// Helper function to log API usage
async function logApiUsage(
  supabase: any,
  logData: ApiUsageLog
): Promise<void> {
  try {
    await supabase
      .from('api_usage_logs')
      .insert(logData);
  } catch (error) {
    console.error('Failed to log API usage:', error);
  }
}

// Helper function to authenticate API key
async function authenticateApiKey(
  supabase: any,
  apiKey: string
): Promise<{ valid: boolean; keyId?: string; permissions?: string[] }> {
  try {
    const keyHash = hashApiKey(apiKey);
    
    const { data: apiKeyData, error } = await supabase
      .from('api_keys')
      .select('id, permissions, is_active, expires_at')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !apiKeyData) {
      return { valid: false };
    }

    // Check if key has expired
    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      return { valid: false };
    }

    // Update last_used timestamp
    await supabase
      .from('api_keys')
      .update({ last_used: new Date().toISOString() })
      .eq('id', apiKeyData.id);

    return {
      valid: true,
      keyId: apiKeyData.id,
      permissions: apiKeyData.permissions || []
    };
  } catch (error) {
    console.error('API key authentication error:', error);
    return { valid: false };
  }
}

// Helper function to check rate limits
async function checkRateLimit(
  supabase: any,
  apiKeyId: string,
  endpoint: string
): Promise<{ allowed: boolean; message?: string }> {
  try {
    // Get rate limits for this API key and endpoint
    const { data: rateLimits } = await supabase
      .from('api_rate_limits')
      .select('*')
      .eq('api_key_id', apiKeyId)
      .eq('is_active', true);

    if (!rateLimits || rateLimits.length === 0) {
      return { allowed: true };
    }

    // Check usage in the last minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: recentRequests } = await supabase
      .from('api_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('api_key_id', apiKeyId)
      .gte('created_at', oneMinuteAgo);

    const rateLimit = rateLimits[0];
    if (recentRequests >= rateLimit.requests_per_minute) {
      return {
        allowed: false,
        message: `Rate limit exceeded: ${rateLimit.requests_per_minute} requests per minute`
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true }; // Allow on error to avoid blocking
  }
}

// Helper function to validate task status
function isValidTaskStatus(status: string): status is UpdateTaskStatusRequest['status'] {
  const validStatuses = ['todo', 'in_progress', 'review', 'completed', 'hold', 'archived'];
  return validStatuses.includes(status);
}

// Helper function to calculate progress percentage based on status
function getProgressPercentageForStatus(status: string): number {
  switch (status) {
    case 'todo': return 0;
    case 'in_progress': return 30;
    case 'review': return 80;
    case 'completed': return 100;
    case 'hold': return 50; // Keep current progress
    case 'archived': return 0; // Keep current progress
    default: return 0;
  }
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  let responseStatus = 200;
  let errorMessage: string | undefined;
  let apiKeyId: string | undefined;

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract API key from headers
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      responseStatus = 401;
      errorMessage = 'API key required. Provide X-API-Key header or Authorization: Bearer <key>';
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'MISSING_API_KEY'
        }),
        {
          status: responseStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Authenticate API key
    const authResult = await authenticateApiKey(supabaseClient, apiKey);
    if (!authResult.valid) {
      responseStatus = 401;
      errorMessage = 'Invalid or expired API key';
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'INVALID_API_KEY'
        }),
        {
          status: responseStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    apiKeyId = authResult.keyId!;

    // Check if API key has write permissions
    const hasWritePermission = authResult.permissions?.some(permission => 
      permission.includes('write') || permission.includes('update') || permission.includes('tasks')
    );

    if (!hasWritePermission) {
      responseStatus = 403;
      errorMessage = 'API key does not have write permissions for tasks';
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'INSUFFICIENT_PERMISSIONS'
        }),
        {
          status: responseStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check rate limits
    const url = new URL(req.url);
    const rateLimitResult = await checkRateLimit(supabaseClient, apiKeyId, url.pathname);
    if (!rateLimitResult.allowed) {
      responseStatus = 429;
      errorMessage = rateLimitResult.message;
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'RATE_LIMIT_EXCEEDED'
        }),
        {
          status: responseStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Only allow PATCH/PUT methods for updates
    if (!['PATCH', 'PUT'].includes(req.method)) {
      responseStatus = 405;
      errorMessage = 'Method not allowed. Use PATCH or PUT to update task status.';
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'METHOD_NOT_ALLOWED'
        }),
        {
          status: responseStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    let requestData: UpdateTaskStatusRequest;
    try {
      requestData = await req.json();
    } catch (error) {
      responseStatus = 400;
      errorMessage = 'Invalid JSON in request body';
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'INVALID_JSON'
        }),
        {
          status: responseStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate required fields
    if (!requestData.task_id || !requestData.status) {
      responseStatus = 400;
      errorMessage = 'Missing required fields: task_id and status are required';
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'MISSING_REQUIRED_FIELDS',
          required_fields: ['task_id', 'status']
        }),
        {
          status: responseStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate task_id format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requestData.task_id)) {
      responseStatus = 400;
      errorMessage = 'Invalid task_id format. Must be a valid UUID.';
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'INVALID_TASK_ID_FORMAT'
        }),
        {
          status: responseStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate status
    if (!isValidTaskStatus(requestData.status)) {
      responseStatus = 400;
      errorMessage = 'Invalid status. Must be one of: todo, in_progress, review, completed, hold, archived';
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'INVALID_STATUS',
          valid_statuses: ['todo', 'in_progress', 'review', 'completed', 'hold', 'archived']
        }),
        {
          status: responseStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if task exists
    const { data: existingTask, error: fetchError } = await supabaseClient
      .from('tasks')
      .select('id, status, hours_worked, progress_percentage, previous_status, archived_at')
      .eq('id', requestData.task_id)
      .single();

    if (fetchError || !existingTask) {
      responseStatus = 404;
      errorMessage = 'Task not found';
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'TASK_NOT_FOUND'
        }),
        {
          status: responseStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare update data
    const updateData: any = {
      status: requestData.status,
      updated_at: new Date().toISOString()
    };

    // Handle status-specific logic
    if (requestData.status === 'completed') {
      // Set completed_on date if not already set
      updateData.completed_on = new Date().toISOString().split('T')[0];
      updateData.progress_percentage = 100;
      
      // Use provided hours_worked or keep existing
      if (requestData.hours_worked !== undefined) {
        updateData.hours_worked = requestData.hours_worked;
      }
    } else if (existingTask.status === 'completed' && requestData.status !== 'completed') {
      // Moving away from completed status
      updateData.completed_on = null;
    }

    // Handle archiving
    if (requestData.status === 'archived') {
      updateData.previous_status = existingTask.status;
      updateData.archived_at = new Date().toISOString();
    } else if (existingTask.status === 'archived' && requestData.status !== 'archived') {
      // Unarchiving
      updateData.previous_status = null;
      updateData.archived_at = null;
    }

    // Set progress percentage based on status (unless explicitly provided)
    if (requestData.progress_percentage !== undefined) {
      updateData.progress_percentage = Math.max(0, Math.min(100, requestData.progress_percentage));
    } else if (requestData.status !== 'hold' && requestData.status !== 'archived') {
      // Don't auto-update progress for hold/archived status
      updateData.progress_percentage = getProgressPercentageForStatus(requestData.status);
    }

    // Update hours worked if provided
    if (requestData.hours_worked !== undefined) {
      updateData.hours_worked = Math.max(0, requestData.hours_worked);
    }

    // Update the task
    const { data: updatedTask, error: updateError } = await supabaseClient
      .from('tasks')
      .update(updateData)
      .eq('id', requestData.task_id)
      .select('*')
      .single();

    if (updateError) {
      responseStatus = 500;
      errorMessage = `Failed to update task: ${updateError.message}`;
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'UPDATE_FAILED'
        }),
        {
          status: responseStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare response
    const responseData = {
      success: true,
      message: 'Task status updated successfully',
      data: {
        task_id: updatedTask.id,
        previous_status: existingTask.status,
        new_status: updatedTask.status,
        progress_percentage: updatedTask.progress_percentage,
        hours_worked: updatedTask.hours_worked,
        updated_at: updatedTask.updated_at,
        ...(requestData.notes && { notes: requestData.notes })
      },
      meta: {
        timestamp: new Date().toISOString(),
        api_version: '1.0'
      }
    };

    const responseBody = JSON.stringify(responseData);
    const responseTime = Date.now() - startTime;

    // Log API usage
    await logApiUsage(supabaseClient, {
      api_key_id: apiKeyId,
      endpoint: url.pathname,
      method: req.method,
      ip_address: getClientIP(req),
      user_agent: req.headers.get('user-agent') || undefined,
      response_status: responseStatus,
      response_time_ms: responseTime,
      request_size_bytes: req.headers.get('content-length') ? parseInt(req.headers.get('content-length')!) : undefined,
      response_size_bytes: new TextEncoder().encode(responseBody).length
    });

    return new Response(responseBody, {
      status: responseStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("API Error:", error);
    responseStatus = 500;
    errorMessage = `Internal server error: ${error.message}`;
    
    const responseTime = Date.now() - startTime;

    // Log error if we have an API key
    if (apiKeyId) {
      try {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        await logApiUsage(supabaseClient, {
          api_key_id: apiKeyId,
          endpoint: new URL(req.url).pathname,
          method: req.method,
          ip_address: getClientIP(req),
          user_agent: req.headers.get('user-agent') || undefined,
          response_status: responseStatus,
          response_time_ms: responseTime,
          error_message: errorMessage
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'INTERNAL_ERROR'
      }),
      {
        status: responseStatus,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});