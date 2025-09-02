import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, AuthState } from '../types';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setAuthState({ user: null, loading: false, error: error.message });
        return;
      }

      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setAuthState({ user: null, loading: false, error: null });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          fetchUserProfile(session.user.id);
        } else {
          setAuthState({ user: null, loading: false, error: null });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If user doesn't exist in users table, create one
        if (error.code === 'PGRST116') {
          await createUserProfile(userId);
          return;
        }
        throw error;
      }

      setAuthState({ user: data, loading: false, error: null });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setAuthState({ 
        user: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch user profile' 
      });
    }
  };

  const createUserProfile = async (userId: string) => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) throw new Error('No authenticated user found');

      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: authUser.user.email!,
          full_name: authUser.user.user_metadata?.full_name || authUser.user.email!,
          role: 'user',
        })
        .select()
        .single();

      if (error) throw error;

      setAuthState({ user: data, loading: false, error: null });
    } catch (error) {
      console.error('Error creating user profile:', error);
      setAuthState({ 
        user: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Failed to create user profile' 
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthState(prev => ({ ...prev, loading: false, error: error.message }));
      return false;
    }

    return true;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setAuthState(prev => ({ ...prev, loading: false, error: error.message }));
      return false;
    }

    return true;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthState(prev => ({ ...prev, error: error.message }));
    }
  };

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
  };
}