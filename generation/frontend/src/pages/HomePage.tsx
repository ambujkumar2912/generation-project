import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

interface VerificationRequestSummary {
  id: string;
  status: string;
  label: string;
  birth_year: number;
  created_at: string;
}

export function HomePage() {
  const { user, verifiedCohorts, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState<VerificationRequestSummary[]>([]);

  useEffect(() => {
    api.get('/verification/status').then((res) => {
      setPendingRequests(
        res.data.requests.filter((r: VerificationRequestSummary) => r.status === 'pending')
      );
    });
  }, []);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const primaryCohort = verifiedCohorts.find((c) => c.is_primary) ?? verifiedCohorts[0];

  return (
    <div className="min-h-screen bg-paper">
      <nav className="flex items-center justify-between border-b border-navy/10 bg-white px-6 py-4">
        <span className="font-display text-lg font-semibold text-navy">Generation</span>
        <button
          onClick={handleLogout}
          className="font-body text-sm font-medium text-navy/60 hover:text-navy"
        >
          Log out
        </button>
      </nav>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-navy">
          {user ? `Welcome, ${user.display_name}` : 'Welcome'}
        </h1>

        {primaryCohort ? (
          <div className="mt-6 flex items-center gap-4 rounded-sm border border-verified/30 bg-verified/5 px-5 py-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-verified text-white">
              ✓
            </div>
            <div>
              <p className="font-body text-sm font-semibold text-verified">
                Verified {primaryCohort.birth_year} Cohort
              </p>
              <p className="font-body text-xs text-ink/60">
                You're in — the {primaryCohort.label} feed is next to build.
              </p>
            </div>
          </div>
        ) : pendingRequests.length > 0 ? (
          <div className="mt-6 rounded-sm border border-gold/40 bg-gold/10 px-5 py-4">
            <p className="font-body text-sm font-semibold text-gold-dark">
              Verification pending for {pendingRequests[0].birth_year}
            </p>
            <p className="mt-1 font-body text-xs text-ink/60">
              We'll show your ✅ badge here once it's reviewed.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-sm border border-navy/10 bg-white px-5 py-4">
            <p className="font-body text-sm text-ink/70">
              You haven't verified your generation yet.
            </p>
            <Link
              to="/onboarding/cohort"
              className="mt-3 inline-block rounded-sm bg-navy px-4 py-2 font-body text-sm font-semibold text-paper hover:bg-navy-light"
            >
              Verify now
            </Link>
          </div>
        )}

        <div className="mt-10 rounded-sm border border-dashed border-navy/20 px-5 py-8 text-center">
          <p className="font-body text-sm text-ink/50">
            The generation feed, communities, and messaging are being built
            next. This is your account home for now.
          </p>
        </div>
      </main>
    </div>
  );
}
