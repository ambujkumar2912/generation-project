-- ============================================================
-- Generation Platform — Initial Schema
-- PostgreSQL 15+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ------------------------------------------------------------
-- ENUM TYPES
-- ------------------------------------------------------------

CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected', 'suspicious');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'banned', 'deleted');
CREATE TYPE post_type AS ENUM ('text', 'photo', 'video', 'question', 'review', 'recommendation', 'poll', 'job', 'help_request', 'life_update', 'achievement');
CREATE TYPE reaction_type AS ENUM ('like', 'support', 'celebrate', 'insightful');
CREATE TYPE report_target_type AS ENUM ('post', 'comment', 'user', 'message');
CREATE TYPE report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE moderation_action_type AS ENUM ('warn', 'remove_content', 'suspend_user', 'ban_user', 'dismiss_report');
CREATE TYPE message_request_status AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE help_category AS ENUM ('job', 'education', 'advice', 'review', 'life', 'financial');
CREATE TYPE subscription_tier AS ENUM ('free', 'premium');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'expired', 'past_due');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- ------------------------------------------------------------
-- USERS & PROFILES
-- ------------------------------------------------------------

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT UNIQUE,
    phone               TEXT UNIQUE,
    password_hash       TEXT NOT NULL,
    account_status      account_status NOT NULL DEFAULT 'active',
    is_admin            BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT users_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE deleted_at IS NULL;

CREATE TABLE profiles (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name        TEXT NOT NULL,
    bio                 TEXT,
    avatar_url          TEXT,
    education_category  TEXT,
    career_category     TEXT,
    broad_location       TEXT, -- e.g. city/state only, never precise coords
    interests           TEXT[] DEFAULT '{}',
    helpful_contributions_count INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- COHORTS & VERIFICATION
-- ------------------------------------------------------------

CREATE TABLE cohorts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    birth_year          INTEGER NOT NULL UNIQUE,
    label               TEXT NOT NULL, -- e.g. "2006 Generation"
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cohort_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cohort_id           UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    verified_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_primary          BOOLEAN NOT NULL DEFAULT TRUE, -- primary cohort shown on profile
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, cohort_id)
);
CREATE INDEX idx_cohort_members_cohort ON cohort_members(cohort_id);
CREATE INDEX idx_cohort_members_user ON cohort_members(user_id);

-- Verification requests store ONLY a pointer to securely-stored document
-- data (object storage key, encrypted), never raw document content or
-- extracted PII beyond what's required to confirm cohort eligibility.
CREATE TABLE verification_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cohort_id           UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    document_type       TEXT NOT NULL, -- 'birth_certificate' | 'class10_certificate' | 'other'
    document_storage_key TEXT NOT NULL, -- private object storage key, never public URL
    status              verification_status NOT NULL DEFAULT 'pending',
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    -- documents are deleted from storage after review; this flags that
    document_deleted_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_verification_status ON verification_requests(status);
CREATE INDEX idx_verification_user ON verification_requests(user_id);

-- ------------------------------------------------------------
-- COMMUNITIES
-- ------------------------------------------------------------

CREATE TABLE communities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    description         TEXT,
    icon_url            TEXT,
    created_by          UUID REFERENCES users(id),
    member_count        INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE TABLE community_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id        UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_moderator        BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (community_id, user_id)
);
CREATE INDEX idx_community_members_user ON community_members(user_id);
CREATE INDEX idx_community_members_community ON community_members(community_id);

-- ------------------------------------------------------------
-- POSTS, MEDIA, COMMENTS, REACTIONS
-- ------------------------------------------------------------

CREATE TABLE posts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cohort_id           UUID REFERENCES cohorts(id), -- feed scoping
    community_id        UUID REFERENCES communities(id), -- null if posted to generation feed only
    type                post_type NOT NULL DEFAULT 'text',
    body                TEXT,
    poll_options        JSONB, -- only used when type = 'poll'
    is_help_request     BOOLEAN NOT NULL DEFAULT FALSE,
    help_category       help_category,
    comment_count       INTEGER NOT NULL DEFAULT 0,
    reaction_count      INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_posts_cohort_created ON posts(cohort_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_community_created ON posts(community_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_help_category ON posts(help_category) WHERE is_help_request = TRUE;

CREATE TABLE post_media (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id             UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    media_type          TEXT NOT NULL, -- 'image' | 'video'
    storage_key         TEXT NOT NULL,
    position             INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_media_post ON post_media(post_id);

CREATE TABLE comments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id             UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id   UUID REFERENCES comments(id) ON DELETE CASCADE, -- for replies
    body                TEXT NOT NULL,
    reaction_count      INTEGER NOT NULL DEFAULT 0,
    marked_helpful      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_comments_post ON comments(post_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);

CREATE TABLE reactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id             UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id          UUID REFERENCES comments(id) ON DELETE CASCADE,
    type                reaction_type NOT NULL DEFAULT 'like',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reactions_target CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR
        (post_id IS NULL AND comment_id IS NOT NULL)
    ),
    UNIQUE (user_id, post_id, comment_id)
);
CREATE INDEX idx_reactions_post ON reactions(post_id);
CREATE INDEX idx_reactions_comment ON reactions(comment_id);

CREATE TABLE saved_posts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id             UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, post_id)
);
CREATE INDEX idx_saved_posts_user ON saved_posts(user_id);

-- ------------------------------------------------------------
-- HELP REQUESTS & REVIEWS (specialized help-section content)
-- ------------------------------------------------------------

CREATE TABLE help_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id             UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    category            help_category NOT NULL,
    is_resolved         BOOLEAN NOT NULL DEFAULT FALSE,
    -- financial help requests require extra scrutiny
    requires_review     BOOLEAN NOT NULL DEFAULT FALSE,
    flagged_for_scam_review BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_help_requests_category ON help_requests(category);

CREATE TABLE reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id             UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    subject_name        TEXT NOT NULL, -- name of course/college/app/product being reviewed
    subject_category    TEXT NOT NULL, -- 'course' | 'college' | 'app' | 'service' | 'product' | 'experience'
    rating              SMALLINT CHECK (rating BETWEEN 1 AND 5),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_subject ON reviews(subject_category, subject_name);

-- ------------------------------------------------------------
-- MESSAGING
-- ------------------------------------------------------------

CREATE TABLE conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT conversations_distinct_users CHECK (user_a_id <> user_b_id),
    UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX idx_conversations_user_a ON conversations(user_a_id, last_message_at DESC);
CREATE INDEX idx_conversations_user_b ON conversations(user_b_id, last_message_at DESC);

CREATE TABLE message_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status              message_request_status NOT NULL DEFAULT 'pending',
    initial_message     TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at         TIMESTAMPTZ,
    UNIQUE (from_user_id, to_user_id)
);
CREATE INDEX idx_message_requests_to ON message_requests(to_user_id, status);

CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body                TEXT,
    image_storage_key   TEXT,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT messages_has_content CHECK (body IS NOT NULL OR image_storage_key IS NOT NULL)
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

-- ------------------------------------------------------------
-- BLOCKS
-- ------------------------------------------------------------

CREATE TABLE user_blocks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_blocks_distinct CHECK (blocker_id <> blocked_id),
    UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);

-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                TEXT NOT NULL, -- 'comment' | 'reply' | 'reaction' | 'message_request' | 'message' | 'community_activity' | 'help_response'
    actor_id            UUID REFERENCES users(id),
    post_id             UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id          UUID REFERENCES comments(id) ON DELETE CASCADE,
    conversation_id     UUID REFERENCES conversations(id) ON DELETE CASCADE,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- ------------------------------------------------------------
-- REPORTS & MODERATION
-- ------------------------------------------------------------

CREATE TABLE reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type         report_target_type NOT NULL,
    target_post_id      UUID REFERENCES posts(id) ON DELETE CASCADE,
    target_comment_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
    target_user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
    target_message_id   UUID REFERENCES messages(id) ON DELETE CASCADE,
    reason              TEXT NOT NULL,
    details             TEXT,
    status              report_status NOT NULL DEFAULT 'open',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at         TIMESTAMPTZ
);
CREATE INDEX idx_reports_status ON reports(status, created_at);

CREATE TABLE moderation_actions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id           UUID REFERENCES reports(id) ON DELETE SET NULL,
    moderator_id        UUID NOT NULL REFERENCES users(id),
    action_type         moderation_action_type NOT NULL,
    target_user_id      UUID REFERENCES users(id),
    target_post_id      UUID REFERENCES posts(id),
    target_comment_id   UUID REFERENCES comments(id),
    reason              TEXT,
    -- for suspend_user: how long; null = permanent (ban)
    suspension_until    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_moderation_actions_target_user ON moderation_actions(target_user_id);

CREATE TABLE appeals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderation_action_id UUID NOT NULL REFERENCES moderation_actions(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message             TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'upheld' | 'overturned'
    reviewed_by         UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at         TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- PREMIUM / SUBSCRIPTIONS / PAYMENTS
-- ------------------------------------------------------------

CREATE TABLE subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier                subscription_tier NOT NULL DEFAULT 'free',
    status              subscription_status NOT NULL DEFAULT 'active',
    current_period_end  TIMESTAMPTZ,
    provider             TEXT, -- e.g. 'stripe' — adapter-based, filled in when connected
    provider_customer_id TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id     UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents        INTEGER NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'INR',
    status              payment_status NOT NULL DEFAULT 'pending',
    provider_payment_id TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_user ON payments(user_id);

-- ------------------------------------------------------------
-- updated_at auto-touch trigger (applied to tables that have the column)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['users','profiles','verification_requests','communities','posts','comments','subscriptions']
    LOOP
        EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
    END LOOP;
END $$;
