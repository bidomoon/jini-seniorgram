BEGIN;
-- The browser uses authenticated Netlify endpoints, never direct table access.
-- The dedicated server DB owner remains responsible for per-account authorization.
DO $$
DECLARE t record; client_role text;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND left(tablename,3)='sg_' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t.tablename);
  FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=client_role) THEN
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',t.tablename,client_role);
   END IF;
  END LOOP;
 END LOOP;
END $$;
COMMIT;
