-- user_jobs 表
CREATE TABLE IF NOT EXISTS user_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'written', 'interview', 'offer', 'star')),
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id, status)
);

ALTER TABLE user_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_jobs_all_own" ON user_jobs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_jobs_user_id_idx ON user_jobs(user_id);
CREATE INDEX IF NOT EXISTS user_jobs_job_id_idx ON user_jobs(job_id);
CREATE INDEX IF NOT EXISTS user_jobs_status_idx ON user_jobs(user_id, status);

-- profiles 表的触发器（自动创建 profile）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
