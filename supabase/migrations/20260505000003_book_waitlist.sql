-- ============================================================
-- Book Waitlist (대기열)
-- When a book is rented, other users can queue up.
-- When the book becomes available, the first waiter is notified.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.book_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id)
);

ALTER TABLE public.book_waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone (authenticated) can see their own waitlist entries
CREATE POLICY "Users see own waitlist entries"
  ON public.book_waitlist FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Book owner can see who is waiting for their books
CREATE POLICY "Book owners see waiters"
  ON public.book_waitlist FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.books
      WHERE id = book_waitlist.book_id AND owner_id = auth.uid()
    )
  );

-- Authenticated users can join waitlist
CREATE POLICY "Users can join waitlist"
  ON public.book_waitlist FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can leave waitlist
CREATE POLICY "Users can leave waitlist"
  ON public.book_waitlist FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_book_waitlist_book_id ON public.book_waitlist (book_id);
CREATE INDEX IF NOT EXISTS idx_book_waitlist_user_id ON public.book_waitlist (user_id);
CREATE INDEX IF NOT EXISTS idx_book_waitlist_book_created ON public.book_waitlist (book_id, created_at);

-- ── Trigger: notify first waiter when book becomes available ──
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_available()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_waiter_id UUID;
  book_title TEXT;
  owner_nickname TEXT;
BEGIN
  -- Only fire when status changes TO 'available'
  IF NEW.status = 'available' AND OLD.status != 'available' THEN
    -- Get first person in queue (oldest entry)
    SELECT user_id INTO first_waiter_id
    FROM public.book_waitlist
    WHERE book_id = NEW.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF first_waiter_id IS NOT NULL THEN
      book_title := NEW.title;

      SELECT nickname INTO owner_nickname
      FROM public.profiles WHERE id = NEW.owner_id;

      -- Notify first waiter
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        first_waiter_id,
        'waitlist_available',
        '대기 중인 책이 반납됐어요!',
        '"' || book_title || '" 책이 반납되었습니다. 빠르게 대여 요청해보세요!',
        jsonb_build_object('book_id', NEW.id, 'owner_id', NEW.owner_id)
      );

      -- Also notify the book owner that a waiter exists
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        NEW.owner_id,
        'waitlist_reminder',
        '대기 중인 독자가 있어요',
        '"' || book_title || '" 책의 대기자에게 알림을 보냈습니다.',
        jsonb_build_object('book_id', NEW.id, 'waiter_id', first_waiter_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_waitlist ON public.books;
CREATE TRIGGER trg_notify_waitlist
AFTER UPDATE OF status ON public.books
FOR EACH ROW
EXECUTE FUNCTION public.notify_waitlist_on_available();

-- ── Trigger: notify book owner when someone joins waitlist ────
CREATE OR REPLACE FUNCTION public.notify_owner_on_waitlist_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  book_owner_id UUID;
  book_title TEXT;
  waiter_nickname TEXT;
  queue_position INTEGER;
BEGIN
  SELECT owner_id, title INTO book_owner_id, book_title
  FROM public.books WHERE id = NEW.book_id;

  -- Don't notify if owner joined their own waitlist (edge case)
  IF book_owner_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT nickname INTO waiter_nickname FROM public.profiles WHERE id = NEW.user_id;

  SELECT COUNT(*) INTO queue_position
  FROM public.book_waitlist WHERE book_id = NEW.book_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    book_owner_id,
    'waitlist_join',
    '대기자가 추가됐어요',
    waiter_nickname || '님이 "' || book_title || '" 대기열에 등록했습니다. (현재 ' || queue_position || '명)',
    jsonb_build_object('book_id', NEW.book_id, 'waiter_id', NEW.user_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_owner_on_waitlist_join ON public.book_waitlist;
CREATE TRIGGER trg_notify_owner_on_waitlist_join
AFTER INSERT ON public.book_waitlist
FOR EACH ROW
EXECUTE FUNCTION public.notify_owner_on_waitlist_join();
