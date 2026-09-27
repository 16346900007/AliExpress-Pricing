-- 本地部署专用：平台 ORM 在每个请求前会 SET LOCAL ROLE 'anon_'（RLS 机制），
-- 需提前建好该角色并授权，否则接口报 "role anon_ does not exist"。
-- 幂等：重复执行不会报错。

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon_') THEN
    CREATE ROLE anon_;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon_;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon_;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon_;
