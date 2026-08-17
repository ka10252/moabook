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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      books: {
        Row: {
          author: string
          community_id: string | null
          condition: Database["public"]["Enums"]["book_condition"]
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          mode: Database["public"]["Enums"]["book_mode"]
          owner_id: string
          price: number | null
          status: Database["public"]["Enums"]["book_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author: string
          community_id?: string | null
          condition?: Database["public"]["Enums"]["book_condition"]
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          mode?: Database["public"]["Enums"]["book_mode"]
          owner_id: string
          price?: number | null
          status?: Database["public"]["Enums"]["book_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          community_id?: string | null
          condition?: Database["public"]["Enums"]["book_condition"]
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          mode?: Database["public"]["Enums"]["book_mode"]
          owner_id?: string
          price?: number | null
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
        }
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          role: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          is_banned?: boolean
          joined_at?: string
          kick_count?: number
          role?: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          is_banned?: boolean
          joined_at?: string
          kick_count?: number
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
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_history: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
        }
        Relationships: []
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
        Relationships: []
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
            foreignKeyName: "community_posts_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
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
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          subscription: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          subscription: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          subscription?: Json
          user_id?: string
        }
        Relationships: []
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
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          age_public: boolean | null
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          gender: string | null
          gender_public: boolean | null
          id: string
          nickname: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          age_public?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          gender?: string | null
          gender_public?: boolean | null
          id: string
          nickname: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          age_public?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          gender?: string | null
          gender_public?: boolean | null
          id?: string
          nickname?: string
          updated_at?: string
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
            foreignKeyName: "transactions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          created_at: string
          id: string
          is_fulfilled: boolean
          notes: string | null
          title: string
          user_id: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          is_fulfilled?: boolean
          notes?: string | null
          title: string
          user_id: string
        }
        Update: {
          author?: string | null
          created_at?: string
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
        ]
      }
    }
    Views: {
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
        ]
      }
    }
    Functions: {
      can_view_community_members: {
        Args: { _community_id: string; _viewer_id: string }
        Returns: boolean
      }
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
      is_community_member: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      book_condition: "S" | "A" | "B" | "C"
      book_mode: "give" | "rent" | "sell"
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
      book_mode: ["give", "rent", "sell"],
      book_status: ["available", "rented", "sold"],
      community_role: ["admin", "member"],
      member_visibility: ["public", "members_only", "private"],
      transaction_status: ["pending", "active", "completed", "cancelled"],
      transaction_type: ["rent", "purchase"],
    },
  },
} as const
