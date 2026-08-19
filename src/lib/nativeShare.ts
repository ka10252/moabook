import { isNative } from '@/lib/native';

const SITE = 'https://moabook.vercel.app';

/**
 * 책 한 권 공유하기.
 *
 * 앱에서는 iOS 공유 시트(카톡·메시지·복사…)를 띄우고, 웹에서는 Web Share API 를,
 * 그것도 없으면 링크를 클립보드에 넣는다. 부르는 쪽은 어느 쪽인지 몰라도 된다.
 *
 * 반환값은 '무슨 일이 일어났는지' — 안내 문구를 부르는 쪽에서 정하려고.
 */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareBook(book: { id: string; title: string; author: string }): Promise<ShareResult> {
  const url = `${SITE}/?book=${book.id}`;
  const text = `${book.title} — ${book.author}\n모아북에서 이 책을 빌릴 수 있어요`;

  if (isNative) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: book.title, text, url, dialogTitle: '책 공유하기' });
      return 'shared';
    } catch (err) {
      // 시트를 닫아도 예외로 온다 — 실패와 구분한다
      if (/cancel/i.test(String((err as { message?: string })?.message ?? err))) return 'cancelled';
      return 'failed';
    }
  }

  // 웹: Web Share 는 https + 사용자 제스처에서만 된다. 데스크톱 브라우저엔 대개 없다.
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: book.title, text, url });
      return 'shared';
    } catch (err) {
      if (/abort/i.test(String((err as { name?: string })?.name ?? err))) return 'cancelled';
      // 공유가 막히면 복사로 흘려보낸다
    }
  }

  return (await copyText(url)) ? 'copied' : 'failed';
}

/**
 * 링크 복사. `navigator.clipboard` 는 https·포커스·권한이 모두 맞아야 해서
 * 은근히 자주 막힌다(사파리, 웹뷰, 백그라운드 탭). 막히면 옛 방식으로 한 번 더 시도한다.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 아래 폴백 */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    // 화면 밖에 두되 focus 는 받을 수 있어야 한다 (display:none 이면 복사가 안 된다)
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
