const PATHS: Record<string, string> = {
  overview: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  posts: 'M4 5h16v14H4V5Zm2 2v7l3-3 3 3 4-4 2 2V7H6Zm0 10h12v-.2l-2-2-4 4-3-3-3 3V17Z',
  compare: 'M5 20V10h3v10H5Zm5.5 0V4h3v16h-3ZM16 20v-7h3v7h-3Z',
  sync: 'M12 5a7 7 0 0 1 6.3 4H16v2h6V5h-2v2.3A9 9 0 0 0 3 12h2a7 7 0 0 1 7-7Zm7 7a7 7 0 0 1-13.3 3H8v-2H2v6h2v-2.3A9 9 0 0 0 21 12h-2Z',
  up: 'M12 6l6 8H6l6-8Z',
  down: 'M12 18l-6-8h12l-6 8Z',
  external: 'M14 4h6v6h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6H14V4ZM5 6h6v2H7v9h9v-4h2v6H5V6Z',
  logout: 'M10 4h8v16h-8v-2h6V6h-6V4ZM3 12l4-4v3h7v2H7v3l-4-4Z',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  table: 'M4 5h16v14H4V5Zm2 2v2h12V7H6Zm0 4v2h12v-2H6Zm0 4v2h12v-2H6Z',
  search: 'M10 4a6 6 0 0 1 4.8 9.6l5 5-1.4 1.4-5-5A6 6 0 1 1 10 4Zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  back: 'M14 6l-6 6 6 6 1.4-1.4L10.8 12l4.6-4.6L14 6Z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 4v5l4 2-.9 1.8L11 13V7h2Z',
};

export default function Icon({ name, className = 'h-5 w-5' }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
