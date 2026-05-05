CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;

-- Posts: members can read, authenticated users who are members can insert/delete own posts
CREATE POLICY "Community members can view posts"
  ON community_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = community_posts.community_id
        AND user_id = auth.uid()
        AND is_banned = false
    )
  );

CREATE POLICY "Members can create posts"
  ON community_posts FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = community_posts.community_id
        AND user_id = auth.uid()
        AND is_banned = false
    )
  );

CREATE POLICY "Authors can delete own posts"
  ON community_posts FOR DELETE
  USING (author_id = auth.uid());

-- Comments: same logic
CREATE POLICY "Community members can view comments"
  ON community_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_posts cp
      JOIN community_members cm ON cm.community_id = cp.community_id
      WHERE cp.id = community_comments.post_id
        AND cm.user_id = auth.uid()
        AND cm.is_banned = false
    )
  );

CREATE POLICY "Members can create comments"
  ON community_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM community_posts cp
      JOIN community_members cm ON cm.community_id = cp.community_id
      WHERE cp.id = community_comments.post_id
        AND cm.user_id = auth.uid()
        AND cm.is_banned = false
    )
  );

CREATE POLICY "Authors can delete own comments"
  ON community_comments FOR DELETE
  USING (author_id = auth.uid());
