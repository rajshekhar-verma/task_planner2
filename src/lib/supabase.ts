import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Enhanced environment variable validation
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase Configuration Error:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlValue: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined',
    keyValue: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'undefined'
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are properly set.');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  console.error('Invalid Supabase URL format:', supabaseUrl);
  throw new Error('Invalid VITE_SUPABASE_URL format. Please ensure it follows the pattern: https://your-project.supabase.co');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test Supabase connection with enhanced error handling
export const testSupabaseConnection = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Testing Supabase connection...', {
      url: `${supabaseUrl.substring(0, 30)}...`,
      keyPrefix: `${supabaseAnonKey.substring(0, 10)}...`
    });

    // Check if environment variables are properly set
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: 'Supabase environment variables are not configured. Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly.'
      };
    }

    // Test basic connectivity with a simple query
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Supabase query error:', error);
      
      // Check for common error types
      if (error.message.includes('Invalid API key') || error.message.includes('JWT')) {
        return {
          success: false,
          error: 'Invalid Supabase API key. Please check your VITE_SUPABASE_ANON_KEY in the .env file. You can find the correct key in your Supabase dashboard under Project Settings > API.'
        };
      } else if (error.message.includes('Project not found') || error.message.includes('404')) {
        return {
          success: false,
          error: 'Supabase project not found. Please check your VITE_SUPABASE_URL in the .env file. Ensure it matches your project URL from the Supabase dashboard.'
        };
      } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
        return {
          success: false,
          error: 'Database tables are not set up. Please run the Supabase migrations or check your database schema. The "profiles" table is missing.'
        };
      } else if (error.message.includes('permission denied') || error.message.includes('RLS')) {
        return {
          success: false,
          error: 'Database permission error. Please check your Row Level Security (RLS) policies or ensure your API key has the correct permissions.'
        };
      } else {
        return {
          success: false,
          error: `Supabase connection failed: ${error.message}. Please check your Supabase project status and configuration.`
        };
      }
    }

    console.log('Supabase connection test successful');
    return { success: true };
  } catch (err) {
    console.error('Supabase connection test error:', err);
    
    // Handle network errors
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      return {
        success: false,
        error: 'Cannot connect to Supabase. This could be due to: 1) No internet connection, 2) Incorrect VITE_SUPABASE_URL, 3) Supabase project is paused/inactive, or 4) Network firewall blocking the connection. Please check your Supabase project status in the dashboard.'
      };
    }

    // Handle CORS errors
    if (err instanceof TypeError && err.message.includes('CORS')) {
      return {
        success: false,
        error: 'CORS error when connecting to Supabase. Please check that your domain is allowed in your Supabase project settings.'
      };
    }

    return {
      success: false,
      error: `Connection test failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please check your .env file configuration and Supabase project status.`
    };
  }
};

// Helper function to check if .env file exists and has required variables
export const validateEnvironmentSetup = (): { isValid: boolean; missingVars: string[]; suggestions: string[] } => {
  const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missingVars: string[] = [];
  const suggestions: string[] = [];

  requiredVars.forEach(varName => {
    const value = import.meta.env[varName];
    if (!value) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    suggestions.push('1. Create a .env file in your project root (copy from .env.example)');
    suggestions.push('2. Add your Supabase project credentials to the .env file');
    suggestions.push('3. Get your credentials from: https://supabase.com/dashboard > Your Project > Settings > API');
    suggestions.push('4. Restart your development server after updating .env');
  }

  return {
    isValid: missingVars.length === 0,
    missingVars,
    suggestions
  };
};