import { useState } from 'react';
import { formatOf, topicLabel } from '../lib/labels';
import type { PostLatest } from '../types/db';

const PALETTES: Array<[string, string, string]> = [
  ['#F2C314', '#ED773C', '#1A1A14'],
  ['#245E55', '#F2C314', '#1A1A14'],
  ['#C63F3E', '#EAA7C7', '#1A1A14'],
  ['#EAE4DA', '#EAA7C7', '#1A1A14'],
  ['#ED773C', '#C63F3E', '#EAE4DA'],
  ['#EAA7C7', '#245E55', '#1A1A14'],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Placeholder thumbnail: brand gradient with abstract frame, used when there is no image. */
export function PlaceholderThumb({ id, label }: { id: string; label: string }) {
  const h = hash(id);
  const [a, b, fg] = PALETTES[h % PALETTES.length];
  const gid = `g${h}`;
  const angle = (h >> 3) % 360;
  const cx = 30 + (h % 40), cy = 30 + ((h >> 5) % 40);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gid} gradientTransform={`rotate(${angle} .5 .5)`}>
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gid})`} />
      <circle cx={cx} cy={cy} r="26" fill="none" stroke={fg} strokeOpacity=".28" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r="14" fill={fg} fillOpacity=".16" />
      <rect x="10" y="10" width="80" height="80" fill="none" stroke={fg} strokeOpacity=".22" strokeWidth=".8" />
      <text x="14" y="90" fontFamily="Bodoni Moda, serif" fontSize="9" fontWeight="700" fill={fg} fillOpacity=".7">{label}</text>
    </svg>
  );
}

export default function Thumb({ post, className = '' }: { post: PostLatest; className?: string }) {
  const [broken, setBroken] = useState(false);
  const src = post.thumbnail_url || post.media_url;
  const fmt = formatOf(post);
  return (
    <div className={`relative overflow-hidden bg-ink-600 ${className}`}>
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <PlaceholderThumb id={post.id} label={topicLabel(post.topic)} />
      )}
      {fmt === 'REELS' && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-brand-yellow">Reels</span>
      )}
      {fmt === 'CAROUSEL' && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-cream">Карусел</span>
      )}
    </div>
  );
}
