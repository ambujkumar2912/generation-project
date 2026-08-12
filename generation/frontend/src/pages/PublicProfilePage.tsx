import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../api/client';
import { Avatar } from '../components/Avatar';

type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  interests: string[];
  generation: { birthYear: number; label: string } | null;
};

export function PublicProfilePage() {
  const { username, userId } = useParams();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState('');
  const [friendRequestStatus, setFriendRequestStatus] = useState<'idle' | 'pending' | 'sent'>('idle');

  useEffect(() => {
    if (!username && !userId) return;
    setUser(null);
    setError('');
    setFriendRequestStatus('idle');
    const request = username
      ? api.get(`/users/${encodeURIComponent(username)}`).then((response) => response.data.user)
      : api.get(`/profile/${encodeURIComponent(userId!)}`).then((response) => ({
        id: response.data.profile.user_id,
        username: response.data.profile.username,
        displayName: response.data.profile.display_name,
        avatarUrl: response.data.profile.avatar_url,
        bio: response.data.profile.bio,
        interests: response.data.profile.interests ?? [],
        generation: response.data.cohort ? { birthYear: response.data.cohort.birth_year, label: response.data.cohort.label } : null,
      }));
    request
      .then((profile) => setUser(profile))
      .catch(() => setError('This profile is unavailable.'));
  }, [username, userId]);

  const isOwnProfile = user?.id === authUser?.id;

  async function sendFriendRequest(username: string) {
    setFriendRequestStatus('pending');
    try {
      const response = await api.post<{ id: string }>(`/users/${username}/friend-request`);
      setFriendRequestStatus('sent');
    } catch (err) {
      const message = apiErrorMessage(err);
      setError(message);
      setFriendRequestStatus('idle');
    }
  }

  if (error) return <main className="mx-auto max-w-3xl px-5 py-10"><Link to="/home" className="text-sm font-semibold text-navy/60">← Back to home</Link><p className="mt-6 rounded-2xl bg-white p-6 text-sm text-ink/65 shadow-sm">{error}</p></main>;
  if (!user) return <main className="mx-auto max-w-3xl px-5 py-10 text-sm text-ink/55">Loading profile…</main>;

  return <main className="mx-auto max-w-3xl px-5 py-8"><Link to="/home" className="text-sm font-semibold text-navy/60">← Back to home</Link><section className="mt-5 overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-navy/5"><div className="h-32 bg-[radial-gradient(circle_at_15%_30%,#c8d5ff,transparent_28%),radial-gradient(circle_at_80%_30%,#fde6a8,transparent_25%),linear-gradient(120deg,#192b55,#314d8d)]"/><div className="px-6 pb-8"><div className="-mt-12 flex items-end gap-4"><div className="rounded-full border-4 border-white"><Avatar name={user.displayName} src={user.avatarUrl} /></div><div className="pb-1"><h1 className="font-display text-3xl font-semibold text-navy">{user.displayName}</h1><p className="mt-1 text-sm font-medium text-navy/55">@{user.username}</p>{user.generation && <span className="mt-2 inline-flex rounded-full bg-verified/10 px-3 py-1 text-sm font-semibold text-verified">● {user.generation.label}</span>}{!isOwnProfile && (
      <button
        onClick={() => sendFriendRequest(user!.username)}
        disabled={friendRequestStatus !== 'idle'}
        className="mt-3 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-[--navy-hover] transition-colors">
        {friendRequestStatus === 'pending' ? 'Sending…' : friendRequestStatus === 'sent' ? 'Friend Request Sent' : 'Add Friend'}
      </button>
    )}</div></div><section className="mt-7 rounded-2xl border border-navy/[.08] p-5"><h2 className="font-display text-base font-semibold text-navy">About</h2><p className="mt-3 leading-7 text-ink/70">{user.bio || 'A member of Generation.'}</p></section>{user.interests.length > 0 && <section className="mt-4 rounded-2xl border border-navy/[.08] p-5"><h2 className="font-display text-base font-semibold text-navy">Interests</h2><div className="mt-3 flex flex-wrap gap-2">{user.interests.map((interest) => <span key={interest} className="rounded-full bg-[#eef1ff] px-3 py-1.5 text-sm font-medium text-navy">{interest}</span>)}</div></section>}</div></section></main>;
}
