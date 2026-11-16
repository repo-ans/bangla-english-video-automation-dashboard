import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Video, Settings as SettingsIcon } from 'lucide-react';
import clsx from 'clsx';
import { useProfile } from '../hooks/useProfile';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/supabase';
import type { Role } from '../types';
import { errorMessage } from '../lib/errors';
import { useToast } from '../hooks/useToast';

function NavItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium',
          isActive
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={clsx(
        'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        role === 'ceo'
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200'
          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
      )}
    >
      {role}
    </span>
  );
}

function RoleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full px-2.5 py-1 font-semibold transition-colors',
        active ? 'bg-white text-slate-900 shadow dark:bg-slate-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'
      )}
    >
      {label}
    </button>
  );
}

export function AppShell() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();

  async function handleSignOut() {
    try {
      await api.signOut();
      navigate('/login');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  }

  function handleRoleSwitch(role: Role) {
    api.setDemoRole?.(role);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['videos'] });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <span className="text-lg font-bold text-slate-900 dark:text-slate-50">VTX</span>
          <nav className="flex items-center gap-1 text-sm">
            <NavItem to="/videos" icon={<Video size={16} />} label="Videos" />
            {profile?.role === 'ceo' && (
              <NavItem to="/settings" icon={<SettingsIcon size={16} />} label="Settings" />
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {isDemoMode && api.setDemoRole && (
              <div className="hidden items-center gap-1 rounded-full bg-slate-100 p-1 text-xs sm:flex dark:bg-slate-800">
                <RoleButton active={profile?.role === 'ceo'} onClick={() => handleRoleSwitch('ceo')} label="CEO" />
                <RoleButton active={profile?.role === 'dev'} onClick={() => handleRoleSwitch('dev')} label="Dev" />
              </div>
            )}
            {profile && (
              <span className="hidden items-center text-sm text-slate-600 sm:inline-flex dark:text-slate-300">
                {profile.name ?? 'Unnamed'}
                <RoleBadge role={profile.role} />
              </span>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Sign out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
