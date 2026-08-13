import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { api, apiErrorMessage } from '../api/client';
import { deletePost, type ApiPost } from '../api/posts';
import { useAuth } from '../context/AuthContext';

type IncomingRequest = {
  id: string;
  requester: { id: string; username: string };
  status: string;
  created_at: string;
};

type Friend = {
  id: string;
  username: string;
};

type RequestStatus = 'idle' | 'accepting' | 'rejecting';

export function ProfilePage() {
  const { user, verifiedCohorts } = useAuth();
  const [tab, setTab] = useState('Overview');

  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);

  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

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

    async function loadFriends() {
      setFriendsLoading(true);
      setFriendsError(null);

      try {
        const res = await api.get('/users/me/friends');
        setFriends(res.data.friends ?? []);
      } catch (err) {
        setFriendsError(apiErrorMessage(err));
      } finally {
        setFriendsLoading(false);
      }
    }

    loadIncomingRequests();
    loadFriends();
  }, []);

  useEffect(() => {
    async function loadPostsIfNeeded() {
      if (tab !== 'Posts') return;
      setPostsLoading(true);
      setPostsError(null);
      try {
        const res = await api.get('/posts/me');
        setPosts(res.data.posts ?? []);
      } catch (err) {
        setPostsError(apiErrorMessage(err));
      } finally {
        setPostsLoading(false);
      }
    }
    loadPostsIfNeeded();
  }, [tab]);

  const handleAcceptClick = async (requestId: string) => {
    setRequestStatus(prev => ({ ...prev, [requestId]: 'accepting' }));

    try {
      await api.post(`/users/friend-requests/${requestId}/accept`);

      const acceptedRequest = incomingRequests.find(
        req => req.id === requestId
      );

      setIncomingRequests(prev =>
        prev.filter(req => req.id !== requestId)
      );

      if (acceptedRequest) {
        setFriends(prev => {
          const alreadyExists = prev.some(
            friend => friend.id === acceptedRequest.requester.id
          );

          if (alreadyExists) return prev;

          return [
            ...prev,
            {
              id: acceptedRequest.requester.id,
              username: acceptedRequest.requester.username,
            },
          ];
        });
      }
    } catch (err) {
      setRequestsError(apiErrorMessage(err));
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

      setIncomingRequests(prev =>
        prev.filter(req => req.id !== requestId)
      );
    } catch (err) {
      setRequestsError(apiErrorMessage(err));
    } finally {
      setRequestStatus(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deletePost(postId);
      setPosts(prev => prev.filter(post => post.id !== postId));
    } catch (err) {
      setPostsError(apiErrorMessage(err));
    }
  };

  if (!user) return null;

  const cohort =
    verifiedCohorts.find(item => item.is_primary) ?? verifiedCohorts[0];

  const joined = new Date(
    (user as any).created_at ?? Date.now()
  ).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });

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

                <Link
                  to="/profile/edit"
                  aria-label="Edit profile photo"
                  className="absolute bottom-1 right-0 rounded-full bg-gold p-2 text-xs text-navy shadow-md"
                >
                  ◉
                </Link>
              </div>

              <div className="pb-1">
                <h1 className="font-display text-3xl font-semibold text-navy">
                  {user.display_name}
                </h1>

                {user.username && (
                  <p className="mt-1 text-sm font-medium text-navy/55">
                    @{user.username}
                  </p>
                )}

                {cohort && (
                  <span className="mt-2 inline-flex rounded-full bg-verified/10 px-3 py-1 text-sm font-semibold text-verified">
                    ● {cohort.label}
                  </span>
                )}
              </div>
            </div>

            <Link
              to="/profile/edit"
              className="rounded-xl bg-navy px-4 py-2.5 text-center text-sm font-semibold text-paper transition hover:-translate-y-0.5 hover:bg-navy-light"
            >
              Edit Profile
            </Link>
          </div>

          <p className="mt-5 max-w-2xl text-sm leading-6 text-ink/70">
            {user.bio ||
              'A new member of Generation, here to learn, grow, and connect.'}
          </p>
        </div>

        {/* Stats: Friends is the large combined card below; these remain compact. */}
        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Member since"
            value={joined}
            note="Part of Generation"
          />
          <Stat
            label="Status"
            value="Active"
            note="Your account is active"
          />
          <Stat
            label="Account"
            value="Generation Member"
            note="Built for belonging"
          />
        </section>

{/* Compact Friends link with dynamic count */}
        <Link
          to="/profile/friends"
          className="flex items-center gap-2 rounded-lg bg-navy/10 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/20 transition-colors"
        >
          Friends
          <span className="hidden sm:inline">
            {String(friends.length)}
          </span>
        </Link>
      </section>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-navy/10">
        {['Overview', 'Posts', 'Saved', 'Activity'].map(item => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className="flex-1 rounded-md border border-navy/[0.1] bg-white px-3 py-2 text-sm font-medium text-navy/60 hover:bg-navy/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
          >
            {item}
          </button>
        ))}
      </div>
      {tab === 'Posts' && (
        <section className="mt-5 rounded-2xl border border-navy/[0.08] bg-white p-6 shadow-[0_4px_15px_rgba(27,42,74,.035)]">
          {postsLoading ? (
            <p className="text-sm text-ink/55">Loading posts…</p>
          ) : postsError ? (
            <p className="text-sm text-red-500">Error loading posts.</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-ink/55">No posts yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="flex items-start gap-3">
                  <div className="flex-shrink-0 rounded-full border-4 border-white">
                    <Avatar name={post.author.displayName} src={post.author.avatarUrl} />
                  </div>
                  <div>
                    <p className="font-medium text-navy/75">
                      {post.author.displayName}
                    </p>
                    <p className="text-[10px] text-ink/45">
                      {post.content}
                    </p>
                    <p className="text-[10px] text-ink/45">
                      · {post.createdAt}
                    </p>
                    <button onClick={() => handleDeletePost(post.id)} className="mt-2 text-xs font-semibold text-red-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  const tones: Record<string, string> = {
    'Member since': 'bg-[#eaf4ff] text-[#1976d2]',
    Status: 'bg-[#eff9ef] text-[#188149]',
    Account: 'bg-[#fff1e8] text-[#e36a21]',
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-navy/[0.08] bg-white p-4 shadow-[0_4px_15px_rgba(27,42,74,.035)]">
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full text-lg ${tones[label]}`}
      >
        {label === 'Member since'
          ? '▣'
          : label === 'Status'
            ? '♛'
            : '◈'}
      </span>

      <div>
        <p className="text-sm font-medium text-navy/75">{label}</p>
        <p className="mt-0.5 font-display text-base font-semibold text-navy">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-ink/45">{note}</p>
      </div>
    </div>
  );
}
