-- Phase: first real Generation text posts. Existing future post concepts remain intact.
ALTER TABLE posts
  ADD CONSTRAINT posts_text_requires_nonempty_body
  CHECK (type <> 'text' OR (body IS NOT NULL AND length(btrim(body)) > 0));

CREATE INDEX idx_posts_cohort_cursor
  ON posts (cohort_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
