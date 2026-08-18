export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcement_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          message: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          message: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      book_hide_log: {
        Row: {
          action: string
          admin_id: string | null
          book_id: string
          book_title: string | null
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          book_id: string
          book_title?: string | null
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          book_id?: string
          book_title?: string | null
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_hide_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_hide_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_hide_log_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_reviews: {
        Row: {
          book_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      book_waitlist: {
        Row: {
          book_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_waitlist_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          allow_give: boolean
          allow_rent: boolean
          allow_sell: boolean
          author: string
          community_id: string | null
          condition: Database["public"]["Enums"]["book_condition"]
          cover_url: string | null
          created_at: string
          description: string | null
          genre: string | null
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          is_public: boolean
          mode: Database["public"]["Enums"]["book_mode"]
          owner_id: string
          price: number | null
          spine_color: number
          status: Database["public"]["Enums"]["book_status"]
          title: string
          updated_at: string
        }
        Insert: {
          allow_give?: boolean
          allow_rent?: boolean
          allow_sell?: boolean
          author: string
          community_id?: string | null
          condition?: Database["public"]["Enums"]["book_condition"]
          cover_url?: string | null
          created_at?: string
          description?: string | null
          genre?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_public?: boolean
          mode?: Database["public"]["Enums"]["book_mode"]
          owner_id: string
          price?: number | null
          spine_color?: number
          status?: Database["public"]["Enums"]["book_status"]
          title: string
          updated_at?: string
        }
        Update: {
          allow_give?: boolean
          allow_rent?: boolean
          allow_sell?: boolean
          author?: string
          community_id?: string | null
          condition?: Database["public"]["Enums"]["book_condition"]
          cover_url?: string | null
          created_at?: string
          description?: string | null
          genre?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_public?: boolean
          mode?: Database["public"]["Enums"]["book_mode"]
          owner_id?: string
          price?: number | null
          spine_color?: number
          status?: Database["public"]["Enums"]["book_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          invite_token: string | null
          member_count: number | null
          member_visibility: Database["public"]["Enums"]["member_visibility"]
          name: string
          pin_hash: string
          requires_pin: boolean
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invite_token?: string | null
          member_count?: number | null
          member_visibility?: Database["public"]["Enums"]["member_visibility"]
          name: string
          pin_hash: string
          requires_pin?: boolean
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invite_token?: string | null
          member_count?: number | null
          member_visibility?: Database["public"]["Enums"]["member_visibility"]
          name?: string
          pin_hash?: string
          requires_pin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_member_flags: {
        Row: {
          community_id: string
          is_banned: boolean
          kick_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          community_id: string
          is_banned?: boolean
          kick_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          community_id?: string
          is_banned?: boolean
          kick_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_member_flags_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_member_flags_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities_public"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          is_banned: boolean
          joined_at: string
          kick_count: number
          notifications_enabled: boolean
          role: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          is_banned?: boolean
          joined_at?: string
          kick_count?: number
          notifications_enabled?: boolean
          role?: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          is_banned?: boolean
          joined_at?: string
          kick_count?: number
          notifications_enabled?: boolean
          role?: Database["public"]["Enums"]["community_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          book_id: string | null
          community_id: string
          content: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          book_id?: string | null
          community_id: string
          content: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          book_id?: string | null
          community_id?: string
          content?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities_public"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          book_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          participant_1: string
          participant_2: string
        }
        Insert: {
          book_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_1: string
          participant_2: string
        }
        Update: {
          book_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_1?: string
          participant_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          anon_id: string | null
          created_at: string
          event: string
          id: number
          props: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          anon_id?: string | null
          created_at?: string
          event: string
          id?: never
          props?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          anon_id?: string | null
          created_at?: string
          event?: string
          id?: never
          props?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: string | null
          created_at: string
          id: string
          message: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          message: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      liked_books: {
        Row: {
          book_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liked_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liked_books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liked_books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          age_public: boolean | null
          avatar_url: string | null
          badges_public: boolean
          bio: string | null
          country: string | null
          created_at: string
          district: string | null
          favorite_districts: string[]
          favorite_stations: string[]
          featured_badge: string | null
          gender: string | null
          gender_public: boolean | null
          id: string
          mrt_station: string | null
          nickname: string
          pixel_avatar: Json | null
          reading_book: Json | null
          reading_book_id: string | null
          region: string | null
          school: string | null
          school_email: string | null
          school_verified_at: string | null
          telegram_chat_id: string | null
          telegram_link_code: string | null
          telegram_opt_in: boolean
          updated_at: string
        }
        Insert: {
          age?: number | null
          age_public?: boolean | null
          avatar_url?: string | null
          badges_public?: boolean
          bio?: string | null
          country?: string | null
          created_at?: string
          district?: string | null
          favorite_districts?: string[]
          favorite_stations?: string[]
          featured_badge?: string | null
          gender?: string | null
          gender_public?: boolean | null
          id: string
          mrt_station?: string | null
          nickname: string
          pixel_avatar?: Json | null
          reading_book?: Json | null
          reading_book_id?: string | null
          region?: string | null
          school?: string | null
          school_email?: string | null
          school_verified_at?: string | null
          telegram_chat_id?: string | null
          telegram_link_code?: string | null
          telegram_opt_in?: boolean
          updated_at?: string
        }
        Update: {
          age?: number | null
          age_public?: boolean | null
          avatar_url?: string | null
          badges_public?: boolean
          bio?: string | null
          country?: string | null
          created_at?: string
          district?: string | null
          favorite_districts?: string[]
          favorite_stations?: string[]
          featured_badge?: string | null
          gender?: string | null
          gender_public?: boolean | null
          id?: string
          mrt_station?: string | null
          nickname?: string
          pixel_avatar?: Json | null
          reading_book?: Json | null
          reading_book_id?: string | null
          region?: string | null
          school?: string | null
          school_email?: string | null
          school_verified_at?: string | null
          telegram_chat_id?: string | null
          telegram_link_code?: string | null
          telegram_opt_in?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_reading_book_id_fkey"
            columns: ["reading_book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          subscription: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          subscription: Json
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          subscription?: Json
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_note: string | null
          context: string | null
          created_at: string
          detail: string | null
          id: string
          reason: string
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string | null
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Insert: {
          admin_note?: string | null
          context?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string | null
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Update: {
          admin_note?: string | null
          context?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string | null
          target_type?: Database["public"]["Enums"]["report_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      school_email_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_announcements: {
        Row: {
          admin_message: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_message?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_message?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_announcements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_announcements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          book_id: string
          borrower_id: string
          created_at: string
          end_date: string | null
          id: string
          owner_id: string
          return_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          book_id: string
          borrower_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          owner_id: string
          return_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          book_id?: string
          borrower_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          owner_id?: string
          return_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_key: string
          earned_at: string
          tier: number
          user_id: string
        }
        Insert: {
          badge_key: string
          earned_at?: string
          tier?: number
          user_id: string
        }
        Update: {
          badge_key?: string
          earned_at?: string
          tier?: number
          user_id?: string
        }
        Relationships: []
      }
      user_manner_reviews: {
        Row: {
          created_at: string
          id: string
          q1: number
          q2: number
          q3: number
          reviewee_id: string
          reviewer_id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          q1: number
          q2: number
          q3: number
          reviewee_id: string
          reviewer_id: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          q1?: number
          q2?: number
          q3?: number
          reviewee_id?: string
          reviewer_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_manner_reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_manner_reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_manner_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_manner_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          author: string | null
          cover_url: string | null
          created_at: string
          desired_mode: string
          id: string
          is_fulfilled: boolean
          notes: string | null
          title: string
          user_id: string
        }
        Insert: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          desired_mode?: string
          id?: string
          is_fulfilled?: boolean
          notes?: string | null
          title: string
          user_id: string
        }
        Update: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          desired_mode?: string
          id?: string
          is_fulfilled?: boolean
          notes?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      book_review_stats: {
        Row: {
          avg_rating: number | null
          book_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "book_reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      communities_public: {
        Row: {
          cover_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          member_count: number | null
          name: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          member_count?: number | null
          name?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          member_count?: number | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          age: number | null
          age_public: boolean | null
          avatar_url: string | null
          badges_public: boolean | null
          bio: string | null
          country: string | null
          created_at: string | null
          district: string | null
          featured_badge: string | null
          gender: string | null
          gender_public: boolean | null
          id: string | null
          mrt_station: string | null
          nickname: string | null
          pixel_avatar: Json | null
          reading_book: Json | null
          reading_book_id: string | null
          region: string | null
          school: string | null
          updated_at: string | null
        }
        Insert: {
          age?: never
          age_public?: boolean | null
          avatar_url?: string | null
          badges_public?: boolean | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          district?: string | null
          featured_badge?: string | null
          gender?: never
          gender_public?: boolean | null
          id?: string | null
          mrt_station?: string | null
          nickname?: string | null
          pixel_avatar?: Json | null
          reading_book?: Json | null
          reading_book_id?: string | null
          region?: string | null
          school?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: never
          age_public?: boolean | null
          avatar_url?: string | null
          badges_public?: boolean | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          district?: string | null
          featured_badge?: string | null
          gender?: never
          gender_public?: boolean | null
          id?: string | null
          mrt_station?: string | null
          nickname?: string | null
          pixel_avatar?: Json | null
          reading_book?: Json | null
          reading_book_id?: string | null
          region?: string | null
          school?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_reading_book_id_fkey"
            columns: ["reading_book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_ban_user: {
        Args: { p_ban_duration?: string; p_target_user_id: string }
        Returns: Json
      }
      admin_borrow_gate_conversion: { Args: { p_days?: number }; Returns: Json }
      admin_check_user_ban: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      admin_daily_active: {
        Args: { p_days?: number }
        Returns: {
          day: string
          ev_count: number
          sessions: number
          users: number
        }[]
      }
      admin_event_counts: {
        Args: { p_days?: number }
        Returns: {
          cnt: number
          event: string
        }[]
      }
      admin_get_user: {
        Args: { p_user_id: string }
        Returns: {
          age: number | null
          age_public: boolean | null
          avatar_url: string | null
          badges_public: boolean
          bio: string | null
          country: string | null
          created_at: string
          district: string | null
          favorite_districts: string[]
          favorite_stations: string[]
          featured_badge: string | null
          gender: string | null
          gender_public: boolean | null
          id: string
          mrt_station: string | null
          nickname: string
          pixel_avatar: Json | null
          reading_book: Json | null
          reading_book_id: string | null
          region: string | null
          school: string | null
          school_email: string | null
          school_verified_at: string | null
          telegram_chat_id: string | null
          telegram_link_code: string | null
          telegram_opt_in: boolean
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_users: {
        Args: never
        Returns: {
          age: number | null
          age_public: boolean | null
          avatar_url: string | null
          badges_public: boolean
          bio: string | null
          country: string | null
          created_at: string
          district: string | null
          favorite_districts: string[]
          favorite_stations: string[]
          featured_badge: string | null
          gender: string | null
          gender_public: boolean | null
          id: string
          mrt_station: string | null
          nickname: string
          pixel_avatar: Json | null
          reading_book: Json | null
          reading_book_id: string | null
          region: string | null
          school: string | null
          school_email: string | null
          school_verified_at: string | null
          telegram_chat_id: string | null
          telegram_link_code: string | null
          telegram_opt_in: boolean
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_metrics_overview: { Args: { p_days?: number }; Returns: Json }
      admin_set_book_hidden: {
        Args: { p_book_id: string; p_hidden: boolean; p_reason?: string }
        Returns: undefined
      }
      admin_top_no_result: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          cnt: number
          query: string
        }[]
      }
      admin_unban_user: { Args: { p_target_user_id: string }; Returns: Json }
      admin_update_user_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: Json
      }
      am_i_telegram_linked: { Args: never; Returns: boolean }
      award_badges: { Args: never; Returns: Json }
      can_view_community_members: {
        Args: { _community_id: string; _viewer_id: string }
        Returns: boolean
      }
      get_manner_summary: {
        Args: { p_user: string }
        Returns: {
          avg_as_described: number
          avg_book_care: number
          avg_overall: number
          avg_promise: number
          avg_revisit: number
          borrower_count: number
          lender_count: number
          total: number
        }[]
      }
      get_my_manner_review: {
        Args: { p_user: string }
        Returns: {
          q1: number
          q2: number
          q3: number
          role: string
        }[]
      }
      get_my_private_profile: { Args: never; Returns: Json }
      get_user_public_stats: { Args: { p_user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_banned_from_community: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
      is_blocked_between: { Args: { _a: string; _b: string }; Returns: boolean }
      is_community_member: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      join_community_with_pin: {
        Args: { p_community_id: string; p_pin: string }
        Returns: string
      }
      join_via_invite: { Args: { p_token: string }; Returns: Json }
      kick_community_member: {
        Args: { p_ban?: boolean; p_community_id: string; p_user_id: string }
        Returns: string
      }
      ko_particle: {
        Args: { with_batchim: string; without_batchim: string; word: string }
        Returns: string
      }
      list_banned_members: {
        Args: { p_community_id: string }
        Returns: {
          avatar_url: string
          is_banned: boolean
          kick_count: number
          nickname: string
          user_id: string
        }[]
      }
      manner_review_role: { Args: { p_user: string }; Returns: string }
      notify_due_returns: { Args: never; Returns: undefined }
      notify_overdue_returns: { Args: never; Returns: undefined }
      notify_pending_requests: { Args: never; Returns: undefined }
      purge_old_events: { Args: never; Returns: undefined }
      run_daily_notifications: { Args: never; Returns: undefined }
      safe_uuid: { Args: { p: string }; Returns: string }
      school_from_email: { Args: { p_email: string }; Returns: string }
      submit_manner_review: {
        Args: { p_q1: number; p_q2: number; p_q3: number; p_user: string }
        Returns: undefined
      }
      unban_community_member: {
        Args: { p_community_id: string; p_user_id: string }
        Returns: string
      }
      verify_community_pin: {
        Args: { p_community_id: string; p_pin: string }
        Returns: boolean
      }
      verify_school_email: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      book_condition: "S" | "A" | "B" | "C"
      book_mode: "rent" | "sell" | "give"
      book_status: "available" | "rented" | "sold"
      community_role: "admin" | "member"
      member_visibility: "public" | "members_only" | "private"
      report_status: "pending" | "reviewing" | "resolved" | "dismissed"
      report_target_type: "book" | "message" | "post" | "comment" | "user"
      transaction_status: "pending" | "active" | "completed" | "cancelled"
      transaction_type: "rent" | "purchase"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      book_condition: ["S", "A", "B", "C"],
      book_mode: ["rent", "sell", "give"],
      book_status: ["available", "rented", "sold"],
      community_role: ["admin", "member"],
      member_visibility: ["public", "members_only", "private"],
      report_status: ["pending", "reviewing", "resolved", "dismissed"],
      report_target_type: ["book", "message", "post", "comment", "user"],
      transaction_status: ["pending", "active", "completed", "cancelled"],
      transaction_type: ["rent", "purchase"],
    },
  },
} as const
