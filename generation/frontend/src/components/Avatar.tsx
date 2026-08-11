import { useState } from 'react';

export function Avatar({ name, src, size = 'lg' }: { name: string; src?: string | null; size?: 'sm' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  const classes = size === 'lg' ? 'h-28 w-28 text-3xl' : 'h-12 w-12 text-base';
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  if (!src || failed) return <div aria-label={`${name} avatar`} className={`${classes} flex items-center justify-center rounded-[2rem] bg-navy font-display font-semibold text-gold shadow-lg`}>{initials}</div>;
  return <img src={src} alt={`${name} profile`} onError={() => setFailed(true)} className={`${classes} rounded-[2rem] object-cover shadow-lg`} />;
}
