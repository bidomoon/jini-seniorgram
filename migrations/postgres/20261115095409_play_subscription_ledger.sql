BEGIN;
CREATE TABLE sg_play_purchases (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 account_id uuid NOT NULL REFERENCES sg_accounts(id),
 token_cipher text NOT NULL,
 product_id text,
 state text NOT NULL,
 expires_at timestamptz,
 order_id text,
 is_test boolean NOT NULL DEFAULT true,
 auto_renewing boolean NOT NULL DEFAULT false,
 replaced_by_hash text,
 checked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sg_play_purchases_account ON sg_play_purchases(account_id);
ALTER TABLE sg_play_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sg_play_purchases FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
 FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=client_role) THEN
   EXECUTE format('REVOKE ALL ON TABLE public.sg_play_purchases FROM %I',client_role);
  END IF;
 END LOOP;
END $$;
COMMIT;
