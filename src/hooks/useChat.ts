import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  book_id: string | null;
  last_message_at: string;
  created_at: string;
  other_user?: {
    id: string;
    nickname: string;
  };
  book?: {
    id: string;
    title: string;
    author?: string;
    cover_url: string | null;
  };
  last_message?: string;
  unread_count?: number;
}

export const useChat = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          book:books(id, title, author, cover_url)
        `)
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Fetch other user profiles and last messages
      const conversationsWithDetails = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUserId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
          
          // Get other user's profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, nickname')
            .eq('id', otherUserId)
            .single();

          // Get last message
          const { data: messages } = await supabase
            .from('messages')
            .select('content, is_read, sender_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

          // Count unread
          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);

          return {
            ...conv,
            other_user: profile || { id: otherUserId, nickname: 'Unknown' },
            last_message: messages?.[0]?.content,
            unread_count: count || 0,
          };
        })
      );

      setConversations(conversationsWithDetails);
      
      // Calculate total unread count
      const totalUnread = conversationsWithDetails.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      setTotalUnreadCount(totalUnread);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!user) return;

    channelRef.current = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user?.id, fetchConversations]);

  const startConversation = async (otherUserId: string, bookId?: string) => {
    if (!user) return { conversation: null, error: new Error('Not logged in'), isNew: false };

    // Check if ANY conversation already exists with this user (regardless of book)
    // This covers both A→B and B→A directions
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${user.id})`)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Update the book_id to the current book if provided
      if (bookId) {
        await supabase
          .from('conversations')
          .update({ book_id: bookId })
          .eq('id', existing.id);
      }
      return { conversation: { ...existing, book_id: bookId || existing.book_id }, error: null, isNew: false };
    }

    // Create new conversation only if no conversation exists with this user
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        participant_1: user.id,
        participant_2: otherUserId,
        book_id: bookId || null,
      })
      .select()
      .single();

    if (!error) {
      await fetchConversations();
    }

    return { conversation: data, error, isNew: true };
  };

  // Start conversation with automatic request message including book info
  const startConversationWithRequest = async (
    otherUserId: string, 
    bookId: string, 
    requestType: 'rent' | 'purchase',
    requesterNickname: string,
    bookTitle: string,
    bookAuthor?: string
  ) => {
    const result = await startConversation(otherUserId, bookId);
    
    if (result.conversation) {
      // Always send the request message with book info (for both new and existing conversations)
      // Format: [대여 요청] {nickname}님이 "{bookTitle}" 대여를 요청합니다.
      const messageContent = requestType === 'rent' 
        ? `[대여 요청] ${requesterNickname}님이 "${bookTitle}"${bookAuthor ? ` (${bookAuthor})` : ''} 대여를 요청합니다. [BOOK_ID:${bookId}]`
        : `[구매 요청] ${requesterNickname}님이 "${bookTitle}"${bookAuthor ? ` (${bookAuthor})` : ''} 구매를 요청합니다. [BOOK_ID:${bookId}]`;
      await sendMessage(result.conversation.id, messageContent);
    }
    
    return result;
  };

  const sendMessage = async (conversationId: string, content: string) => {
    if (!user || !conversationId || !content.trim()) {
      return { error: new Error('Invalid message') };
    }

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    });

    // Update conversation's last_message_at
    if (!error) {
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    return { error };
  };

  return {
    conversations,
    loading,
    totalUnreadCount,
    refresh: fetchConversations,
    startConversation,
    startConversationWithRequest,
    sendMessage,
  };
};

export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error) {
      setMessages(data || []);
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Mark messages as read
  useEffect(() => {
    if (!conversationId || !user) return;

    supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false)
      .then();
  }, [conversationId, user?.id, messages]);

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;

    channelRef.current = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId]);

  const sendMessage = async (content: string) => {
    if (!user || !conversationId || !content.trim()) {
      return { error: new Error('Invalid message') };
    }

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    });

    // Update conversation's last_message_at
    if (!error) {
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    return { error };
  };

  return {
    messages,
    loading,
    sendMessage,
    refresh: fetchMessages,
  };
};
