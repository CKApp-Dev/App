import type { ReactNode } from 'react';

export function Icon({ name, size = 20 }: { name: 'bell' | 'plus' | 'clock' | 'check' | 'arrow' | 'logout' | 'file' | 'archive' | 'shield' | 'refresh'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    logout: <><path d="M9 5H4v14h5m5-14 7 7-7 7M8 12h13" /></>,
    file: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" /></>,
    archive: <><path d="M4 8h16v12H4zM3 3h18v5H3zM9 12h6" /></>,
    shield: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z" /><path d="m8 12 3 3 5-6" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true">CK<span>+</span></span><span className="brand-copy">CK APP<span>ADMIN CONSOLE</span></span></div>;
}

