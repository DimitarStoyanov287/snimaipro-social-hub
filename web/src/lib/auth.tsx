import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../data';
import { DEMO_MODE, supabase } from './supabase';

type Status = 'loading' | 'signedOut' | 'noAccess' | 'ready';

interface AuthCtx {
  status: Status;
  email: string | null;
  error: string | null;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(DEMO_MODE ? 'ready' : 'loading');
  const [email, setEmail] = useState<string | null>(DEMO_MODE ? 'demo@snimai.pro' : null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (DEMO_MODE || !supabase) return;
    let alive = true;
    const resolve = async (userEmail: string | null | undefined) => {
      if (!alive) return;
      if (!userEmail) { setEmail(null); setStatus('signedOut'); return; }
      setEmail(userEmail);
      try {
        const ok = await api.isAllowed(userEmail);
        if (alive) { setError(null); setStatus(ok ? 'ready' : 'noAccess'); }
      } catch (e) {
        if (alive) { setError((e as Error).message); setStatus('noAccess'); }
      }
    };
    supabase.auth.getSession().then(({ data }) => resolve(data.session?.user.email));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      // Defer to avoid calling supabase inside the auth callback.
      setTimeout(() => resolve(session?.user.email), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (addr: string) => {
    if (!supabase) return;
    const redirect = window.location.origin + window.location.pathname;
    const { error: err } = await supabase.auth.signInWithOtp({
      email: addr.trim(),
      options: { emailRedirectTo: redirect, shouldCreateUser: true },
    });
    if (err) throw new Error(err.message);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setEmail(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo(() => ({ status, email, error, signIn, signOut }), [status, email, error, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}
