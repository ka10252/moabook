import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface BookInfo {
  id: string;
  title: string;
  author: string;
  cover_url?: string | null;
}

/**
 * Unified function for completing a rental return
 * Handles:
 * 1. Updating transaction status to 'completed'
 * 2. Updating book status back to 'available'
 * 3. Sending Template C message to chat
 */
export const handleReturnCompletion = async (params: {
  transactionId: string;
  book: BookInfo;
  conversationId: string;
  userId: string;
}) => {
  const { transactionId, book, conversationId, userId } = params;

  // 1. Update transaction status to 'completed'
  //    returned_at = **실제로 돌려받은 시각**. `return_date`(반납 예정일)를 덮어쓰지 않는다 —
  //    덮어쓰면 "언제까지 빌리기로 했는지"가 사라진다.
  const { error: txnError } = await supabase
    .from('transactions')
    .update({ status: 'completed', returned_at: new Date().toISOString() })
    .eq('id', transactionId);

  if (txnError) throw txnError;

  // 2. Update book status back to 'available'
  const { error: bookError } = await supabase
    .from('books')
    .update({ status: 'available' })
    .eq('id', book.id);

  if (bookError) throw bookError;

  // 3. Send Template C message to chat
  const returnMessage = `[반납 완료] "${book.title}" 반납이 완료되었습니다. [BOOK_ID:${book.id}]`;
  
  const { error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: returnMessage,
    });

  if (msgError) throw msgError;

  // 4. Update conversation's last_message_at
  const { error: convError } = await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (convError) throw convError;
};
