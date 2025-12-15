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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      appointment_reminders: {
        Row: {
          appointment_ghl_id: string
          appointment_id: string
          created_at: string
          id: string
          recipient_email: string | null
          recipient_type: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          appointment_ghl_id: string
          appointment_id: string
          created_at?: string
          id?: string
          recipient_email?: string | null
          recipient_type: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          appointment_ghl_id?: string
          appointment_id?: string
          created_at?: string
          id?: string
          recipient_email?: string | null
          recipient_type?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          address: string | null
          appointment_status: string | null
          assigned_user_id: string | null
          calendar_id: string | null
          contact_id: string | null
          created_at: string
          end_time: string | null
          entered_by: string | null
          ghl_date_added: string | null
          ghl_date_updated: string | null
          ghl_id: string
          id: string
          last_synced_at: string | null
          location_id: string
          notes: string | null
          salesperson_confirmed: boolean
          salesperson_confirmed_at: string | null
          start_time: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          appointment_status?: string | null
          assigned_user_id?: string | null
          calendar_id?: string | null
          contact_id?: string | null
          created_at?: string
          end_time?: string | null
          entered_by?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id: string
          id?: string
          last_synced_at?: string | null
          location_id: string
          notes?: string | null
          salesperson_confirmed?: boolean
          salesperson_confirmed_at?: string | null
          start_time?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          appointment_status?: string | null
          assigned_user_id?: string | null
          calendar_id?: string | null
          contact_id?: string | null
          created_at?: string
          end_time?: string | null
          entered_by?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string
          id?: string
          last_synced_at?: string | null
          location_id?: string
          notes?: string | null
          salesperson_confirmed?: boolean
          salesperson_confirmed_at?: string | null
          start_time?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_date: string | null
          contact_id: string
          conversation_id: string
          created_at: string
          direction: string | null
          duration: number | null
          ghl_message_id: string
          id: string
          location_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          call_date?: string | null
          contact_id: string
          conversation_id: string
          created_at?: string
          direction?: string | null
          duration?: number | null
          ghl_message_id: string
          id?: string
          location_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          call_date?: string | null
          contact_id?: string
          conversation_id?: string
          created_at?: string
          direction?: string | null
          duration?: number | null
          ghl_message_id?: string
          id?: string
          location_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contact_notes: {
        Row: {
          body: string | null
          contact_id: string
          created_at: string
          entered_by: string | null
          ghl_date_added: string | null
          ghl_id: string
          id: string
          location_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          contact_id: string
          created_at?: string
          entered_by?: string | null
          ghl_date_added?: string | null
          ghl_id: string
          id?: string
          location_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          contact_id?: string
          created_at?: string
          entered_by?: string | null
          ghl_date_added?: string | null
          ghl_id?: string
          id?: string
          location_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_to: string | null
          attributions: Json | null
          contact_name: string | null
          created_at: string
          custom_fields: Json | null
          email: string | null
          entered_by: string | null
          first_name: string | null
          ghl_date_added: string | null
          ghl_date_updated: string | null
          ghl_id: string
          id: string
          last_name: string | null
          last_synced_at: string | null
          location_id: string
          phone: string | null
          source: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attributions?: Json | null
          contact_name?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          entered_by?: string | null
          first_name?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id: string
          id?: string
          last_name?: string | null
          last_synced_at?: string | null
          location_id: string
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attributions?: Json | null
          contact_name?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          entered_by?: string | null
          first_name?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string
          id?: string
          last_name?: string | null
          last_synced_at?: string | null
          location_id?: string
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          contact_id: string | null
          created_at: string
          ghl_date_added: string | null
          ghl_date_updated: string | null
          ghl_id: string
          id: string
          inbox_status: string | null
          last_message_body: string | null
          last_message_date: string | null
          last_message_direction: string | null
          last_message_type: string | null
          last_synced_at: string | null
          location_id: string
          type: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id: string
          id?: string
          inbox_status?: string | null
          last_message_body?: string | null
          last_message_date?: string | null
          last_message_direction?: string | null
          last_message_type?: string | null
          last_synced_at?: string | null
          location_id: string
          type?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string
          id?: string
          inbox_status?: string | null
          last_message_body?: string | null
          last_message_date?: string | null
          last_message_direction?: string | null
          last_message_type?: string | null
          last_synced_at?: string | null
          location_id?: string
          type?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ghl_calendars: {
        Row: {
          created_at: string
          description: string | null
          ghl_id: string
          id: string
          is_active: boolean | null
          location_id: string
          name: string | null
          team_members: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ghl_id: string
          id?: string
          is_active?: boolean | null
          location_id: string
          name?: string | null
          team_members?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ghl_id?: string
          id?: string
          is_active?: boolean | null
          location_id?: string
          name?: string | null
          team_members?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      ghl_tasks: {
        Row: {
          assigned_to: string | null
          body: string | null
          completed: boolean | null
          contact_id: string
          created_at: string
          due_date: string | null
          entered_by: string | null
          ghl_id: string
          id: string
          last_synced_at: string | null
          location_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          body?: string | null
          completed?: boolean | null
          contact_id: string
          created_at?: string
          due_date?: string | null
          entered_by?: string | null
          ghl_id: string
          id?: string
          last_synced_at?: string | null
          location_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          body?: string | null
          completed?: boolean | null
          contact_id?: string
          created_at?: string
          due_date?: string | null
          entered_by?: string | null
          ghl_id?: string
          id?: string
          last_synced_at?: string | null
          location_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_tasks_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_users: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          ghl_id: string
          id: string
          last_name: string | null
          location_id: string
          name: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          ghl_id: string
          id?: string
          last_name?: string | null
          location_id: string
          name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          ghl_id?: string
          id?: string
          last_name?: string | null
          location_id?: string
          name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      imported_records: {
        Row: {
          created_at: string | null
          id: string
          imported_at: string | null
          record_type: string
          source_ghl_id: string
          source_location_id: string
          target_ghl_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          imported_at?: string | null
          record_type: string
          source_ghl_id: string
          source_location_id: string
          target_ghl_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          imported_at?: string | null
          record_type?: string
          source_ghl_id?: string
          source_location_id?: string
          target_ghl_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          appointment_ghl_id: string | null
          created_at: string
          ghl_user_id: string | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          appointment_ghl_id?: string | null
          created_at?: string
          ghl_user_id?: string | null
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          appointment_ghl_id?: string | null
          created_at?: string
          ghl_user_id?: string | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          custom_fields: Json | null
          entered_by: string | null
          ghl_date_added: string | null
          ghl_date_updated: string | null
          ghl_id: string
          id: string
          last_synced_at: string | null
          location_id: string
          monetary_value: number | null
          name: string | null
          pipeline_id: string | null
          pipeline_name: string | null
          pipeline_stage_id: string | null
          stage_name: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          custom_fields?: Json | null
          entered_by?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id: string
          id?: string
          last_synced_at?: string | null
          location_id: string
          monetary_value?: number | null
          name?: string | null
          pipeline_id?: string | null
          pipeline_name?: string | null
          pipeline_stage_id?: string | null
          stage_name?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          custom_fields?: Json | null
          entered_by?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string
          id?: string
          last_synced_at?: string | null
          location_id?: string
          monetary_value?: number | null
          name?: string | null
          pipeline_id?: string | null
          pipeline_name?: string | null
          pipeline_stage_id?: string | null
          stage_name?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_edits: {
        Row: {
          contact_ghl_id: string | null
          edited_at: string | null
          edited_by: string | null
          field_name: string
          id: string
          location_id: string | null
          new_value: string | null
          old_value: string | null
          opportunity_ghl_id: string
        }
        Insert: {
          contact_ghl_id?: string | null
          edited_at?: string | null
          edited_by?: string | null
          field_name: string
          id?: string
          location_id?: string | null
          new_value?: string | null
          old_value?: string | null
          opportunity_ghl_id: string
        }
        Update: {
          contact_ghl_id?: string | null
          edited_at?: string | null
          edited_by?: string | null
          field_name?: string
          id?: string
          location_id?: string | null
          new_value?: string | null
          old_value?: string | null
          opportunity_ghl_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          ghl_user_id: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          ghl_user_id?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          ghl_user_id?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_costs: {
        Row: {
          created_at: string
          entered_by: string | null
          estimated_cost: number
          id: string
          notes: string | null
          opportunity_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entered_by?: string | null
          estimated_cost?: number
          id?: string
          notes?: string | null
          opportunity_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entered_by?: string | null
          estimated_cost?: number
          id?: string
          notes?: string | null
          opportunity_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_costs_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          ghl_id: string | null
          id: string
          location_id: string
          notes: string | null
          opportunity_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          ghl_id?: string | null
          id?: string
          location_id: string
          notes?: string | null
          opportunity_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          ghl_id?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          opportunity_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
