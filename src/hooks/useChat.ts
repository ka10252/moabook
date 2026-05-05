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
      // Query 1: fetch all conversations
      const { data, error } = await supabase
        .from('conversations')
        .select(`*, book:books(id, title, author, cover_url)`)
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        setConversations([]);
        setTotalUnreadCount(0);
        setLoading(false);
        return;
      }

      const convIds = data.map(c => c.id);
      const otherUserIds = data.map(c =>
        c.participant_1 === user.id ? c.participant_2 : c.participant_1
      );

      // Query 2: batch fetch all other user profiles
      const [profilesResult, messagesResult, unreadResult] = await Promise.all([
        supabase.from('profiles').select('id, nickname').in('id', otherUserIds),
        // Query 3: recent messages for last-message preview (desc order, pick first per conv client-side)
        supabase
          .from('messages')
          .select('conversation_id, content, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(Math.min(data.length * 10, 300)),
        // Query 4: all unread messages for this user across all conversations
        supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', convIds)
          .eq('is_read', false)
          .neq('sender_id', user.id),
      ]);

      const profileMap = new Map((profilesResult.data || []).map(p => [p.id, p]));

      // Last message per conversation (first seen = most recent due to desc order)
      const lastMessageByConv = new Map<string, string>();
      for (const msg of (messagesResult.data || [])) {
        if (!lastMessageByConv.has(msg.conversation_id)) {
          lastMessageByConv.set(msg.conversation_id, msg.content);
        }
      }

      // Unread count per conversation
      const unreadByConv = new Map<string, number>();
      for (const msg of (unreadResult.data || [])) {
        unreadByConv.set(msg.conversation_id, (unreadByConv.get(msg.conversation_id) || 0) + 1);
      }

      const conversationsWithDetails = data.map(conv => {
        const otherUserId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
        return {
          ...conv,
          other_user: profileMap.get(otherUserId) || { id: otherUserId, nickname: 'Unknown' },
          last_message: lastMessageByConv.get(conv.id),
          unread_count: unreadByConv.get(conv.id) || 0,
        };
      });

      setConversations(conversationsWithDetails);
      setTotalUnreadCount(conversationsWithDetails.reduce((sum, c) => sum + (c.unread_count || 0), 0));
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
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as { sender_id: string; content: string };
          // Show browser notification for messages from others when tab is hidden
          if (
            msg.sender_id !== user.id &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            document.hidden
          ) {
            const preview = msg.content.replace(/\s*\[BOOK_ID:[^\]]+\]/, '').slice(0, 60);
            new window.Notification('새 메시지', { body: preview, icon: '/moa-logo.png' });
          }
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

  const startConversation = async (otherUserId: string) => {
    if (!user) return { conversation: null, error: new Error('Not logged in'), isNew: false };

    // Check if ANY conversation already exists with this user (regardless of book)
    // This covers both A→B and B→A directions
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${user.id})`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // User-based chat: don't update book_id, just return existing conversation
      return { conversation: existing, error: null, isNew: false };
    }

    // Create new conversation only if no conversation exists with this user
    // Note: book_id is null for user-based chats - book info is in messages
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        participant_1: user.id,
        participant_2: otherUserId,
        book_id: null,
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
    requesterNickname: string
  ) => {
    const result = await startConversation(otherUserId);
    
    if (result.conversation) {
      // Send request message with embedded BOOK_ID for dynamic rendering
      const messageContent = requestType === 'rent' 
        ? `[대여 요청] ${requesterNickname}님이 대여를 요청합니다. [BOOK_ID:${bookId}]`
        : `[구매 요청] ${requesterNickname}님이 구매를 요청합니다. [BOOK_ID:${bookId}]`;
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

  // Real-time subscription (INSERT + UPDATE for read receipts)
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Update is_read status in place (read receipt)
          setMessages(prev =>
            prev.map(m => m.id === payload.new.id ? { ...m, is_read: payload.new.is_read } : m)
          );
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
