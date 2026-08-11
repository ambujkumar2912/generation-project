import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function HomePage() {
  const { user, verifiedCohorts, logout } = useAuth();
  const navigate = useNavigate();
  const cohort = verifiedCohorts.find((item) => item.is_primary) ?? verifiedCohorts[0];
  return <div className="min-h-screen bg-paper"><nav className="flex items-center justify-between border-b border-navy/10 bg-white px-6 py-4"><span className="font-display text-lg font-semibold text-navy">Generation</span><button onClick={() => { logout(); navigate('/'); }} className="font-body text-sm text-navy/60">Log out</button></nav><main className="mx-auto max-w-2xl px-6 py-10"><h1 className="font-display text-2xl text-navy">{user ? `Welcome, ${user.display_name}` : 'Welcome'}</h1>{cohort ? <div className="mt-6 rounded-sm border border-verified/30 bg-verified/5 px-5 py-4"><p className="font-body text-sm font-semibold text-verified">{cohort.label}</p><p className="mt-1 font-body text-xs text-ink/60">Your generation was determined from your private date of birth.</p></div> : <p className="mt-6 font-body text-sm text-ink/70">Your account was created before Generation onboarding. Contact support to add your generation.</p>}<div className="mt-10 rounded-sm border border-dashed border-navy/20 px-5 py-8 text-center font-body text-sm text-ink/50">The generation feed, communities, and messaging are being built next. This is your account home for now.</div></main></div>;
}
