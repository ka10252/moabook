-- ============================================================
-- DB OPTIMIZATION: indexes + stable spine_color
-- ============================================================

-- ── 1. spine_color on books ──────────────────────────────────
-- Stores the display color (1-6) so it doesn't re-randomise on
-- every fetch in the React client.
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS spine_color SMALLINT NOT NULL DEFAULT 1;

-- Randomise color for existing rows once (values 1-6)
UPDATE public.books
SET spine_color = (floor(random() * 6) + 1)::SMALLINT
WHERE spine_color = 1;  -- only touches rows still at the default

-- Set a random default for future inserts via a trigger
CREATE OR REPLACE FUNCTION public.set_book_spine_color()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.spine_color := (floor(random() * 6) + 1)::SMALLINT;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_book_spine_color ON public.books;
CREATE TRIGGER trg_set_book_spine_color
BEFORE INSERT ON public.books
FOR EACH ROW
EXECUTE FUNCTION public.set_book_spine_color();

-- ── 2. Indexes ────────────────────────────────────────────────
-- PostgreSQL creates indexes automatically only for PRIMARY KEY
-- and UNIQUE constraints. All FK columns below are unindexed.

-- books
CREATE INDEX IF NOT EXISTS idx_books_owner_id      ON public.books (owner_id);
CREATE INDEX IF NOT EXISTS idx_books_community_id  ON public.books (community_id);
CREATE INDEX IF NOT EXISTS idx_books_status        ON public.books (status);
-- composite: community shelf query filters by community_id + status
CREATE INDEX IF NOT EXISTS idx_books_community_status
  ON public.books (community_id, status);

-- transactions
CREATE INDEX IF NOT EXISTS idx_transactions_book_id     ON public.transactions (book_id);
CREATE INDEX IF NOT EXISTS idx_transactions_owner_id    ON public.transactions (owner_id);
CREATE INDEX IF NOT EXISTS idx_transactions_borrower_id ON public.transactions (borrower_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status      ON public.transactions (status);
-- composite used when checking active borrows for a user
CREATE INDEX IF NOT EXISTS idx_transactions_borrower_status
  ON public.transactions (borrower_id, status);

-- conversations
CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON public.conversations (participant_1);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON public.conversations (participant_2);
-- sort by latest message
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
  ON public.conversations (last_message_at DESC);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id       ON public.messages (sender_id);
-- unread count queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_is_read
  ON public.messages (conversation_id, is_read)
  WHERE is_read = false;

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read)
  WHERE is_read = false;

-- wishlists
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON public.wishlists (user_id);

-- liked_books — unique(user_id, book_id) already covers user_id lookups.
-- Add index for reverse lookup (all likers of a book).
CREATE INDEX IF NOT EXISTS idx_liked_books_book_id ON public.liked_books (book_id);

-- community_members — unique(community_id, user_id) covers community_id lookups.
-- Add index for user_id so "get all communities for a user" is fast.
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON public.community_members (user_id);

-- community_posts (new table from previous migration)
CREATE INDEX IF NOT EXISTS idx_community_posts_community_id ON public.community_posts (community_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_author_id    ON public.community_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at
  ON public.community_posts (community_id, created_at DESC);

-- community_comments
CREATE INDEX IF NOT EXISTS idx_community_comments_post_id   ON public.community_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_author_id ON public.community_comments (author_id);

-- ── 3. liked_books FK to profiles (was missing) ──────────────
-- The original migration omitted the FK reference to profiles.
ALTER TABLE public.liked_books
  DROP CONSTRAINT IF EXISTS liked_books_user_id_fkey;
ALTER TABLE public.liked_books
  ADD CONSTRAINT liked_books_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── 4. notifications FK to profiles (was missing) ────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
