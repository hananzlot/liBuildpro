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
          edited_at: string | null
          edited_by: string | null
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
          edited_at?: string | null
          edited_by?: string | null
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
          edited_at?: string | null
          edited_by?: string | null
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
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changes: Json | null
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
          description?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      banks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
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
          bank_name: string | null
          bill_id: string
          created_at: string
          id: string
          payment_amount: number
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          updated_at: string
        }
        Insert: {
          bank_name?: string | null
          bill_id: string
          created_at?: string
          id?: string
          payment_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          updated_at?: string
        }
        Update: {
          bank_name?: string | null
          bill_id?: string
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
            foreignKeyName: "bill_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "project_bills"
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
      client_comments: {
        Row: {
          comment_text: string
          commenter_email: string | null
          commenter_name: string
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
            foreignKeyName: "commission_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          body: string | null
          contact_id: string
          created_at: string
          edited_at: string | null
          edited_by: string | null
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
          edited_at?: string | null
          edited_by?: string | null
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
          edited_at?: string | null
          edited_by?: string | null
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
      document_portal_tokens: {
        Row: {
          access_count: number | null
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
          document_id: string
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
          document_id: string
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
          document_id?: string
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
      estimate_attachments: {
        Row: {
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
      estimate_groups: {
        Row: {
          created_at: string
          description: string | null
          estimate_id: string
          group_name: string
          id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimate_id: string
          group_name: string
          id?: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          estimate_id?: string
          group_name?: string
          id?: string
          sort_order?: number | null
        }
        Relationships: [
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
          cost: number | null
          created_at: string
          description: string
          estimate_id: string
          group_id: string | null
          id: string
          is_taxable: boolean | null
          item_type: Database["public"]["Enums"]["estimate_line_item_type"]
          line_total: number | null
          markup_percent: number | null
          quantity: number | null
          sort_order: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description: string
          estimate_id: string
          group_id?: string | null
          id?: string
          is_taxable?: boolean | null
          item_type?: Database["public"]["Enums"]["estimate_line_item_type"]
          line_total?: number | null
          markup_percent?: number | null
          quantity?: number | null
          sort_order?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string
          estimate_id?: string
          group_id?: string | null
          id?: string
          is_taxable?: boolean | null
          item_type?: Database["public"]["Enums"]["estimate_line_item_type"]
          line_total?: number | null
          markup_percent?: number | null
          quantity?: number | null
          sort_order?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
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
            foreignKeyName: "estimate_payment_schedule_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_signatures: {
        Row: {
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
      estimates: {
        Row: {
          billing_address: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          decline_reason: string | null
          declined_at: string | null
          deposit_amount: number | null
          deposit_due_rule: string | null
          deposit_percent: number | null
          deposit_required: boolean | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          estimate_date: string
          estimate_number: number
          estimate_title: string
          expiration_date: string | null
          id: string
          job_address: string | null
          notes: string | null
          opportunity_id: string | null
          sent_at: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["estimate_status"]
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          terms_and_conditions: string | null
          total: number | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          billing_address?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deposit_amount?: number | null
          deposit_due_rule?: string | null
          deposit_percent?: number | null
          deposit_required?: boolean | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          estimate_date?: string
          estimate_number?: number
          estimate_title: string
          expiration_date?: string | null
          id?: string
          job_address?: string | null
          notes?: string | null
          opportunity_id?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_and_conditions?: string | null
          total?: number | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          billing_address?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deposit_amount?: number | null
          deposit_due_rule?: string | null
          deposit_percent?: number | null
          deposit_required?: boolean | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          estimate_date?: string
          estimate_number?: number
          estimate_title?: string
          expiration_date?: string | null
          id?: string
          job_address?: string | null
          notes?: string | null
          opportunity_id?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_and_conditions?: string | null
          total?: number | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
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
        ]
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
      ghl_pipelines: {
        Row: {
          created_at: string
          ghl_id: string
          id: string
          location_id: string
          name: string
          stages: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          ghl_id: string
          id?: string
          location_id: string
          name: string
          stages?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          ghl_id?: string
          id?: string
          location_id?: string
          name?: string
          stages?: Json
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
          edited_at: string | null
          edited_by: string | null
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
          edited_at?: string | null
          edited_by?: string | null
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
          edited_at?: string | null
          edited_by?: string | null
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
      magazine_sales: {
        Row: {
          ad_sold: string
          buyer_email: string | null
          buyer_name: string
          buyer_phone: string | null
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
          edited_at: string
          edited_by: string | null
          field_name: string
          id: string
          magazine_sale_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          edited_at?: string
          edited_by?: string | null
          field_name: string
          id?: string
          magazine_sale_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
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
      note_edits: {
        Row: {
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
          address: string | null
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
          scope_of_work: string | null
          stage_name: string | null
          status: string | null
          updated_at: string
          won_at: string | null
        }
        Insert: {
          address?: string | null
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
          scope_of_work?: string | null
          stage_name?: string | null
          status?: string | null
          updated_at?: string
          won_at?: string | null
        }
        Update: {
          address?: string | null
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
          scope_of_work?: string | null
          stage_name?: string | null
          status?: string | null
          updated_at?: string
          won_at?: string | null
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
      opportunity_sales: {
        Row: {
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
        Relationships: []
      }
      portal_view_logs: {
        Row: {
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
      project_agreements: {
        Row: {
          agreement_number: string | null
          agreement_signed_date: string | null
          agreement_type: string | null
          attachment_url: string | null
          average_lead_cost: number | null
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
          created_at: string | null
          id: string
          installer_company: string | null
          is_voided: boolean
          memo: string | null
          not_affecting_payment: boolean | null
          offset_bill_id: string | null
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
          created_at?: string | null
          id?: string
          installer_company?: string | null
          is_voided?: boolean
          memo?: string | null
          not_affecting_payment?: boolean | null
          offset_bill_id?: string | null
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
          created_at?: string | null
          id?: string
          installer_company?: string | null
          is_voided?: boolean
          memo?: string | null
          not_affecting_payment?: boolean | null
          offset_bill_id?: string | null
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
      project_cases: {
        Row: {
          case_number: string | null
          closed_at: string | null
          created_at: string | null
          created_by: string | null
          customer_status: string | null
          id: string
          notes: string | null
          project_id: string | null
        }
        Insert: {
          case_number?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_status?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
        }
        Update: {
          case_number?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_status?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_cases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_checklists: {
        Row: {
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
          created_at?: string | null
          id?: string
          project_id?: string | null
          salesperson?: string | null
          total_commission?: number | null
          updated_at?: string | null
        }
        Relationships: [
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
      project_documents: {
        Row: {
          category: string | null
          created_at: string | null
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
          created_at?: string | null
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
          created_at?: string | null
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
          created_at: string | null
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
          created_at?: string | null
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
          created_at?: string | null
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
          created_at: string
          created_by: string | null
          id: string
          note_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_id?: string
        }
        Relationships: [
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
          created_at: string
          created_by: string | null
          id: string
          note_text: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note_text: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note_text?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
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
      project_payment_phases: {
        Row: {
          agreement_id: string | null
          amount: number | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          phase_name: string
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          agreement_id?: string | null
          amount?: number | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          phase_name: string
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          agreement_id?: string | null
          amount?: number | null
          created_at?: string | null
          description?: string | null
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
          bank_name: string | null
          check_number: string | null
          created_at: string | null
          deposit_verified: boolean | null
          do_not_summarize: boolean | null
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
          bank_name?: string | null
          check_number?: string | null
          created_at?: string | null
          deposit_verified?: boolean | null
          do_not_summarize?: boolean | null
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
          bank_name?: string | null
          check_number?: string | null
          created_at?: string | null
          deposit_verified?: boolean | null
          do_not_summarize?: boolean | null
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
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
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
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
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
          branch: string | null
          cell_phone: string | null
          commission_split_pct: number | null
          completion_date: string | null
          contact_id: string | null
          contact_preferences: string | null
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
          branch?: string | null
          cell_phone?: string | null
          commission_split_pct?: number | null
          completion_date?: string | null
          contact_id?: string | null
          contact_preferences?: string | null
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
          branch?: string | null
          cell_phone?: string | null
          commission_split_pct?: number | null
          completion_date?: string | null
          contact_id?: string | null
          contact_preferences?: string | null
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
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_documents: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
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
            foreignKeyName: "signature_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractors: {
        Row: {
          address: string | null
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
            foreignKeyName: "subcontractors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_edits: {
        Row: {
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
      trades: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_created_by_fkey"
            columns: ["created_by"]
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
      ],
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
    },
  },
} as const
