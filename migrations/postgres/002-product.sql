BEGIN;
ALTER TABLE sg_accounts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE TABLE IF NOT EXISTS sg_entitlements (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES sg_accounts(id),
 source text NOT NULL CHECK(source IN ('trial','google-play','kakaopay','operator-test')),
 reference text UNIQUE NOT NULL,
 starts_at timestamptz NOT NULL DEFAULT now(),
 ends_at timestamptz,
 image_limit integer NOT NULL CHECK(image_limit>=0),
 video_limit integer NOT NULL CHECK(video_limit>=0),
 image_used integer NOT NULL DEFAULT 0 CHECK(image_used>=0 AND image_used<=image_limit),
 video_used integer NOT NULL DEFAULT 0 CHECK(video_used>=0 AND video_used<=video_limit),
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sg_entitlements_account ON sg_entitlements(account_id,ends_at);
CREATE TABLE IF NOT EXISTS sg_daily_usage (
 day date NOT NULL, kind text NOT NULL, used integer NOT NULL DEFAULT 0 CHECK(used>=0),
 PRIMARY KEY(day,kind)
);
CREATE TABLE IF NOT EXISTS sg_jobs (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES sg_accounts(id), request_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('image','video')), prompt text NOT NULL CHECK(length(prompt)<=800),
 state text NOT NULL CHECK(state IN ('submitting','processing','succeeded','failed','unknown')),
 provider_id text, object_key text, message text, parent_id uuid REFERENCES sg_jobs(id),
 entitlement_id uuid NOT NULL REFERENCES sg_entitlements(id),
 usage_state text NOT NULL DEFAULT 'reserved' CHECK(usage_state IN ('reserved','consumed','refunded')),
 created_at timestamptz NOT NULL DEFAULT now(), checked_at timestamptz, deleted_at timestamptz,
 UNIQUE(account_id,request_id)
);
CREATE INDEX IF NOT EXISTS sg_jobs_account_created ON sg_jobs(account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS sg_jobs_pending ON sg_jobs(checked_at) WHERE state='processing' AND deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS sg_posts (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES sg_accounts(id), request_id uuid NOT NULL,
 title text NOT NULL CHECK(length(title)<=80), object_key text NOT NULL,
 state text NOT NULL CHECK(state IN ('reviewing','visible','hidden','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(account_id,request_id)
);
CREATE INDEX IF NOT EXISTS sg_posts_feed ON sg_posts(created_at DESC) WHERE state='visible';
CREATE TABLE IF NOT EXISTS sg_likes (
 post_id uuid NOT NULL REFERENCES sg_posts(id) ON DELETE CASCADE,
 account_id uuid NOT NULL REFERENCES sg_accounts(id), PRIMARY KEY(post_id,account_id)
);
CREATE TABLE IF NOT EXISTS sg_reports (
 post_id uuid NOT NULL REFERENCES sg_posts(id) ON DELETE CASCADE,
 account_id uuid NOT NULL REFERENCES sg_accounts(id), reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 PRIMARY KEY(post_id,account_id)
);
CREATE TABLE IF NOT EXISTS sg_blocks (
 account_id uuid NOT NULL REFERENCES sg_accounts(id), blocked_id uuid NOT NULL REFERENCES sg_accounts(id),
 PRIMARY KEY(account_id,blocked_id), CHECK(account_id<>blocked_id)
);
CREATE TABLE IF NOT EXISTS sg_feedback (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES sg_accounts(id),
 category text NOT NULL CHECK(category IN ('help','bug','idea','refund','cancel')),
 message text NOT NULL CHECK(length(message) BETWEEN 3 AND 2000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sg_file_deletions (
 object_key text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sg_admin_events (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES sg_accounts(id), action text NOT NULL,
 target_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
