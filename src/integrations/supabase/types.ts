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
      app_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_type: string | null
          setting_value: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_type?: string | null
          setting_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_type?: string | null
          setting_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_version: {
        Row: {
          created_at: string
          deployed_at: string
          id: string
          notes: string | null
          version_number: number
        }
        Insert: {
          created_at?: string
          deployed_at?: string
          id?: string
          notes?: string | null
          version_number?: number
        }
        Update: {
          created_at?: string
          deployed_at?: string
          id?: string
          notes?: string | null
          version_number?: number
        }
        Relationships: []
      }
      appointment_edits: {
        Row: {
          appointment_ghl_id: string
          company_id: string | null
          contact_ghl_id: string | null
          edited_at: string
          edited_by: string | null
          field_name: string
          id: string
          location_id: string | null
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          appointment_ghl_id: string
          company_id?: string | null
          contact_ghl_id?: string | null
          edited_at?: string
          edited_by?: string | null
          field_name: string
          id?: string
          location_id?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          appointment_ghl_id?: string
          company_id?: string | null
          contact_ghl_id?: string | null
          edited_at?: string
          edited_by?: string | null
          field_name?: string
          id?: string
          location_id?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_edits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminders: {
        Row: {
          appointment_ghl_id: string
          appointment_id: string
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
          created_at?: string
          id?: string
          recipient_email?: string | null
          recipient_type?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          address: string | null
          appointment_status: string | null
          assigned_user_id: string | null
          calendar_id: string | null
          company_id: string | null
          contact_id: string | null
          contact_uuid: string | null
          created_at: string
          edited_at: string | null
          edited_by: string | null
          end_time: string | null
          entered_by: string | null
          external_id: string | null
          ghl_date_added: string | null
          ghl_date_updated: string | null
          ghl_id: string | null
          google_calendar_id: string | null
          google_event_id: string | null
          id: string
          last_synced_at: string | null
          location_id: string
          notes: string | null
          provider: string | null
          salesperson_confirmation_status: string | null
          salesperson_confirmed: boolean
          salesperson_confirmed_at: string | null
          salesperson_id: string | null
          start_time: string | null
          sync_source:
            | Database["public"]["Enums"]["appointment_sync_source"]
            | null
          title: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          appointment_status?: string | null
          assigned_user_id?: string | null
          calendar_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_uuid?: string | null
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          end_time?: string | null
          entered_by?: string | null
          external_id?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          location_id: string
          notes?: string | null
          provider?: string | null
          salesperson_confirmation_status?: string | null
          salesperson_confirmed?: boolean
          salesperson_confirmed_at?: string | null
          salesperson_id?: string | null
          start_time?: string | null
          sync_source?:
            | Database["public"]["Enums"]["appointment_sync_source"]
            | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          appointment_status?: string | null
          assigned_user_id?: string | null
          calendar_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_uuid?: string | null
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          end_time?: string | null
          entered_by?: string | null
          external_id?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          location_id?: string
          notes?: string | null
          provider?: string | null
          salesperson_confirmation_status?: string | null
          salesperson_confirmed?: boolean
          salesperson_confirmed_at?: string | null
          salesperson_id?: string | null
          start_time?: string | null
          sync_source?:
            | Database["public"]["Enums"]["appointment_sync_source"]
            | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_contact_uuid_fkey"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointments_contact_uuid"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_sources: {
        Row: {
          archived_at: string
          archived_by: string | null
          company_id: string
          created_at: string
          id: string
          source_name: string
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          source_name: string
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          source_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_sources_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archived_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changes: Json | null
          company_id: string | null
          description: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changes?: Json | null
          company_id?: string | null
          description?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changes?: Json | null
          company_id?: string | null
          description?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "banks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_payments: {
        Row: {
          bank_id: string | null
          bank_name: string | null
          bill_id: string
          company_id: string | null
          created_at: string
          id: string
          payment_amount: number
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          updated_at: string
        }
        Insert: {
          bank_id?: string | null
          bank_name?: string | null
          bill_id: string
          company_id?: string | null
          created_at?: string
          id?: string
          payment_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          updated_at?: string
        }
        Update: {
          bank_id?: string | null
          bank_name?: string | null
          bill_id?: string
          company_id?: string | null
          created_at?: string
          id?: string
          payment_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "project_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_history: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          description: string | null
          id: string
          invoice_url: string | null
          paid_at: string | null
          status: string
          stripe_invoice_id: string | null
          subscription_id: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "company_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_date: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "call_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_comments: {
        Row: {
          comment_text: string
          commenter_email: string | null
          commenter_name: string
          company_id: string | null
          created_at: string
          created_by: string | null
          estimate_id: string | null
          id: string
          is_internal: boolean | null
          parent_comment_id: string | null
          portal_token_id: string | null
          project_id: string | null
          updated_at: string
        }
        Insert: {
          comment_text: string
          commenter_email?: string | null
          commenter_name: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          estimate_id?: string | null
          id?: string
          is_internal?: boolean | null
          parent_comment_id?: string | null
          portal_token_id?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          comment_text?: string
          commenter_email?: string | null
          commenter_name?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          estimate_id?: string | null
          id?: string
          is_internal?: boolean | null
          parent_comment_id?: string | null
          portal_token_id?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_comments_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "client_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_comments_portal_token_id_fkey"
            columns: ["portal_token_id"]
            isOneToOne: false
            referencedRelation: "client_portal_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_tokens: {
        Row: {
          access_count: number | null
          client_email: string | null
          client_name: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          estimate_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          project_id: string | null
          token: string
        }
        Insert: {
          access_count?: number | null
          client_email?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          estimate_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          project_id?: string | null
          token?: string
        }
        Update: {
          access_count?: number | null
          client_email?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          estimate_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          project_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_tokens_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payments: {
        Row: {
          bank_name: string | null
          company_id: string | null
          created_at: string
          id: string
          notes: string | null
          payment_amount: number
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          project_id: string
          salesperson_name: string
          updated_at: string
        }
        Insert: {
          bank_name?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          project_id: string
          salesperson_name: string
          updated_at?: string
        }
        Update: {
          bank_name?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          project_id?: string
          salesperson_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          corporation_id: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          slug: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          corporation_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          corporation_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_corporation_id_fkey"
            columns: ["corporation_id"]
            isOneToOne: false
            referencedRelation: "corporations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_integrations: {
        Row: {
          api_key_encrypted: string | null
          api_key_vault_id: string | null
          company_id: string
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          last_sync_at: string | null
          last_sync_started_at: string | null
          location_id: string | null
          name: string | null
          provider: string
          refresh_token_encrypted: string | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_key_vault_id?: string | null
          company_id: string
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          last_sync_at?: string | null
          last_sync_started_at?: string | null
          location_id?: string | null
          name?: string | null
          provider: string
          refresh_token_encrypted?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_key_vault_id?: string | null
          company_id?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          last_sync_at?: string | null
          last_sync_started_at?: string | null
          location_id?: string | null
          name?: string | null
          provider?: string
          refresh_token_encrypted?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          description: string | null
          id: string
          setting_key: string
          setting_type: string | null
          setting_value: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          company_id: string
          description?: string | null
          id?: string
          setting_key: string
          setting_type?: string | null
          setting_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_type?: string | null
          setting_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          canceled_at: string | null
          company_id: string
          created_at: string
          current_period_end: string
          current_period_start: string
          features_override: Json | null
          grace_period_ends_at: string | null
          id: string
          max_users_override: number | null
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          canceled_at?: string | null
          company_id: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          features_override?: Json | null
          grace_period_ends_at?: string | null
          id?: string
          max_users_override?: number | null
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          canceled_at?: string | null
          company_id?: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          features_override?: Json | null
          grace_period_ends_at?: string | null
          id?: string
          max_users_override?: number | null
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_document_templates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_main_contract: boolean
          name: string
          requires_separate_signature: boolean
          template_file_name: string
          template_file_url: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_main_contract?: boolean
          name: string
          requires_separate_signature?: boolean
          template_file_name: string
          template_file_url: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_main_contract?: boolean
          name?: string
          requires_separate_signature?: boolean
          template_file_name?: string
          template_file_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_document_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_document_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_template_fields: {
        Row: {
          company_id: string | null
          created_at: string
          field_key: string
          field_label: string | null
          font_color: string | null
          font_size: number
          id: string
          page_number: number
          static_text: string | null
          template_id: string
          text_align: string | null
          updated_at: string
          width: number | null
          x_position: number
          y_position: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          field_key: string
          field_label?: string | null
          font_color?: string | null
          font_size?: number
          id?: string
          page_number?: number
          static_text?: string | null
          template_id: string
          text_align?: string | null
          updated_at?: string
          width?: number | null
          x_position: number
          y_position: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          field_key?: string
          field_label?: string | null
          font_color?: string | null
          font_size?: number
          id?: string
          page_number?: number
          static_text?: string | null
          template_id?: string
          text_align?: string | null
          updated_at?: string
          width?: number | null
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_template_fields_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "compliance_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          body: string | null
          company_id: string | null
          contact_id: string
          contact_uuid: string | null
          created_at: string
          edited_at: string | null
          edited_by: string | null
          entered_by: string | null
          external_id: string | null
          ghl_date_added: string | null
          ghl_id: string | null
          id: string
          location_id: string
          provider: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          contact_id: string
          contact_uuid?: string | null
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          entered_by?: string | null
          external_id?: string | null
          ghl_date_added?: string | null
          ghl_id?: string | null
          id?: string
          location_id: string
          provider?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string | null
          contact_id?: string
          contact_uuid?: string | null
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          entered_by?: string | null
          external_id?: string | null
          ghl_date_added?: string | null
          ghl_id?: string | null
          id?: string
          location_id?: string
          provider?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_contact_uuid_fkey"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contact_notes_contact_uuid"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_to: string | null
          attributions: Json | null
          company_id: string | null
          contact_name: string | null
          created_at: string
          custom_fields: Json | null
          email: string | null
          entered_by: string | null
          external_id: string | null
          first_name: string | null
          ghl_date_added: string | null
          ghl_date_updated: string | null
          ghl_id: string | null
          id: string
          last_name: string | null
          last_synced_at: string | null
          location_id: string
          phone: string | null
          provider: string | null
          source: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attributions?: Json | null
          company_id?: string | null
          contact_name?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          entered_by?: string | null
          external_id?: string | null
          first_name?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string | null
          id?: string
          last_name?: string | null
          last_synced_at?: string | null
          location_id: string
          phone?: string | null
          provider?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attributions?: Json | null
          company_id?: string | null
          contact_name?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          entered_by?: string | null
          external_id?: string | null
          first_name?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string | null
          id?: string
          last_name?: string | null
          last_synced_at?: string | null
          location_id?: string
          phone?: string | null
          provider?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
          contact_id: string | null
          created_at: string
          external_id: string | null
          ghl_date_added: string | null
          ghl_date_updated: string | null
          ghl_id: string | null
          id: string
          inbox_status: string | null
          last_message_body: string | null
          last_message_date: string | null
          last_message_direction: string | null
          last_message_type: string | null
          last_synced_at: string | null
          location_id: string
          provider: string | null
          type: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          external_id?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string | null
          id?: string
          inbox_status?: string | null
          last_message_body?: string | null
          last_message_date?: string | null
          last_message_direction?: string | null
          last_message_type?: string | null
          last_synced_at?: string | null
          location_id: string
          provider?: string | null
          type?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          external_id?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string | null
          id?: string
          inbox_status?: string | null
          last_message_body?: string | null
          last_message_date?: string | null
          last_message_direction?: string | null
          last_message_type?: string | null
          last_synced_at?: string | null
          location_id?: string
          provider?: string | null
          type?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      corporations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      document_portal_tokens: {
        Row: {
          access_count: number | null
          company_id: string | null
          created_at: string
          created_by: string | null
          document_id: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          token: string
        }
        Insert: {
          access_count?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          token?: string
        }
        Update: {
          access_count?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_portal_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_portal_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_portal_tokens_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "signature_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signature_fields: {
        Row: {
          company_id: string | null
          created_at: string
          document_id: string
          field_label: string | null
          field_type: string
          height: number
          id: string
          is_required: boolean
          page_number: number
          signer_id: string | null
          width: number
          x_position: number
          y_position: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          document_id: string
          field_label?: string | null
          field_type?: string
          height?: number
          id?: string
          is_required?: boolean
          page_number?: number
          signer_id?: string | null
          width?: number
          x_position: number
          y_position: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          document_id?: string
          field_label?: string | null
          field_type?: string
          height?: number
          id?: string
          is_required?: boolean
          page_number?: number
          signer_id?: string | null
          width?: number
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_signature_fields_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signature_fields_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "signature_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signature_fields_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "document_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          company_id: string | null
          document_id: string
          field_values: Json | null
          id: string
          ip_address: string | null
          signature_data: string
          signature_font: string | null
          signature_type: string
          signed_at: string
          signer_email: string | null
          signer_id: string | null
          signer_name: string
          user_agent: string | null
        }
        Insert: {
          company_id?: string | null
          document_id: string
          field_values?: Json | null
          id?: string
          ip_address?: string | null
          signature_data: string
          signature_font?: string | null
          signature_type: string
          signed_at?: string
          signer_email?: string | null
          signer_id?: string | null
          signer_name: string
          user_agent?: string | null
        }
        Update: {
          company_id?: string | null
          document_id?: string
          field_values?: Json | null
          id?: string
          ip_address?: string | null
          signature_data?: string
          signature_font?: string | null
          signature_type?: string
          signed_at?: string
          signer_email?: string | null
          signer_id?: string | null
          signer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "signature_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "document_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signers: {
        Row: {
          company_id: string | null
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          document_id: string
          id: string
          sent_at: string | null
          signature_id: string | null
          signed_at: string | null
          signer_email: string
          signer_name: string
          signer_order: number
          status: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          document_id: string
          id?: string
          sent_at?: string | null
          signature_id?: string | null
          signed_at?: string | null
          signer_email: string
          signer_name: string
          signer_order?: number
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          document_id?: string
          id?: string
          sent_at?: string | null
          signature_id?: string | null
          signed_at?: string | null
          signer_email?: string
          signer_name?: string
          signer_order?: number
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "signature_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signers_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "document_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_logs: {
        Row: {
          company_id: string | null
          created_at: string
          duration_ms: number | null
          error_details: string | null
          error_message: string | null
          function_name: string
          id: string
          request_summary: Json | null
          response_summary: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: string | null
          error_message?: string | null
          function_name: string
          id?: string
          request_summary?: Json | null
          response_summary?: Json | null
          status?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: string | null
          error_message?: string | null
          function_name?: string
          id?: string
          request_summary?: Json | null
          response_summary?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edge_function_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      encryption_keys: {
        Row: {
          created_at: string | null
          id: string
          key_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key_name?: string
        }
        Relationships: []
      }
      estimate_attachments: {
        Row: {
          company_id: string | null
          created_at: string
          estimate_id: string
          file_name: string
          file_type: string | null
          file_url: string
          group_id: string | null
          id: string
          line_item_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          estimate_id: string
          file_name: string
          file_type?: string | null
          file_url: string
          group_id?: string | null
          id?: string
          line_item_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          estimate_id?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          group_id?: string | null
          id?: string
          line_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_attachments_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_attachments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "estimate_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_attachments_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "estimate_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_compliance_documents: {
        Row: {
          company_id: string | null
          created_at: string
          estimate_id: string
          generated_at: string | null
          generated_file_url: string | null
          id: string
          sent_at: string | null
          signature_document_id: string | null
          signed_at: string | null
          status: string
          template_id: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          estimate_id: string
          generated_at?: string | null
          generated_file_url?: string | null
          id?: string
          sent_at?: string | null
          signature_document_id?: string | null
          signed_at?: string | null
          status?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          estimate_id?: string
          generated_at?: string | null
          generated_file_url?: string | null
          id?: string
          sent_at?: string | null
          signature_document_id?: string | null
          signed_at?: string | null
          status?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_compliance_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_compliance_documents_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_compliance_documents_signature_document_id_fkey"
            columns: ["signature_document_id"]
            isOneToOne: false
            referencedRelation: "signature_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_compliance_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "compliance_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_drafts: {
        Row: {
          company_id: string
          created_at: string
          draft_data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          draft_data?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          draft_data?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_generation_jobs: {
        Row: {
          company_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_stage: string | null
          error_message: string | null
          estimate_id: string
          id: string
          request_params: Json | null
          result_json: Json | null
          stage_results: Json | null
          started_at: string | null
          status: string
          total_stages: number | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string | null
          error_message?: string | null
          estimate_id: string
          id?: string
          request_params?: Json | null
          result_json?: Json | null
          stage_results?: Json | null
          started_at?: string | null
          status?: string
          total_stages?: number | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string | null
          error_message?: string | null
          estimate_id?: string
          id?: string
          request_params?: Json | null
          result_json?: Json | null
          stage_results?: Json | null
          started_at?: string | null
          status?: string
          total_stages?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_generation_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_generation_jobs_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_generation_queue: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          job_id: string
          position: number
          started_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          job_id: string
          position: number
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          job_id?: string
          position?: number
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_generation_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_generation_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "estimate_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_groups: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          estimate_id: string
          group_name: string
          id: string
          sort_order: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          estimate_id: string
          group_name: string
          id?: string
          sort_order?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          estimate_id?: string
          group_name?: string
          id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_groups_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          company_id: string | null
          cost: number | null
          created_at: string
          description: string
          estimate_id: string
          group_id: string | null
          id: string
          is_taxable: boolean | null
          item_type: Database["public"]["Enums"]["estimate_line_item_type"]
          labor_cost: number | null
          line_total: number | null
          markup_percent: number | null
          material_cost: number | null
          quantity: number | null
          sort_order: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          company_id?: string | null
          cost?: number | null
          created_at?: string
          description: string
          estimate_id: string
          group_id?: string | null
          id?: string
          is_taxable?: boolean | null
          item_type?: Database["public"]["Enums"]["estimate_line_item_type"]
          labor_cost?: number | null
          line_total?: number | null
          markup_percent?: number | null
          material_cost?: number | null
          quantity?: number | null
          sort_order?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          company_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string
          estimate_id?: string
          group_id?: string | null
          id?: string
          is_taxable?: boolean | null
          item_type?: Database["public"]["Enums"]["estimate_line_item_type"]
          labor_cost?: number | null
          line_total?: number | null
          markup_percent?: number | null
          material_cost?: number | null
          quantity?: number | null
          sort_order?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "estimate_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_payment_schedule: {
        Row: {
          amount: number | null
          company_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_type: string | null
          estimate_id: string
          id: string
          percent: number | null
          phase_name: string
          sort_order: number | null
        }
        Insert: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_type?: string | null
          estimate_id: string
          id?: string
          percent?: number | null
          phase_name: string
          sort_order?: number | null
        }
        Update: {
          amount?: number | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_type?: string | null
          estimate_id?: string
          id?: string
          percent?: number | null
          phase_name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_payment_schedule_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_payment_schedule_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_portal_tokens: {
        Row: {
          access_count: number | null
          company_id: string | null
          created_at: string
          estimate_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_accessed_at: string | null
          signer_id: string
          token: string
        }
        Insert: {
          access_count?: number | null
          company_id?: string | null
          created_at?: string
          estimate_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          signer_id: string
          token?: string
        }
        Update: {
          access_count?: number | null
          company_id?: string | null
          created_at?: string
          estimate_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          signer_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_portal_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_portal_tokens_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_portal_tokens_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "estimate_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_signatures: {
        Row: {
          company_id: string | null
          estimate_id: string
          id: string
          ip_address: string | null
          portal_token_id: string | null
          signature_data: string
          signature_font: string | null
          signature_type: string
          signed_at: string
          signer_email: string | null
          signer_name: string
          user_agent: string | null
        }
        Insert: {
          company_id?: string | null
          estimate_id: string
          id?: string
          ip_address?: string | null
          portal_token_id?: string | null
          signature_data: string
          signature_font?: string | null
          signature_type: string
          signed_at?: string
          signer_email?: string | null
          signer_name: string
          user_agent?: string | null
        }
        Update: {
          company_id?: string | null
          estimate_id?: string
          id?: string
          ip_address?: string | null
          portal_token_id?: string | null
          signature_data?: string
          signature_font?: string | null
          signature_type?: string
          signed_at?: string
          signer_email?: string | null
          signer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_signatures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_signatures_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_signatures_portal_token_id_fkey"
            columns: ["portal_token_id"]
            isOneToOne: false
            referencedRelation: "client_portal_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_signers: {
        Row: {
          company_id: string | null
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          estimate_id: string
          id: string
          sent_at: string | null
          signature_id: string | null
          signed_at: string | null
          signer_email: string
          signer_name: string
          signer_order: number
          status: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          estimate_id: string
          id?: string
          sent_at?: string | null
          signature_id?: string | null
          signed_at?: string | null
          signer_email: string
          signer_name: string
          signer_order?: number
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          estimate_id?: string
          id?: string
          sent_at?: string | null
          signature_id?: string | null
          signed_at?: string | null
          signer_email?: string
          signer_name?: string
          signer_order?: number
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_signers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_signers_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_signers_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "estimate_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          ai_analysis: Json | null
          billing_address: string | null
          company_id: string | null
          contact_id: string | null
          contact_uuid: string | null
          created_at: string
          created_by: string | null
          created_by_source: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          decline_reason: string | null
          declined_at: string | null
          deposit_amount: number | null
          deposit_due_rule: string | null
          deposit_max_amount: number | null
          deposit_percent: number | null
          deposit_required: boolean | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          estimate_date: string
          estimate_mode: string | null
          estimate_number: number
          estimate_title: string
          expiration_date: string | null
          finishing_grade: string | null
          garage_sq_ft: string | null
          id: string
          job_address: string | null
          lead_source: string | null
          manual_total: number | null
          notes: string | null
          notes_to_customer: string | null
          opportunity_id: string | null
          opportunity_uuid: string | null
          plans_file_url: string | null
          project_id: string | null
          proposal_pdf_url: string | null
          salesperson_id: string | null
          salesperson_name: string | null
          sent_at: string | null
          show_details_to_customer: boolean
          show_line_items_to_customer: boolean
          show_scope_to_customer: boolean
          signed_at: string | null
          sq_ft_to_build: string | null
          status: Database["public"]["Enums"]["estimate_status"]
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          terms_and_conditions: string | null
          total: number | null
          updated_at: string
          viewed_at: string | null
          work_scope_description: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          billing_address?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_uuid?: string | null
          created_at?: string
          created_by?: string | null
          created_by_source?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deposit_amount?: number | null
          deposit_due_rule?: string | null
          deposit_max_amount?: number | null
          deposit_percent?: number | null
          deposit_required?: boolean | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          estimate_date?: string
          estimate_mode?: string | null
          estimate_number?: number
          estimate_title: string
          expiration_date?: string | null
          finishing_grade?: string | null
          garage_sq_ft?: string | null
          id?: string
          job_address?: string | null
          lead_source?: string | null
          manual_total?: number | null
          notes?: string | null
          notes_to_customer?: string | null
          opportunity_id?: string | null
          opportunity_uuid?: string | null
          plans_file_url?: string | null
          project_id?: string | null
          proposal_pdf_url?: string | null
          salesperson_id?: string | null
          salesperson_name?: string | null
          sent_at?: string | null
          show_details_to_customer?: boolean
          show_line_items_to_customer?: boolean
          show_scope_to_customer?: boolean
          signed_at?: string | null
          sq_ft_to_build?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_and_conditions?: string | null
          total?: number | null
          updated_at?: string
          viewed_at?: string | null
          work_scope_description?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          billing_address?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_uuid?: string | null
          created_at?: string
          created_by?: string | null
          created_by_source?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deposit_amount?: number | null
          deposit_due_rule?: string | null
          deposit_max_amount?: number | null
          deposit_percent?: number | null
          deposit_required?: boolean | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          estimate_date?: string
          estimate_mode?: string | null
          estimate_number?: number
          estimate_title?: string
          expiration_date?: string | null
          finishing_grade?: string | null
          garage_sq_ft?: string | null
          id?: string
          job_address?: string | null
          lead_source?: string | null
          manual_total?: number | null
          notes?: string | null
          notes_to_customer?: string | null
          opportunity_id?: string | null
          opportunity_uuid?: string | null
          plans_file_url?: string | null
          project_id?: string | null
          proposal_pdf_url?: string | null
          salesperson_id?: string | null
          salesperson_name?: string | null
          sent_at?: string | null
          show_details_to_customer?: boolean
          show_line_items_to_customer?: boolean
          show_scope_to_customer?: boolean
          signed_at?: string | null
          sq_ft_to_build?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_and_conditions?: string | null
          total?: number | null
          updated_at?: string
          viewed_at?: string | null
          work_scope_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_contact_uuid_fkey"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["ghl_id"]
          },
          {
            foreignKeyName: "estimates_opportunity_uuid_fkey"
            columns: ["opportunity_uuid"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_estimates_contact_uuid"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_calendars: {
        Row: {
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "ghl_calendars_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_field_mappings: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          field_name: string
          ghl_custom_field_id: string
          id: string
          integration_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          field_name: string
          ghl_custom_field_id: string
          id?: string
          integration_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          field_name?: string
          ghl_custom_field_id?: string
          id?: string
          integration_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_field_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_field_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "company_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_pipelines: {
        Row: {
          company_id: string | null
          created_at: string
          ghl_id: string
          id: string
          location_id: string
          name: string
          stages: Json
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          ghl_id: string
          id?: string
          location_id: string
          name: string
          stages?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          ghl_id?: string
          id?: string
          location_id?: string
          name?: string
          stages?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_pipelines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_sync_exclusions: {
        Row: {
          company_id: string | null
          excluded_at: string
          excluded_by: string | null
          ghl_id: string
          id: string
          location_id: string
          reason: string | null
          record_type: string
        }
        Insert: {
          company_id?: string | null
          excluded_at?: string
          excluded_by?: string | null
          ghl_id: string
          id?: string
          location_id: string
          reason?: string | null
          record_type: string
        }
        Update: {
          company_id?: string | null
          excluded_at?: string
          excluded_by?: string | null
          ghl_id?: string
          id?: string
          location_id?: string
          reason?: string | null
          record_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_sync_exclusions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_sync_exclusions_excluded_by_fkey"
            columns: ["excluded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_tasks: {
        Row: {
          assigned_to: string | null
          body: string | null
          company_id: string | null
          completed: boolean | null
          contact_id: string
          contact_uuid: string | null
          created_at: string
          due_date: string | null
          edited_at: string | null
          edited_by: string | null
          entered_by: string | null
          external_id: string | null
          ghl_id: string | null
          id: string
          last_synced_at: string | null
          location_id: string
          provider: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          body?: string | null
          company_id?: string | null
          completed?: boolean | null
          contact_id: string
          contact_uuid?: string | null
          created_at?: string
          due_date?: string | null
          edited_at?: string | null
          edited_by?: string | null
          entered_by?: string | null
          external_id?: string | null
          ghl_id?: string | null
          id?: string
          last_synced_at?: string | null
          location_id: string
          provider?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          body?: string | null
          company_id?: string | null
          completed?: boolean | null
          contact_id?: string
          contact_uuid?: string | null
          created_at?: string
          due_date?: string | null
          edited_at?: string | null
          edited_by?: string | null
          entered_by?: string | null
          external_id?: string | null
          ghl_id?: string | null
          id?: string
          last_synced_at?: string | null
          location_id?: string
          provider?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ghl_tasks_contact_uuid"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_tasks_contact_uuid_fkey"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_tasks_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
          created_at: string
          email: string | null
          external_id: string | null
          first_name: string | null
          ghl_id: string
          id: string
          last_name: string | null
          location_id: string
          name: string | null
          phone: string | null
          provider: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          ghl_id: string
          id?: string
          last_name?: string | null
          location_id: string
          name?: string | null
          phone?: string | null
          provider?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          ghl_id?: string
          id?: string
          last_name?: string | null
          location_id?: string
          name?: string | null
          phone?: string | null
          provider?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          access_token_encrypted: string | null
          calendar_email: string | null
          calendar_id: string
          calendar_name: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_company_calendar: boolean
          last_sync_at: string | null
          refresh_token_encrypted: string | null
          salesperson_id: string | null
          sync_direction: Database["public"]["Enums"]["calendar_sync_direction"]
          sync_error: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          calendar_email?: string | null
          calendar_id: string
          calendar_name?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_company_calendar?: boolean
          last_sync_at?: string | null
          refresh_token_encrypted?: string | null
          salesperson_id?: string | null
          sync_direction?: Database["public"]["Enums"]["calendar_sync_direction"]
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          calendar_email?: string | null
          calendar_id?: string
          calendar_name?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_company_calendar?: boolean
          last_sync_at?: string | null
          refresh_token_encrypted?: string | null
          salesperson_id?: string | null
          sync_direction?: Database["public"]["Enums"]["calendar_sync_direction"]
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_connections_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      ignored_duplicate_opportunities: {
        Row: {
          company_id: string
          id: string
          ignored_at: string
          ignored_by: string | null
          opportunity_id_1: string
          opportunity_id_2: string
          reason: string | null
        }
        Insert: {
          company_id: string
          id?: string
          ignored_at?: string
          ignored_by?: string | null
          opportunity_id_1: string
          opportunity_id_2: string
          reason?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          ignored_at?: string
          ignored_by?: string | null
          opportunity_id_1?: string
          opportunity_id_2?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ignored_duplicate_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_records: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          imported_at: string | null
          record_type: string
          source_ghl_id: string
          source_location_id: string
          target_ghl_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          imported_at?: string | null
          record_type: string
          source_ghl_id: string
          source_location_id: string
          target_ghl_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          imported_at?: string | null
          record_type?: string
          source_ghl_id?: string
          source_location_id?: string
          target_ghl_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imported_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      magazine_sales: {
        Row: {
          ad_sold: string
          buyer_email: string | null
          buyer_name: string
          buyer_phone: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          entered_by: string | null
          id: string
          magazine_issue_date: string
          page_number: string
          page_size: string
          price: number
          sections_sold: number[] | null
          updated_at: string
        }
        Insert: {
          ad_sold: string
          buyer_email?: string | null
          buyer_name: string
          buyer_phone?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          entered_by?: string | null
          id?: string
          magazine_issue_date: string
          page_number: string
          page_size: string
          price?: number
          sections_sold?: number[] | null
          updated_at?: string
        }
        Update: {
          ad_sold?: string
          buyer_email?: string | null
          buyer_name?: string
          buyer_phone?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          entered_by?: string | null
          id?: string
          magazine_issue_date?: string
          page_number?: string
          page_size?: string
          price?: number
          sections_sold?: number[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "magazine_sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magazine_sales_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      magazine_sales_edits: {
        Row: {
          company_id: string | null
          edited_at: string
          edited_by: string | null
          field_name: string
          id: string
          magazine_sale_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          company_id?: string | null
          edited_at?: string
          edited_by?: string | null
          field_name: string
          id?: string
          magazine_sale_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          company_id?: string | null
          edited_at?: string
          edited_by?: string | null
          field_name?: string
          id?: string
          magazine_sale_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "magazine_sales_edits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magazine_sales_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magazine_sales_edits_magazine_sale_id_fkey"
            columns: ["magazine_sale_id"]
            isOneToOne: false
            referencedRelation: "magazine_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      map_contacts: {
        Row: {
          created_at: string
          new_contact_id: string
          old_contact_id: string
        }
        Insert: {
          created_at?: string
          new_contact_id: string
          old_contact_id: string
        }
        Update: {
          created_at?: string
          new_contact_id?: string
          old_contact_id?: string
        }
        Relationships: []
      }
      note_edits: {
        Row: {
          company_id: string | null
          contact_ghl_id: string | null
          edited_at: string
          edited_by: string | null
          field_name: string
          id: string
          location_id: string | null
          new_value: string | null
          note_ghl_id: string
          old_value: string | null
        }
        Insert: {
          company_id?: string | null
          contact_ghl_id?: string | null
          edited_at?: string
          edited_by?: string | null
          field_name: string
          id?: string
          location_id?: string | null
          new_value?: string | null
          note_ghl_id: string
          old_value?: string | null
        }
        Update: {
          company_id?: string | null
          contact_ghl_id?: string | null
          edited_at?: string
          edited_by?: string | null
          field_name?: string
          id?: string
          location_id?: string | null
          new_value?: string | null
          note_ghl_id?: string
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_edits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          appointment_ghl_id: string | null
          company_id: string | null
          created_at: string
          ghl_user_id: string | null
          id: string
          message: string
          read: boolean
          reference_url: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          appointment_ghl_id?: string | null
          company_id?: string | null
          created_at?: string
          ghl_user_id?: string | null
          id?: string
          message: string
          read?: boolean
          reference_url?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          appointment_ghl_id?: string | null
          company_id?: string | null
          created_at?: string
          ghl_user_id?: string | null
          id?: string
          message?: string
          read?: boolean
          reference_url?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          address: string | null
          assigned_to: string | null
          company_id: string | null
          contact_id: string | null
          contact_uuid: string | null
          created_at: string
          custom_fields: Json | null
          entered_by: string | null
          external_id: string | null
          ghl_date_added: string | null
          ghl_date_updated: string | null
          ghl_id: string | null
          id: string
          last_synced_at: string | null
          location_id: string
          monetary_value: number | null
          name: string | null
          opportunity_number: number | null
          pipeline_id: string | null
          pipeline_name: string | null
          pipeline_stage_id: string | null
          proposal_link: string | null
          provider: string | null
          salesperson_id: string | null
          scope_of_work: string | null
          stage_name: string | null
          status: string | null
          updated_at: string
          won_at: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_uuid?: string | null
          created_at?: string
          custom_fields?: Json | null
          entered_by?: string | null
          external_id?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string | null
          id?: string
          last_synced_at?: string | null
          location_id: string
          monetary_value?: number | null
          name?: string | null
          opportunity_number?: number | null
          pipeline_id?: string | null
          pipeline_name?: string | null
          pipeline_stage_id?: string | null
          proposal_link?: string | null
          provider?: string | null
          salesperson_id?: string | null
          scope_of_work?: string | null
          stage_name?: string | null
          status?: string | null
          updated_at?: string
          won_at?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_uuid?: string | null
          created_at?: string
          custom_fields?: Json | null
          entered_by?: string | null
          external_id?: string | null
          ghl_date_added?: string | null
          ghl_date_updated?: string | null
          ghl_id?: string | null
          id?: string
          last_synced_at?: string | null
          location_id?: string
          monetary_value?: number | null
          name?: string | null
          opportunity_number?: number | null
          pipeline_id?: string | null
          pipeline_name?: string | null
          pipeline_stage_id?: string | null
          proposal_link?: string | null
          provider?: string | null
          salesperson_id?: string | null
          scope_of_work?: string | null
          stage_name?: string | null
          status?: string | null
          updated_at?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_opportunities_contact_uuid"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_uuid_fkey"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_edits: {
        Row: {
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "opportunity_edits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_sales: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          entered_by: string | null
          id: string
          location_id: string
          opportunity_id: string
          sold_amount: number
          sold_by: string | null
          sold_date: string
          sold_to_name: string | null
          sold_to_phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          entered_by?: string | null
          id?: string
          location_id: string
          opportunity_id: string
          sold_amount?: number
          sold_by?: string | null
          sold_date: string
          sold_to_name?: string | null
          sold_to_phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          entered_by?: string | null
          id?: string
          location_id?: string
          opportunity_id?: string
          sold_amount?: number
          sold_by?: string | null
          sold_date?: string
          sold_to_name?: string | null
          sold_to_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_chat_messages: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_read: boolean | null
          is_sms: boolean | null
          message: string
          portal_token_id: string | null
          project_id: string | null
          sender_email: string | null
          sender_name: string
          sender_type: string
          sender_user_id: string | null
          sms_phone_number: string | null
          twilio_message_sid: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          is_sms?: boolean | null
          message: string
          portal_token_id?: string | null
          project_id?: string | null
          sender_email?: string | null
          sender_name: string
          sender_type: string
          sender_user_id?: string | null
          sms_phone_number?: string | null
          twilio_message_sid?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          is_sms?: boolean | null
          message?: string
          portal_token_id?: string | null
          project_id?: string | null
          sender_email?: string | null
          sender_name?: string
          sender_type?: string
          sender_user_id?: string | null
          sms_phone_number?: string | null
          twilio_message_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_chat_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_chat_messages_portal_token_id_fkey"
            columns: ["portal_token_id"]
            isOneToOne: false
            referencedRelation: "client_portal_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_chat_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_chat_messages_archived: {
        Row: {
          archived_at: string
          company_id: string | null
          id: string
          is_read: boolean | null
          message: string
          original_created_at: string
          original_id: string
          original_updated_at: string
          portal_token_id: string | null
          project_id: string
          sender_email: string | null
          sender_name: string
          sender_type: string
          sender_user_id: string | null
        }
        Insert: {
          archived_at?: string
          company_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          original_created_at: string
          original_id: string
          original_updated_at: string
          portal_token_id?: string | null
          project_id: string
          sender_email?: string | null
          sender_name: string
          sender_type: string
          sender_user_id?: string | null
        }
        Update: {
          archived_at?: string
          company_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          original_created_at?: string
          original_id?: string
          original_updated_at?: string
          portal_token_id?: string | null
          project_id?: string
          sender_email?: string | null
          sender_name?: string
          sender_type?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_chat_messages_archived_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_chat_messages_archived_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_view_logs: {
        Row: {
          company_id: string | null
          estimate_id: string | null
          id: string
          ip_address: string | null
          page_viewed: string | null
          portal_token_id: string
          project_id: string | null
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          company_id?: string | null
          estimate_id?: string | null
          id?: string
          ip_address?: string | null
          page_viewed?: string | null
          portal_token_id: string
          project_id?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          company_id?: string | null
          estimate_id?: string | null
          id?: string
          ip_address?: string | null
          page_viewed?: string | null
          portal_token_id?: string
          project_id?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_view_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_view_logs_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_view_logs_portal_token_id_fkey"
            columns: ["portal_token_id"]
            isOneToOne: false
            referencedRelation: "client_portal_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_view_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          corporation_id: string | null
          created_at: string | null
          email: string
          full_name: string | null
          ghl_user_id: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          corporation_id?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          ghl_user_id?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          corporation_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          ghl_user_id?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_corporation_id_fkey"
            columns: ["corporation_id"]
            isOneToOne: false
            referencedRelation: "corporations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_agreements: {
        Row: {
          agreement_number: string | null
          agreement_signed_date: string | null
          agreement_type: string | null
          attachment_url: string | null
          average_lead_cost: number | null
          company_id: string | null
          created_at: string | null
          description_of_work: string | null
          id: string
          lead_cost_percent: number | null
          project_id: string | null
          total_price: number | null
          updated_at: string | null
        }
        Insert: {
          agreement_number?: string | null
          agreement_signed_date?: string | null
          agreement_type?: string | null
          attachment_url?: string | null
          average_lead_cost?: number | null
          company_id?: string | null
          created_at?: string | null
          description_of_work?: string | null
          id?: string
          lead_cost_percent?: number | null
          project_id?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Update: {
          agreement_number?: string | null
          agreement_signed_date?: string | null
          agreement_type?: string | null
          attachment_url?: string | null
          average_lead_cost?: number | null
          company_id?: string | null
          created_at?: string | null
          description_of_work?: string | null
          id?: string
          lead_cost_percent?: number | null
          project_id?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_agreements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_bills: {
        Row: {
          agreement_id: string | null
          amount_paid: number | null
          attachment_url: string | null
          balance: number | null
          bill_amount: number | null
          bill_ref: string | null
          category: string | null
          company_id: string | null
          created_at: string | null
          exclude_from_qb: boolean | null
          id: string
          installer_company: string | null
          is_voided: boolean
          memo: string | null
          not_affecting_payment: boolean | null
          offset_bill_id: string | null
          original_bill_amount: number | null
          payment_method: string | null
          payment_reference: string | null
          project_id: string | null
          scheduled_payment_amount: number | null
          scheduled_payment_date: string | null
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          agreement_id?: string | null
          amount_paid?: number | null
          attachment_url?: string | null
          balance?: number | null
          bill_amount?: number | null
          bill_ref?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          exclude_from_qb?: boolean | null
          id?: string
          installer_company?: string | null
          is_voided?: boolean
          memo?: string | null
          not_affecting_payment?: boolean | null
          offset_bill_id?: string | null
          original_bill_amount?: number | null
          payment_method?: string | null
          payment_reference?: string | null
          project_id?: string | null
          scheduled_payment_amount?: number | null
          scheduled_payment_date?: string | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          agreement_id?: string | null
          amount_paid?: number | null
          attachment_url?: string | null
          balance?: number | null
          bill_amount?: number | null
          bill_ref?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          exclude_from_qb?: boolean | null
          id?: string
          installer_company?: string | null
          is_voided?: boolean
          memo?: string | null
          not_affecting_payment?: boolean | null
          offset_bill_id?: string | null
          original_bill_amount?: number | null
          payment_method?: string | null
          payment_reference?: string | null
          project_id?: string | null
          scheduled_payment_amount?: number | null
          scheduled_payment_date?: string | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_bills_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "project_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_bills_offset_bill_id_fkey"
            columns: ["offset_bill_id"]
            isOneToOne: false
            referencedRelation: "project_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_bills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_bills_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_checklists: {
        Row: {
          company_id: string | null
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          due_date: string | null
          id: string
          item: string
          project_id: string | null
        }
        Insert: {
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          item: string
          project_id?: string | null
        }
        Update: {
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          item?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_checklists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_checklists_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_commissions: {
        Row: {
          commission_balance: number | null
          commission_paid: number | null
          company_id: string | null
          created_at: string | null
          id: string
          project_id: string | null
          salesperson: string | null
          total_commission: number | null
          updated_at: string | null
        }
        Insert: {
          commission_balance?: number | null
          commission_paid?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          salesperson?: string | null
          total_commission?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_balance?: number | null
          commission_paid?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          salesperson?: string | null
          total_commission?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_commissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_costs: {
        Row: {
          company_id: string | null
          created_at: string
          entered_by: string | null
          estimated_cost: number
          id: string
          notes: string | null
          opportunity_id: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          entered_by?: string | null
          estimated_cost?: number
          id?: string
          notes?: string | null
          opportunity_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
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
            foreignKeyName: "project_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_costs_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string | null
          estimate_id: string | null
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          notes: string | null
          project_id: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          estimate_id?: string | null
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          notes?: string | null
          project_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          estimate_id?: string | null
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_feedback: {
        Row: {
          company_id: string | null
          completion_call_notes: string | null
          created_at: string | null
          customer_feedback: string | null
          id: string
          online_review_given: boolean | null
          progress_call_notes: string | null
          project_id: string | null
          review_location: string | null
          satisfaction_rank: number | null
          service_call_status: string | null
          updated_at: string | null
          use_as_reference: boolean | null
          welcome_call_notes: string | null
        }
        Insert: {
          company_id?: string | null
          completion_call_notes?: string | null
          created_at?: string | null
          customer_feedback?: string | null
          id?: string
          online_review_given?: boolean | null
          progress_call_notes?: string | null
          project_id?: string | null
          review_location?: string | null
          satisfaction_rank?: number | null
          service_call_status?: string | null
          updated_at?: string | null
          use_as_reference?: boolean | null
          welcome_call_notes?: string | null
        }
        Update: {
          company_id?: string | null
          completion_call_notes?: string | null
          created_at?: string | null
          customer_feedback?: string | null
          id?: string
          online_review_given?: boolean | null
          progress_call_notes?: string | null
          project_id?: string | null
          review_location?: string | null
          satisfaction_rank?: number | null
          service_call_status?: string | null
          updated_at?: string | null
          use_as_reference?: boolean | null
          welcome_call_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_feedback_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_finance: {
        Row: {
          account_number: string | null
          approved_amount: number | null
          bank_name: string | null
          company_id: string | null
          created_at: string | null
          finance_balance: number | null
          finance_type: string | null
          id: string
          notes: string | null
          project_id: string | null
          updated_at: string | null
          used_amount: number | null
        }
        Insert: {
          account_number?: string | null
          approved_amount?: number | null
          bank_name?: string | null
          company_id?: string | null
          created_at?: string | null
          finance_balance?: number | null
          finance_type?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          updated_at?: string | null
          used_amount?: number | null
        }
        Update: {
          account_number?: string | null
          approved_amount?: number | null
          bank_name?: string | null
          company_id?: string | null
          created_at?: string | null
          finance_balance?: number | null
          finance_type?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          updated_at?: string | null
          used_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_finance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_finance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invoices: {
        Row: {
          agreement_id: string | null
          amount: number | null
          attachment_url: string | null
          company_id: string | null
          created_at: string | null
          exclude_from_qb: boolean | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          open_balance: number | null
          payment_phase_id: string | null
          payments_received: number | null
          project_id: string | null
          total_expected: number | null
          updated_at: string | null
        }
        Insert: {
          agreement_id?: string | null
          amount?: number | null
          attachment_url?: string | null
          company_id?: string | null
          created_at?: string | null
          exclude_from_qb?: boolean | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          open_balance?: number | null
          payment_phase_id?: string | null
          payments_received?: number | null
          project_id?: string | null
          total_expected?: number | null
          updated_at?: string | null
        }
        Update: {
          agreement_id?: string | null
          amount?: number | null
          attachment_url?: string | null
          company_id?: string | null
          created_at?: string | null
          exclude_from_qb?: boolean | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          open_balance?: number | null
          payment_phase_id?: string | null
          payments_received?: number | null
          project_id?: string | null
          total_expected?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_invoices_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "project_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invoices_payment_phase_id_fkey"
            columns: ["payment_phase_id"]
            isOneToOne: false
            referencedRelation: "project_payment_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_messages: {
        Row: {
          attachment_url: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_alert: boolean | null
          message: string | null
          project_id: string | null
          subject: string | null
        }
        Insert: {
          attachment_url?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_alert?: boolean | null
          message?: string | null
          project_id?: string | null
          subject?: string | null
        }
        Update: {
          attachment_url?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_alert?: boolean | null
          message?: string | null
          project_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_note_comments: {
        Row: {
          comment_text: string
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          note_id: string
        }
        Insert: {
          comment_text: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note_id: string
        }
        Update: {
          comment_text?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_note_comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_note_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_note_comments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "project_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notes: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          note_text: string
          project_id: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note_text: string
          project_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note_text?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notification_log: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_automated: boolean | null
          notification_type: string
          project_id: string
          sent_at: string
          sent_by: string | null
          sent_to_email: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_automated?: boolean | null
          notification_type?: string
          project_id: string
          sent_at?: string
          sent_by?: string | null
          sent_to_email?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_automated?: boolean | null
          notification_type?: string
          project_id?: string
          sent_at?: string
          sent_by?: string | null
          sent_to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_notification_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notification_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notification_log_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_payment_phases: {
        Row: {
          agreement_id: string | null
          amount: number | null
          company_id: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          due_date: string | null
          id: string
          phase_name: string
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          agreement_id?: string | null
          amount?: number | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          due_date?: string | null
          id?: string
          phase_name: string
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          agreement_id?: string | null
          amount?: number | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          due_date?: string | null
          id?: string
          phase_name?: string
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_payment_phases_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "project_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payment_phases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payment_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_payments: {
        Row: {
          bank_id: string | null
          bank_name: string | null
          check_number: string | null
          company_id: string | null
          created_at: string | null
          deposit_verified: boolean | null
          do_not_summarize: boolean | null
          exclude_from_qb: boolean | null
          id: string
          invoice_id: string | null
          is_voided: boolean
          payment_amount: number | null
          payment_fee: number | null
          payment_phase_id: string | null
          payment_schedule: string | null
          payment_status: string | null
          project_id: string | null
          projected_received_date: string | null
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          bank_id?: string | null
          bank_name?: string | null
          check_number?: string | null
          company_id?: string | null
          created_at?: string | null
          deposit_verified?: boolean | null
          do_not_summarize?: boolean | null
          exclude_from_qb?: boolean | null
          id?: string
          invoice_id?: string | null
          is_voided?: boolean
          payment_amount?: number | null
          payment_fee?: number | null
          payment_phase_id?: string | null
          payment_schedule?: string | null
          payment_status?: string | null
          project_id?: string | null
          projected_received_date?: string | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          bank_id?: string | null
          bank_name?: string | null
          check_number?: string | null
          company_id?: string | null
          created_at?: string | null
          deposit_verified?: boolean | null
          do_not_summarize?: boolean | null
          exclude_from_qb?: boolean | null
          id?: string
          invoice_id?: string | null
          is_voided?: boolean
          payment_amount?: number | null
          payment_fee?: number | null
          payment_phase_id?: string | null
          payment_schedule?: string | null
          payment_status?: string | null
          project_id?: string | null
          projected_received_date?: string | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_payments_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "project_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payments_payment_phase_id_fkey"
            columns: ["payment_phase_id"]
            isOneToOne: false
            referencedRelation: "project_payment_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payments_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_statuses: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_statuses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_statuses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_types: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          agreement_signed_date: string | null
          alt_phone: string | null
          auto_sync_to_quickbooks: boolean
          branch: string | null
          cell_phone: string | null
          commission_split_pct: number | null
          company_id: string | null
          completion_date: string | null
          contact_id: string | null
          contact_preferences: string | null
          contact_uuid: string | null
          contract_expiration_date: string | null
          contract_number: string | null
          created_at: string | null
          created_by: string | null
          customer_email: string | null
          customer_first_name: string | null
          customer_last_name: string | null
          date_of_birth: string | null
          deleted_at: string | null
          dropbox_link: string | null
          due_date: string | null
          estimated_cost: number | null
          estimated_project_cost: number | null
          has_hoa: boolean | null
          home_phone: string | null
          id: string
          install_notes: string | null
          install_start_date: string | null
          install_status: string | null
          installers_on_site: string[] | null
          lead_cost_percent: number | null
          lead_number: string | null
          lead_source: string | null
          legacy_project_number: string | null
          location_id: string
          lock_box_code: string | null
          opportunity_id: string | null
          opportunity_uuid: string | null
          permit_numbers: string | null
          primary_commission_pct: number | null
          primary_profit_split_pct: number | null
          primary_salesperson: string | null
          project_address: string | null
          project_manager: string | null
          project_name: string
          project_number: number
          project_scope_dispatch: string | null
          project_status: string | null
          project_subcategory: string | null
          project_type: string | null
          quaternary_commission_pct: number | null
          quaternary_profit_split_pct: number | null
          quaternary_salesperson: string | null
          scope_of_work: string | null
          secondary_commission_pct: number | null
          secondary_profit_split_pct: number | null
          secondary_salesperson: string | null
          sold_dispatch_value: number | null
          sold_under: string | null
          tertiary_commission_pct: number | null
          tertiary_profit_split_pct: number | null
          tertiary_salesperson: string | null
          total_pl: number | null
          updated_at: string | null
          utility: string | null
        }
        Insert: {
          agreement_signed_date?: string | null
          alt_phone?: string | null
          auto_sync_to_quickbooks?: boolean
          branch?: string | null
          cell_phone?: string | null
          commission_split_pct?: number | null
          company_id?: string | null
          completion_date?: string | null
          contact_id?: string | null
          contact_preferences?: string | null
          contact_uuid?: string | null
          contract_expiration_date?: string | null
          contract_number?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_last_name?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          dropbox_link?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          estimated_project_cost?: number | null
          has_hoa?: boolean | null
          home_phone?: string | null
          id?: string
          install_notes?: string | null
          install_start_date?: string | null
          install_status?: string | null
          installers_on_site?: string[] | null
          lead_cost_percent?: number | null
          lead_number?: string | null
          lead_source?: string | null
          legacy_project_number?: string | null
          location_id: string
          lock_box_code?: string | null
          opportunity_id?: string | null
          opportunity_uuid?: string | null
          permit_numbers?: string | null
          primary_commission_pct?: number | null
          primary_profit_split_pct?: number | null
          primary_salesperson?: string | null
          project_address?: string | null
          project_manager?: string | null
          project_name: string
          project_number?: number
          project_scope_dispatch?: string | null
          project_status?: string | null
          project_subcategory?: string | null
          project_type?: string | null
          quaternary_commission_pct?: number | null
          quaternary_profit_split_pct?: number | null
          quaternary_salesperson?: string | null
          scope_of_work?: string | null
          secondary_commission_pct?: number | null
          secondary_profit_split_pct?: number | null
          secondary_salesperson?: string | null
          sold_dispatch_value?: number | null
          sold_under?: string | null
          tertiary_commission_pct?: number | null
          tertiary_profit_split_pct?: number | null
          tertiary_salesperson?: string | null
          total_pl?: number | null
          updated_at?: string | null
          utility?: string | null
        }
        Update: {
          agreement_signed_date?: string | null
          alt_phone?: string | null
          auto_sync_to_quickbooks?: boolean
          branch?: string | null
          cell_phone?: string | null
          commission_split_pct?: number | null
          company_id?: string | null
          completion_date?: string | null
          contact_id?: string | null
          contact_preferences?: string | null
          contact_uuid?: string | null
          contract_expiration_date?: string | null
          contract_number?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_last_name?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          dropbox_link?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          estimated_project_cost?: number | null
          has_hoa?: boolean | null
          home_phone?: string | null
          id?: string
          install_notes?: string | null
          install_start_date?: string | null
          install_status?: string | null
          installers_on_site?: string[] | null
          lead_cost_percent?: number | null
          lead_number?: string | null
          lead_source?: string | null
          legacy_project_number?: string | null
          location_id?: string
          lock_box_code?: string | null
          opportunity_id?: string | null
          opportunity_uuid?: string | null
          permit_numbers?: string | null
          primary_commission_pct?: number | null
          primary_profit_split_pct?: number | null
          primary_salesperson?: string | null
          project_address?: string | null
          project_manager?: string | null
          project_name?: string
          project_number?: number
          project_scope_dispatch?: string | null
          project_status?: string | null
          project_subcategory?: string | null
          project_type?: string | null
          quaternary_commission_pct?: number | null
          quaternary_profit_split_pct?: number | null
          quaternary_salesperson?: string | null
          scope_of_work?: string | null
          secondary_commission_pct?: number | null
          secondary_profit_split_pct?: number | null
          secondary_salesperson?: string | null
          sold_dispatch_value?: number | null
          sold_under?: string | null
          tertiary_commission_pct?: number | null
          tertiary_profit_split_pct?: number | null
          tertiary_salesperson?: string | null
          total_pl?: number | null
          updated_at?: string | null
          utility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_contact_uuid"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_opportunity_uuid"
            columns: ["opportunity_uuid"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_contact_uuid_fkey"
            columns: ["contact_uuid"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_opportunity_uuid_fkey"
            columns: ["opportunity_uuid"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_connections: {
        Row: {
          access_token_encrypted: string | null
          company_id: string
          company_name: string | null
          connected_at: string | null
          connected_by: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          realm_id: string
          refresh_token_encrypted: string | null
          sync_error: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          company_id: string
          company_name?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          realm_id: string
          refresh_token_encrypted?: string | null
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          company_id?: string
          company_name?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          realm_id?: string
          refresh_token_encrypted?: string | null
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickbooks_connections_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_field_mappings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          local_field: string
          qb_field: string
          record_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          local_field: string
          qb_field: string
          record_type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          local_field?: string
          qb_field?: string
          record_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_field_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_mappings: {
        Row: {
          company_id: string
          created_at: string
          default_expense_account_id: string | null
          default_expense_account_name: string | null
          id: string
          is_default: boolean | null
          mapping_type: string
          qbo_id: string
          qbo_name: string
          qbo_type: string | null
          source_value: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_expense_account_id?: string | null
          default_expense_account_name?: string | null
          id?: string
          is_default?: boolean | null
          mapping_type: string
          qbo_id: string
          qbo_name: string
          qbo_type?: string | null
          source_value?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_expense_account_id?: string | null
          default_expense_account_name?: string | null
          id?: string
          is_default?: boolean | null
          mapping_type?: string
          qbo_id?: string
          qbo_name?: string
          qbo_type?: string | null
          source_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_sync_log: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          qb_doc_number: string | null
          quickbooks_id: string | null
          record_id: string
          record_type: string
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          qb_doc_number?: string | null
          quickbooks_id?: string | null
          record_id: string
          record_type: string
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          qb_doc_number?: string | null
          quickbooks_id?: string | null
          record_id?: string
          record_type?: string
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_sync_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      salespeople: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          ghl_user_id: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          ghl_user_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          ghl_user_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salespeople_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      salesperson_portal_tokens: {
        Row: {
          access_count: number | null
          company_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          salesperson_id: string
          token: string
          updated_at: string
        }
        Insert: {
          access_count?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          salesperson_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          access_count?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          salesperson_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salesperson_portal_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesperson_portal_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesperson_portal_tokens_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_submissions: {
        Row: {
          appointment_id: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          estimate_id: string | null
          id: string
          job_address: string | null
          measurements: string | null
          office_notes: string | null
          opportunity_id: string | null
          photos_urls: string[] | null
          priority: string | null
          project_type: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          salesperson_id: string
          scope_description: string
          special_requirements: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          estimate_id?: string | null
          id?: string
          job_address?: string | null
          measurements?: string | null
          office_notes?: string | null
          opportunity_id?: string | null
          photos_urls?: string[] | null
          priority?: string | null
          project_type?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salesperson_id: string
          scope_description: string
          special_requirements?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          estimate_id?: string | null
          id?: string
          job_address?: string | null
          measurements?: string | null
          office_notes?: string | null
          opportunity_id?: string | null
          photos_urls?: string[] | null
          priority?: string | null
          project_type?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salesperson_id?: string
          scope_description?: string
          special_requirements?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_submissions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_submissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_submissions_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_submissions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_submissions_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      short_link_clicks: {
        Row: {
          clicked_at: string | null
          country: string | null
          device_type: string | null
          id: string
          ip_hash: string | null
          referer: string | null
          short_link_id: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          referer?: string | null
          short_link_id: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          referer?: string | null
          short_link_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "short_link_clicks_short_link_id_fkey"
            columns: ["short_link_id"]
            isOneToOne: false
            referencedRelation: "short_links"
            referencedColumns: ["id"]
          },
        ]
      }
      short_links: {
        Row: {
          click_count: number | null
          company_id: string
          created_at: string | null
          created_by_id: string | null
          created_by_type: string
          custom_alias: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_clicked_at: string | null
          long_url: string
          max_clicks: number | null
          short_code: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          click_count?: number | null
          company_id: string
          created_at?: string | null
          created_by_id?: string | null
          created_by_type: string
          custom_alias?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_clicked_at?: string | null
          long_url: string
          max_clicks?: number | null
          short_code: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          click_count?: number | null
          company_id?: string
          created_at?: string | null
          created_by_id?: string | null
          created_by_type?: string
          custom_alias?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_clicked_at?: string | null
          long_url?: string
          max_clicks?: number | null
          short_code?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "short_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_documents: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          decline_reason: string | null
          declined_at: string | null
          document_name: string
          document_url: string
          id: string
          notes: string | null
          recipient_email: string
          recipient_name: string
          sent_at: string | null
          signed_at: string | null
          status: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          document_name: string
          document_url: string
          id?: string
          notes?: string | null
          recipient_email: string
          recipient_name: string
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          document_name?: string
          document_url?: string
          id?: string
          notes?: string | null
          recipient_email?: string
          recipient_name?: string
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_field_template_items: {
        Row: {
          company_id: string | null
          created_at: string
          field_label: string | null
          field_type: string
          height: number
          id: string
          is_required: boolean
          page_number: number
          signer_order: number
          template_id: string
          width: number
          x_position: number
          y_position: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          field_label?: string | null
          field_type?: string
          height?: number
          id?: string
          is_required?: boolean
          page_number?: number
          signer_order?: number
          template_id: string
          width?: number
          x_position: number
          y_position: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          field_label?: string | null
          field_type?: string
          height?: number
          id?: string
          is_required?: boolean
          page_number?: number
          signer_order?: number
          template_id?: string
          width?: number
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "signature_field_template_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_field_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "signature_field_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_field_templates: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_field_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_field_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signed_compliance_documents: {
        Row: {
          company_id: string | null
          created_at: string
          document_name: string
          document_type: string
          estimate_id: string
          file_url: string
          id: string
          ip_address: string | null
          project_id: string | null
          signature_data: string | null
          signature_font: string | null
          signature_type: string | null
          signed_at: string | null
          signed_file_url: string | null
          signer_email: string | null
          signer_name: string | null
          status: string
          template_id: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          document_name: string
          document_type?: string
          estimate_id: string
          file_url: string
          id?: string
          ip_address?: string | null
          project_id?: string | null
          signature_data?: string | null
          signature_font?: string | null
          signature_type?: string | null
          signed_at?: string | null
          signed_file_url?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          document_name?: string
          document_type?: string
          estimate_id?: string
          file_url?: string
          id?: string
          ip_address?: string | null
          project_id?: string | null
          signature_data?: string | null
          signature_font?: string | null
          signature_type?: string | null
          signed_at?: string | null
          signed_file_url?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signed_compliance_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_compliance_documents_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_compliance_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_compliance_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "compliance_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractors: {
        Row: {
          address: string | null
          company_id: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          do_not_require_insurance: boolean
          do_not_require_license: boolean
          email: string | null
          id: string
          insurance_document_url: string | null
          insurance_expiration_date: string | null
          is_active: boolean
          license_document_url: string | null
          license_expiration_date: string | null
          license_number: string | null
          notes: string | null
          phone: string | null
          subcontractor_type: string
          trade: string[] | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          do_not_require_insurance?: boolean
          do_not_require_license?: boolean
          email?: string | null
          id?: string
          insurance_document_url?: string | null
          insurance_expiration_date?: string | null
          is_active?: boolean
          license_document_url?: string | null
          license_expiration_date?: string | null
          license_number?: string | null
          notes?: string | null
          phone?: string | null
          subcontractor_type?: string
          trade?: string[] | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          do_not_require_insurance?: boolean
          do_not_require_license?: boolean
          email?: string | null
          id?: string
          insurance_document_url?: string | null
          insurance_expiration_date?: string | null
          is_active?: boolean
          license_document_url?: string | null
          license_expiration_date?: string | null
          license_number?: string | null
          notes?: string | null
          phone?: string | null
          subcontractor_type?: string
          trade?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontractors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_features: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          feature_key: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          feature_key: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          feature_key?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_users: number
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          sort_order: number
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_users?: number
          name: string
          price_monthly?: number
          price_yearly?: number
          slug: string
          sort_order?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_users?: number
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
          sort_order?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      task_edits: {
        Row: {
          company_id: string | null
          contact_ghl_id: string | null
          edited_at: string
          edited_by: string | null
          field_name: string
          id: string
          location_id: string | null
          new_value: string | null
          old_value: string | null
          task_ghl_id: string
        }
        Insert: {
          company_id?: string | null
          contact_ghl_id?: string | null
          edited_at?: string
          edited_by?: string | null
          field_name: string
          id?: string
          location_id?: string | null
          new_value?: string | null
          old_value?: string | null
          task_ghl_id: string
        }
        Update: {
          company_id?: string | null
          contact_ghl_id?: string | null
          edited_at?: string
          edited_by?: string | null
          field_name?: string
          id?: string
          location_id?: string | null
          new_value?: string | null
          old_value?: string | null
          task_ghl_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_edits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_analytics_permissions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_visible: boolean
          report_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_visible?: boolean
          report_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          report_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_analytics_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assign_role: {
        Args: {
          target_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      backfill_contact_addresses_from_projects: {
        Args: never
        Returns: {
          contacts_updated: number
          opportunities_updated: number
        }[]
      }
      backfill_contact_uuids: { Args: never; Returns: undefined }
      bulk_delete_junk_contacts: {
        Args: { p_company_id: string; p_contact_ids: string[] }
        Returns: Json
      }
      generate_company_encryption_key: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_company_encryption_key: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_ghl_api_key_encrypted: {
        Args: { p_integration_id: string }
        Returns: string
      }
      get_google_oauth_tokens: {
        Args: { p_connection_id: string }
        Returns: {
          access_token: string
          refresh_token: string
          token_expires_at: string
        }[]
      }
      get_next_queue_position: {
        Args: { p_company_id: string }
        Returns: number
      }
      get_quickbooks_tokens: {
        Args: { p_company_id: string }
        Returns: {
          access_token: string
          realm_id: string
          refresh_token: string
          token_expires_at: string
        }[]
      }
      get_resend_api_key_encrypted: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_scope_from_contact_attributions: {
        Args: { p_contact_id: string; p_contact_uuid: string }
        Returns: string
      }
      get_user_company_id: { Args: never; Returns: string }
      get_user_corporation_id: { Args: never; Returns: string }
      has_company_access: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_valid_portal_token_for_company: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      has_valid_salesperson_portal_token: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      has_valid_salesperson_portal_token_for_company: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_corp_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_description?: string
          p_new_values?: Json
          p_old_values?: Json
          p_record_id: string
          p_table_name: string
        }
        Returns: string
      }
      salesperson_portal_can_upload_to_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      soft_delete_early_stage_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      store_ghl_api_key_encrypted: {
        Args: { p_api_key: string; p_integration_id: string }
        Returns: boolean
      }
      store_google_oauth_tokens: {
        Args: {
          p_access_token: string
          p_connection_id: string
          p_expires_at: string
          p_refresh_token: string
        }
        Returns: boolean
      }
      store_quickbooks_tokens: {
        Args: {
          p_access_token: string
          p_company_id: string
          p_expires_at: string
          p_realm_id: string
          p_refresh_token: string
        }
        Returns: boolean
      }
      store_resend_api_key_encrypted: {
        Args: { p_api_key: string; p_company_id: string }
        Returns: boolean
      }
      user_in_corporation: { Args: { corp_id: string }; Returns: boolean }
      validate_portal_token: {
        Args: { p_token: string }
        Returns: {
          access_count: number
          client_email: string
          client_name: string
          company_id: string
          created_at: string
          created_by: string
          estimate_id: string
          expires_at: string
          id: string
          is_active: boolean
          last_accessed_at: string
          project_id: string
          token: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "magazine"
        | "production"
        | "dispatch"
        | "sales"
        | "contract_manager"
        | "corp_admin"
        | "corp_viewer"
      appointment_sync_source: "google" | "local" | "ghl"
      billing_cycle: "monthly" | "yearly"
      calendar_sync_direction: "import" | "export" | "bidirectional"
      estimate_line_item_type:
        | "labor"
        | "material"
        | "equipment"
        | "permit"
        | "assembly"
        | "note"
      estimate_status:
        | "draft"
        | "sent"
        | "viewed"
        | "needs_changes"
        | "accepted"
        | "declined"
        | "expired"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
        | "paused"
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
      app_role: [
        "super_admin",
        "admin",
        "magazine",
        "production",
        "dispatch",
        "sales",
        "contract_manager",
        "corp_admin",
        "corp_viewer",
      ],
      appointment_sync_source: ["google", "local", "ghl"],
      billing_cycle: ["monthly", "yearly"],
      calendar_sync_direction: ["import", "export", "bidirectional"],
      estimate_line_item_type: [
        "labor",
        "material",
        "equipment",
        "permit",
        "assembly",
        "note",
      ],
      estimate_status: [
        "draft",
        "sent",
        "viewed",
        "needs_changes",
        "accepted",
        "declined",
        "expired",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "expired",
        "paused",
      ],
    },
  },
} as const
