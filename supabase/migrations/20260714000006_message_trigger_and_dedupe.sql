-- 두 가지를 고친다.
--
--   1) 메시지 알림 트리거가 통째로 없었다 → 요청/메시지 알림이 하나도 안 나갔다
--   2) 같은 상대와 대화방이 두 개 생길 수 있었다 → 대여 요청 한 번에 메시지 두 개


-- ─────────────────────────────────────────────────────────────
-- 1. 메시지 알림 트리거 — 함수만 있고 트리거가 안 붙어 있었다
-- ─────────────────────────────────────────────────────────────
-- notify_on_new_message() 함수는 있는데 messages 테이블에 트리거가 없었다.
-- 그래서 대여 요청도, 채팅 메시지도 notifications 행을 만들지 않았고,
-- 그 뒤에 붙은 푸시 트리거(trg_notifications_push)도 당연히 한 번도 안 돌았다.
-- 온보딩에서 "이웃이 내 책을 빌리고 싶어할 때 알려드려요"라고 약속해놓고
-- 실제로는 아무 알림도 안 가고 있었다.

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();


-- ─────────────────────────────────────────────────────────────
-- 2. 대화방 중복 — 먼저 기존 중복을 합치고, 다시 못 생기게 막는다
-- ─────────────────────────────────────────────────────────────
-- 앱은 "이 상대와 대화방이 있나?" 조회 후 없으면 INSERT 했다.
-- 두 번이 거의 동시에 실행되면 둘 다 "없다"고 읽고 둘 다 INSERT 한다 (check-then-insert 경합).
-- 앱 쪽 이중 호출도 막았지만, DB가 스스로 지킬 수 있어야 한다.
-- 화면이 여러 개든, 기기가 여러 개든, 나중에 코드가 바뀌든 이 제약은 남는다.

-- (a) 중복 대화방의 메시지를 가장 오래된 방으로 모은다 (메시지 유실 없음)
WITH canonical AS (
  SELECT id,
         first_value(id) OVER (
           PARTITION BY LEAST(participant_1, participant_2), GREATEST(participant_1, participant_2)
           ORDER BY created_at
         ) AS keep_id
  FROM public.conversations
)
UPDATE public.messages m
SET conversation_id = c.keep_id
FROM canonical c
WHERE m.conversation_id = c.id AND c.id <> c.keep_id;

-- (b) 이제 빈 껍데기가 된 중복 대화방을 지운다
DELETE FROM public.conversations c
WHERE EXISTS (
  SELECT 1 FROM public.conversations o
  WHERE LEAST(o.participant_1, o.participant_2) = LEAST(c.participant_1, c.participant_2)
    AND GREATEST(o.participant_1, o.participant_2) = GREATEST(c.participant_1, c.participant_2)
    AND o.created_at < c.created_at
);

-- (c) 합치고 나면 똑같은 요청 메시지가 나란히 두 개 남는다. 하나만 남긴다.
--     "같은 사람이 같은 내용을 5초 안에 두 번" = 사람이 그럴 리 없다, 버그다.
DELETE FROM public.messages m
WHERE EXISTS (
  SELECT 1 FROM public.messages o
  WHERE o.conversation_id = m.conversation_id
    AND o.sender_id = m.sender_id
    AND o.content = m.content
    AND o.created_at < m.created_at
    AND m.created_at - o.created_at < interval '5 seconds'
);

-- (d) 다시는 못 생기게. 참가자 순서가 A→B든 B→A든 같은 방으로 본다.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_participant_pair_key
  ON public.conversations (
    LEAST(participant_1, participant_2),
    GREATEST(participant_1, participant_2)
  );
