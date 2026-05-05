-- Demo transaction data: enables D-day badges, bookmarks, and tilt effects on BookShelf
-- Run in Supabase Dashboard → SQL Editor
-- This creates 3 active transactions for the demo account:
--   1. Demo borrows a book — due in 3 days (shows D-3 yellow badge)
--   2. Demo borrows another book — overdue by 1 day (shows D+1 red badge)
--   3. Demo lends one of their own books — due in 14 days (amber bookmark visible)

DO $$
DECLARE
  demo_id         UUID;
  borrow1_id      UUID;
  borrow1_owner   UUID;
  borrow2_id      UUID;
  borrow2_owner   UUID;
  lend_id         UUID;
  other_user_id   UUID;
BEGIN
  -- ── 1. Resolve demo user ────────────────────────────────────────────────
  SELECT id INTO demo_id FROM auth.users WHERE email = 'demo@moabook.app';
  IF demo_id IS NULL THEN
    RAISE EXCEPTION 'demo@moabook.app not found in auth.users';
  END IF;

  -- ── 2. Pick a public rent book owned by someone else (borrow #1, D-3) ──
  SELECT b.id, b.owner_id
  INTO borrow1_id, borrow1_owner
  FROM books b
  WHERE b.owner_id != demo_id
    AND b.is_public  = true
    AND b.status     = 'available'
    AND b.mode       = 'rent'
  ORDER BY random()
  LIMIT 1;

  -- ── 3. Pick a different public rent book (borrow #2, overdue D+1) ───────
  SELECT b.id, b.owner_id
  INTO borrow2_id, borrow2_owner
  FROM books b
  WHERE b.owner_id != demo_id
    AND b.is_public  = true
    AND b.status     = 'available'
    AND b.mode       = 'rent'
    AND b.id         != COALESCE(borrow1_id, '00000000-0000-0000-0000-000000000000'::UUID)
  ORDER BY random()
  LIMIT 1;

  -- ── 4. Pick a rent book owned by demo to lend out ──────────────────────
  SELECT id INTO lend_id
  FROM books
  WHERE owner_id = demo_id
    AND status   = 'available'
    AND mode     = 'rent'
  ORDER BY random()
  LIMIT 1;

  -- ── 5. Pick any other user to be the borrower of demo's book ───────────
  SELECT id INTO other_user_id
  FROM auth.users
  WHERE email != 'demo@moabook.app'
  ORDER BY random()
  LIMIT 1;

  -- ── Insert transactions ─────────────────────────────────────────────────

  IF borrow1_id IS NOT NULL THEN
    INSERT INTO transactions
      (book_id, borrower_id, owner_id, type, status, start_date, end_date, return_date)
    VALUES
      (borrow1_id, demo_id, borrow1_owner, 'rent', 'active',
       NOW() - INTERVAL '7 days',
       NOW() + INTERVAL '3 days',
       NOW() + INTERVAL '3 days');
    UPDATE books SET status = 'rented' WHERE id = borrow1_id;
    RAISE NOTICE 'OK  borrow#1 (D-3): book=%', borrow1_id;
  ELSE
    RAISE NOTICE 'SKIP borrow#1: no eligible book found';
  END IF;

  IF borrow2_id IS NOT NULL THEN
    INSERT INTO transactions
      (book_id, borrower_id, owner_id, type, status, start_date, end_date, return_date)
    VALUES
      (borrow2_id, demo_id, borrow2_owner, 'rent', 'active',
       NOW() - INTERVAL '14 days',
       NOW() - INTERVAL '1 day',
       NOW() - INTERVAL '1 day');
    UPDATE books SET status = 'rented' WHERE id = borrow2_id;
    RAISE NOTICE 'OK  borrow#2 (D+1 overdue): book=%', borrow2_id;
  ELSE
    RAISE NOTICE 'SKIP borrow#2: no eligible book found';
  END IF;

  IF lend_id IS NOT NULL AND other_user_id IS NOT NULL THEN
    INSERT INTO transactions
      (book_id, borrower_id, owner_id, type, status, start_date, end_date, return_date)
    VALUES
      (lend_id, other_user_id, demo_id, 'rent', 'active',
       NOW() - INTERVAL '3 days',
       NOW() + INTERVAL '14 days',
       NOW() + INTERVAL '14 days');
    UPDATE books SET status = 'rented' WHERE id = lend_id;
    RAISE NOTICE 'OK  lend#1 (due in 14d): book=%', lend_id;
  ELSE
    RAISE NOTICE 'SKIP lend#1: demo has no available rent books or no other user exists';
  END IF;
END $$;
