import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../api/client';
import { Avatar } from '../components/Avatar';
import { fetchPostsByUsername, type ApiPost } from '../api/posts';

type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  interests: string[];
  generation: { birthYear: number; label: string } | null;
};

type FriendshipStatus = 'none' | 'outgoing_pending' | 'incoming_pending' | 'friends';
type Friendship = { status: FriendshipStatus; requestId?: string };

export function PublicProfilePage() {
  const { username, userId } = useParams();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState('');
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [friendshipError, setFriendshipError] = useState<string | null>(null);
  const [friendAction, setFriendAction] = useState<'idle' | 'sending' | 'accepting' | 'rejecting'>('idle');
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postsVisibility, setPostsVisibility] = useState<'visible' | 'limited_to_same_cohort'>('visible');

  useEffect(() => {
    if (!username && !userId) return;
    setUser(null);
    setError('');
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

  async function refreshFriendship(usernameToCheck: string) {
    try {
      const response = await api.get<Friendship>(`/users/${encodeURIComponent(usernameToCheck)}/friendship-status`);
      setFriendship(response.data);
      setFriendshipError(null);
    } catch (err) {
      setFriendshipError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    if (!user || isOwnProfile) return;
    setFriendship(null);
    void refreshFriendship(user.username);
  }, [user, isOwnProfile]);

  useEffect(() => {
    if (!user || isOwnProfile) return;
    setPostsLoading(true);
    setPostsError(null);
    fetchPostsByUsername(user.username)
      .then((response) => {
        setPosts(response.posts);
        setPostsVisibility(response.visibility);
      })
      .catch((err) => setPostsError(apiErrorMessage(err)))
      .finally(() => setPostsLoading(false));
  }, [user, isOwnProfile]);

  async function sendFriendRequest() {
    if (!user) return;
    setFriendAction('sending');
    try {
      await api.post(`/users/${encodeURIComponent(user.username)}/friend-request`);
      await refreshFriendship(user.username);
    } catch (err) {
      setFriendshipError(apiErrorMessage(err));
    } finally {
      setFriendAction('idle');
    }
  }

  async function respondToRequest(action: 'accept' | 'reject') {
    if (!user || !friendship?.requestId) return;
    setFriendAction(action === 'accept' ? 'accepting' : 'rejecting');
    try {
      await api.post(`/users/friend-requests/${friendship.requestId}/${action}`);
      await refreshFriendship(user.username);
    } catch (err) {
      setFriendshipError(apiErrorMessage(err));
    } finally {
      setFriendAction('idle');
    }
  }

  if (error) return <main className="mx-auto max-w-3xl px-5 py-10"><Link to="/home" className="text-sm font-semibold text-navy/60">← Back to home</Link><p className="mt-6 rounded-2xl bg-white p-6 text-sm text-ink/65 shadow-sm">{error}</p></main>;
  if (!user) return <main className="mx-auto max-w-3xl px-5 py-10 text-sm text-ink/55">Loading profile…</main>;
  if (isOwnProfile) return <Navigate to="/profile" replace />;

  return <main className="mx-auto max-w-3xl px-5 py-8"><Link to="/home" className="text-sm font-semibold text-navy/60">← Back to home</Link><section className="mt-5 overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-navy/5"><div className="h-32 bg-[radial-gradient(circle_at_15%_30%,#c8d5ff,transparent_28%),radial-gradient(circle_at_80%_30%,#fde6a8,transparent_25%),linear-gradient(120deg,#192b55,#314d8d)]"/><div className="px-6 pb-8"><div className="-mt-12 flex items-end gap-4"><div className="rounded-full border-4 border-white"><Avatar name={user.displayName} src={user.avatarUrl} /></div><div className="pb-1"><h1 className="font-display text-3xl font-semibold text-navy">{user.displayName}</h1><p className="mt-1 text-sm font-medium text-navy/55">@{user.username}</p>{user.generation && <span className="mt-2 inline-flex rounded-full bg-verified/10 px-3 py-1 text-sm font-semibold text-verified">● {user.generation.label}</span>}{!isOwnProfile && (
      <div className="mt-3">
        {friendshipError && <p className="mb-2 text-xs text-red-600">{friendshipError}</p>}
        {!friendship ? <span className="text-sm text-ink/55">Checking friendship…</span> : friendship.status === 'none' ? (
          <button onClick={sendFriendRequest} disabled={friendAction !== 'idle'} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-[--navy-hover] disabled:opacity-60">{friendAction === 'sending' ? 'Sending…' : 'Add Friend'}</button>
        ) : friendship.status === 'outgoing_pending' ? (
          <span className="inline-flex rounded-lg bg-navy/10 px-4 py-2 text-sm font-semibold text-navy">Request Sent</span>
        ) : friendship.status === 'incoming_pending' ? (
          <span className="flex gap-2"><button onClick={() => respondToRequest('accept')} disabled={friendAction !== 'idle'} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60">{friendAction === 'accepting' ? 'Accepting…' : 'Accept Request'}</button><button onClick={() => respondToRequest('reject')} disabled={friendAction !== 'idle'} className="rounded-lg bg-navy/10 px-4 py-2 text-sm font-semibold text-navy disabled:opacity-60">{friendAction === 'rejecting' ? 'Rejecting…' : 'Reject'}</button></span>
        ) : <span className="inline-flex rounded-lg bg-verified/10 px-4 py-2 text-sm font-semibold text-verified">Friends</span>}
      </div>
    )}</div></div><section className="mt-7 rounded-2xl border border-navy/[.08] p-5"><h2 className="font-display text-base font-semibold text-navy">About</h2><p className="mt-3 leading-7 text-ink/70">{user.bio || 'A member of Generation.'}</p></section>{user.interests.length > 0 && <section className="mt-4 rounded-2xl border border-navy/[.08] p-5"><h2 className="font-display text-base font-semibold text-navy">Interests</h2><div className="mt-3 flex flex-wrap gap-2">{user.interests.map((interest) => <span key={interest} className="rounded-full bg-[#eef1ff] px-3 py-1.5 text-sm font-medium text-navy">{interest}</span>)}</div></section>}</div></section><section className="mt-5 rounded-2xl border border-navy/[0.08] bg-white p-6 shadow-[0_4px_15px_rgba(27,42,74,.035)]"><h2 className="font-display text-base font-semibold text-navy">Posts</h2>{postsLoading ? <p className="mt-3 text-sm text-ink/55">Loading posts…</p> : postsError ? <p className="mt-3 text-sm text-red-600">{postsError}</p> : postsVisibility === 'limited_to_same_cohort' ? <p className="mt-3 text-sm text-ink/55">Posts are visible to members of the same Generation.</p> : posts.length === 0 ? <p className="mt-3 text-sm text-ink/55">No posts yet.</p> : <div className="mt-4 space-y-4">{posts.map((post) => <article key={post.id} className="flex gap-3 border-b border-navy/[0.08] pb-4 last:border-0 last:pb-0"><Avatar name={post.author.displayName} src={post.author.avatarUrl} size="sm"/><div className="min-w-0"><p className="text-sm font-semibold text-navy">{post.author.displayName}</p><p className="mt-0.5 text-xs text-ink/45">{new Date(post.createdAt).toLocaleDateString()}</p><p className="mt-2 text-sm leading-6 text-ink/75">{post.content}</p></div></article>)}</div>}</section></main>;
}
