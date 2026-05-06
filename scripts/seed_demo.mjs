import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://venrajnufandslcbehkz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlbnJham51ZmFuZHNsY2JlaGt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MjIzNCwiZXhwIjoyMDkzNTQ4MjM0fQ.PU3ijHNRnMLvOkUVsEoJsD2uum3mg-qVMyW27bEiAlQ';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  // ── 1. Get demo user ──────────────────────────────────────────────────────
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;

  const demoUser = users.find(u => u.email === 'demo@moabook.app');
  if (!demoUser) throw new Error('demo@moabook.app not found — create the account first');
  const demoId = demoUser.id;
  console.log('✅ Demo user:', demoId);

  // ── 2. Create companion user (idempotent) ─────────────────────────────────
  let companionId;
  const existing = users.find(u => u.email === 'companion@moabook.app');
  if (existing) {
    companionId = existing.id;
    console.log('ℹ️  Companion already exists:', companionId);
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: 'companion@moabook.app',
      password: 'companion-placeholder-pw',
      email_confirm: true,
    });
    if (createErr) throw createErr;
    companionId = created.user.id;
    console.log('✅ Companion created:', companionId);
  }

  // ── 3. Upsert companion profile ───────────────────────────────────────────
  await supabase.from('profiles').upsert({
    id: companionId,
    nickname: '이책방',
    district: 'Queenstown (퀸스타운)',
  }, { onConflict: 'id' });
  console.log('✅ Companion profile upserted');

  // ── 4. Clean up previous demo transactions ────────────────────────────────
  const { data: oldTxs } = await supabase
    .from('transactions')
    .select('id, book_id')
    .or(`borrower_id.eq.${demoId},owner_id.eq.${demoId}`)
    .eq('status', 'active');

  if (oldTxs?.length) {
    const bookIds = oldTxs.map(t => t.book_id);
    const txIds = oldTxs.map(t => t.id);

    await supabase.from('transactions').delete().in('id', txIds);
    await supabase.from('books').update({ status: 'available' }).in('id', bookIds);
    console.log(`🧹 Cleaned ${oldTxs.length} old transactions`);
  }

  // Delete companion's previous seed books
  await supabase.from('books').delete().eq('owner_id', companionId);
  console.log('🧹 Deleted old companion books');

  // ── 5. Create companion's books (demo will borrow these) ──────────────────
  const { data: b1, error: b1Err } = await supabase.from('books').insert({
    owner_id: companionId,
    title: '채식주의자',
    author: '한강',
    condition: 'A',
    mode: 'rent',
    status: 'available',
    is_public: true,
    spine_color: 2,
  }).select('id').single();
  if (b1Err) throw b1Err;
  console.log('✅ Companion book 1:', b1.id);

  const { data: b2, error: b2Err } = await supabase.from('books').insert({
    owner_id: companionId,
    title: '어린 왕자',
    author: '생텍쥐페리',
    condition: 'A',
    mode: 'rent',
    status: 'available',
    is_public: true,
    spine_color: 5,
  }).select('id').single();
  if (b2Err) throw b2Err;
  console.log('✅ Companion book 2:', b2.id);

  // ── 6. Pick or create a demo book to lend out ─────────────────────────────
  let lendBookId;
  const { data: demoBooksAvail } = await supabase
    .from('books')
    .select('id')
    .eq('owner_id', demoId)
    .eq('mode', 'rent')
    .eq('status', 'available')
    .order('created_at')
    .limit(1);

  if (demoBooksAvail?.length) {
    lendBookId = demoBooksAvail[0].id;
    console.log('ℹ️  Using existing demo book for lend:', lendBookId);
  } else {
    const { data: lb, error: lbErr } = await supabase.from('books').insert({
      owner_id: demoId,
      title: '데미안',
      author: '헤르만 헤세',
      condition: 'A',
      mode: 'rent',
      status: 'available',
      is_public: true,
      spine_color: 3,
    }).select('id').single();
    if (lbErr) throw lbErr;
    lendBookId = lb.id;
    console.log('✅ Created demo lend book:', lendBookId);
  }

  // ── 7. Insert transactions ────────────────────────────────────────────────
  const now = new Date();
  const daysAgo = (n) => new Date(now - n * 86400000).toISOString();
  const daysLater = (n) => new Date(+now + n * 86400000).toISOString();

  // Borrow #1: D-3 (yellow badge + indigo bookmark + -5° tilt)
  const { error: t1Err } = await supabase.from('transactions').insert({
    book_id: b1.id,
    borrower_id: demoId,
    owner_id: companionId,
    type: 'rent',
    status: 'active',
    start_date: daysAgo(7),
    end_date: daysLater(3),
    return_date: daysLater(3),
  });
  if (t1Err) throw t1Err;
  await supabase.from('books').update({ status: 'rented' }).eq('id', b1.id);
  console.log('✅ Borrow #1 (D-3, yellow badge)');

  // Borrow #2: D+1 overdue (red badge + indigo bookmark + -5° tilt)
  const { error: t2Err } = await supabase.from('transactions').insert({
    book_id: b2.id,
    borrower_id: demoId,
    owner_id: companionId,
    type: 'rent',
    status: 'active',
    start_date: daysAgo(14),
    end_date: daysAgo(1),
    return_date: daysAgo(1),
  });
  if (t2Err) throw t2Err;
  await supabase.from('books').update({ status: 'rented' }).eq('id', b2.id);
  console.log('✅ Borrow #2 (D+1 overdue, red badge)');

  // Lend #1: amber bookmark on demo's book
  const { error: t3Err } = await supabase.from('transactions').insert({
    book_id: lendBookId,
    borrower_id: companionId,
    owner_id: demoId,
    type: 'rent',
    status: 'active',
    start_date: daysAgo(3),
    end_date: daysLater(14),
    return_date: daysLater(14),
  });
  if (t3Err) throw t3Err;
  await supabase.from('books').update({ status: 'rented' }).eq('id', lendBookId);
  console.log('✅ Lend #1 (amber bookmark, 14d left)');

  console.log('\n🎉 Demo data seeded successfully!');
  console.log('   → 나의 책장에 빌린 책 2권 (기울어짐 + 배지) + 빌려준 책 1권 (앰버 책갈피) 확인');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
