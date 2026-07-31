-- 반납 임박/연체 알림이 한 번도 안 나가던 버그 수정.
-- 원인: 크론 함수가 transactions.end_date 로 필터·계산하는데, 앱은 return_date 만 쓰고
--       end_date 는 항상 NULL 이라 WHERE end_date IS NOT NULL 이 0건 → 알림 미발송.
-- 수정: 유효 반납일 = COALESCE(return_date, end_date) (앱=return_date, 레거시=end_date 둘 다 커버).

CREATE OR REPLACE FUNCTION public.notify_due_returns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t           RECORD;
  days_left   int;
  notif_title text;
  notif_body  text;
BEGIN
  FOR t IN
    SELECT tx.id, tx.borrower_id,
           COALESCE(tx.return_date, tx.end_date) AS due_date,
           b.title AS book_title
    FROM public.transactions tx
    JOIN public.books b ON b.id = tx.book_id
    WHERE tx.status = 'active' AND tx.type = 'rent'
      AND COALESCE(tx.return_date, tx.end_date) IS NOT NULL
      AND COALESCE(tx.return_date, tx.end_date)::date IN (CURRENT_DATE, CURRENT_DATE + 1)
  LOOP
    days_left := t.due_date::date - CURRENT_DATE;

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = t.borrower_id AND n.type = 'return_due'
        AND n.data->>'transaction_id' = t.id::text
        AND n.created_at::date = CURRENT_DATE
    );

    IF days_left = 0 THEN
      notif_title := '⏰ 오늘이 반납일이에요';
      notif_body  := '"' || t.book_title || '" 돌려줄 약속을 잡아보세요';
    ELSE
      notif_title := '⏰ 내일이 반납일이에요';
      notif_body  := '"' || t.book_title || '" 돌려줄 준비를 해주세요';
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.borrower_id, 'return_due', notif_title, notif_body,
      jsonb_build_object('transaction_id', t.id, 'days_left', days_left)
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_overdue_returns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t            RECORD;
  days_over    int;
BEGIN
  FOR t IN
    SELECT tx.id, tx.borrower_id, tx.owner_id,
           COALESCE(tx.return_date, tx.end_date) AS due_date,
           b.title AS book_title,
           bp.nickname AS borrower_nickname
    FROM public.transactions tx
    JOIN public.books b   ON b.id = tx.book_id
    LEFT JOIN public.profiles bp ON bp.id = tx.borrower_id
    WHERE tx.status = 'active'
      AND tx.type = 'rent'
      AND COALESCE(tx.return_date, tx.end_date) IS NOT NULL
      AND COALESCE(tx.return_date, tx.end_date)::date < CURRENT_DATE
  LOOP
    days_over := CURRENT_DATE - t.due_date::date;

    -- D+1, D+3, 이후 7일 간격으로만. 매일 울리면 알림을 꺼버린다.
    CONTINUE WHEN NOT (days_over IN (1, 3) OR days_over % 7 = 0);

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'return_overdue'
        AND n.data->>'transaction_id' = t.id::text
        AND n.created_at::date = CURRENT_DATE
    );

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.borrower_id,
      'return_overdue',
      '반납일이 지났어요',
      '"' || t.book_title || '" 반납이 ' || days_over || '일 지났어요. 책 주인과 약속을 잡아주세요.',
      jsonb_build_object('transaction_id', t.id, 'days_over', days_over, 'role', 'borrower')
    );

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.owner_id,
      'return_overdue',
      '반납이 지연되고 있어요',
      COALESCE(t.borrower_nickname, '이웃') || '님이 빌린 "' || t.book_title || '" 반납이 ' ||
      days_over || '일 지났어요.',
      jsonb_build_object('transaction_id', t.id, 'days_over', days_over, 'role', 'owner')
    );
  END LOOP;
END;
$$;
