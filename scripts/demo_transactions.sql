-- Demo data for demo@moabook.app
-- Run in: Supabase Dashboard → SQL Editor
--
-- Creates a self-contained demo environment:
--   - A "companion" user (이책방) who owns books the demo account borrows
--   - 2 borrow transactions for demo: D-3 badge (yellow) + D+1 overdue (red)
--   - 1 lend transaction: demo lends one of their books to companion (amber bookmark)
--
-- Safe to run multiple times — cleans up previous demo data first.

DO $$
DECLARE
  demo_id        UUID;
  companion_id   UUID := 'aaaaaaaa-0000-0000-0000-000000000001'::UUID;
  book_borrow1   UUID;
  book_borrow2   UUID;
  book_lend      UUID;
BEGIN
  -- ── 1. Resolve demo user ────────────────────────────────────────────────────
  SELECT id INTO demo_id FROM auth.users WHERE email = 'demo@moabook.app';
  IF demo_id IS NULL THEN
    RAISE EXCEPTION 'demo@moabook.app not found in auth.users — create the account first';
  END IF;

  -- ── 2. Create companion user (idempotent) ───────────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token, recovery_token,
    email_change_token_new, email_change
  )
  VALUES (
    companion_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'companion@moabook.app', '',
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false, '', '', '', ''
  )
  ON CONFLICT (id) DO NOTHING;

  -- Companion profile
  INSERT INTO profiles (id, nickname, district, avatar_url)
  VALUES (companion_id, '이책방', '마포구', NULL)
  ON CONFLICT (id) DO UPDATE SET nickname = '이책방', district = '마포구';

  -- ── 3. Clean up previous demo transactions ──────────────────────────────────
  -- Reset books to available before deleting transactions
  UPDATE books SET status = 'available'
  WHERE id IN (
    SELECT book_id FROM transactions
    WHERE borrower_id = demo_id OR (owner_id = demo_id AND borrower_id = companion_id)
       OR owner_id = companion_id
  );

  DELETE FROM transactions
  WHERE (borrower_id = demo_id AND owner_id = companion_id)
     OR (owner_id = demo_id AND borrower_id = companion_id);

  -- ── 4. Create companion's books (demo will borrow these) ────────────────────
  INSERT INTO books (owner_id, title, author, condition, mode, status, is_public, spine_color)
  VALUES (companion_id, '채식주의자', '한강', 'A', 'rent', 'available', true, 2)
  RETURNING id INTO book_borrow1;

  INSERT INTO books (owner_id, title, author, condition, mode, status, is_public, spine_color)
  VALUES (companion_id, '어린 왕자', '생텍쥐페리', 'A', 'rent', 'available', true, 5)
  RETURNING id INTO book_borrow2;

  RAISE NOTICE 'Companion books created: % and %', book_borrow1, book_borrow2;

  -- ── 5. Pick or create a rent book that demo will lend out ───────────────────
  SELECT id INTO book_lend
  FROM books
  WHERE owner_id = demo_id AND mode = 'rent' AND status = 'available'
  ORDER BY created_at
  LIMIT 1;

  IF book_lend IS NULL THEN
    INSERT INTO books (owner_id, title, author, condition, mode, status, is_public, spine_color)
    VALUES (demo_id, '데미안', '헤르만 헤세', 'A', 'rent', 'available', true, 3)
    RETURNING id INTO book_lend;
    RAISE NOTICE 'Created demo lend book: %', book_lend;
  ELSE
    RAISE NOTICE 'Using existing demo book for lend: %', book_lend;
  END IF;

  -- ── 6. Insert transactions ───────────────────────────────────────────────────

  -- Borrow #1: D-3 badge (yellow) + indigo bookmark + -5° tilt
  INSERT INTO transactions
    (book_id, borrower_id, owner_id, type, status, start_date, end_date, return_date)
  VALUES
    (book_borrow1, demo_id, companion_id, 'rent', 'active',
     NOW() - INTERVAL '7 days',
     NOW() + INTERVAL '3 days',
     NOW() + INTERVAL '3 days');
  UPDATE books SET status = 'rented' WHERE id = book_borrow1;
  RAISE NOTICE 'OK  borrow#1 (D-3): %', book_borrow1;

  -- Borrow #2: D+1 overdue (red badge) + indigo bookmark + -5° tilt
  INSERT INTO transactions
    (book_id, borrower_id, owner_id, type, status, start_date, end_date, return_date)
  VALUES
    (book_borrow2, demo_id, companion_id, 'rent', 'active',
     NOW() - INTERVAL '14 days',
     NOW() - INTERVAL '1 day',
     NOW() - INTERVAL '1 day');
  UPDATE books SET status = 'rented' WHERE id = book_borrow2;
  RAISE NOTICE 'OK  borrow#2 (D+1 overdue): %', book_borrow2;

  -- Lend #1: amber bookmark visible on demo's book in 나의 책장
  INSERT INTO transactions
    (book_id, borrower_id, owner_id, type, status, start_date, end_date, return_date)
  VALUES
    (book_lend, companion_id, demo_id, 'rent', 'active',
     NOW() - INTERVAL '3 days',
     NOW() + INTERVAL '14 days',
     NOW() + INTERVAL '14 days');
  UPDATE books SET status = 'rented' WHERE id = book_lend;
  RAISE NOTICE 'OK  lend#1 (amber bookmark, 14d left): %', book_lend;

  RAISE NOTICE '✅ Demo data seeded successfully for %', demo_id;
END $$;
