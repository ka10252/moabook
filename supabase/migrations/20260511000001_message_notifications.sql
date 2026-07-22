-- Trigger: create in-app notification for the receiver when a new message arrives.
-- Skips system messages (return completion, etc.) to avoid noise.

CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_nickname text;
  receiver_id     uuid;
  conv_row        record;
  msg_body        text;
BEGIN
  -- Resolve the other participant
  SELECT participant_1, participant_2 INTO conv_row
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF conv_row.participant_1 = NEW.sender_id THEN
    receiver_id := conv_row.participant_2;
  ELSE
    receiver_id := conv_row.participant_1;
  END IF;

  -- Strip BOOK_ID tag and leading system prefixes
  msg_body := trim(regexp_replace(NEW.content, '\[BOOK_ID:[^\]]+\]', '', 'g'));

  -- Skip system messages (대여 요청, 반납 완료, etc.)
  IF msg_body ~ '^\[' THEN
    RETURN NEW;
  END IF;

  -- Truncate to 80 chars for notification body
  msg_body := left(msg_body, 80);

  SELECT nickname INTO sender_nickname
  FROM public.profiles
  WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    receiver_id,
    'new_message',
    sender_nickname || '님의 메시지',
    msg_body,
    jsonb_build_object(
      'sender_id',      NEW.sender_id,
      'conversation_id', NEW.conversation_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_message();
