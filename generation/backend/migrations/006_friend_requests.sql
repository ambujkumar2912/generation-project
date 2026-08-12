-- ============================================================
-- Step 2: Friend Requests
-- ============================================================

CREATE TABLE friend_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX idx_friend_requests_to_user_status ON friend_requests(to_user_id, status);
CREATE INDEX idx_friend_requests_from_user ON friend_requests(from_user_id, status);