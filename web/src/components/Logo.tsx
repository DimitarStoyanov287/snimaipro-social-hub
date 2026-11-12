export default function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`font-display font-bold tracking-tight text-cream ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}>
      snimai<span className="text-brand-yellow">.</span>pro
    </span>
  );
}
