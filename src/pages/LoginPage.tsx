import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Video } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../hooks/useSession';
import { errorMessage } from '../lib/errors';

export function LoginPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const [showSetPassword] = useState(
    () => window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery')
  );
  const [mode, setMode] = useState<'password' | 'magic'>('password');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);

  if (!loading && user && !showSetPassword) {
    return <Navigate to="/videos" replace />;
  }

  async function handlePasswordSignIn(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.signInWithPassword(email, password);
      navigate('/videos');
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.signInWithMagicLink(email);
      setMagicLinkSent(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not send the magic link.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSettingPassword(true);
    try {
      await api.updatePassword(newPassword);
      navigate('/videos');
    } catch (err) {
      setError(errorMessage(err, 'Could not set your password.'));
    } finally {
      setSettingPassword(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-6 flex items-center justify-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-50">
          <Video size={22} className="text-blue-600" />
          VTX
        </div>

        {showSetPassword ? (
          <form onSubmit={handleSetPassword} className="space-y-3">
            <h1 className="text-center text-sm font-medium text-slate-700 dark:text-slate-200">
              Set your password
            </h1>
            <Field label="New password" type="password" value={newPassword} onChange={setNewPassword} />
            <Field label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} />
            {error && <ErrorText>{error}</ErrorText>}
            <SubmitButton busy={settingPassword}>Save password</SubmitButton>
          </form>
        ) : mode === 'password' ? (
          <form onSubmit={handlePasswordSignIn} className="space-y-3">
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && <ErrorText>{error}</ErrorText>}
            <SubmitButton busy={submitting}>Sign in</SubmitButton>
            <button
              type="button"
              onClick={() => {
                setMode('magic');
                setError(null);
              }}
              className="w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Email me a magic link instead
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            {error && <ErrorText>{error}</ErrorText>}
            {magicLinkSent ? (
              <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                Check your email for a sign-in link.
              </p>
            ) : (
              <SubmitButton busy={submitting}>Email me a magic link</SubmitButton>
            )}
            <button
              type="button"
              onClick={() => {
                setMode('password');
                setError(null);
                setMagicLinkSent(false);
              }}
              className="w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Use a password instead
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </div>
  );
}

function ErrorText({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {children}
    </p>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {busy ? 'Please wait…' : children}
    </button>
  );
}
