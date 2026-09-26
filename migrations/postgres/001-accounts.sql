BEGIN;
CREATE TABLE IF NOT EXISTS sg_accounts (
 id uuid PRIMARY KEY,
 kakao_id text UNIQUE NOT NULL,
 nickname text NOT NULL DEFAULT '시니어그램 회원',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sg_oauth_states (
 hash text PRIMARY KEY,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS sg_sessions (
 hash text PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES sg_accounts(id),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sg_sessions_expiry ON sg_sessions(expires_at);
CREATE TABLE IF NOT EXISTS sg_trials (
 account_id uuid PRIMARY KEY REFERENCES sg_accounts(id),
 granted_images integer NOT NULL CHECK(granted_images >= 0),
 used_images integer NOT NULL DEFAULT 0 CHECK(used_images >= 0 AND used_images <= granted_images),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sg_subscription_orders (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES sg_accounts(id),
 request_id uuid NOT NULL,
 plan_id text NOT NULL CHECK(plan_id IN ('image','video')),
 amount integer NOT NULL CHECK(amount IN (9900,19900)),
 state text NOT NULL CHECK(state IN ('preparing','ready','approving','verified-test','unknown','cancelled')),
 tid text UNIQUE,
 redirect_url text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,request_id)
);
-- A test payment receipt never grants commercial access.
-- Live recurring charge, refunds, provider reconciliation and entitlement ledger
-- must be implemented and verified before commercial checkout can open.
COMMIT;
