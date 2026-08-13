import { useState, type ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { api } from '../api/client';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

type IncomingRequest = {
  id: string;
  requester: { id: string; username: string };
  status: string;
  created_at: string;
};

type RequestStatus = 'idle' | 'accepting' | 'rejecting';

export function ProfilePage() {
  const { user, verifiedCohorts } = useAuth();
  const [tab, setTab] = useState('Overview');
  const cohort = verifiedCohorts.find((item) => item.is_primary) ?? verifiedCohorts[0];
  if (!user) return null;
  const joined = new Date((user as any).created_at ?? Date.now()).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<Record<string, RequestStatus>>({});

  useEffect(() => {
    async function loadIncomingRequests() {
      setRequestsLoading(true);
      setRequestsError(null);
      try {
        const res = await api.get('/users/me/friend-requests');
        setIncomingRequests(res.data.requests ?? []);
      } catch (err) {
        setRequestsError(apiErrorMessage(err));
      } finally {
        setRequestsLoading(false);
      }
    }
    loadIncomingRequests();
  }, []);

  const handleAcceptClick = async (requestId: string) => {
    setRequestStatus(prev => ({ ...prev, [requestId]: 'accepting' }));
    try {
      await api.post(`/users/friend-requests/${requestId}/accept`);
      // Remove accepted request from list immediately
      setIncomingRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (err) {
      const message = apiErrorMessage(err);
      setRequestsError(message);
    } finally {
      setRequestStatus(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    }
  };

  const handleRejectClick = async (requestId: string) => {
    setRequestStatus(prev => ({ ...prev, [requestId]: 'rejecting' }));
    try {
      await api.post(`/users/friend-requests/${requestId}/reject`);
      // Remove rejected request from list immediately
      setIncomingRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (err) {
      const message = apiErrorMessage(err);
      setRequestsError(message);
    } finally {
      setRequestStatus(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <section className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-navy/5">
        <div className="h-36 bg-[radial-gradient(circle_at_15%_30%,#c8d5ff,transparent_28%),radial-gradient(circle_at_80%_30%,#fde6a8,transparent_25%),linear-gradient(120deg,#192b55,#314d8d)]" />
        <div className="relative px-5 pb-6 sm:px-8">
          <div className="-mt-16 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative">
                <div className="rounded-full border-4 border-white">
                  <Avatar name={user.display_name} src={user.avatar_url} />
                </div>
                <Link to="/profile/edit" aria-label="Edit profile photo" className="absolute bottom-1 right-0 rounded-full bg-gold p-2 text-xs text-navy shadow-md">◉</Link>
              </div>
              <div className="pb-1">
                <h1 className="font-display text-3xl font-semibold text-navy">{user.display_name}</h1>
                {user.username && <p className="mt-1 text-sm font-medium text-navy/55">@{user.username}</p>}
                {cohort && <span className="mt-2 inline-flex rounded-full bg-verified/10 px-3 py-1 text-sm font-semibold text-verified">● {cohort.label}</span>}
              </div>
            </div>
            <Link to="/profile/edit" className="rounded-xl bg-navy px-4 py-2.5 text-center text-sm font-semibold text-paper transition hover:-translate-y-0.5 hover:bg-navy-light">Edit Profile</Link>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-ink/70">{user.bio || 'A new member of Generation, here to learn, grow, and connect.'}</p>
        </div>

        <section className="mt-5 grid gap-3 sm:grid-cols-4">
          <Stat label="Friends" value={String(incomingRequests.length)} note="pending requests" />
          <Stat label="Member since" value={joined} note="Part of Generation" />
          <Stat label="Status" value="Active" note="Your account is active" />
          <Stat label="Account" value="Generation Member" note="Built for belonging" />
        </section>

        <section className="mt-6 space-y-4">
          {requestsLoading ? (
            <p className="text-sm text-ink/55">Loading incoming requests…</p>
          ) : incomingRequests.length === 0 ? (
            <p className="text-sm text-ink/55">No incoming friend requests.</p>
          ) : (
            <div className="rounded-2xl border border-navy/[0.08] bg-white p-6 shadow-[0_4px_15px_rgba(27,42,74,.035)]">
              <h2 className="font-display text-base font-semibold text-navy">Incoming Friend Requests</h2>
              <p className="mt-1 text-sm text-ink/65">You have {incomingRequests.length} pending request{incomingRequests.length !== 1 ? 's' : ''}</p>
              {incomingRequests.length > 1 && <p className="text-[10px] text-ink/50">s</p>}
              <div className="mt-4 space-y-3">
                {incomingRequests.map((req) => (
                  <div key={req.id} className="flex items-start gap-3">
                    <div className="rounded-full border-4 border-white flex-shrink-0">
                      <Avatar name={req.requester.username} src={undefined} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-navy/75">{req.requester.username}</p>
                      <p className="text-[10px] text-ink/45">sent you a friend request</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptClick(req.id)}
                        disabled={requestStatus[req.id] === 'accepting' || requestStatus[req.id] === 'rejecting'}
                        className="rounded-lg bg-navy/10 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/20 transition-colors"
                        aria-label="Accept friend request"
                      >
                        {requestStatus[req.id] === 'accepting' ? 'Accepting…' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleRejectClick(req.id)}
                        disabled={requestStatus[req.id] === 'accepting' || requestStatus[req.id] === 'rejecting'}
                        className="rounded-lg bg-paper px-3 py-1.5 text-xs font-semibold text-navy/50 hover:bg-gray-100 transition-colors"
                        aria-label="Reject friend request"
                      >
                        {requestStatus[req.id] === 'rejecting' ? 'Rejecting…' : 'Reject'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </section>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-navy/10">
        {['Overview', 'Posts', 'Saved', 'Activity'].map((item) => (
          <button key={item} onClick={() => setTab(item)} className="flex-1 rounded-md border border-navy/[0.1] bg-white px-3 py-2 text-sm font-medium text-navy/60 hover:bg-navy/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30">
            {item}
          </button>
        ))}
      </div>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  const tones: Record<string, string> = {
    Friends: 'bg-[#f0ecff] text-[#6652d8]',
    'Member since': 'bg-[#eaf4ff] text-[#1976d2]',
    Status: 'bg-[#eff9ef] text-[#188149]',
    Account: 'bg-[#fff1e8] text-[#e36a21]',
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-navy/[0.08] bg-white p-4 shadow-[0_4px_15px_rgba(27,42,74,.035)]">
      <span className={`flex h-11 w-11 items-center justify-center rounded-full text-lg ${tones[label]}`}>{label === 'Friends' ? '♧' : label === 'Member since' ? '▣' : label === 'Status' ? '♛' : '◈'}</span>
      <div>
        <p className="text-sm font-medium text-navy/75">{label}</p>
        <p className="mt-0.5 font-display text-base font-semibold text-navy">{value}</p>
        <p className="mt-0.5 text-xs text-ink/45">{note}</p>
      </div>
    </div>
  );
}