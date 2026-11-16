import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSession } from './hooks/useSession';
import { useProfile } from './hooks/useProfile';
import { api } from './lib/api';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { VideosPage } from './pages/VideosPage';
import { VideoDetailPage } from './pages/VideoDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
      <Loader2 className="animate-spin text-slate-400" size={28} />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireProfile({ children }: { children: ReactNode }) {
  const { data: profile, isLoading, isError } = useProfile();

  if (isLoading) return <FullScreenSpinner />;

  if (isError || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center dark:bg-slate-900">
        <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
          Your account is not set up yet. Ask the CEO to invite you.
        </p>
        <SignOutButton />
      </div>
    );
  }

  return <>{children}</>;
}

function SignOutButton() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <button
      type="button"
      onClick={() => api.signOut()}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      Sign out
    </button>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <RequireProfile>
              <AppShell />
            </RequireProfile>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/videos" replace />} />
        <Route path="videos" element={<VideosPage />} />
        <Route path="videos/:id" element={<VideoDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
