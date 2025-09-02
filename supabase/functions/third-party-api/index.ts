import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

interface ProjectTaskData {
  project_name: string;
  project_id: string;
  project_status: string;
  tasks: {
    id: string;
    title: string;
    description: string; // Without attachments
    status: string;
    assigned_to?: string;
    priority: string;
    due_date?: string;
    created_at: string;
    updated_at: string;
    hours_worked?: number;
    estimated_hours?: number;
    progress_percentage?: number;
  }[];
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

// Helper function to clean description (remove attachments)
function cleanDescription(description: string): string {
  // Remove screenshot markdown syntax
  return description.replace(/!\[Screenshot\]\((data:image\/[^)]+)\)/g, '').trim();
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

    // Route handling
    if (req.method === "GET") {
      // Parse query parameters
      const params = url.searchParams;
      const projectId = params.get('project_id');
      const projectStatus = params.get('project_status');
      const taskStatus = params.get('task_status');
      const limit = Math.min(parseInt(params.get('limit') || '100'), 1000); // Max 1000 records
      const offset = parseInt(params.get('offset') || '0');

      // Build query for projects
      let projectQuery = supabaseClient
        .from('projects')
        .select(`
          id,
          name,
          status,
          tasks (
            id,
            title,
            description,
            status,
            assigned_to,
            priority,
            due_date,
            created_at,
            updated_at,
            hours_worked,
            estimated_hours,
            progress_percentage
          )
        `)
        .range(offset, offset + limit - 1);

      // Apply filters
      if (projectId) {
        projectQuery = projectQuery.eq('id', projectId);
      }
      if (projectStatus) {
        projectQuery = projectQuery.eq('status', projectStatus);
      }

      const { data: projects, error: projectError } = await projectQuery;

      if (projectError) {
        responseStatus = 500;
        errorMessage = `Database error: ${projectError.message}`;
        
        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            code: 'DATABASE_ERROR'
          }),
          {
            status: responseStatus,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Process and clean the data
      const processedData: ProjectTaskData[] = projects?.map(project => ({
        project_name: project.name,
        project_id: project.id,
        project_status: project.status,
        tasks: project.tasks
          ?.filter((task: any) => !taskStatus || task.status === taskStatus)
          ?.map((task: any) => ({
            id: task.id,
            title: task.title,
            description: cleanDescription(task.description), // Remove attachments
            status: task.status,
            assigned_to: task.assigned_to,
            priority: task.priority,
            due_date: task.due_date,
            created_at: task.created_at,
            updated_at: task.updated_at,
            hours_worked: task.hours_worked,
            estimated_hours: task.estimated_hours,
            progress_percentage: task.progress_percentage
          })) || []
      })) || [];

      const responseData = {
        success: true,
        data: processedData,
        meta: {
          total_projects: processedData.length,
          total_tasks: processedData.reduce((sum, p) => sum + p.tasks.length, 0),
          limit,
          offset,
          timestamp: new Date().toISOString()
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
    }

    // Method not allowed
    responseStatus = 405;
    errorMessage = 'Method not allowed. Only GET requests are supported.';
    
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