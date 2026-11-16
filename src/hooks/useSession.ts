import { useEffect, useState } from 'react';
import { api, type AuthUser } from '../lib/api';

export interface SessionState {
  user: AuthUser | null;
  loading: boolean;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ user: null, loading: true });

  useEffect(() => {
    let active = true;

    api.getSession().then((user) => {
      if (active) setState({ user, loading: false });
    });

    const unsubscribe = api.onAuthStateChange((user) => {
      if (active) setState({ user, loading: false });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}
