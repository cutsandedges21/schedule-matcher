import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { consumeRedirect } from './redirect';
import { signInWithGoogle } from './signIn';
import Button from '@/components/Button';

export default function LoginPage() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to={consumeRedirect()} replace />;

  return (
    <main className="flex min-h-dvh flex-col justify-between p-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Schedule Matcher</h1>
        <p className="max-w-xs text-balance text-slate-600">
          Upload your schedule once. Stop texting screenshots.
        </p>
      </div>
      <Button onClick={() => void signInWithGoogle()} className="w-full">
        Continue with Google
      </Button>
    </main>
  );
}
