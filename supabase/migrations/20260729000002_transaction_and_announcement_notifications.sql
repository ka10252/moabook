-- 알림 추가
--   A. 커뮤니티별 알림 on/off (community_members.notifications_enabled)
--   B. 반납 완료 → 빌린 사람·책 주인 양쪽
--   C. 판매/나눔 완료 → 요청자에게 (나눔·판매 구분)
--   D. 첫 거래 축하
--   E. 공지 발행 시 전체 알림
--
-- notifications 에 행이 생기면 trg_notifications_push 가 잠금화면 푸시를,
-- 앱이 켜져 있으면 프론트가 인앱 토스트를 띄운다.


-- ─────────────────────────────────────────────────────────────
-- A. 커뮤니티별 알림 on/off
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;

-- 새 책 알림은 '이 커뮤니티 알림을 켠' 멤버에게만 보낸다
CREATE OR REPLACE FUNCTION public.notify_community_new_book()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m              RECORD;
  owner_nickname text;
  community_name text;
BEGIN
  IF NEW.community_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO owner_nickname FROM public.profiles WHERE id = NEW.owner_id;
  SELECT name INTO community_name FROM public.communities WHERE id = NEW.community_id;

  FOR m IN
    SELECT cm.user_id
    FROM public.community_members cm
    WHERE cm.community_id = NEW.community_id
      AND cm.user_id <> NEW.owner_id
      AND cm.notifications_enabled = true   -- ← 알림 켠 멤버에게만
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      m.user_id,
      'community_new_book',
      '📖 ' || COALESCE(community_name, '커뮤니티') || '에 새 책',
      COALESCE(owner_nickname, '이웃') || '님이 "' || NEW.title || '"' ||
      public.ko_particle(NEW.title, '을', '를') || ' 올렸어요',
      jsonb_build_object('book_id', NEW.id, 'community_id', NEW.community_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- B·C·D. 거래 완료 알림 (반납완료 양쪽 / 판매·나눔완료 / 첫 거래)
-- ─────────────────────────────────────────────────────────────
-- 대여는 반납되며 completed로 UPDATE 되고, 판매·나눔은 수락 즉시 completed로 INSERT 된다.
-- 그래서 INSERT·UPDATE 둘 다에서 "방금 completed가 된 순간"만 잡는다.

CREATE OR REPLACE FUNCTION public.notify_transaction_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  book_title    text;
  book_mode     text;
  borrower_nick text;
  owner_nick    text;
  first_cnt     int;
BEGIN
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  -- 이미 완료였던 행을 또 UPDATE한 경우는 중복 알림을 막는다
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT title, mode::text INTO book_title, book_mode FROM public.books WHERE id = NEW.book_id;
  book_title := COALESCE(book_title, '책');
  SELECT nickname INTO borrower_nick FROM public.profiles WHERE id = NEW.borrower_id;
  SELECT nickname INTO owner_nick   FROM public.profiles WHERE id = NEW.owner_id;

  IF NEW.type = 'rent' THEN
    -- 반납 완료 → 양쪽 모두
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES
      (NEW.owner_id, 'return_completed', '📗 반납 완료',
       COALESCE(borrower_nick, '이웃') || '님이 "' || book_title || '"' ||
       public.ko_particle(book_title, '을', '를') || ' 반납했어요',
       jsonb_build_object('transaction_id', NEW.id, 'book_id', NEW.book_id)),
      (NEW.borrower_id, 'return_completed', '📗 반납 완료',
       '"' || book_title || '" 반납이 완료됐어요',
       jsonb_build_object('transaction_id', NEW.id, 'book_id', NEW.book_id));

  ELSIF book_mode = 'give' THEN
    -- 나눔 완료 → 받은 사람에게
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES
      (NEW.borrower_id, 'purchase_completed', '🎁 나눔 완료',
       COALESCE(owner_nick, '이웃') || '님이 "' || book_title || '"' ||
       public.ko_particle(book_title, '을', '를') || ' 나눠주셨어요',
       jsonb_build_object('book_id', NEW.book_id));

  ELSE
    -- 판매 완료 → 산 사람에게
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES
      (NEW.borrower_id, 'purchase_completed', '💰 판매 완료',
       COALESCE(owner_nick, '이웃') || '님이 "' || book_title || '" 판매를 수락했어요',
       jsonb_build_object('book_id', NEW.book_id));
  END IF;

  -- 첫 거래 축하 — 이 거래를 포함해 완료 거래가 딱 1건이면 그 사람의 첫 거래다
  SELECT count(*) INTO first_cnt FROM public.transactions
  WHERE status = 'completed' AND (borrower_id = NEW.borrower_id OR owner_id = NEW.borrower_id);
  IF first_cnt = 1 THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES
      (NEW.borrower_id, 'first_transaction', '🎉 첫 거래를 축하해요!',
       '이웃과의 첫 책 거래를 마쳤어요. 앞으로도 즐거운 책 나눔 되세요!', '{}'::jsonb);
  END IF;

  SELECT count(*) INTO first_cnt FROM public.transactions
  WHERE status = 'completed' AND (borrower_id = NEW.owner_id OR owner_id = NEW.owner_id);
  IF first_cnt = 1 THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES
      (NEW.owner_id, 'first_transaction', '🎉 첫 거래를 축하해요!',
       '이웃과의 첫 책 거래를 마쳤어요. 앞으로도 즐거운 책 나눔 되세요!', '{}'::jsonb);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_transaction_completed ON public.transactions;
CREATE TRIGGER trg_notify_transaction_completed
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_transaction_completed();


-- ─────────────────────────────────────────────────────────────
-- E. 공지 발행 알림
-- ─────────────────────────────────────────────────────────────
-- site_announcements 는 admin_message 를 갱신하는 방식이라 INSERT·UPDATE 둘 다에서
-- 내용이 새로 채워진 순간에만 전체에게 알린다.

CREATE OR REPLACE FUNCTION public.notify_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(trim(NEW.admin_message), '') = '' THEN
    RETURN NEW;
  END IF;
  -- 내용이 바뀌지 않았으면 다시 알리지 않는다
  IF TG_OP = 'UPDATE' AND NEW.admin_message = OLD.admin_message THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT p.id, 'announcement', '📢 새 공지사항',
         left(NEW.admin_message, 80),
         jsonb_build_object('announcement_id', NEW.id)
  FROM public.profiles p;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_announcement ON public.site_announcements;
CREATE TRIGGER trg_notify_announcement
  AFTER INSERT OR UPDATE ON public.site_announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_announcement();
