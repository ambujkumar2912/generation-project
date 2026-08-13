import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { api, apiErrorMessage } from '../api/client';
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

export function FriendsPage() {
  const { user } = useAuth();

  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);

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

  if (!user) return null;

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

                {/* Cohort removed - keeping minimal */}
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
            {user.bio || 'A new member of Generation, here to learn, grow, and connect.'}
          </p>
        </div>

        {/* ONE main Friends container */}
        <section className="mt-6 px-5 pb-6 sm:px-8">
          <div className="rounded-2xl border border-navy/[0.08] bg-white p-6 shadow-[0_4px_15px_rgba(27,42,74,.035)]">

            {/* Friend Requests section */}
            {incomingRequests.length > 0 && (
              <div>
                <h2 className="font-display text-base font-semibold text-navy">
                  Friend Requests
                </h2>

                {requestsLoading ? (
                  <p className="mt-3 text-sm text-ink/55">Loading requests…</p>
                ) : requestsError ? (
                  <p className="mt-3 text-sm text-red-500">
                    {requestsError}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-ink/65">
                    You have {incomingRequests.length} pending request
                    {incomingRequests.length !== 1 ? 's' : ''}
                  </p>
                )}

                <div className="mt-4 space-y-3">
                  {incomingRequests.map(req => (
                    <div
                      key={req.id}
                      className="flex items-start gap-3"
                    >
                      <div className="flex-shrink-0 rounded-full border-4 border-white">
                        <Avatar
                          name={req.requester.username}
                          src={undefined}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-navy/75">
                          {req.requester.username}
                        </p>

                        <p className="text-[10px] text-ink/45">
                          sent you a friend request
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAcceptClick(req.id)}
                          disabled={
                            requestStatus[req.id] === 'accepting' ||
                            requestStatus[req.id] === 'rejecting'
                          }
                          className="rounded-lg bg-navy/10 px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-navy/20"
                          aria-label="Accept friend request"
                        >
                          {requestStatus[req.id] === 'accepting'
                            ? 'Accepting…'
                            : 'Accept'}
                        </button>

                        <button
                          onClick={() => handleRejectClick(req.id)}
                          disabled={
                            requestStatus[req.id] === 'accepting' ||
                            requestStatus[req.id] === 'rejecting'
                          }
                          className="rounded-lg bg-paper px-3 py-1.5 text-xs font-semibold text-navy/50 transition-colors hover:bg-gray-100"
                          aria-label="Reject friend request"
                        >
                          {requestStatus[req.id] === 'rejecting'
                            ? 'Rejecting…'
                            : 'Reject'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {incomingRequests.length > 0 && (
              <div className="my-6 border-t border-navy/[0.08]" />
            )}

            {/* My Friends section */}
            <div>
              <h2 className="font-display text-base font-semibold text-navy">
                My Friends
              </h2>

              {friendsLoading ? (
                <p className="mt-3 text-sm text-ink/55">Loading friends…</p>
              ) : friendsError ? (
                <p className="mt-3 text-sm text-red-500">
                  {friendsError}
                </p>
              ) : friends.length === 0 ? (
                <p className="mt-3 text-sm text-ink/55">
                  No friends yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {friends.map(friend => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3"
                    >
                      <div className="flex-shrink-0 rounded-full border-4 border-white">
                        <Avatar
                          name={friend.username}
                          src={undefined}
                        />
                      </div>

                      <div>
                        <p className="font-medium text-navy/75">
                          {friend.username}
                        </p>

                        <p className="text-[10px] text-ink/45">
                          your friend
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </section>

      </main>
  );
}