import React from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';

function App() {
  const { user, loading, error, signIn, signUp, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthForm
        onSignIn={signIn}
        onSignUp={signUp}
        loading={loading}
        error={error}
      />
    );
  }

  return <Dashboard user={user} onSignOut={signOut} />;
}

export default App;