import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../api/client';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, displayName);
      navigate('/onboarding/cohort');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-lg font-semibold text-navy">
          Generation
        </Link>
        <h1 className="mt-6 font-display text-2xl font-semibold text-navy">
          Join your generation
        </h1>
        <p className="mt-1 font-body text-sm text-ink/60">
          Create an account to start the verification process.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="font-body text-sm font-medium text-navy" htmlFor="displayName">
              Your name
            </label>
            <input
              id="displayName"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-sm border border-navy/20 bg-white px-3 py-2 font-body text-sm text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>
          <div>
            <label className="font-body text-sm font-medium text-navy" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-sm border border-navy/20 bg-white px-3 py-2 font-body text-sm text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>
          <div>
            <label className="font-body text-sm font-medium text-navy" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-sm border border-navy/20 bg-white px-3 py-2 font-body text-sm text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
            <p className="mt-1 font-body text-xs text-ink/50">At least 8 characters.</p>
          </div>

          {error && (
            <p role="alert" className="font-body text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-sm bg-navy px-4 py-2.5 font-body text-sm font-semibold text-paper transition hover:bg-navy-light disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 font-body text-sm text-ink/60">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-navy underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
