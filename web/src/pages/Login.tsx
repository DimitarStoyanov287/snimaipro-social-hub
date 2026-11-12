import { useState, type FormEvent } from 'react';
import Logo from '../components/Logo';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('sending'); setErr(null);
    try { await signIn(email); setState('sent'); }
    catch (x) { setErr((x as Error).message); setState('idle'); }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="animate-rise">
        <Logo size="lg" />
        <p className="eyebrow mt-2">Social Hub</p>
        <h1 className="mt-10 font-display text-4xl font-bold leading-tight">Вход за екипа</h1>
        <p className="mt-3 text-cream-dim">
          Въведи имейла си и ще ти изпратим линк за вход. Без парола.
        </p>
        {state === 'sent' ? (
          <div className="panel mt-8 border-brand-yellow/40" role="status">
            <p className="font-semibold text-brand-yellow">Линкът е изпратен</p>
            <p className="mt-1 text-sm text-cream-dim">
              Провери пощата на {email}. Отвори линка в същия браузър, в който си започнал входа.
            </p>
            <button className="btn btn-ghost mt-4" onClick={() => setState('idle')}>Друг имейл</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-3">
            <label htmlFor="email" className="eyebrow block">Имейл</label>
            <input
              id="email" type="email" required autoComplete="email" inputMode="email"
              className="field" placeholder="ime@primer.bg" value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {err && <p className="text-sm text-down" role="alert">{err}</p>}
            <button className="btn btn-primary w-full" disabled={state === 'sending' || !email}>
              {state === 'sending' ? 'Изпращане...' : 'Изпрати линк за вход'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
