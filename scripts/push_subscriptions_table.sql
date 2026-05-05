-- Run in Supabase Dashboard → SQL Editor
-- Creates the push_subscriptions table required for web push notifications

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL,
  subscription JSONB      NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
