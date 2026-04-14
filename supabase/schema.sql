-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  token_balance INTEGER NOT NULL DEFAULT 0,
  reputation_score INTEGER NOT NULL DEFAULT 0,
  total_votes INTEGER NOT NULL DEFAULT 0,
  correct_votes INTEGER NOT NULL DEFAULT 0,
  accuracy_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  badge_level TEXT NOT NULL DEFAULT 'Newcomer' CHECK (badge_level IN ('Newcomer','Contributor','Trusted','Expert')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. polls table
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_url TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('image','video','text')),
  user_description TEXT NOT NULL DEFAULT '',
  ai_generated_question TEXT NOT NULL,
  flag_level TEXT NOT NULL CHECK (flag_level IN ('safe','warning','blocked')),
  flag_reason TEXT,
  flag_confidence INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','blocked')),
  yes_votes INTEGER NOT NULL DEFAULT 0,
  no_votes INTEGER NOT NULL DEFAULT 0,
  correct_answer TEXT CHECK (correct_answer IN ('yes','no')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 3. votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('yes','no')),
  is_correct BOOLEAN,
  tokens_awarded INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- 4. token_ledger table
CREATE TABLE IF NOT EXISTS token_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('correct_vote','wrong_vote','poll_created','ai_fraud_detected','whistleblower_bonus','cashout')),
  poll_id UUID REFERENCES polls(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Storage bucket for poll media (images / videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('poll-media', 'poll-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read files from the poll-media bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'poll_media_select_public'
  ) THEN
    CREATE POLICY "poll_media_select_public"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'poll-media');
  END IF;
END $$;

-- Allow anyone (anon / authenticated) to upload files to poll-media
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'poll_media_insert_public'
  ) THEN
    CREATE POLICY "poll_media_insert_public"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'poll-media');
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_created_at ON polls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_poll_id ON votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_token_ledger_user_id ON token_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: anyone can read, service role can write
CREATE POLICY "users_select_all" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert_service" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update_service" ON users FOR UPDATE USING (true);

-- Polls: anyone can read active/closed polls, service role manages all
CREATE POLICY "polls_select_public" ON polls FOR SELECT USING (status != 'blocked');
CREATE POLICY "polls_insert_service" ON polls FOR INSERT WITH CHECK (true);
CREATE POLICY "polls_update_service" ON polls FOR UPDATE USING (true);

-- Votes: users can read their own votes, service role manages all
CREATE POLICY "votes_select_own" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_service" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "votes_update_service" ON votes FOR UPDATE USING (true);

-- Token ledger: users can read their own history
CREATE POLICY "ledger_select_own" ON token_ledger FOR SELECT USING (true);
CREATE POLICY "ledger_insert_service" ON token_ledger FOR INSERT WITH CHECK (true);

-- 6. Poll comments / justifications table
CREATE TABLE IF NOT EXISTS poll_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
  comment TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poll_comments_poll_id ON poll_comments(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_comments_created_at ON poll_comments(created_at DESC);

ALTER TABLE poll_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_all" ON poll_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_all" ON poll_comments FOR INSERT WITH CHECK (true);
