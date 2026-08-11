import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

type Step = 'welcome' | 'phone' | 'dob' | 'confirm' | 'profile' | 'existing';

export function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('welcome');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const year = dateOfBirth.slice(0, 4);

  async function checkPhone(e: FormEvent) {
    e.preventDefault(); setError(null); setSubmitting(true);
    try { const res = await api.post('/auth/phone/check', { phone }); setStep(res.data.exists ? 'existing' : 'dob'); }
    catch (err) { setError(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }
  async function createAccount(e: FormEvent) {
    e.preventDefault(); setError(null); setSubmitting(true);
    try {
      await register(phone, password, displayName, dateOfBirth, avatarUrl, bio, interests.split(',').map((x) => x.trim()).filter(Boolean));
      navigate('/home');
    } catch (err) { setError(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }
  async function existingLogin(e: FormEvent) {
    e.preventDefault(); setError(null); setSubmitting(true);
    try { await login(phone, password); navigate('/home'); }
    catch (err) { setError(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }
  const field = 'mt-2 w-full rounded-sm border border-navy/20 bg-white px-3 py-2 font-body text-sm text-ink';
  const button = 'mt-6 w-full rounded-sm bg-navy px-4 py-2.5 font-body text-sm font-semibold text-paper disabled:opacity-60';
  return <div className="flex min-h-screen items-center justify-center bg-paper px-6"><div className="w-full max-w-sm">
    <Link to="/" className="font-display text-lg font-semibold text-navy">Generation</Link>
    {step === 'welcome' && <><h1 className="mt-8 font-display text-3xl text-navy">Welcome to Generation</h1><p className="mt-2 font-body text-ink/70">Meet people from your generation.</p><button className={button} onClick={() => setStep('phone')}>Continue</button></>}
    {step === 'phone' && <form onSubmit={checkPhone}><h1 className="mt-8 font-display text-2xl text-navy">Enter your phone number</h1><p className="mt-2 font-body text-sm text-ink/70">This will be your unique account identifier. Include country code.</p><input className={field} type="tel" required placeholder="+91 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<button disabled={submitting} className={button}>Continue</button></form>}
    {step === 'dob' && <form onSubmit={(e) => { e.preventDefault(); setStep('confirm'); }}><h1 className="mt-8 font-display text-2xl text-navy">When were you born?</h1><p className="mt-2 font-body text-sm text-ink/70">Your birth year determines your Generation community. Your exact date of birth remains private.</p><input className={field} type="date" required max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} /><button className={button}>Continue</button></form>}
    {step === 'confirm' && <><h1 className="mt-8 font-display text-2xl text-navy">Welcome to the {year} Generation 🎉</h1><p className="mt-2 font-body text-sm text-ink/70">Your Generation has been determined from your date of birth.</p><button className={button} onClick={() => setStep('profile')}>Continue</button></>}
    {step === 'profile' && <form onSubmit={createAccount}><h1 className="mt-8 font-display text-2xl text-navy">Set up your profile</h1><input className={field} required placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /><input className={field} type="password" required minLength={8} placeholder="Development password" value={password} onChange={(e) => setPassword(e.target.value)} /><input className={field} type="url" placeholder="Profile photo URL (optional)" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} /><textarea className={field} placeholder="Bio (optional)" value={bio} onChange={(e) => setBio(e.target.value)} /><input className={field} placeholder="Interests, separated by commas (optional)" value={interests} onChange={(e) => setInterests(e.target.value)} />{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<button disabled={submitting} className={button}>Enter Generation</button></form>}
    {step === 'existing' && <form onSubmit={existingLogin}><h1 className="mt-8 font-display text-2xl text-navy">Welcome back</h1><p className="mt-2 font-body text-sm text-ink/70">This phone number already has an account.</p><input className={field} type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<button disabled={submitting} className={button}>Log in</button></form>}
  </div></div>;
}
