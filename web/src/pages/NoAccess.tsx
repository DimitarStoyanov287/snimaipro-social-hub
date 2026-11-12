import Logo from '../components/Logo';
import { useAuth } from '../lib/auth';

export default function NoAccess() {
  const { email, error, signOut } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Logo size="lg" />
      <h1 className="mt-10 font-display text-4xl font-bold leading-tight">Нямаш достъп</h1>
      <p className="mt-3 text-cream-dim">
        Профилът {email ? <strong className="text-cream">{email}</strong> : 'ти'} не е в списъка с разрешени потребители.
        Ако трябва да имаш достъп, помоли администратора да добави имейла ти.
      </p>
      {error && <p className="mt-3 text-sm text-down">{error}</p>}
      <button className="btn btn-ghost mt-8 self-start" onClick={signOut}>Изход</button>
    </div>
  );
}
