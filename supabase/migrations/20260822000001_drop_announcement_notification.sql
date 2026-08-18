-- 공지사항 알림 끄기
--
-- 공지는 site_announcements 한 줄을 고치는 방식이라, 문구를 다듬을 때마다
-- **전체 유저에게 알림이 한 통씩** 나갔다. 알림함이 공지로 채워져 정작 봐야 하는
-- 거래·메시지 알림이 아래로 밀렸다.
--
-- 공지는 화면에 상시 배너·팝업으로 이미 보인다. 알림으로 또 밀어낼 필요가 없다.
-- 트리거만 떼고 함수는 남긴다 — 다시 켤 일이 생기면 트리거만 만들면 된다.
DROP TRIGGER IF EXISTS trg_notify_announcement ON public.site_announcements;

COMMENT ON FUNCTION public.notify_announcement() IS
  '공지 발행 알림. 2026-08-19 부터 트리거를 떼어 쓰지 않는다 — 공지를 고칠 때마다 전체 알림이 나갔다.';

-- 이미 쌓인 공지 알림은 지운다. 지금 알림함을 채우고 있는 것들이다.
DELETE FROM public.notifications WHERE type = 'announcement';
