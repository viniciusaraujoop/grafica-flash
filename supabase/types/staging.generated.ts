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
      admin_audit_logs: {
        Row: {
          action: string
          admin_email: string
          created_at: string | null
          id: string
          metadata: Json | null
          payload: Json
          target_id: string | null
          target_label: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_email: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payload?: Json
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_email?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payload?: Json
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_bug_reports: {
        Row: {
          affected_field: string | null
          affected_table: string | null
          area: string
          auto_fixable: boolean
          category: string
          code: string
          description: string | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          fingerprint: string
          first_seen_at: string | null
          fix_route: string | null
          fix_sql: string | null
          fix_steps: Json
          id: string
          last_seen_at: string | null
          metadata: Json
          occurrences: number
          record_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          suggested_action: string | null
          table_name: string | null
          title: string
        }
        Insert: {
          affected_field?: string | null
          affected_table?: string | null
          area?: string
          auto_fixable?: boolean
          category: string
          code: string
          description?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          fingerprint: string
          first_seen_at?: string | null
          fix_route?: string | null
          fix_sql?: string | null
          fix_steps?: Json
          id?: string
          last_seen_at?: string | null
          metadata?: Json
          occurrences?: number
          record_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          suggested_action?: string | null
          table_name?: string | null
          title: string
        }
        Update: {
          affected_field?: string | null
          affected_table?: string | null
          area?: string
          auto_fixable?: boolean
          category?: string
          code?: string
          description?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          fingerprint?: string
          first_seen_at?: string | null
          fix_route?: string | null
          fix_sql?: string | null
          fix_steps?: Json
          id?: string
          last_seen_at?: string | null
          metadata?: Json
          occurrences?: number
          record_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          suggested_action?: string | null
          table_name?: string | null
          title?: string
        }
        Relationships: []
      }
      admin_scan_runs: {
        Row: {
          created_by: string | null
          critical_count: number
          finished_at: string | null
          high_count: number
          id: string
          low_count: number
          medium_count: number
          started_at: string | null
          status: string
          summary: Json
          total_issues: number
        }
        Insert: {
          created_by?: string | null
          critical_count?: number
          finished_at?: string | null
          high_count?: number
          id?: string
          low_count?: number
          medium_count?: number
          started_at?: string | null
          status?: string
          summary?: Json
          total_issues?: number
        }
        Update: {
          created_by?: string | null
          critical_count?: number
          finished_at?: string | null
          high_count?: number
          id?: string
          low_count?: number
          medium_count?: number
          started_at?: string | null
          status?: string
          summary?: Json
          total_issues?: number
        }
        Relationships: []
      }
      admin_system_snapshots: {
        Row: {
          bugs_green: number | null
          bugs_red: number | null
          bugs_yellow: number | null
          companies_active: number | null
          companies_overdue: number | null
          companies_total: number | null
          created_at: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          bugs_green?: number | null
          bugs_red?: number | null
          bugs_yellow?: number | null
          companies_active?: number | null
          companies_overdue?: number | null
          companies_total?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          bugs_green?: number | null
          bugs_red?: number | null
          bugs_yellow?: number | null
          companies_active?: number | null
          companies_overdue?: number | null
          companies_total?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          area: string | null
          ativo: boolean
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          nome: string | null
          observacoes: string | null
          permissions: Json
          role: string
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          ativo?: boolean
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          nome?: string | null
          observacoes?: string | null
          permissions?: Json
          role?: string
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          ativo?: boolean
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          nome?: string | null
          observacoes?: string | null
          permissions?: Json
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      affiliate_achievements: {
        Row: {
          achievement_id: string
          affiliate_id: string
          id: string
          metadata: Json
          title: string
          unlocked_at: string
        }
        Insert: {
          achievement_id: string
          affiliate_id: string
          id?: string
          metadata?: Json
          title: string
          unlocked_at?: string
        }
        Update: {
          achievement_id?: string
          affiliate_id?: string
          id?: string
          metadata?: Json
          title?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_achievements_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_activity_events: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          kind: string
          lead_id: string | null
          metadata: Json
          xp: number
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          kind: string
          lead_id?: string | null
          metadata?: Json
          xp?: number
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          metadata?: Json
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_activity_events_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_activity_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "affiliate_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_announcements: {
        Row: {
          body: string
          created_at: string
          cta_href: string | null
          cta_label: string | null
          id: string
          is_active: boolean
          kind: string
          published_at: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          published_at?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          published_at?: string
          title?: string
        }
        Relationships: []
      }
      affiliate_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          affiliate_id: string | null
          created_at: string
          id: string
          ip_hash: string | null
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          affiliate_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          affiliate_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_audit_logs_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_certifications: {
        Row: {
          affiliate_id: string
          certification_id: string
          expires_at: string | null
          id: string
          issued_at: string
          metadata: Json
          score: number
          status: string
          title: string
        }
        Insert: {
          affiliate_id: string
          certification_id: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          metadata?: Json
          score: number
          status?: string
          title: string
        }
        Update: {
          affiliate_id?: string
          certification_id?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          metadata?: Json
          score?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_certifications_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          code_snapshot: string
          created_at: string
          id: string
          ip_hash: string | null
          landing_path: string | null
          referrer_host: string | null
          session_hash: string | null
          user_agent_hash: string | null
        }
        Insert: {
          affiliate_id: string
          code_snapshot: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          referrer_host?: string | null
          session_hash?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          affiliate_id?: string
          code_snapshot?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          referrer_host?: string | null
          session_hash?: string | null
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          available_at: string | null
          commission_amount: number
          commission_rate: number
          company_id: string
          created_at: string
          eligible_amount: number
          gross_amount: number
          hold_until: string | null
          id: string
          payout_id: string | null
          plan: string
          plan_payment_id: string | null
          provider_payment_id: string
          referral_id: string
          reversal_reason: string | null
          reversed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          available_at?: string | null
          commission_amount: number
          commission_rate: number
          company_id: string
          created_at?: string
          eligible_amount: number
          gross_amount: number
          hold_until?: string | null
          id?: string
          payout_id?: string | null
          plan: string
          plan_payment_id?: string | null
          provider_payment_id: string
          referral_id: string
          reversal_reason?: string | null
          reversed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          available_at?: string | null
          commission_amount?: number
          commission_rate?: number
          company_id?: string
          created_at?: string
          eligible_amount?: number
          gross_amount?: number
          hold_until?: string | null
          id?: string
          payout_id?: string | null
          plan?: string
          plan_payment_id?: string | null
          provider_payment_id?: string
          referral_id?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "affiliate_commissions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "affiliate_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_plan_payment_id_fkey"
            columns: ["plan_payment_id"]
            isOneToOne: false
            referencedRelation: "plan_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: true
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_course_progress: {
        Row: {
          affiliate_id: string
          completed_at: string
          course_id: string
          created_at: string
          id: string
          lesson_id: string
          score: number | null
        }
        Insert: {
          affiliate_id: string
          completed_at?: string
          course_id: string
          created_at?: string
          id?: string
          lesson_id: string
          score?: number | null
        }
        Update: {
          affiliate_id?: string
          completed_at?: string
          course_id?: string
          created_at?: string
          id?: string
          lesson_id?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_course_progress_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_goals: {
        Row: {
          affiliate_id: string
          contacts_target: number
          content_target: number
          created_at: string
          customers_target: number
          demos_target: number
          id: string
          period_start: string
          study_target: number
          trials_target: number
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          contacts_target?: number
          content_target?: number
          created_at?: string
          customers_target?: number
          demos_target?: number
          id?: string
          period_start: string
          study_target?: number
          trials_target?: number
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          contacts_target?: number
          content_target?: number
          created_at?: string
          customers_target?: number
          demos_target?: number
          id?: string
          period_start?: string
          study_target?: number
          trials_target?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_goals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_leads: {
        Row: {
          affiliate_id: string
          company_name: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          estimated_plan: string | null
          estimated_value: number
          id: string
          lost_reason: string | null
          name: string
          next_follow_up_at: string | null
          notes: string | null
          segment: string
          source: string
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          affiliate_id: string
          company_name?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          estimated_plan?: string | null
          estimated_value?: number
          id?: string
          lost_reason?: string | null
          name: string
          next_follow_up_at?: string | null
          notes?: string | null
          segment?: string
          source?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          affiliate_id?: string
          company_name?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          estimated_plan?: string | null
          estimated_value?: number
          id?: string
          lost_reason?: string | null
          name?: string
          next_follow_up_at?: string | null
          notes?: string | null
          segment?: string
          source?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payout_items: {
        Row: {
          amount: number
          commission_id: string
          created_at: string
          payout_id: string
        }
        Insert: {
          amount: number
          commission_id: string
          created_at?: string
          payout_id: string
        }
        Update: {
          amount?: number
          commission_id?: string
          created_at?: string
          payout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payout_items_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: true
            referencedRelation: "affiliate_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payout_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "affiliate_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          admin_note: string | null
          affiliate_id: string
          amount: number
          approved_at: string | null
          cancelled_at: string | null
          created_at: string
          debt_offset: number
          external_reference: string
          failed_at: string | null
          failure_reason: string | null
          gross_commissions: number
          holder_name: string
          id: string
          paid_at: string | null
          pix_key_masked: string
          pix_key_type: string
          processing_at: string | null
          proof_url: string | null
          provider: string
          provider_transfer_id: string | null
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          affiliate_id: string
          amount: number
          approved_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          debt_offset?: number
          external_reference: string
          failed_at?: string | null
          failure_reason?: string | null
          gross_commissions?: number
          holder_name: string
          id?: string
          paid_at?: string | null
          pix_key_masked: string
          pix_key_type: string
          processing_at?: string | null
          proof_url?: string | null
          provider?: string
          provider_transfer_id?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          affiliate_id?: string
          amount?: number
          approved_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          debt_offset?: number
          external_reference?: string
          failed_at?: string | null
          failure_reason?: string | null
          gross_commissions?: number
          holder_name?: string
          id?: string
          paid_at?: string | null
          pix_key_masked?: string
          pix_key_type?: string
          processing_at?: string | null
          proof_url?: string | null
          provider?: string
          provider_transfer_id?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_profiles: {
        Row: {
          approved_at: string | null
          code: string
          commission_rate: number
          created_at: string
          debt_balance: number
          document_hash: string
          document_last4: string
          document_type: string
          email: string
          id: string
          last_login_at: string | null
          marketing_opt_in: boolean
          name: string
          payout_status: string
          status: string
          suspended_at: string | null
          suspension_reason: string | null
          terms_accepted_at: string
          terms_version: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          approved_at?: string | null
          code: string
          commission_rate?: number
          created_at?: string
          debt_balance?: number
          document_hash: string
          document_last4: string
          document_type: string
          email: string
          id?: string
          last_login_at?: string | null
          marketing_opt_in?: boolean
          name: string
          payout_status?: string
          status?: string
          suspended_at?: string | null
          suspension_reason?: string | null
          terms_accepted_at: string
          terms_version: string
          updated_at?: string
          user_id: string
          whatsapp: string
        }
        Update: {
          approved_at?: string | null
          code?: string
          commission_rate?: number
          created_at?: string
          debt_balance?: number
          document_hash?: string
          document_last4?: string
          document_type?: string
          email?: string
          id?: string
          last_login_at?: string | null
          marketing_opt_in?: boolean
          name?: string
          payout_status?: string
          status?: string
          suspended_at?: string | null
          suspension_reason?: string | null
          terms_accepted_at?: string
          terms_version?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      affiliate_program_settings: {
        Row: {
          attribution_days: number
          automatic_payout_enabled: boolean
          commission_rate: number
          hold_days: number
          id: number
          minimum_payout_amount: number
          payouts_enabled: boolean
          terms_version: string
          updated_at: string
        }
        Insert: {
          attribution_days?: number
          automatic_payout_enabled?: boolean
          commission_rate?: number
          hold_days?: number
          id?: number
          minimum_payout_amount?: number
          payouts_enabled?: boolean
          terms_version?: string
          updated_at?: string
        }
        Update: {
          attribution_days?: number
          automatic_payout_enabled?: boolean
          commission_rate?: number
          hold_days?: number
          id?: number
          minimum_payout_amount?: number
          payouts_enabled?: boolean
          terms_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          commission_expected: number
          company_id: string | null
          created_at: string
          customer_document_hash: string | null
          customer_email_masked: string | null
          customer_name_masked: string | null
          customer_whatsapp_hash: string | null
          device_hash: string | null
          first_payment_amount: number | null
          first_payment_reference: string | null
          id: string
          ip_hash: string | null
          plan: string | null
          qualified_at: string | null
          referral_code: string
          registered_at: string
          rejected_at: string | null
          rejection_reason: string | null
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          signup_lead_id: string | null
          source: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          commission_expected?: number
          company_id?: string | null
          created_at?: string
          customer_document_hash?: string | null
          customer_email_masked?: string | null
          customer_name_masked?: string | null
          customer_whatsapp_hash?: string | null
          device_hash?: string | null
          first_payment_amount?: number | null
          first_payment_reference?: string | null
          id?: string
          ip_hash?: string | null
          plan?: string | null
          qualified_at?: string | null
          referral_code: string
          registered_at?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          signup_lead_id?: string | null
          source?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          commission_expected?: number
          company_id?: string | null
          created_at?: string
          customer_document_hash?: string | null
          customer_email_masked?: string | null
          customer_name_masked?: string | null
          customer_whatsapp_hash?: string | null
          device_hash?: string | null
          first_payment_amount?: number | null
          first_payment_reference?: string | null
          id?: string
          ip_hash?: string | null
          plan?: string | null
          qualified_at?: string | null
          referral_code?: string
          registered_at?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          signup_lead_id?: string | null
          source?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "affiliate_referrals_signup_lead_id_fkey"
            columns: ["signup_lead_id"]
            isOneToOne: true
            referencedRelation: "admin_signup_leads_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_signup_lead_id_fkey"
            columns: ["signup_lead_id"]
            isOneToOne: true
            referencedRelation: "signup_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_tasks: {
        Row: {
          affiliate_id: string
          completed_at: string | null
          created_at: string
          due_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          priority: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          priority?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          priority?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_tasks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "affiliate_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_training_sessions: {
        Row: {
          affiliate_id: string
          answer: string | null
          completed_at: string
          created_at: string
          feedback: string | null
          id: string
          mode: string
          scenario_id: string
          score_json: Json
          total_score: number
        }
        Insert: {
          affiliate_id: string
          answer?: string | null
          completed_at?: string
          created_at?: string
          feedback?: string | null
          id?: string
          mode: string
          scenario_id: string
          score_json?: Json
          total_score?: number
        }
        Update: {
          affiliate_id?: string
          answer?: string | null
          completed_at?: string
          created_at?: string
          feedback?: string | null
          id?: string
          mode?: string
          scenario_id?: string
          score_json?: Json
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_training_sessions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          company_id: string
          created_at: string
          id: string
          link_url: string | null
          mensagem: string | null
          payload: Json
          read_at: string | null
          status: string
          tipo: string
          titulo: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          link_url?: string | null
          mensagem?: string | null
          payload?: Json
          read_at?: string | null
          status?: string
          tipo?: string
          titulo: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          link_url?: string | null
          mensagem?: string | null
          payload?: Json
          read_at?: string | null
          status?: string
          tipo?: string
          titulo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      application_error_events: {
        Row: {
          actor_user_id: string | null
          company_id: string | null
          created_at: string
          deployment: string | null
          environment: string
          error_code: string | null
          error_id: string
          error_type: string
          http_status: number | null
          id: string
          message_sanitized: string | null
          metadata: Json
          operation: string
          request_id: string
          route: string
          stack_sanitized: string | null
        }
        Insert: {
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          deployment?: string | null
          environment?: string
          error_code?: string | null
          error_id: string
          error_type: string
          http_status?: number | null
          id?: string
          message_sanitized?: string | null
          metadata?: Json
          operation: string
          request_id: string
          route: string
          stack_sanitized?: string | null
        }
        Update: {
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          deployment?: string | null
          environment?: string
          error_code?: string | null
          error_id?: string
          error_type?: string
          http_status?: number | null
          id?: string
          message_sanitized?: string | null
          metadata?: Json
          operation?: string
          request_id?: string
          route?: string
          stack_sanitized?: string | null
        }
        Relationships: []
      }
      art_approval_requests: {
        Row: {
          approved_at: string | null
          artwork_url: string | null
          cliente_nome: string | null
          cliente_whatsapp: string | null
          comentario_cliente: string | null
          company_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          instructions: string | null
          internal_notes: string | null
          order_id: string | null
          preview_url: string | null
          produto_nome: string | null
          proposal_id: string | null
          requested_changes_at: string | null
          responded_at: string | null
          revoked_at: string | null
          status: string
          title: string | null
          token: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          artwork_url?: string | null
          cliente_nome?: string | null
          cliente_whatsapp?: string | null
          comentario_cliente?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          instructions?: string | null
          internal_notes?: string | null
          order_id?: string | null
          preview_url?: string | null
          produto_nome?: string | null
          proposal_id?: string | null
          requested_changes_at?: string | null
          responded_at?: string | null
          revoked_at?: string | null
          status?: string
          title?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          artwork_url?: string | null
          cliente_nome?: string | null
          cliente_whatsapp?: string | null
          comentario_cliente?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          instructions?: string | null
          internal_notes?: string | null
          order_id?: string | null
          preview_url?: string | null
          produto_nome?: string | null
          proposal_id?: string | null
          requested_changes_at?: string | null
          responded_at?: string | null
          revoked_at?: string | null
          status?: string
          title?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "art_approval_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "art_approval_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "art_approval_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "art_approval_requests_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "art_approval_requests_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_events: {
        Row: {
          completion_tokens: number | null
          created_at: string
          event_name: string
          id: string
          latency_ms: number | null
          metadata: Json
          model: string | null
          page_path: string | null
          prompt_tokens: number | null
          recommended_plan: string | null
          request_id: string
          segment: string | null
          session_hash: string
          status: string | null
          tool_name: string | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          event_name: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          page_path?: string | null
          prompt_tokens?: number | null
          recommended_plan?: string | null
          request_id: string
          segment?: string | null
          session_hash: string
          status?: string | null
          tool_name?: string | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          event_name?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          page_path?: string | null
          prompt_tokens?: number | null
          recommended_plan?: string | null
          request_id?: string
          segment?: string | null
          session_hash?: string
          status?: string | null
          tool_name?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          actions: Json
          company_id: string
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          id: string
          name: string
          trigger_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actions?: Json
          company_id: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          trigger_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actions?: Json
          company_id?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          trigger_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          attempts: number
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          input: Json
          last_error: string | null
          max_attempts: number
          outbox_event_id: string | null
          result: Json
          rule_id: string
          run_key: string
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          company_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          input?: Json
          last_error?: string | null
          max_attempts?: number
          outbox_event_id?: string | null
          result?: Json
          rule_id: string
          run_key: string
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          input?: Json
          last_error?: string | null
          max_attempts?: number
          outbox_event_id?: string | null
          result?: Json
          rule_id?: string
          run_key?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "automation_runs_outbox_event_id_fkey"
            columns: ["outbox_event_id"]
            isOneToOne: false
            referencedRelation: "transactional_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      background_jobs: {
        Row: {
          attempts: number
          company_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          metadata: Json
          payload: Json
          run_after: string
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          metadata?: Json
          payload?: Json
          run_after?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          metadata?: Json
          payload?: Json
          run_after?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      business_hours: {
        Row: {
          active: boolean | null
          break_end: string | null
          break_start: string | null
          close_time: string | null
          closed_message: string | null
          closes_at: string | null
          company_id: string | null
          created_at: string | null
          id: string
          is_active: boolean
          is_open: boolean | null
          open_time: string | null
          opens_at: string | null
          updated_at: string | null
          weekday: number
        }
        Insert: {
          active?: boolean | null
          break_end?: string | null
          break_start?: string | null
          close_time?: string | null
          closed_message?: string | null
          closes_at?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          is_open?: boolean | null
          open_time?: string | null
          opens_at?: string | null
          updated_at?: string | null
          weekday: number
        }
        Update: {
          active?: boolean | null
          break_end?: string | null
          break_start?: string | null
          close_time?: string | null
          closed_message?: string | null
          closes_at?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          is_open?: boolean | null
          open_time?: string | null
          opens_at?: string | null
          updated_at?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      companies: {
        Row: {
          access_until: string | null
          aceita_cartao: boolean | null
          aceita_pix: boolean | null
          assinatura_auto_recorrente: boolean | null
          assinatura_cancelada_em: string | null
          assinatura_checkout_url: string | null
          assinatura_expira_em: string | null
          assinatura_forma_pagamento_preferida: string | null
          assinatura_inicio: string | null
          assinatura_mp_payload: Json | null
          assinatura_pix_avulso_status: string | null
          assinatura_pix_avulso_ultimo_pagamento: string | null
          assinatura_plano: string | null
          assinatura_proxima_cobranca: string | null
          assinatura_status: string | null
          assinatura_ultimo_pagamento: string | null
          atendimento_horario: string | null
          atendimento_observacao: string | null
          ativo: boolean | null
          banner_url: string | null
          business_type: string | null
          cancel_at_period_end: boolean
          cidade: string | null
          cobrar_sinal: boolean | null
          cor_principal: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          founder_billing_attempts: number
          founder_billing_authorized_at: string | null
          founder_billing_claim_id: string | null
          founder_billing_claimed_at: string | null
          founder_billing_last_error: string | null
          founder_billing_last_sync_at: string | null
          founder_billing_setup_at: string | null
          founder_number: number | null
          founder_price_cents: number | null
          founder_price_conversion_attempts: number
          founder_price_conversion_claim_id: string | null
          founder_price_conversion_claimed_at: string | null
          founder_price_conversion_last_error: string | null
          founder_price_converted_at: string | null
          founder_price_ends_at: string | null
          founder_started_at: string | null
          founder_trial_ends_at: string | null
          founder_welcome_seen_at: string | null
          id: string
          instagram: string | null
          is_founder: boolean
          logo_url: string | null
          marketplace_ativo: boolean | null
          marketplace_banner_url: string | null
          marketplace_config: Json | null
          marketplace_endereco: string | null
          marketplace_mapa_url: string | null
          marketplace_sobre: string | null
          marketplace_subtitulo: string | null
          marketplace_termos: string | null
          marketplace_texto_botao: string | null
          marketplace_titulo: string | null
          mercado_pago_customer_email: string | null
          mercado_pago_subscription_id: string | null
          mercado_pago_subscription_status: string | null
          modelo_campos_recomendados: string[] | null
          modelo_mensagens: Json | null
          modelo_negocio: string | null
          modelo_nome: string | null
          modelo_perguntas: Json | null
          modelo_proposta: Json | null
          modelo_status: string[] | null
          next_billing_at: string | null
          nome: string
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_current_step: number | null
          onboarding_dismissed: boolean | null
          onboarding_goal: string | null
          onboarding_updated_at: string | null
          owner_id: string | null
          percentual_sinal: number | null
          pix_cidade: string | null
          pix_key: string | null
          pix_nome: string | null
          pix_tipo: string | null
          plano: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          segmento: string | null
          site_about_text: string | null
          site_about_title: string | null
          site_accent_color: string | null
          site_art_style: string | null
          site_art_variant: string | null
          site_background_color: string | null
          site_badge_text: string | null
          site_banner_url: string | null
          site_benefits: Json | null
          site_brand_words: string[] | null
          site_business_hours: Json | null
          site_button_style: string | null
          site_card_color: string | null
          site_cart_button_text: string | null
          site_checkout_button_text: string | null
          site_checkout_mode: string | null
          site_config: Json | null
          site_contact_title: string | null
          site_corner_style: string | null
          site_cta_label: string | null
          site_cta_text: string | null
          site_custom_sections: Json | null
          site_delivery_options: string[] | null
          site_density: string | null
          site_empty_catalog_text: string | null
          site_enable_cart: boolean | null
          site_enable_coupons: boolean | null
          site_faq: Json | null
          site_features: Json | null
          site_font_style: string | null
          site_footer_text: string | null
          site_gallery: Json | null
          site_headline: string | null
          site_hero_alignment: string | null
          site_hero_highlights: Json | null
          site_hero_style: string | null
          site_keywords: string[] | null
          site_layout: string | null
          site_marketplace_subtitle: string | null
          site_marketplace_title: string | null
          site_nav_variant: string | null
          site_payment_methods: string[] | null
          site_primary_color: string | null
          site_product_card_style: string | null
          site_promo_active: boolean | null
          site_promo_button_text: string | null
          site_promo_text: string | null
          site_promo_title: string | null
          site_publico_ativo: boolean | null
          site_secondary_cta_text: string | null
          site_section_style: string | null
          site_sections: Json | null
          site_seo_description: string | null
          site_seo_title: string | null
          site_services_title: string | null
          site_show_about: boolean | null
          site_show_benefits: boolean | null
          site_show_contact: boolean | null
          site_show_faq: boolean | null
          site_show_featured: boolean | null
          site_show_gallery: boolean | null
          site_show_marketplace: boolean | null
          site_show_prices: boolean | null
          site_show_store: boolean | null
          site_show_testimonials: boolean | null
          site_status: string | null
          site_subheadline: string | null
          site_template: string | null
          site_testimonials: Json | null
          site_text_color: string | null
          site_theme: string | null
          site_trust_title: string | null
          site_updated_at: string | null
          site_whatsapp_message: string | null
          slug: string
          subdomain_slug: string | null
          subscription_provider: string | null
          telefone: string | null
          tester_id: string | null
          timezone: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_used_at: string | null
          updated_at: string | null
          whatsapp: string | null
          whatsapp_access_token: string | null
          whatsapp_ai_enabled: boolean | null
          whatsapp_ai_prompt: string | null
          whatsapp_auto_reply_enabled: boolean | null
          whatsapp_business_account_id: string | null
          whatsapp_enabled: boolean | null
          whatsapp_order_notifications: boolean | null
          whatsapp_phone_number_id: string | null
          whatsapp_status_notifications: boolean | null
          whatsapp_verify_token: string | null
        }
        Insert: {
          access_until?: string | null
          aceita_cartao?: boolean | null
          aceita_pix?: boolean | null
          assinatura_auto_recorrente?: boolean | null
          assinatura_cancelada_em?: string | null
          assinatura_checkout_url?: string | null
          assinatura_expira_em?: string | null
          assinatura_forma_pagamento_preferida?: string | null
          assinatura_inicio?: string | null
          assinatura_mp_payload?: Json | null
          assinatura_pix_avulso_status?: string | null
          assinatura_pix_avulso_ultimo_pagamento?: string | null
          assinatura_plano?: string | null
          assinatura_proxima_cobranca?: string | null
          assinatura_status?: string | null
          assinatura_ultimo_pagamento?: string | null
          atendimento_horario?: string | null
          atendimento_observacao?: string | null
          ativo?: boolean | null
          banner_url?: string | null
          business_type?: string | null
          cancel_at_period_end?: boolean
          cidade?: string | null
          cobrar_sinal?: boolean | null
          cor_principal?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          founder_billing_attempts?: number
          founder_billing_authorized_at?: string | null
          founder_billing_claim_id?: string | null
          founder_billing_claimed_at?: string | null
          founder_billing_last_error?: string | null
          founder_billing_last_sync_at?: string | null
          founder_billing_setup_at?: string | null
          founder_number?: number | null
          founder_price_cents?: number | null
          founder_price_conversion_attempts?: number
          founder_price_conversion_claim_id?: string | null
          founder_price_conversion_claimed_at?: string | null
          founder_price_conversion_last_error?: string | null
          founder_price_converted_at?: string | null
          founder_price_ends_at?: string | null
          founder_started_at?: string | null
          founder_trial_ends_at?: string | null
          founder_welcome_seen_at?: string | null
          id?: string
          instagram?: string | null
          is_founder?: boolean
          logo_url?: string | null
          marketplace_ativo?: boolean | null
          marketplace_banner_url?: string | null
          marketplace_config?: Json | null
          marketplace_endereco?: string | null
          marketplace_mapa_url?: string | null
          marketplace_sobre?: string | null
          marketplace_subtitulo?: string | null
          marketplace_termos?: string | null
          marketplace_texto_botao?: string | null
          marketplace_titulo?: string | null
          mercado_pago_customer_email?: string | null
          mercado_pago_subscription_id?: string | null
          mercado_pago_subscription_status?: string | null
          modelo_campos_recomendados?: string[] | null
          modelo_mensagens?: Json | null
          modelo_negocio?: string | null
          modelo_nome?: string | null
          modelo_perguntas?: Json | null
          modelo_proposta?: Json | null
          modelo_status?: string[] | null
          next_billing_at?: string | null
          nome: string
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_current_step?: number | null
          onboarding_dismissed?: boolean | null
          onboarding_goal?: string | null
          onboarding_updated_at?: string | null
          owner_id?: string | null
          percentual_sinal?: number | null
          pix_cidade?: string | null
          pix_key?: string | null
          pix_nome?: string | null
          pix_tipo?: string | null
          plano?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          segmento?: string | null
          site_about_text?: string | null
          site_about_title?: string | null
          site_accent_color?: string | null
          site_art_style?: string | null
          site_art_variant?: string | null
          site_background_color?: string | null
          site_badge_text?: string | null
          site_banner_url?: string | null
          site_benefits?: Json | null
          site_brand_words?: string[] | null
          site_business_hours?: Json | null
          site_button_style?: string | null
          site_card_color?: string | null
          site_cart_button_text?: string | null
          site_checkout_button_text?: string | null
          site_checkout_mode?: string | null
          site_config?: Json | null
          site_contact_title?: string | null
          site_corner_style?: string | null
          site_cta_label?: string | null
          site_cta_text?: string | null
          site_custom_sections?: Json | null
          site_delivery_options?: string[] | null
          site_density?: string | null
          site_empty_catalog_text?: string | null
          site_enable_cart?: boolean | null
          site_enable_coupons?: boolean | null
          site_faq?: Json | null
          site_features?: Json | null
          site_font_style?: string | null
          site_footer_text?: string | null
          site_gallery?: Json | null
          site_headline?: string | null
          site_hero_alignment?: string | null
          site_hero_highlights?: Json | null
          site_hero_style?: string | null
          site_keywords?: string[] | null
          site_layout?: string | null
          site_marketplace_subtitle?: string | null
          site_marketplace_title?: string | null
          site_nav_variant?: string | null
          site_payment_methods?: string[] | null
          site_primary_color?: string | null
          site_product_card_style?: string | null
          site_promo_active?: boolean | null
          site_promo_button_text?: string | null
          site_promo_text?: string | null
          site_promo_title?: string | null
          site_publico_ativo?: boolean | null
          site_secondary_cta_text?: string | null
          site_section_style?: string | null
          site_sections?: Json | null
          site_seo_description?: string | null
          site_seo_title?: string | null
          site_services_title?: string | null
          site_show_about?: boolean | null
          site_show_benefits?: boolean | null
          site_show_contact?: boolean | null
          site_show_faq?: boolean | null
          site_show_featured?: boolean | null
          site_show_gallery?: boolean | null
          site_show_marketplace?: boolean | null
          site_show_prices?: boolean | null
          site_show_store?: boolean | null
          site_show_testimonials?: boolean | null
          site_status?: string | null
          site_subheadline?: string | null
          site_template?: string | null
          site_testimonials?: Json | null
          site_text_color?: string | null
          site_theme?: string | null
          site_trust_title?: string | null
          site_updated_at?: string | null
          site_whatsapp_message?: string | null
          slug: string
          subdomain_slug?: string | null
          subscription_provider?: string | null
          telefone?: string | null
          tester_id?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_used_at?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_access_token?: string | null
          whatsapp_ai_enabled?: boolean | null
          whatsapp_ai_prompt?: string | null
          whatsapp_auto_reply_enabled?: boolean | null
          whatsapp_business_account_id?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_order_notifications?: boolean | null
          whatsapp_phone_number_id?: string | null
          whatsapp_status_notifications?: boolean | null
          whatsapp_verify_token?: string | null
        }
        Update: {
          access_until?: string | null
          aceita_cartao?: boolean | null
          aceita_pix?: boolean | null
          assinatura_auto_recorrente?: boolean | null
          assinatura_cancelada_em?: string | null
          assinatura_checkout_url?: string | null
          assinatura_expira_em?: string | null
          assinatura_forma_pagamento_preferida?: string | null
          assinatura_inicio?: string | null
          assinatura_mp_payload?: Json | null
          assinatura_pix_avulso_status?: string | null
          assinatura_pix_avulso_ultimo_pagamento?: string | null
          assinatura_plano?: string | null
          assinatura_proxima_cobranca?: string | null
          assinatura_status?: string | null
          assinatura_ultimo_pagamento?: string | null
          atendimento_horario?: string | null
          atendimento_observacao?: string | null
          ativo?: boolean | null
          banner_url?: string | null
          business_type?: string | null
          cancel_at_period_end?: boolean
          cidade?: string | null
          cobrar_sinal?: boolean | null
          cor_principal?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          founder_billing_attempts?: number
          founder_billing_authorized_at?: string | null
          founder_billing_claim_id?: string | null
          founder_billing_claimed_at?: string | null
          founder_billing_last_error?: string | null
          founder_billing_last_sync_at?: string | null
          founder_billing_setup_at?: string | null
          founder_number?: number | null
          founder_price_cents?: number | null
          founder_price_conversion_attempts?: number
          founder_price_conversion_claim_id?: string | null
          founder_price_conversion_claimed_at?: string | null
          founder_price_conversion_last_error?: string | null
          founder_price_converted_at?: string | null
          founder_price_ends_at?: string | null
          founder_started_at?: string | null
          founder_trial_ends_at?: string | null
          founder_welcome_seen_at?: string | null
          id?: string
          instagram?: string | null
          is_founder?: boolean
          logo_url?: string | null
          marketplace_ativo?: boolean | null
          marketplace_banner_url?: string | null
          marketplace_config?: Json | null
          marketplace_endereco?: string | null
          marketplace_mapa_url?: string | null
          marketplace_sobre?: string | null
          marketplace_subtitulo?: string | null
          marketplace_termos?: string | null
          marketplace_texto_botao?: string | null
          marketplace_titulo?: string | null
          mercado_pago_customer_email?: string | null
          mercado_pago_subscription_id?: string | null
          mercado_pago_subscription_status?: string | null
          modelo_campos_recomendados?: string[] | null
          modelo_mensagens?: Json | null
          modelo_negocio?: string | null
          modelo_nome?: string | null
          modelo_perguntas?: Json | null
          modelo_proposta?: Json | null
          modelo_status?: string[] | null
          next_billing_at?: string | null
          nome?: string
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_current_step?: number | null
          onboarding_dismissed?: boolean | null
          onboarding_goal?: string | null
          onboarding_updated_at?: string | null
          owner_id?: string | null
          percentual_sinal?: number | null
          pix_cidade?: string | null
          pix_key?: string | null
          pix_nome?: string | null
          pix_tipo?: string | null
          plano?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          segmento?: string | null
          site_about_text?: string | null
          site_about_title?: string | null
          site_accent_color?: string | null
          site_art_style?: string | null
          site_art_variant?: string | null
          site_background_color?: string | null
          site_badge_text?: string | null
          site_banner_url?: string | null
          site_benefits?: Json | null
          site_brand_words?: string[] | null
          site_business_hours?: Json | null
          site_button_style?: string | null
          site_card_color?: string | null
          site_cart_button_text?: string | null
          site_checkout_button_text?: string | null
          site_checkout_mode?: string | null
          site_config?: Json | null
          site_contact_title?: string | null
          site_corner_style?: string | null
          site_cta_label?: string | null
          site_cta_text?: string | null
          site_custom_sections?: Json | null
          site_delivery_options?: string[] | null
          site_density?: string | null
          site_empty_catalog_text?: string | null
          site_enable_cart?: boolean | null
          site_enable_coupons?: boolean | null
          site_faq?: Json | null
          site_features?: Json | null
          site_font_style?: string | null
          site_footer_text?: string | null
          site_gallery?: Json | null
          site_headline?: string | null
          site_hero_alignment?: string | null
          site_hero_highlights?: Json | null
          site_hero_style?: string | null
          site_keywords?: string[] | null
          site_layout?: string | null
          site_marketplace_subtitle?: string | null
          site_marketplace_title?: string | null
          site_nav_variant?: string | null
          site_payment_methods?: string[] | null
          site_primary_color?: string | null
          site_product_card_style?: string | null
          site_promo_active?: boolean | null
          site_promo_button_text?: string | null
          site_promo_text?: string | null
          site_promo_title?: string | null
          site_publico_ativo?: boolean | null
          site_secondary_cta_text?: string | null
          site_section_style?: string | null
          site_sections?: Json | null
          site_seo_description?: string | null
          site_seo_title?: string | null
          site_services_title?: string | null
          site_show_about?: boolean | null
          site_show_benefits?: boolean | null
          site_show_contact?: boolean | null
          site_show_faq?: boolean | null
          site_show_featured?: boolean | null
          site_show_gallery?: boolean | null
          site_show_marketplace?: boolean | null
          site_show_prices?: boolean | null
          site_show_store?: boolean | null
          site_show_testimonials?: boolean | null
          site_status?: string | null
          site_subheadline?: string | null
          site_template?: string | null
          site_testimonials?: Json | null
          site_text_color?: string | null
          site_theme?: string | null
          site_trust_title?: string | null
          site_updated_at?: string | null
          site_whatsapp_message?: string | null
          slug?: string
          subdomain_slug?: string | null
          subscription_provider?: string | null
          telefone?: string | null
          tester_id?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_used_at?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_access_token?: string | null
          whatsapp_ai_enabled?: boolean | null
          whatsapp_ai_prompt?: string | null
          whatsapp_auto_reply_enabled?: boolean | null
          whatsapp_business_account_id?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_order_notifications?: boolean | null
          whatsapp_phone_number_id?: string | null
          whatsapp_status_notifications?: boolean | null
          whatsapp_verify_token?: string | null
        }
        Relationships: []
      }
      company_health_snapshots: {
        Row: {
          calculated_at: string
          company_id: string
          id: number
          metrics: Json
          reasons: Json
          score: number
        }
        Insert: {
          calculated_at?: string
          company_id: string
          id?: never
          metrics?: Json
          reasons?: Json
          score: number
        }
        Update: {
          calculated_at?: string
          company_id?: string
          id?: never
          metrics?: Json
          reasons?: Json
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_health_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_health_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_members: {
        Row: {
          cargo: string
          company_id: string
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          nome: string
          permissions: Json
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cargo?: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          nome: string
          permissions?: Json
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cargo?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          nome?: string
          permissions?: Json
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_niche_templates: {
        Row: {
          applied_at: string
          applied_by: string | null
          categories: string[]
          company_id: string
          id: string
          niche_id: string
          niche_name: string
          proposal_model: Json
          questions: string[]
          ready_messages: Json
          recommended_fields: string[]
          statuses: string[]
          updated_at: string
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          categories?: string[]
          company_id: string
          id?: string
          niche_id: string
          niche_name: string
          proposal_model?: Json
          questions?: string[]
          ready_messages?: Json
          recommended_fields?: string[]
          statuses?: string[]
          updated_at?: string
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          categories?: string[]
          company_id?: string
          id?: string
          niche_id?: string
          niche_name?: string
          proposal_model?: Json
          questions?: string[]
          ready_messages?: Json
          recommended_fields?: string[]
          statuses?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_niche_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_niche_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_proposal_settings: {
        Row: {
          auto_generate_pix: boolean | null
          company_id: string
          created_at: string | null
          default_approval_message: string | null
          default_intro: string | null
          default_rejection_message: string | null
          default_terms: string | null
          default_validity_days: number | null
          id: string
          require_document: boolean | null
          require_signature_name: boolean | null
          updated_at: string | null
        }
        Insert: {
          auto_generate_pix?: boolean | null
          company_id: string
          created_at?: string | null
          default_approval_message?: string | null
          default_intro?: string | null
          default_rejection_message?: string | null
          default_terms?: string | null
          default_validity_days?: number | null
          id?: string
          require_document?: boolean | null
          require_signature_name?: boolean | null
          updated_at?: string | null
        }
        Update: {
          auto_generate_pix?: boolean | null
          company_id?: string
          created_at?: string | null
          default_approval_message?: string | null
          default_intro?: string | null
          default_rejection_message?: string | null
          default_terms?: string | null
          default_validity_days?: number | null
          id?: string
          require_document?: boolean | null
          require_signature_name?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_proposal_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_proposal_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_whatsapp_settings: {
        Row: {
          ai_enabled: boolean
          ai_prompt: string | null
          business_account_id: string | null
          company_id: string
          created_at: string
          enabled: boolean
          fallback_message: string | null
          metadata: Json
          notify_client_new_order: boolean
          notify_client_order_status: boolean
          notify_client_proposal: boolean
          notify_owner_new_order: boolean
          notify_owner_proposal: boolean
          owner_phone: string | null
          phone_number_id: string | null
          template_language: string
          template_order_created: string | null
          template_order_status: string | null
          template_payment_update: string | null
          template_proposal_update: string | null
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_prompt?: string | null
          business_account_id?: string | null
          company_id: string
          created_at?: string
          enabled?: boolean
          fallback_message?: string | null
          metadata?: Json
          notify_client_new_order?: boolean
          notify_client_order_status?: boolean
          notify_client_proposal?: boolean
          notify_owner_new_order?: boolean
          notify_owner_proposal?: boolean
          owner_phone?: string | null
          phone_number_id?: string | null
          template_language?: string
          template_order_created?: string | null
          template_order_status?: string | null
          template_payment_update?: string | null
          template_proposal_update?: string | null
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          ai_prompt?: string | null
          business_account_id?: string | null
          company_id?: string
          created_at?: string
          enabled?: boolean
          fallback_message?: string | null
          metadata?: Json
          notify_client_new_order?: boolean
          notify_client_order_status?: boolean
          notify_client_proposal?: boolean
          notify_owner_new_order?: boolean
          notify_owner_proposal?: boolean
          owner_phone?: string | null
          phone_number_id?: string | null
          template_language?: string
          template_order_created?: string | null
          template_order_status?: string | null
          template_payment_update?: string | null
          template_proposal_update?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_whatsapp_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_whatsapp_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_profile_id: string | null
          email: string | null
          etapa: string
          id: string
          nome: string
          observacoes: string | null
          order_id: string | null
          origem: string | null
          proposal_id: string | null
          proximo_contato_em: string | null
          status: string
          tags: string[] | null
          telefone: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_profile_id?: string | null
          email?: string | null
          etapa?: string
          id?: string
          nome: string
          observacoes?: string | null
          order_id?: string | null
          origem?: string | null
          proposal_id?: string | null
          proximo_contato_em?: string | null
          status?: string
          tags?: string[] | null
          telefone?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_profile_id?: string | null
          email?: string | null
          etapa?: string
          id?: string
          nome?: string
          observacoes?: string | null
          order_id?: string | null
          origem?: string | null
          proposal_id?: string | null
          proximo_contato_em?: string | null
          status?: string
          tags?: string[] | null
          telefone?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_duplicate_candidates: {
        Row: {
          company_id: string
          confidence: number
          created_at: string
          id: string
          left_customer_id: string
          reasons: Json
          reviewed_at: string | null
          reviewed_by: string | null
          right_customer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          confidence?: number
          created_at?: string
          id?: string
          left_customer_id: string
          reasons?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          right_customer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          confidence?: number
          created_at?: string
          id?: string
          left_customer_id?: string
          reasons?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          right_customer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_duplicate_candidates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_duplicate_candidates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "customer_duplicate_candidates_left_customer_id_fkey"
            columns: ["left_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_duplicate_candidates_right_customer_id_fkey"
            columns: ["right_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_followups: {
        Row: {
          cliente_nome: string | null
          cliente_telefone: string
          company_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          customer_profile_id: string | null
          descricao: string | null
          due_at: string | null
          id: string
          prioridade: string
          status: string
          titulo: string
        }
        Insert: {
          cliente_nome?: string | null
          cliente_telefone: string
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_profile_id?: string | null
          descricao?: string | null
          due_at?: string | null
          id?: string
          prioridade?: string
          status?: string
          titulo: string
        }
        Update: {
          cliente_nome?: string | null
          cliente_telefone?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_profile_id?: string | null
          descricao?: string | null
          due_at?: string | null
          id?: string
          prioridade?: string
          status?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_followups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_followups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "customer_followups_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_internal_notes: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          note: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          note: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_internal_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_internal_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      customer_magic_links: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string
          id: string
          last_access_at: string | null
          status: string
          token: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_access_at?: string | null
          status?: string
          token?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_access_at?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_magic_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_magic_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          cliente_nome: string | null
          cliente_telefone: string
          company_id: string
          conteudo: string
          created_at: string | null
          created_by: string | null
          customer_profile_id: string | null
          id: string
          tipo: string
        }
        Insert: {
          cliente_nome?: string | null
          cliente_telefone: string
          company_id: string
          conteudo: string
          created_at?: string | null
          created_by?: string | null
          customer_profile_id?: string | null
          id?: string
          tipo?: string
        }
        Update: {
          cliente_nome?: string | null
          cliente_telefone?: string
          company_id?: string
          conteudo?: string
          created_at?: string | null
          created_by?: string | null
          customer_profile_id?: string | null
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "customer_notes_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_events: {
        Row: {
          company_id: string | null
          created_at: string
          customer_magic_link_id: string | null
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_magic_link_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_magic_link_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "customer_portal_events_customer_magic_link_id_fkey"
            columns: ["customer_magic_link_id"]
            isOneToOne: false
            referencedRelation: "customer_magic_links"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          archived: boolean
          company_id: string
          contact_key: string
          created_at: string
          created_by: string | null
          display_name: string | null
          email_normalized: string | null
          email_raw: string | null
          id: string
          last_activity_at: string | null
          merged_into_id: string | null
          metadata: Json
          normalized_name: string | null
          phone_normalized: string | null
          phone_raw: string | null
          source: string
          source_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived?: boolean
          company_id: string
          contact_key: string
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email_normalized?: string | null
          email_raw?: string | null
          id?: string
          last_activity_at?: string | null
          merged_into_id?: string | null
          metadata?: Json
          normalized_name?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          source?: string
          source_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived?: boolean
          company_id?: string
          contact_key?: string
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email_normalized?: string | null
          email_raw?: string | null
          id?: string
          last_activity_at?: string | null
          merged_into_id?: string | null
          metadata?: Json
          normalized_name?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          source?: string
          source_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "customer_profiles_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_quality_issues: {
        Row: {
          auto_fixable: boolean
          company_id: string
          detail: string
          entity_id: string | null
          entity_type: string
          fingerprint: string
          first_seen_at: string
          id: string
          last_seen_at: string
          metadata: Json
          recommended_action: string
          resolved_at: string | null
          rule_key: string
          severity: string
          status: string
          title: string
        }
        Insert: {
          auto_fixable?: boolean
          company_id: string
          detail: string
          entity_id?: string | null
          entity_type: string
          fingerprint: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          recommended_action: string
          resolved_at?: string | null
          rule_key: string
          severity: string
          status?: string
          title: string
        }
        Update: {
          auto_fixable?: boolean
          company_id?: string
          detail?: string
          entity_id?: string | null
          entity_type?: string
          fingerprint?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          recommended_action?: string
          resolved_at?: string | null
          rule_key?: string
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_quality_issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_quality_issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      deliveries: {
        Row: {
          address: string | null
          assigned_at: string | null
          assigned_driver_id: string | null
          company_id: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_fee: number | null
          delivery_zone_id: string | null
          dispatched_at: string | null
          estimated_delivery_at: string | null
          id: string
          neighborhood: string | null
          notes: string | null
          order_id: string | null
          payment_method_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          assigned_at?: string | null
          assigned_driver_id?: string | null
          company_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_fee?: number | null
          delivery_zone_id?: string | null
          dispatched_at?: string | null
          estimated_delivery_at?: string | null
          id?: string
          neighborhood?: string | null
          notes?: string | null
          order_id?: string | null
          payment_method_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          assigned_at?: string | null
          assigned_driver_id?: string | null
          company_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_fee?: number | null
          delivery_zone_id?: string | null
          dispatched_at?: string | null
          estimated_delivery_at?: string | null
          id?: string
          neighborhood?: string | null
          notes?: string | null
          order_id?: string | null
          payment_method_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deliveries_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_assignments: {
        Row: {
          address: string | null
          assigned_at: string
          company_id: string
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_code: string | null
          delivery_fee: number
          delivery_id: string | null
          driver_id: string | null
          driver_name: string
          driver_whatsapp: string | null
          id: string
          map_url: string | null
          neighborhood: string | null
          order_id: string | null
          order_total: number
          out_for_delivery_at: string | null
          payment_method: string | null
          payment_status: string | null
          settled_at: string | null
          settlement_note: string | null
          settlement_status: string
          status: string
          updated_at: string
          vehicle_plate: string | null
        }
        Insert: {
          address?: string | null
          assigned_at?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_code?: string | null
          delivery_fee?: number
          delivery_id?: string | null
          driver_id?: string | null
          driver_name: string
          driver_whatsapp?: string | null
          id?: string
          map_url?: string | null
          neighborhood?: string | null
          order_id?: string | null
          order_total?: number
          out_for_delivery_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          settled_at?: string | null
          settlement_note?: string | null
          settlement_status?: string
          status?: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Update: {
          address?: string | null
          assigned_at?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_code?: string | null
          delivery_fee?: number
          delivery_id?: string | null
          driver_id?: string | null
          driver_name?: string
          driver_whatsapp?: string | null
          id?: string
          map_url?: string | null
          neighborhood?: string | null
          order_id?: string | null
          order_total?: number
          out_for_delivery_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          settled_at?: string | null
          settlement_note?: string | null
          settlement_status?: string
          status?: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "delivery_assignments_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_drivers: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
          vehicle_plate: string | null
          whatsapp: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          vehicle_plate?: string | null
          whatsapp: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          vehicle_plate?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          estimated_time_max: number | null
          estimated_time_min: number | null
          fee: number | null
          id: string
          is_active: boolean
          min_order: number | null
          minimum_order: number | null
          name: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          estimated_time_max?: number | null
          estimated_time_min?: number | null
          fee?: number | null
          id?: string
          is_active?: boolean
          min_order?: number | null
          minimum_order?: number | null
          name: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          estimated_time_max?: number | null
          estimated_time_min?: number | null
          fee?: number | null
          id?: string
          is_active?: boolean
          min_order?: number | null
          minimum_order?: number | null
          name?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_zones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      demo_data_registry: {
        Row: {
          company_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          template_key: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: never
          template_key?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_data_registry_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_data_registry_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      ecosystem_audit_events: {
        Row: {
          actor_id: string | null
          entity_id: string
          event_type: string
          id: string
          recorded_at: string
        }
        Insert: {
          actor_id?: string | null
          entity_id: string
          event_type: string
          id?: string
          recorded_at?: string
        }
        Update: {
          actor_id?: string | null
          entity_id?: string
          event_type?: string
          id?: string
          recorded_at?: string
        }
        Relationships: []
      }
      ecosystem_context_consents: {
        Row: {
          data_scope: string
          expires_at: string
          granted_at: string
          id: string
          purpose: string
          revoked_at: string | null
          source_company_id: string | null
          source_product: string
          target_company_id: string | null
          target_product: string
          user_id: string
        }
        Insert: {
          data_scope: string
          expires_at: string
          granted_at?: string
          id?: string
          purpose: string
          revoked_at?: string | null
          source_company_id?: string | null
          source_product: string
          target_company_id?: string | null
          target_product: string
          user_id: string
        }
        Update: {
          data_scope?: string
          expires_at?: string
          granted_at?: string
          id?: string
          purpose?: string
          revoked_at?: string | null
          source_company_id?: string | null
          source_product?: string
          target_company_id?: string | null
          target_product?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ecosystem_context_consents_source_company_id_fkey"
            columns: ["source_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecosystem_context_consents_source_company_id_fkey"
            columns: ["source_company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ecosystem_context_consents_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecosystem_context_consents_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      ecosystem_product_entitlements: {
        Row: {
          company_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          permissions: string[]
          product_id: string
          source: string
          source_reference: string | null
          starts_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          permissions?: string[]
          product_id: string
          source: string
          source_reference?: string | null
          starts_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          permissions?: string[]
          product_id?: string
          source?: string
          source_reference?: string | null
          starts_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecosystem_product_entitlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecosystem_product_entitlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      event_idempotency: {
        Row: {
          attempt: number
          company_id: string | null
          event_id: string
          event_type: string | null
          id: string
          last_error: string | null
          metadata: Json
          payload_hash: string | null
          processed_at: string | null
          provider: string
          received_at: string
          status: string
        }
        Insert: {
          attempt?: number
          company_id?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          payload_hash?: string | null
          processed_at?: string | null
          provider: string
          received_at?: string
          status?: string
        }
        Update: {
          attempt?: number
          company_id?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          payload_hash?: string | null
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_idempotency_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_idempotency_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string | null
          id: string
          nome: string
          saldo_inicial: number
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string | null
          id?: string
          nome: string
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string | null
          id?: string
          nome?: string
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          type: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      financial_material_entries: {
        Row: {
          categoria: string | null
          codigo: string | null
          company_id: string
          created_at: string | null
          fornecedor: string | null
          id: string
          nome: string
          quantidade: number
          transaction_id: string | null
          unidade: string | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          categoria?: string | null
          codigo?: string | null
          company_id: string
          created_at?: string | null
          fornecedor?: string | null
          id?: string
          nome: string
          quantidade?: number
          transaction_id?: string | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          categoria?: string | null
          codigo?: string | null
          company_id?: string
          created_at?: string | null
          fornecedor?: string | null
          id?: string
          nome?: string
          quantidade?: number
          transaction_id?: string | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_material_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_material_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "financial_material_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_id: string | null
          amount: number | null
          categoria: string
          category_id: string | null
          centro_custo: string | null
          codigo_barras: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          customer_profile_id: string | null
          data_competencia: string
          descricao: string
          description: string | null
          documento_nome: string | null
          documento_tipo: string | null
          documento_url: string | null
          due_date: string | null
          forma_pagamento: string | null
          fornecedor_cliente: string | null
          id: string
          invoice_id: string | null
          nota_chave: string | null
          nota_cnpj_emitente: string | null
          nota_data_emissao: string | null
          nota_emitente: string | null
          nota_numero: string | null
          nota_serie: string | null
          notes: string | null
          observacoes: string | null
          order_id: string | null
          origem: string
          paid_at: string | null
          parcela_atual: number | null
          parcelas_total: number | null
          payment_method: string | null
          proposal_id: string | null
          raw_data: Json
          recorrencia_grupo: string | null
          recorrente: boolean | null
          status: string
          tags: string[] | null
          tipo: string
          type: string | null
          updated_at: string | null
          valor: number
          vencimento: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          categoria?: string
          category_id?: string | null
          centro_custo?: string | null
          codigo_barras?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_profile_id?: string | null
          data_competencia?: string
          descricao: string
          description?: string | null
          documento_nome?: string | null
          documento_tipo?: string | null
          documento_url?: string | null
          due_date?: string | null
          forma_pagamento?: string | null
          fornecedor_cliente?: string | null
          id?: string
          invoice_id?: string | null
          nota_chave?: string | null
          nota_cnpj_emitente?: string | null
          nota_data_emissao?: string | null
          nota_emitente?: string | null
          nota_numero?: string | null
          nota_serie?: string | null
          notes?: string | null
          observacoes?: string | null
          order_id?: string | null
          origem?: string
          paid_at?: string | null
          parcela_atual?: number | null
          parcelas_total?: number | null
          payment_method?: string | null
          proposal_id?: string | null
          raw_data?: Json
          recorrencia_grupo?: string | null
          recorrente?: boolean | null
          status?: string
          tags?: string[] | null
          tipo?: string
          type?: string | null
          updated_at?: string | null
          valor?: number
          vencimento?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          categoria?: string
          category_id?: string | null
          centro_custo?: string | null
          codigo_barras?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_profile_id?: string | null
          data_competencia?: string
          descricao?: string
          description?: string | null
          documento_nome?: string | null
          documento_tipo?: string | null
          documento_url?: string | null
          due_date?: string | null
          forma_pagamento?: string | null
          fornecedor_cliente?: string | null
          id?: string
          invoice_id?: string | null
          nota_chave?: string | null
          nota_cnpj_emitente?: string | null
          nota_data_emissao?: string | null
          nota_emitente?: string | null
          nota_numero?: string | null
          nota_serie?: string | null
          notes?: string | null
          observacoes?: string | null
          order_id?: string | null
          origem?: string
          paid_at?: string | null
          parcela_atual?: number | null
          parcelas_total?: number | null
          payment_method?: string | null
          proposal_id?: string | null
          raw_data?: Json
          recorrencia_grupo?: string | null
          recorrente?: boolean | null
          status?: string
          tags?: string[] | null
          tipo?: string
          type?: string | null
          updated_at?: string | null
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "financial_transactions_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_invites: {
        Row: {
          activated_at: string | null
          activation_attempts: number
          activation_claim_id: string | null
          activation_claimed_at: string | null
          activation_last_error: string | null
          company_id: string | null
          created_at: string
          created_by_admin_id: string | null
          created_by_email: string
          email: string
          email_normalized: string | null
          founder_number: number
          founder_price_cents: number
          id: string
          invited_at: string
          plan_key: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_admin_id: string | null
          sales_lead_id: string | null
          status: string
          token_expires_at: string | null
          token_hash: string
          token_rotated_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_attempts?: number
          activation_claim_id?: string | null
          activation_claimed_at?: string | null
          activation_last_error?: string | null
          company_id?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          created_by_email: string
          email: string
          email_normalized?: string | null
          founder_number: number
          founder_price_cents: number
          id?: string
          invited_at?: string
          plan_key: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_admin_id?: string | null
          sales_lead_id?: string | null
          status?: string
          token_expires_at?: string | null
          token_hash: string
          token_rotated_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_attempts?: number
          activation_claim_id?: string | null
          activation_claimed_at?: string | null
          activation_last_error?: string | null
          company_id?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          created_by_email?: string
          email?: string
          email_normalized?: string | null
          founder_number?: number
          founder_price_cents?: number
          id?: string
          invited_at?: string
          plan_key?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_admin_id?: string | null
          sales_lead_id?: string | null
          status?: string
          token_expires_at?: string | null
          token_hash?: string
          token_rotated_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "founder_invites_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_invites_revoked_by_admin_id_fkey"
            columns: ["revoked_by_admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_invites_sales_lead_id_fkey"
            columns: ["sales_lead_id"]
            isOneToOne: false
            referencedRelation: "admin_signup_leads_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_invites_sales_lead_id_fkey"
            columns: ["sales_lead_id"]
            isOneToOne: false
            referencedRelation: "signup_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          capabilities: string[]
          company_id: string
          config: Json
          connected_at: string | null
          connected_by: string | null
          created_at: string
          credentials_reference: string | null
          display_name: string | null
          external_account_id: string | null
          external_account_name: string | null
          id: string
          last_error_at: string | null
          last_error_code: string | null
          last_success_at: string | null
          last_sync_at: string | null
          provider: string
          refresh_lock_id: string | null
          refresh_locked_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capabilities?: string[]
          company_id: string
          config?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          credentials_reference?: string | null
          display_name?: string | null
          external_account_id?: string | null
          external_account_name?: string | null
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_success_at?: string | null
          last_sync_at?: string | null
          provider: string
          refresh_lock_id?: string | null
          refresh_locked_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capabilities?: string[]
          company_id?: string
          config?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          credentials_reference?: string | null
          display_name?: string | null
          external_account_id?: string | null
          external_account_name?: string | null
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_success_at?: string | null
          last_sync_at?: string | null
          provider?: string
          refresh_lock_id?: string | null
          refresh_locked_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      integration_mappings: {
        Row: {
          company_id: string
          connection_id: string
          created_at: string
          entity_type: string
          external_id: string
          external_version: string | null
          id: string
          metadata: Json
          orcaly_entity_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          connection_id: string
          created_at?: string
          entity_type: string
          external_id: string
          external_version?: string | null
          id?: string
          metadata?: Json
          orcaly_entity_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          connection_id?: string
          created_at?: string
          entity_type?: string
          external_id?: string
          external_version?: string | null
          id?: string
          metadata?: Json
          orcaly_entity_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "integration_mappings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_oauth_states: {
        Row: {
          company_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          nonce_hash: string
          pkce_reference: string | null
          provider: string
          requested_scopes: string[]
          user_id: string
        }
        Insert: {
          company_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          nonce_hash: string
          pkce_reference?: string | null
          provider: string
          requested_scopes?: string[]
          user_id: string
        }
        Update: {
          company_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          nonce_hash?: string
          pkce_reference?: string | null
          provider?: string
          requested_scopes?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_oauth_states_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_oauth_states_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      integration_push_channels: {
        Row: {
          channel_id: string
          company_id: string
          connection_id: string
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          provider: string
          resource_id: string
          resource_type: string
          resource_uri: string | null
          state: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          company_id: string
          connection_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider: string
          resource_id: string
          resource_type: string
          resource_uri?: string | null
          state?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          company_id?: string
          connection_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider?: string
          resource_id?: string
          resource_type?: string
          resource_uri?: string | null
          state?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_push_channels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_push_channels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "integration_push_channels_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_cursors: {
        Row: {
          checkpoint: Json
          connection_id: string
          cursor_key: string
          cursor_value: string | null
          updated_at: string
        }
        Insert: {
          checkpoint?: Json
          connection_id: string
          cursor_key?: string
          cursor_value?: string | null
          updated_at?: string
        }
        Update: {
          checkpoint?: Json
          connection_id?: string
          cursor_key?: string
          cursor_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_cursors_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_usage_daily: {
        Row: {
          company_id: string
          metadata: Json
          metric: string
          provider: string
          quantity: number
          updated_at: string
          usage_day: string
        }
        Insert: {
          company_id: string
          metadata?: Json
          metric: string
          provider: string
          quantity?: number
          updated_at?: string
          usage_day?: string
        }
        Update: {
          company_id?: string
          metadata?: Json
          metric?: string
          provider?: string
          quantity?: number
          updated_at?: string
          usage_day?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_usage_daily_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_usage_daily_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      internal_tasks: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          crm_lead_id: string | null
          descricao: string | null
          due_at: string | null
          id: string
          order_id: string | null
          prioridade: string
          proposal_id: string | null
          responsavel_id: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          crm_lead_id?: string | null
          descricao?: string | null
          due_at?: string | null
          id?: string
          order_id?: string | null
          prioridade?: string
          proposal_id?: string | null
          responsavel_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          crm_lead_id?: string | null
          descricao?: string | null
          due_at?: string | null
          id?: string
          order_id?: string | null
          prioridade?: string
          proposal_id?: string | null
          responsavel_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_commission_rules: {
        Row: {
          commission_fixed: number
          commission_percentage: number
          company_id: string | null
          created_at: string | null
          id: string
          is_active: boolean
          plan_key: string | null
          updated_at: string | null
        }
        Insert: {
          commission_fixed?: number
          commission_percentage?: number
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          plan_key?: string | null
          updated_at?: string | null
        }
        Update: {
          commission_fixed?: number
          commission_percentage?: number
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          plan_key?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_commission_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_commission_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      marketplace_commissions: {
        Row: {
          calculation_base: string | null
          commission_amount: number
          commission_fixed: number
          commission_percentage: number
          company_id: string
          confirmed_amount: number | null
          confirmed_at: string | null
          created_at: string | null
          estimated_amount: number | null
          external_reference: string | null
          fee_percent: number | null
          gross_amount: number
          id: string
          marketplace_payment_id: string | null
          order_id: string | null
          provider: string
          provider_split_id: string | null
          refusal_reason: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          calculation_base?: string | null
          commission_amount?: number
          commission_fixed?: number
          commission_percentage?: number
          company_id: string
          confirmed_amount?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          estimated_amount?: number | null
          external_reference?: string | null
          fee_percent?: number | null
          gross_amount?: number
          id?: string
          marketplace_payment_id?: string | null
          order_id?: string | null
          provider?: string
          provider_split_id?: string | null
          refusal_reason?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          calculation_base?: string | null
          commission_amount?: number
          commission_fixed?: number
          commission_percentage?: number
          company_id?: string
          confirmed_amount?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          estimated_amount?: number | null
          external_reference?: string | null
          fee_percent?: number | null
          gross_amount?: number
          id?: string
          marketplace_payment_id?: string | null
          order_id?: string | null
          provider?: string
          provider_split_id?: string | null
          refusal_reason?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "marketplace_commissions_marketplace_payment_id_fkey"
            columns: ["marketplace_payment_id"]
            isOneToOne: false
            referencedRelation: "marketplace_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_coupons: {
        Row: {
          allowed_categories: Json
          allowed_product_ids: Json
          ativo: boolean
          codigo: string
          codigo_normalizado: string
          company_id: string
          coupon_type: string | null
          created_at: string
          descricao: string | null
          ends_at: string | null
          free_delivery: boolean
          id: string
          starts_at: string | null
          tipo: string
          updated_at: string
          usage_limit: number | null
          used_count: number
          valor: number
          valor_maximo_desconto: number | null
          valor_minimo_pedido: number
        }
        Insert: {
          allowed_categories?: Json
          allowed_product_ids?: Json
          ativo?: boolean
          codigo: string
          codigo_normalizado: string
          company_id: string
          coupon_type?: string | null
          created_at?: string
          descricao?: string | null
          ends_at?: string | null
          free_delivery?: boolean
          id?: string
          starts_at?: string | null
          tipo?: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valor?: number
          valor_maximo_desconto?: number | null
          valor_minimo_pedido?: number
        }
        Update: {
          allowed_categories?: Json
          allowed_product_ids?: Json
          ativo?: boolean
          codigo?: string
          codigo_normalizado?: string
          company_id?: string
          coupon_type?: string | null
          created_at?: string
          descricao?: string | null
          ends_at?: string | null
          free_delivery?: boolean
          id?: string
          starts_at?: string | null
          tipo?: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valor?: number
          valor_maximo_desconto?: number | null
          valor_minimo_pedido?: number
        }
        Relationships: []
      }
      marketplace_oauth_states: {
        Row: {
          company_id: string
          consumed_at: string | null
          created_at: string | null
          expires_at: string
          id: string
          provider: string
          state_hash: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          consumed_at?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          provider?: string
          state_hash: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          consumed_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          provider?: string
          state_hash?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_oauth_states_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_oauth_states_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      marketplace_payment_settings: {
        Row: {
          access_token: string | null
          account_status: string | null
          automatic_payout_enabled: boolean
          bank_account_last4: string | null
          bank_account_type: string | null
          bank_name: string | null
          card_enabled: boolean | null
          charges_enabled: boolean | null
          company_id: string
          created_at: string | null
          document_last4: string | null
          encrypted_provider_api_key: string | null
          encrypted_webhook_auth_token: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_payout_at: string | null
          last_status_check_at: string | null
          legal_name: string | null
          minimum_payout_amount: number
          onboarding_status: string
          onboarding_url: string | null
          payout_pix_key_encrypted: string | null
          payout_pix_key_masked: string | null
          payout_pix_key_type: string | null
          payout_pix_owner_document_masked: string | null
          payout_pix_owner_name: string | null
          payouts_enabled: boolean | null
          pix_enabled: boolean | null
          provider: string
          provider_account_id: string | null
          provider_metadata_sanitized: Json | null
          provider_user_id: string | null
          provider_wallet_id: string | null
          public_key: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          account_status?: string | null
          automatic_payout_enabled?: boolean
          bank_account_last4?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          card_enabled?: boolean | null
          charges_enabled?: boolean | null
          company_id: string
          created_at?: string | null
          document_last4?: string | null
          encrypted_provider_api_key?: string | null
          encrypted_webhook_auth_token?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_payout_at?: string | null
          last_status_check_at?: string | null
          legal_name?: string | null
          minimum_payout_amount?: number
          onboarding_status?: string
          onboarding_url?: string | null
          payout_pix_key_encrypted?: string | null
          payout_pix_key_masked?: string | null
          payout_pix_key_type?: string | null
          payout_pix_owner_document_masked?: string | null
          payout_pix_owner_name?: string | null
          payouts_enabled?: boolean | null
          pix_enabled?: boolean | null
          provider?: string
          provider_account_id?: string | null
          provider_metadata_sanitized?: Json | null
          provider_user_id?: string | null
          provider_wallet_id?: string | null
          public_key?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          account_status?: string | null
          automatic_payout_enabled?: boolean
          bank_account_last4?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          card_enabled?: boolean | null
          charges_enabled?: boolean | null
          company_id?: string
          created_at?: string | null
          document_last4?: string | null
          encrypted_provider_api_key?: string | null
          encrypted_webhook_auth_token?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_payout_at?: string | null
          last_status_check_at?: string | null
          legal_name?: string | null
          minimum_payout_amount?: number
          onboarding_status?: string
          onboarding_url?: string | null
          payout_pix_key_encrypted?: string | null
          payout_pix_key_masked?: string | null
          payout_pix_key_type?: string | null
          payout_pix_owner_document_masked?: string | null
          payout_pix_owner_name?: string | null
          payouts_enabled?: boolean | null
          pix_enabled?: boolean | null
          provider?: string
          provider_account_id?: string | null
          provider_metadata_sanitized?: Json | null
          provider_user_id?: string | null
          provider_wallet_id?: string | null
          public_key?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payment_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_payment_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      marketplace_payments: {
        Row: {
          amount: number
          card_brand: string | null
          card_last4: string | null
          checkout_url: string | null
          commission_amount: number
          commission_percentage: number
          company_id: string
          created_at: string | null
          currency: string
          delivery_fee: number
          discount_amount: number
          error_message: string | null
          expires_at: string | null
          external_reference: string | null
          gross_amount: number | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          order_id: string | null
          paid_at: string | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          payment_method: string | null
          payout_status: string | null
          platform_fee_amount: number | null
          platform_fee_percent: number | null
          provider: string
          provider_customer_id: string | null
          provider_fee_amount: number | null
          provider_net_amount: number | null
          provider_payment_id: string | null
          provider_preference_id: string | null
          provider_status: string | null
          raw_payload: Json | null
          sandbox_checkout_url: string | null
          seller_net_amount: number | null
          split_status: string | null
          status: string
          stock_confirmed_at: string | null
          stock_released_at: string | null
          stock_reservation_status: string | null
          stock_reserved_at: string | null
          subtotal: number
          updated_at: string | null
        }
        Insert: {
          amount?: number
          card_brand?: string | null
          card_last4?: string | null
          checkout_url?: string | null
          commission_amount?: number
          commission_percentage?: number
          company_id: string
          created_at?: string | null
          currency?: string
          delivery_fee?: number
          discount_amount?: number
          error_message?: string | null
          expires_at?: string | null
          external_reference?: string | null
          gross_amount?: number | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          order_id?: string | null
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_method?: string | null
          payout_status?: string | null
          platform_fee_amount?: number | null
          platform_fee_percent?: number | null
          provider?: string
          provider_customer_id?: string | null
          provider_fee_amount?: number | null
          provider_net_amount?: number | null
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          provider_status?: string | null
          raw_payload?: Json | null
          sandbox_checkout_url?: string | null
          seller_net_amount?: number | null
          split_status?: string | null
          status?: string
          stock_confirmed_at?: string | null
          stock_released_at?: string | null
          stock_reservation_status?: string | null
          stock_reserved_at?: string | null
          subtotal?: number
          updated_at?: string | null
        }
        Update: {
          amount?: number
          card_brand?: string | null
          card_last4?: string | null
          checkout_url?: string | null
          commission_amount?: number
          commission_percentage?: number
          company_id?: string
          created_at?: string | null
          currency?: string
          delivery_fee?: number
          discount_amount?: number
          error_message?: string | null
          expires_at?: string | null
          external_reference?: string | null
          gross_amount?: number | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          order_id?: string | null
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_method?: string | null
          payout_status?: string | null
          platform_fee_amount?: number | null
          platform_fee_percent?: number | null
          provider?: string
          provider_customer_id?: string | null
          provider_fee_amount?: number | null
          provider_net_amount?: number | null
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          provider_status?: string | null
          raw_payload?: Json | null
          sandbox_checkout_url?: string | null
          seller_net_amount?: number | null
          split_status?: string | null
          status?: string
          stock_confirmed_at?: string | null
          stock_released_at?: string | null
          stock_reservation_status?: string | null
          stock_reserved_at?: string | null
          subtotal?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "marketplace_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_stock_reservations: {
        Row: {
          company_id: string
          confirmed_at: string | null
          created_at: string
          expires_at: string
          id: string
          marketplace_payment_id: string
          order_id: string
          product_id: string
          quantity: number
          release_reason: string | null
          released_at: string | null
          status: string
          stock_after: number
          stock_before: number
          updated_at: string
        }
        Insert: {
          company_id: string
          confirmed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          marketplace_payment_id: string
          order_id: string
          product_id: string
          quantity: number
          release_reason?: string | null
          released_at?: string | null
          status?: string
          stock_after: number
          stock_before: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          marketplace_payment_id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          release_reason?: string | null
          released_at?: string | null
          status?: string
          stock_after?: number
          stock_before?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_stock_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_stock_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "marketplace_stock_reservations_marketplace_payment_id_fkey"
            columns: ["marketplace_payment_id"]
            isOneToOne: false
            referencedRelation: "marketplace_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_stock_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          link: string | null
          message: string | null
          metadata: Json | null
          priority: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          priority?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          priority?: string | null
          read_at?: string | null
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
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      order_internal_comments: {
        Row: {
          comentario: string
          company_id: string
          created_at: string
          id: string
          order_id: string
          user_id: string | null
        }
        Insert: {
          comentario: string
          company_id: string
          created_at?: string
          id?: string
          order_id: string
          user_id?: string | null
        }
        Update: {
          comentario?: string
          company_id?: string
          created_at?: string
          id?: string
          order_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          addons: Json | null
          addons_json: Json | null
          altura: number | null
          area_m2: number | null
          company_id: string | null
          comprimento: number | null
          created_at: string | null
          detalhes_calculo: string | null
          id: string
          largura: number | null
          nome: string
          notes: string | null
          observation: string | null
          order_id: string | null
          precificacao: string | null
          preco_unitario: number | null
          product_id: string | null
          product_name: string | null
          quantidade: number | null
          quantity: number | null
          respostas: Json | null
          subtotal: number | null
          tipo: string | null
          total: number | null
          unidade: string | null
          unit_price: number | null
          variation: Json | null
          variation_json: Json | null
        }
        Insert: {
          addons?: Json | null
          addons_json?: Json | null
          altura?: number | null
          area_m2?: number | null
          company_id?: string | null
          comprimento?: number | null
          created_at?: string | null
          detalhes_calculo?: string | null
          id?: string
          largura?: number | null
          nome: string
          notes?: string | null
          observation?: string | null
          order_id?: string | null
          precificacao?: string | null
          preco_unitario?: number | null
          product_id?: string | null
          product_name?: string | null
          quantidade?: number | null
          quantity?: number | null
          respostas?: Json | null
          subtotal?: number | null
          tipo?: string | null
          total?: number | null
          unidade?: string | null
          unit_price?: number | null
          variation?: Json | null
          variation_json?: Json | null
        }
        Update: {
          addons?: Json | null
          addons_json?: Json | null
          altura?: number | null
          area_m2?: number | null
          company_id?: string | null
          comprimento?: number | null
          created_at?: string | null
          detalhes_calculo?: string | null
          id?: string
          largura?: number | null
          nome?: string
          notes?: string | null
          observation?: string | null
          order_id?: string | null
          precificacao?: string | null
          preco_unitario?: number | null
          product_id?: string | null
          product_name?: string | null
          quantidade?: number | null
          quantity?: number | null
          respostas?: Json | null
          subtotal?: number | null
          tipo?: string | null
          total?: number | null
          unidade?: string | null
          unit_price?: number | null
          variation?: Json | null
          variation_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string | null
          external_reference: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_id: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method_id: string | null
          proof_url: string | null
          provider: string | null
          provider_payment_id: string | null
          provider_status: string | null
          remaining_amount: number | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          external_reference?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method_id?: string | null
          proof_url?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          provider_status?: string | null
          remaining_amount?: number | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          external_reference?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method_id?: string | null
          proof_url?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          provider_status?: string | null
          remaining_amount?: number | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          changed_by_email: string | null
          company_id: string
          created_at: string
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          order_id: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string | null
          company_id: string
          created_at?: string
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          order_id: string
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string | null
          company_id?: string
          created_at?: string
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          order_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string | null
          altura: number | null
          aprovado_em: string | null
          arquivo_url: string | null
          canal_origem: string | null
          cancelado_em: string | null
          change_for: number | null
          checkout_idempotency_key: string | null
          cliente_empresa: string | null
          company_id: string | null
          complement: string | null
          coupon_code: string | null
          coupon_consumed_at: string | null
          coupon_id: string | null
          created_at: string | null
          created_by: string | null
          cupom_codigo: string | null
          cupom_id: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_portal_token: string | null
          customer_profile_id: string | null
          dados_inteligentes: Json | null
          delivery_fee: number | null
          delivery_type: string | null
          delivery_zone_id: string | null
          discount_amount: number | null
          endereco_entrega: string | null
          entregue_em: string | null
          files: Json | null
          forma_pagamento: string | null
          id: string
          internal_notes: string | null
          items_snapshot: Json | null
          itens_resumo: string | null
          largura: number | null
          marketplace_origem: string | null
          marketplace_payment_id: string | null
          neighborhood: string | null
          nome: string
          notificado_em: string | null
          observacoes: string | null
          observacoes_internas: string | null
          original_order_id: string | null
          paid_at: string | null
          parcelas: number | null
          payment_method: string | null
          payment_method_id: string | null
          payment_provider: string | null
          payment_status: string | null
          percentual_sinal: number | null
          prazo: string | null
          prazo_entrega: string | null
          preco_estimado: number | null
          prioridade: string | null
          priority: string | null
          produto: string
          quantidade: number | null
          reference_point: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          source: string | null
          source_id: string | null
          status: string | null
          subtotal: number | null
          telefone: string
          total: number | null
          total_amount: number | null
          updated_at: string | null
          updated_by: string | null
          valor_desconto: number | null
          valor_sinal: number | null
          valor_total: number | null
          valor_total_original: number | null
          visualizado_em: string | null
          whatsapp_client_created_notified_at: string | null
          whatsapp_last_status_notified: string | null
          whatsapp_last_status_notified_at: string | null
          whatsapp_owner_notified_at: string | null
        }
        Insert: {
          address?: string | null
          altura?: number | null
          aprovado_em?: string | null
          arquivo_url?: string | null
          canal_origem?: string | null
          cancelado_em?: string | null
          change_for?: number | null
          checkout_idempotency_key?: string | null
          cliente_empresa?: string | null
          company_id?: string | null
          complement?: string | null
          coupon_code?: string | null
          coupon_consumed_at?: string | null
          coupon_id?: string | null
          created_at?: string | null
          created_by?: string | null
          cupom_codigo?: string | null
          cupom_id?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_portal_token?: string | null
          customer_profile_id?: string | null
          dados_inteligentes?: Json | null
          delivery_fee?: number | null
          delivery_type?: string | null
          delivery_zone_id?: string | null
          discount_amount?: number | null
          endereco_entrega?: string | null
          entregue_em?: string | null
          files?: Json | null
          forma_pagamento?: string | null
          id?: string
          internal_notes?: string | null
          items_snapshot?: Json | null
          itens_resumo?: string | null
          largura?: number | null
          marketplace_origem?: string | null
          marketplace_payment_id?: string | null
          neighborhood?: string | null
          nome: string
          notificado_em?: string | null
          observacoes?: string | null
          observacoes_internas?: string | null
          original_order_id?: string | null
          paid_at?: string | null
          parcelas?: number | null
          payment_method?: string | null
          payment_method_id?: string | null
          payment_provider?: string | null
          payment_status?: string | null
          percentual_sinal?: number | null
          prazo?: string | null
          prazo_entrega?: string | null
          preco_estimado?: number | null
          prioridade?: string | null
          priority?: string | null
          produto: string
          quantidade?: number | null
          reference_point?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          subtotal?: number | null
          telefone: string
          total?: number | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valor_desconto?: number | null
          valor_sinal?: number | null
          valor_total?: number | null
          valor_total_original?: number | null
          visualizado_em?: string | null
          whatsapp_client_created_notified_at?: string | null
          whatsapp_last_status_notified?: string | null
          whatsapp_last_status_notified_at?: string | null
          whatsapp_owner_notified_at?: string | null
        }
        Update: {
          address?: string | null
          altura?: number | null
          aprovado_em?: string | null
          arquivo_url?: string | null
          canal_origem?: string | null
          cancelado_em?: string | null
          change_for?: number | null
          checkout_idempotency_key?: string | null
          cliente_empresa?: string | null
          company_id?: string | null
          complement?: string | null
          coupon_code?: string | null
          coupon_consumed_at?: string | null
          coupon_id?: string | null
          created_at?: string | null
          created_by?: string | null
          cupom_codigo?: string | null
          cupom_id?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_portal_token?: string | null
          customer_profile_id?: string | null
          dados_inteligentes?: Json | null
          delivery_fee?: number | null
          delivery_type?: string | null
          delivery_zone_id?: string | null
          discount_amount?: number | null
          endereco_entrega?: string | null
          entregue_em?: string | null
          files?: Json | null
          forma_pagamento?: string | null
          id?: string
          internal_notes?: string | null
          items_snapshot?: Json | null
          itens_resumo?: string | null
          largura?: number | null
          marketplace_origem?: string | null
          marketplace_payment_id?: string | null
          neighborhood?: string | null
          nome?: string
          notificado_em?: string | null
          observacoes?: string | null
          observacoes_internas?: string | null
          original_order_id?: string | null
          paid_at?: string | null
          parcelas?: number | null
          payment_method?: string | null
          payment_method_id?: string | null
          payment_provider?: string | null
          payment_status?: string | null
          percentual_sinal?: number | null
          prazo?: string | null
          prazo_entrega?: string | null
          preco_estimado?: number | null
          prioridade?: string | null
          priority?: string | null
          produto?: string
          quantidade?: number | null
          reference_point?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          subtotal?: number | null
          telefone?: string
          total?: number | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valor_desconto?: number | null
          valor_sinal?: number | null
          valor_total?: number | null
          valor_total_original?: number | null
          visualizado_em?: string | null
          whatsapp_client_created_notified_at?: string | null
          whatsapp_last_status_notified?: string | null
          whatsapp_last_status_notified_at?: string | null
          whatsapp_owner_notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "orders_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_marketplace_payment_id_fkey"
            columns: ["marketplace_payment_id"]
            isOneToOne: false
            referencedRelation: "marketplace_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          allow_delivery_payment: boolean | null
          allow_online_payment: boolean | null
          company_id: string | null
          created_at: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          name: string
          requires_change: boolean | null
          type: string
          updated_at: string | null
        }
        Insert: {
          allow_delivery_payment?: boolean | null
          allow_online_payment?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          name: string
          requires_change?: boolean | null
          type: string
          updated_at?: string | null
        }
        Update: {
          allow_delivery_payment?: boolean | null
          allow_online_payment?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          name?: string
          requires_change?: boolean | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      payment_payouts: {
        Row: {
          amount: number
          attempts: number
          company_id: string
          created_at: string
          expected_at: string | null
          external_reference: string | null
          failure_reason: string | null
          id: string
          marketplace_payment_id: string | null
          paid_at: string | null
          pix_key_masked: string | null
          pix_key_type: string | null
          provider: string
          provider_payout_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          attempts?: number
          company_id: string
          created_at?: string
          expected_at?: string | null
          external_reference?: string | null
          failure_reason?: string | null
          id?: string
          marketplace_payment_id?: string | null
          paid_at?: string | null
          pix_key_masked?: string | null
          pix_key_type?: string | null
          provider: string
          provider_payout_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          attempts?: number
          company_id?: string
          created_at?: string
          expected_at?: string | null
          external_reference?: string | null
          failure_reason?: string | null
          id?: string
          marketplace_payment_id?: string | null
          paid_at?: string | null
          pix_key_masked?: string | null
          pix_key_type?: string | null
          provider?: string
          provider_payout_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_webhook_events: {
        Row: {
          attempts: number
          company_id: string | null
          error_message: string | null
          event_type: string
          id: string
          payload_hash: string
          payload_sanitized: Json
          processed_at: string | null
          processing_status: string
          provider: string
          provider_event_id: string
          provider_object_id: string | null
          received_at: string
        }
        Insert: {
          attempts?: number
          company_id?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload_hash: string
          payload_sanitized?: Json
          processed_at?: string | null
          processing_status?: string
          provider: string
          provider_event_id: string
          provider_object_id?: string | null
          received_at?: string
        }
        Update: {
          attempts?: number
          company_id?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload_hash?: string
          payload_sanitized?: Json
          processed_at?: string | null
          processing_status?: string
          provider?: string
          provider_event_id?: string
          provider_object_id?: string | null
          received_at?: string
        }
        Relationships: []
      }
      plan_payments: {
        Row: {
          billing_type: string | null
          cancelled_at: string | null
          checkout_url: string | null
          company_id: string | null
          created_at: string | null
          email: string | null
          external_reference: string | null
          id: string
          idempotency_key: string | null
          mercado_pago_authorized_payment_id: string | null
          mercado_pago_payment_id: string | null
          mercado_pago_preapproval_id: string | null
          mercado_pago_preference_id: string | null
          next_payment_date: string | null
          nome_empresa: string | null
          paid_at: string | null
          payment_method: string | null
          plano: string
          provider: string | null
          provider_customer_id: string | null
          provider_payment_id: string | null
          provider_subscription_id: string | null
          raw_authorized_payment: Json | null
          raw_payment: Json | null
          raw_subscription: Json | null
          raw_webhook: Json | null
          status: string | null
          tipo: string | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          billing_type?: string | null
          cancelled_at?: string | null
          checkout_url?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          external_reference?: string | null
          id?: string
          idempotency_key?: string | null
          mercado_pago_authorized_payment_id?: string | null
          mercado_pago_payment_id?: string | null
          mercado_pago_preapproval_id?: string | null
          mercado_pago_preference_id?: string | null
          next_payment_date?: string | null
          nome_empresa?: string | null
          paid_at?: string | null
          payment_method?: string | null
          plano: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          raw_authorized_payment?: Json | null
          raw_payment?: Json | null
          raw_subscription?: Json | null
          raw_webhook?: Json | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor: number
        }
        Update: {
          billing_type?: string | null
          cancelled_at?: string | null
          checkout_url?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          external_reference?: string | null
          id?: string
          idempotency_key?: string | null
          mercado_pago_authorized_payment_id?: string | null
          mercado_pago_payment_id?: string | null
          mercado_pago_preapproval_id?: string | null
          mercado_pago_preference_id?: string | null
          next_payment_date?: string | null
          nome_empresa?: string | null
          paid_at?: string | null
          payment_method?: string | null
          plano?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          raw_authorized_payment?: Json | null
          raw_payment?: Json | null
          raw_subscription?: Json | null
          raw_webhook?: Json | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      platform_admin_invites: {
        Row: {
          activated_at: string | null
          activation_claim_id: string | null
          area: string
          claimed_at: string | null
          created_at: string
          created_by_admin_id: string | null
          created_by_email: string
          email: string
          email_normalized: string | null
          expires_at: string
          id: string
          invited_at: string
          last_token_rotated_at: string | null
          nome: string
          observacoes: string | null
          permissions: Json
          platform_admin_id: string | null
          revoked_at: string | null
          role: string
          status: string
          token_hash: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_claim_id?: string | null
          area?: string
          claimed_at?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          created_by_email: string
          email: string
          email_normalized?: string | null
          expires_at: string
          id?: string
          invited_at?: string
          last_token_rotated_at?: string | null
          nome: string
          observacoes?: string | null
          permissions?: Json
          platform_admin_id?: string | null
          revoked_at?: string | null
          role?: string
          status?: string
          token_hash: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_claim_id?: string | null
          area?: string
          claimed_at?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          created_by_email?: string
          email?: string
          email_normalized?: string | null
          expires_at?: string
          id?: string
          invited_at?: string
          last_token_rotated_at?: string | null
          nome?: string
          observacoes?: string | null
          permissions?: Json
          platform_admin_id?: string | null
          revoked_at?: string | null
          role?: string
          status?: string
          token_hash?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_admin_invites_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_admin_invites_platform_admin_id_fkey"
            columns: ["platform_admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          area: string
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          must_change_password: boolean
          nome: string | null
          observacoes: string | null
          permissions: Json
          role: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          area?: string
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          must_change_password?: boolean
          nome?: string | null
          observacoes?: string | null
          permissions?: Json
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          area?: string
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          must_change_password?: boolean
          nome?: string | null
          observacoes?: string | null
          permissions?: Json
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      platform_feature_flags: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          id: string
          key: string
          scope: string
          scope_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          scope?: string
          scope_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          scope?: string
          scope_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_support_ticket_events: {
        Row: {
          admin_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          message: string | null
          metadata: Json
          ticket_id: string
          to_status: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          ticket_id: string
          to_status?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          ticket_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_support_ticket_events_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "platform_support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_support_tickets: {
        Row: {
          assignee_admin_id: string | null
          attachments: Json
          category: string
          closed_at: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string
          first_response_at: string | null
          id: string
          metadata: Json
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assignee_admin_id?: string | null
          attachments?: Json
          category?: string
          closed_at?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          first_response_at?: string | null
          id?: string
          metadata?: Json
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assignee_admin_id?: string | null
          attachments?: Json
          category?: string
          closed_at?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          first_response_at?: string | null
          id?: string
          metadata?: Json
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_support_tickets_assignee_admin_id_fkey"
            columns: ["assignee_admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      product_analytics_events: {
        Row: {
          company_id: string | null
          event_name: string
          id: number
          metadata: Json
          occurred_at: string
          session_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          event_name: string
          id?: never
          metadata?: Json
          occurred_at?: string
          session_id?: string | null
          source?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          event_name?: string
          id?: never
          metadata?: Json
          occurred_at?: string
          session_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_analytics_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_analytics_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      product_stock_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          idempotency_key: string
          marketplace_payment_id: string | null
          metadata: Json
          movement_type: string
          order_id: string | null
          product_id: string
          quantity_delta: number
          reason: string | null
          reservation_id: string | null
          stock_after: number
          stock_before: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          marketplace_payment_id?: string | null
          metadata?: Json
          movement_type: string
          order_id?: string | null
          product_id: string
          quantity_delta: number
          reason?: string | null
          reservation_id?: string | null
          stock_after: number
          stock_before: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          marketplace_payment_id?: string | null
          metadata?: Json
          movement_type?: string
          order_id?: string | null
          product_id?: string
          quantity_delta?: number
          reason?: string | null
          reservation_id?: string | null
          stock_after?: number
          stock_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "product_stock_movements_marketplace_payment_id_fkey"
            columns: ["marketplace_payment_id"]
            isOneToOne: false
            referencedRelation: "marketplace_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_movements_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stock_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          customer_name: string | null
          customer_whatsapp: string | null
          due_date: string | null
          files: Json | null
          id: string
          internal_notes: string | null
          metadata: Json | null
          order_id: string | null
          priority: string | null
          proposal_id: string | null
          responsible_name: string | null
          responsible_user_id: string | null
          signal_value: number | null
          started_at: string | null
          status: string | null
          title: string
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          customer_whatsapp?: string | null
          due_date?: string | null
          files?: Json | null
          id?: string
          internal_notes?: string | null
          metadata?: Json | null
          order_id?: string | null
          priority?: string | null
          proposal_id?: string | null
          responsible_name?: string | null
          responsible_user_id?: string | null
          signal_value?: number | null
          started_at?: string | null
          status?: string | null
          title: string
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          customer_whatsapp?: string | null
          due_date?: string | null
          files?: Json | null
          id?: string
          internal_notes?: string | null
          metadata?: Json | null
          order_id?: string | null
          priority?: string | null
          proposal_id?: string | null
          responsible_name?: string | null
          responsible_user_id?: string | null
          signal_value?: number | null
          started_at?: string | null
          status?: string | null
          title?: string
          total_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "production_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      production_steps: {
        Row: {
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          production_order_id: string
          sort_order: number | null
          started_at: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          production_order_id: string
          sort_order?: number | null
          started_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          production_order_id?: string
          sort_order?: number | null
          started_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_steps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_steps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "production_steps_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_steps_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          addons: Json | null
          adicionais: Json | null
          archived: boolean | null
          arquivado: boolean | null
          ativo: boolean | null
          available: boolean | null
          business_type: string | null
          campos_orcamento: Json | null
          categoria: string | null
          cobrar_sinal_personalizado: boolean | null
          company_id: string | null
          configuracoes: Json | null
          created_at: string | null
          created_by: string | null
          custo_entrega: number | null
          custo_mao_obra: number | null
          custo_material: number | null
          custo_taxas: number | null
          deleted_at: string | null
          descricao: string | null
          descricao_curta: string | null
          descricao_detalhada: string | null
          destaque: boolean | null
          estoque: number | null
          extras: Json | null
          foto_url: string | null
          id: string
          image_urls: string[] | null
          imagem_url: string | null
          is_active: boolean
          margem_desejada: number | null
          margem_estimada: number | null
          nome: string
          oculto: boolean | null
          percentual_sinal_produto: number | null
          permite_altura: boolean | null
          permite_comprimento: boolean | null
          permite_largura: boolean | null
          permite_quantidade: boolean | null
          prazo_medio: string | null
          precificacao: string | null
          preco: number
          preco_minimo: number | null
          preco_promocional: number | null
          preco_sob_consulta: boolean | null
          preco_sugerido: number | null
          promocao_ativa: boolean | null
          sku: string | null
          source: string | null
          source_id: string | null
          subcategoria: string | null
          tipo: string | null
          unidade: string | null
          unidade_label: string | null
          unidade_preco: string | null
          updated_at: string | null
          updated_by: string | null
          valor_minimo: number | null
          variacoes: string | null
          variations: Json | null
          video_url: string | null
        }
        Insert: {
          addons?: Json | null
          adicionais?: Json | null
          archived?: boolean | null
          arquivado?: boolean | null
          ativo?: boolean | null
          available?: boolean | null
          business_type?: string | null
          campos_orcamento?: Json | null
          categoria?: string | null
          cobrar_sinal_personalizado?: boolean | null
          company_id?: string | null
          configuracoes?: Json | null
          created_at?: string | null
          created_by?: string | null
          custo_entrega?: number | null
          custo_mao_obra?: number | null
          custo_material?: number | null
          custo_taxas?: number | null
          deleted_at?: string | null
          descricao?: string | null
          descricao_curta?: string | null
          descricao_detalhada?: string | null
          destaque?: boolean | null
          estoque?: number | null
          extras?: Json | null
          foto_url?: string | null
          id?: string
          image_urls?: string[] | null
          imagem_url?: string | null
          is_active?: boolean
          margem_desejada?: number | null
          margem_estimada?: number | null
          nome: string
          oculto?: boolean | null
          percentual_sinal_produto?: number | null
          permite_altura?: boolean | null
          permite_comprimento?: boolean | null
          permite_largura?: boolean | null
          permite_quantidade?: boolean | null
          prazo_medio?: string | null
          precificacao?: string | null
          preco: number
          preco_minimo?: number | null
          preco_promocional?: number | null
          preco_sob_consulta?: boolean | null
          preco_sugerido?: number | null
          promocao_ativa?: boolean | null
          sku?: string | null
          source?: string | null
          source_id?: string | null
          subcategoria?: string | null
          tipo?: string | null
          unidade?: string | null
          unidade_label?: string | null
          unidade_preco?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_minimo?: number | null
          variacoes?: string | null
          variations?: Json | null
          video_url?: string | null
        }
        Update: {
          addons?: Json | null
          adicionais?: Json | null
          archived?: boolean | null
          arquivado?: boolean | null
          ativo?: boolean | null
          available?: boolean | null
          business_type?: string | null
          campos_orcamento?: Json | null
          categoria?: string | null
          cobrar_sinal_personalizado?: boolean | null
          company_id?: string | null
          configuracoes?: Json | null
          created_at?: string | null
          created_by?: string | null
          custo_entrega?: number | null
          custo_mao_obra?: number | null
          custo_material?: number | null
          custo_taxas?: number | null
          deleted_at?: string | null
          descricao?: string | null
          descricao_curta?: string | null
          descricao_detalhada?: string | null
          destaque?: boolean | null
          estoque?: number | null
          extras?: Json | null
          foto_url?: string | null
          id?: string
          image_urls?: string[] | null
          imagem_url?: string | null
          is_active?: boolean
          margem_desejada?: number | null
          margem_estimada?: number | null
          nome?: string
          oculto?: boolean | null
          percentual_sinal_produto?: number | null
          permite_altura?: boolean | null
          permite_comprimento?: boolean | null
          permite_largura?: boolean | null
          permite_quantidade?: boolean | null
          prazo_medio?: string | null
          precificacao?: string | null
          preco?: number
          preco_minimo?: number | null
          preco_promocional?: number | null
          preco_sob_consulta?: boolean | null
          preco_sugerido?: number | null
          promocao_ativa?: boolean | null
          sku?: string | null
          source?: string | null
          source_id?: string | null
          subcategoria?: string | null
          tipo?: string | null
          unidade?: string | null
          unidade_label?: string | null
          unidade_preco?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_minimo?: number | null
          variacoes?: string | null
          variations?: Json | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      proposal_events: {
        Row: {
          actor_email: string | null
          actor_name: string | null
          actor_type: string | null
          company_id: string | null
          created_at: string | null
          event_type: string
          id: string
          ip: string | null
          metadata: Json | null
          note: string | null
          proposal_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_name?: string | null
          actor_type?: string | null
          company_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          note?: string | null
          proposal_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_name?: string | null
          actor_type?: string | null
          company_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          note?: string | null
          proposal_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_terms: boolean | null
          approval_document: string | null
          approval_hash: string | null
          approval_name: string | null
          approval_note: string | null
          approved_at: string | null
          capa_url: string | null
          change_requested_at: string | null
          client_ip: string | null
          cliente_email: string | null
          cliente_nome: string | null
          cliente_whatsapp: string | null
          company_id: string | null
          condicao_pagamento: string | null
          condicoes: string | null
          created_at: string | null
          created_by: string | null
          customer_profile_id: string | null
          descricao: string | null
          expired_at: string | null
          id: string
          imagem_url: string | null
          introducao: string | null
          itens: Json
          last_viewed_at: string | null
          margem_percentual: number | null
          order_id: string | null
          origem: string | null
          payment_terms: string | null
          payment_url: string | null
          percentual_sinal: number | null
          pix_payload: string | null
          pix_txid: string | null
          pix_valor: number | null
          prazo: string | null
          prazo_entrega: string | null
          prazo_producao: string | null
          preview_url: string | null
          production_order_id: string | null
          proposta_numero: string | null
          raw_data: Json | null
          rejected_at: string | null
          rejection_reason: string | null
          resumo: string | null
          sent_at: string | null
          signature_signed_at: string | null
          sinal_pago: boolean | null
          source_id: string | null
          status: string | null
          titulo: string | null
          token: string
          updated_at: string | null
          updated_by: string | null
          user_agent: string | null
          valid_until: string | null
          validade_dias: number | null
          valor_desconto: number | null
          valor_sinal: number | null
          valor_total: number | null
          version: number | null
          view_count: number | null
          viewed_at: string | null
        }
        Insert: {
          accepted_terms?: boolean | null
          approval_document?: string | null
          approval_hash?: string | null
          approval_name?: string | null
          approval_note?: string | null
          approved_at?: string | null
          capa_url?: string | null
          change_requested_at?: string | null
          client_ip?: string | null
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_whatsapp?: string | null
          company_id?: string | null
          condicao_pagamento?: string | null
          condicoes?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_profile_id?: string | null
          descricao?: string | null
          expired_at?: string | null
          id?: string
          imagem_url?: string | null
          introducao?: string | null
          itens?: Json
          last_viewed_at?: string | null
          margem_percentual?: number | null
          order_id?: string | null
          origem?: string | null
          payment_terms?: string | null
          payment_url?: string | null
          percentual_sinal?: number | null
          pix_payload?: string | null
          pix_txid?: string | null
          pix_valor?: number | null
          prazo?: string | null
          prazo_entrega?: string | null
          prazo_producao?: string | null
          preview_url?: string | null
          production_order_id?: string | null
          proposta_numero?: string | null
          raw_data?: Json | null
          rejected_at?: string | null
          rejection_reason?: string | null
          resumo?: string | null
          sent_at?: string | null
          signature_signed_at?: string | null
          sinal_pago?: boolean | null
          source_id?: string | null
          status?: string | null
          titulo?: string | null
          token?: string
          updated_at?: string | null
          updated_by?: string | null
          user_agent?: string | null
          valid_until?: string | null
          validade_dias?: number | null
          valor_desconto?: number | null
          valor_sinal?: number | null
          valor_total?: number | null
          version?: number | null
          view_count?: number | null
          viewed_at?: string | null
        }
        Update: {
          accepted_terms?: boolean | null
          approval_document?: string | null
          approval_hash?: string | null
          approval_name?: string | null
          approval_note?: string | null
          approved_at?: string | null
          capa_url?: string | null
          change_requested_at?: string | null
          client_ip?: string | null
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_whatsapp?: string | null
          company_id?: string | null
          condicao_pagamento?: string | null
          condicoes?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_profile_id?: string | null
          descricao?: string | null
          expired_at?: string | null
          id?: string
          imagem_url?: string | null
          introducao?: string | null
          itens?: Json
          last_viewed_at?: string | null
          margem_percentual?: number | null
          order_id?: string | null
          origem?: string | null
          payment_terms?: string | null
          payment_url?: string | null
          percentual_sinal?: number | null
          pix_payload?: string | null
          pix_txid?: string | null
          pix_valor?: number | null
          prazo?: string | null
          prazo_entrega?: string | null
          prazo_producao?: string | null
          preview_url?: string | null
          production_order_id?: string | null
          proposta_numero?: string | null
          raw_data?: Json | null
          rejected_at?: string | null
          rejection_reason?: string | null
          resumo?: string | null
          sent_at?: string | null
          signature_signed_at?: string | null
          sinal_pago?: boolean | null
          source_id?: string | null
          status?: string | null
          titulo?: string | null
          token?: string
          updated_at?: string | null
          updated_by?: string | null
          user_agent?: string | null
          valid_until?: string | null
          validade_dias?: number | null
          valor_desconto?: number | null
          valor_sinal?: number | null
          valor_total?: number | null
          version?: number | null
          view_count?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "proposals_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_customers: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          document_hash: string | null
          id: string
          provider: string
          provider_customer_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          document_hash?: string | null
          id?: string
          provider: string
          provider_customer_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          document_hash?: string | null
          id?: string
          provider?: string
          provider_customer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_templates: {
        Row: {
          ativo: boolean | null
          company_id: string | null
          created_at: string | null
          id: string
          nome: string
          perguntas: Json
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          perguntas?: Json
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          perguntas?: Json
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      recurring_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          frequency: string | null
          id: string
          last_repeated_at: string | null
          next_due_at: string | null
          notes: string | null
          original_order_id: string | null
          status: string
          title: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          frequency?: string | null
          id?: string
          last_repeated_at?: string | null
          next_due_at?: string | null
          notes?: string | null
          original_order_id?: string | null
          status?: string
          title?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          frequency?: string | null
          id?: string
          last_repeated_at?: string | null
          next_due_at?: string | null
          notes?: string | null
          original_order_id?: string | null
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "recurring_orders_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      security_blocklist: {
        Row: {
          active: boolean
          created_at: string | null
          created_by: string | null
          id: string
          reason: string | null
          type: string
          value: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string | null
          type: string
          value: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string | null
          type?: string
          value?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          actor_user_id: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          event_type: string
          id: string
          ip: string | null
          metadata: Json
          method: string | null
          path: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          user_agent: string | null
          user_email: string | null
        }
        Insert: {
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json
          method?: string | null
          path?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
          user_agent?: string | null
          user_email?: string | null
        }
        Update: {
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json
          method?: string | null
          path?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
          user_agent?: string | null
          user_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      signup_lead_followups: {
        Row: {
          admin_email: string | null
          channel: string
          created_at: string | null
          created_by_admin_id: string | null
          id: string
          lead_id: string
          message: string | null
          raw_data: Json
          sales_event_type: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          admin_email?: string | null
          channel?: string
          created_at?: string | null
          created_by_admin_id?: string | null
          id?: string
          lead_id: string
          message?: string | null
          raw_data?: Json
          sales_event_type?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          admin_email?: string | null
          channel?: string
          created_at?: string | null
          created_by_admin_id?: string | null
          id?: string
          lead_id?: string
          message?: string | null
          raw_data?: Json
          sales_event_type?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_lead_followups_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_lead_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "admin_signup_leads_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_lead_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "signup_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_leads: {
        Row: {
          affiliate_referral_id: string | null
          assigned_to_admin_id: string | null
          checkout_url: string | null
          cidade: string | null
          converted_company_id: string | null
          converted_user_id: string | null
          created_at: string | null
          created_by_admin_id: string | null
          email: string
          empresa_nome: string
          estado: string | null
          followup_count: number
          id: string
          last_followup_at: string | null
          lead_source: string
          marketing_opt_in: boolean
          marketing_opt_in_text: string | null
          mercado_pago_payment_id: string | null
          mercado_pago_preference_id: string | null
          modelo_negocio: string | null
          next_followup_at: string | null
          nome_responsavel: string | null
          paid_at: string | null
          payment_status: string | null
          plano: string
          raw_data: Json
          referral_code: string | null
          sales_last_contact_at: string | null
          sales_lost_reason: string | null
          sales_next_action_at: string | null
          sales_notes: string | null
          sales_stage: string
          sales_stage_updated_at: string
          segmento: string | null
          slug_sugerido: string | null
          status: string
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          affiliate_referral_id?: string | null
          assigned_to_admin_id?: string | null
          checkout_url?: string | null
          cidade?: string | null
          converted_company_id?: string | null
          converted_user_id?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          email: string
          empresa_nome: string
          estado?: string | null
          followup_count?: number
          id?: string
          last_followup_at?: string | null
          lead_source?: string
          marketing_opt_in?: boolean
          marketing_opt_in_text?: string | null
          mercado_pago_payment_id?: string | null
          mercado_pago_preference_id?: string | null
          modelo_negocio?: string | null
          next_followup_at?: string | null
          nome_responsavel?: string | null
          paid_at?: string | null
          payment_status?: string | null
          plano?: string
          raw_data?: Json
          referral_code?: string | null
          sales_last_contact_at?: string | null
          sales_lost_reason?: string | null
          sales_next_action_at?: string | null
          sales_notes?: string | null
          sales_stage?: string
          sales_stage_updated_at?: string
          segmento?: string | null
          slug_sugerido?: string | null
          status?: string
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          affiliate_referral_id?: string | null
          assigned_to_admin_id?: string | null
          checkout_url?: string | null
          cidade?: string | null
          converted_company_id?: string | null
          converted_user_id?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          email?: string
          empresa_nome?: string
          estado?: string | null
          followup_count?: number
          id?: string
          last_followup_at?: string | null
          lead_source?: string
          marketing_opt_in?: boolean
          marketing_opt_in_text?: string | null
          mercado_pago_payment_id?: string | null
          mercado_pago_preference_id?: string | null
          modelo_negocio?: string | null
          next_followup_at?: string | null
          nome_responsavel?: string | null
          paid_at?: string | null
          payment_status?: string | null
          plano?: string
          raw_data?: Json
          referral_code?: string | null
          sales_last_contact_at?: string | null
          sales_lost_reason?: string | null
          sales_next_action_at?: string | null
          sales_notes?: string | null
          sales_stage?: string
          sales_stage_updated_at?: string
          segmento?: string | null
          slug_sugerido?: string | null
          status?: string
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signup_leads_affiliate_referral_id_fkey"
            columns: ["affiliate_referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_leads_assigned_to_admin_id_fkey"
            columns: ["assigned_to_admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_leads_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      site_sections: {
        Row: {
          active: boolean
          button_label: string | null
          button_url: string | null
          company_id: string
          config: Json
          content: string | null
          created_at: string | null
          id: string
          image_url: string | null
          locked: boolean
          sort_order: number
          subtitle: string | null
          title: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          button_label?: string | null
          button_url?: string | null
          company_id: string
          config?: Json
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          locked?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          button_label?: string | null
          button_url?: string | null
          company_id?: string
          config?: Json
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          locked?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      site_template_presets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          payload: Json
          segment: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          name: string
          payload?: Json
          segment: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          payload?: Json
          segment?: string
        }
        Relationships: []
      }
      smart_notification_events: {
        Row: {
          company_id: string
          created_at: string
          entity: string | null
          entity_id: string | null
          event_key: string
          event_type: string
          id: string
          resolved_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          event_key: string
          event_type: string
          id?: string
          resolved_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          event_key?: string
          event_type?: string
          id?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      smart_notification_settings: {
        Row: {
          company_id: string
          coupon_expiring_days: number
          coupon_expiring_enabled: boolean
          created_at: string
          lead_idle_days: number
          lead_idle_enabled: boolean
          new_order_enabled: boolean
          order_stuck_days: number
          order_stuck_enabled: boolean
          product_without_image_enabled: boolean
          proposal_idle_days: number
          proposal_idle_enabled: boolean
          site_without_logo_enabled: boolean
          subscription_expiring_days: number
          subscription_expiring_enabled: boolean
          task_due_today_enabled: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          coupon_expiring_days?: number
          coupon_expiring_enabled?: boolean
          created_at?: string
          lead_idle_days?: number
          lead_idle_enabled?: boolean
          new_order_enabled?: boolean
          order_stuck_days?: number
          order_stuck_enabled?: boolean
          product_without_image_enabled?: boolean
          proposal_idle_days?: number
          proposal_idle_enabled?: boolean
          site_without_logo_enabled?: boolean
          subscription_expiring_days?: number
          subscription_expiring_enabled?: boolean
          task_due_today_enabled?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          coupon_expiring_days?: number
          coupon_expiring_enabled?: boolean
          created_at?: string
          lead_idle_days?: number
          lead_idle_enabled?: boolean
          new_order_enabled?: boolean
          order_stuck_days?: number
          order_stuck_enabled?: boolean
          product_without_image_enabled?: boolean
          proposal_idle_days?: number
          proposal_idle_enabled?: boolean
          site_without_logo_enabled?: boolean
          subscription_expiring_days?: number
          subscription_expiring_enabled?: boolean
          task_due_today_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          company_id: string
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          metadata: Json
          new_status: string | null
          old_status: string | null
          payload_hash: string | null
          processed_at: string | null
          processing_status: string | null
          provider: string
          provider_event_id: string | null
          provider_object_id: string | null
          provider_reference: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json
          new_status?: string | null
          old_status?: string | null
          payload_hash?: string | null
          processed_at?: string | null
          processing_status?: string | null
          provider?: string
          provider_event_id?: string | null
          provider_object_id?: string | null
          provider_reference?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          new_status?: string | null
          old_status?: string | null
          payload_hash?: string | null
          processed_at?: string | null
          processing_status?: string | null
          provider?: string
          provider_event_id?: string | null
          provider_object_id?: string | null
          provider_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      system_audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          details: Json
          entity: string | null
          entity_id: string | null
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      timeline_events: {
        Row: {
          actor_id: string | null
          aggregate_id: string | null
          aggregate_type: string
          company_id: string
          customer_profile_id: string | null
          detail: string | null
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          source: string
          source_id: string | null
          title: string
        }
        Insert: {
          actor_id?: string | null
          aggregate_id?: string | null
          aggregate_type: string
          company_id: string
          customer_profile_id?: string | null
          detail?: string | null
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source?: string
          source_id?: string | null
          title: string
        }
        Update: {
          actor_id?: string | null
          aggregate_id?: string | null
          aggregate_type?: string
          company_id?: string
          customer_profile_id?: string | null
          detail?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source?: string
          source_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "timeline_events_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactional_outbox: {
        Row: {
          aggregate_id: string | null
          aggregate_type: string
          attempts: number
          available_at: string
          company_id: string | null
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          aggregate_id?: string | null
          aggregate_type: string
          attempts?: number
          available_at?: string
          company_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          aggregate_id?: string | null
          aggregate_type?: string
          attempts?: number
          available_at?: string
          company_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactional_outbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactional_outbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      wealth_debt_terms: {
        Row: {
          id: string
          installment_count: number | null
          minimum_cents: number
          monthly_rate_bps: number
          next_due_date: string | null
          principal_cents: number
          priority: number
          remaining_installments: number | null
        }
        Insert: {
          id: string
          installment_count?: number | null
          minimum_cents: number
          monthly_rate_bps: number
          next_due_date?: string | null
          principal_cents: number
          priority?: number
          remaining_installments?: number | null
        }
        Update: {
          id?: string
          installment_count?: number | null
          minimum_cents?: number
          monthly_rate_bps?: number
          next_due_date?: string | null
          principal_cents?: number
          priority?: number
          remaining_installments?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wealth_debt_terms_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "wealth_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      wealth_entries: {
        Row: {
          amount_cents: number
          archived_at: string | null
          category: string
          created_at: string
          currency: string
          financial_date: string
          id: string
          idempotency_key: string
          kind: string
          liquidity: string
          position_class: string | null
          recurrence: string
          title: string
          updated_at: string
          user_id: string
          valuation_status: string
          version: number
        }
        Insert: {
          amount_cents: number
          archived_at?: string | null
          category: string
          created_at?: string
          currency?: string
          financial_date: string
          id?: string
          idempotency_key: string
          kind: string
          liquidity?: string
          position_class?: string | null
          recurrence?: string
          title: string
          updated_at?: string
          user_id: string
          valuation_status?: string
          version?: number
        }
        Update: {
          amount_cents?: number
          archived_at?: string | null
          category?: string
          created_at?: string
          currency?: string
          financial_date?: string
          id?: string
          idempotency_key?: string
          kind?: string
          liquidity?: string
          position_class?: string | null
          recurrence?: string
          title?: string
          updated_at?: string
          user_id?: string
          valuation_status?: string
          version?: number
        }
        Relationships: []
      }
      wealth_goals: {
        Row: {
          archived_at: string | null
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          monthly_contribution_cents: number
          saved_cents: number
          status: string
          target_cents: number
          target_date: string
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          monthly_contribution_cents?: number
          saved_cents?: number
          status?: string
          target_cents: number
          target_date: string
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          monthly_contribution_cents?: number
          saved_cents?: number
          status?: string
          target_cents?: number
          target_date?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      wealth_holdings: {
        Row: {
          cost_basis_cents: number | null
          exposure_currency: string | null
          id: string
          instrument: string
          issuer: string | null
          maturity: string | null
          portfolio_id: string
          quantity: number
          sector: string | null
          user_id: string
          valuation_source: string
        }
        Insert: {
          cost_basis_cents?: number | null
          exposure_currency?: string | null
          id: string
          instrument: string
          issuer?: string | null
          maturity?: string | null
          portfolio_id: string
          quantity: number
          sector?: string | null
          user_id: string
          valuation_source: string
        }
        Update: {
          cost_basis_cents?: number | null
          exposure_currency?: string | null
          id?: string
          instrument?: string
          issuer?: string | null
          maturity?: string | null
          portfolio_id?: string
          quantity?: number
          sector?: string | null
          user_id?: string
          valuation_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "wealth_holdings_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "wealth_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wealth_holdings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "wealth_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      wealth_net_worth_snapshots: {
        Row: {
          captured_at: string
          composition: Json
          id: string
          idempotency_key: string
          local_date: string
          source: string
          timezone: string
          user_id: string
        }
        Insert: {
          captured_at: string
          composition: Json
          id?: string
          idempotency_key: string
          local_date: string
          source: string
          timezone: string
          user_id: string
        }
        Update: {
          captured_at?: string
          composition?: Json
          id?: string
          idempotency_key?: string
          local_date?: string
          source?: string
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
      wealth_portfolio_transactions: {
        Row: {
          amount_cents: number
          basis_removed_cents: number | null
          created_at: string
          destination_id: string | null
          financial_date: string
          holding_id: string
          id: string
          position_after: Json
          position_before: Json
          quantity: number
          realized_gain_cents: number | null
          reference: string
          type: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          basis_removed_cents?: number | null
          created_at?: string
          destination_id?: string | null
          financial_date: string
          holding_id: string
          id?: string
          position_after: Json
          position_before: Json
          quantity: number
          realized_gain_cents?: number | null
          reference: string
          type: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          basis_removed_cents?: number | null
          created_at?: string
          destination_id?: string | null
          financial_date?: string
          holding_id?: string
          id?: string
          position_after?: Json
          position_before?: Json
          quantity?: number
          realized_gain_cents?: number | null
          reference?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wealth_portfolio_transactions_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "wealth_holdings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wealth_portfolio_transactions_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "wealth_holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      wealth_portfolios: {
        Row: {
          created_at: string
          goal_id: string | null
          id: string
          kind: string
          lab_positions: Json
          name: string
          targets: Json
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          goal_id?: string | null
          id?: string
          kind: string
          lab_positions?: Json
          name: string
          targets?: Json
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          goal_id?: string | null
          id?: string
          kind?: string
          lab_positions?: Json
          name?: string
          targets?: Json
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "wealth_portfolios_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "wealth_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      wealth_profiles: {
        Row: {
          currency: string
          dependents: number
          emergency_months: number
          monthly_budget_cents: number
          monthly_income_cents: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          currency?: string
          dependents?: number
          emergency_months?: number
          monthly_budget_cents?: number
          monthly_income_cents?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          currency?: string
          dependents?: number
          emergency_months?: number
          monthly_budget_cents?: number
          monthly_income_cents?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wealth_recurrence_occurrences: {
        Row: {
          created_at: string
          entry_id: string | null
          financial_date: string
          occurrence_index: number
          schedule_id: string
        }
        Insert: {
          created_at?: string
          entry_id?: string | null
          financial_date: string
          occurrence_index: number
          schedule_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string | null
          financial_date?: string
          occurrence_index?: number
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wealth_recurrence_occurrences_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "wealth_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wealth_recurrence_occurrences_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "wealth_recurring_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      wealth_recurring_schedules: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          currency: string
          end_date: string | null
          frequency: string
          id: string
          idempotency_key: string
          interval_count: number
          kind: string
          last_run_at: string | null
          max_occurrences: number | null
          next_date: string
          next_index: number
          next_run_at: string
          pause_reason: string | null
          source_entry_id: string | null
          start_date: string
          status: string
          timezone: string
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          amount_cents: number
          category: string
          created_at?: string
          currency?: string
          end_date?: string | null
          frequency: string
          id?: string
          idempotency_key: string
          interval_count?: number
          kind: string
          last_run_at?: string | null
          max_occurrences?: number | null
          next_date: string
          next_index?: number
          next_run_at: string
          pause_reason?: string | null
          source_entry_id?: string | null
          start_date: string
          status?: string
          timezone: string
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          currency?: string
          end_date?: string | null
          frequency?: string
          id?: string
          idempotency_key?: string
          interval_count?: number
          kind?: string
          last_run_at?: string | null
          max_occurrences?: number | null
          next_date?: string
          next_index?: number
          next_run_at?: string
          pause_reason?: string | null
          source_entry_id?: string | null
          start_date?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "wealth_recurring_schedules_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "wealth_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          access_token_ciphertext: string | null
          business_name: string | null
          company_id: string
          connected_at: string | null
          created_at: string
          display_phone_number: string | null
          id: string
          last_verified_at: string | null
          metadata: Json
          phone_number_id: string | null
          provider: string
          status: string
          token_expires_at: string | null
          updated_at: string
          waba_id: string | null
        }
        Insert: {
          access_token_ciphertext?: string | null
          business_name?: string | null
          company_id: string
          connected_at?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_verified_at?: string | null
          metadata?: Json
          phone_number_id?: string | null
          provider?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          waba_id?: string | null
        }
        Update: {
          access_token_ciphertext?: string | null
          business_name?: string | null
          company_id?: string
          connected_at?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_verified_at?: string | null
          metadata?: Json
          phone_number_id?: string | null
          provider?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          ai_enabled: boolean
          company_id: string | null
          created_at: string
          customer_name: string | null
          id: string
          last_inbound_at: string | null
          last_message: string | null
          last_outbound_at: string | null
          metadata: Json
          phone: string
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          company_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message?: string | null
          last_outbound_at?: string | null
          metadata?: Json
          phone: string
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          company_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message?: string | null
          last_outbound_at?: string | null
          metadata?: Json
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      whatsapp_message_logs: {
        Row: {
          company_id: string | null
          content: string | null
          conversation_id: string | null
          created_at: string
          direction: string
          error: string | null
          event_type: string | null
          from_phone: string | null
          id: string
          message_type: string
          meta_message_id: string | null
          order_id: string | null
          proposal_id: string | null
          provider_timestamp: string | null
          raw_payload: Json | null
          raw_response: Json | null
          status: string
          to_phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          event_type?: string | null
          from_phone?: string | null
          id?: string
          message_type?: string
          meta_message_id?: string | null
          order_id?: string | null
          proposal_id?: string | null
          provider_timestamp?: string | null
          raw_payload?: Json | null
          raw_response?: Json | null
          status?: string
          to_phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          event_type?: string | null
          from_phone?: string | null
          id?: string
          message_type?: string
          meta_message_id?: string | null
          order_id?: string | null
          proposal_id?: string | null
          provider_timestamp?: string | null
          raw_payload?: Json | null
          raw_response?: Json | null
          status?: string
          to_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "whatsapp_message_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_logs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_logs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          company_id: string | null
          error_message: string | null
          event_key: string
          event_type: string
          id: string
          payload_hash: string | null
          processed_at: string | null
          processing_status: string
          received_at: string
        }
        Insert: {
          company_id?: string | null
          error_message?: string | null
          event_key: string
          event_type: string
          id?: string
          payload_hash?: string | null
          processed_at?: string | null
          processing_status?: string
          received_at?: string
        }
        Update: {
          company_id?: string | null
          error_message?: string | null
          event_key?: string
          event_type?: string
          id?: string
          payload_hash?: string | null
          processed_at?: string | null
          processing_status?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
    }
    Views: {
      admin_signup_leads_overview: {
        Row: {
          checkout_url: string | null
          cidade: string | null
          converted_company_id: string | null
          converted_user_id: string | null
          created_at: string | null
          dias_sem_converter: number | null
          email: string | null
          empresa_nome: string | null
          estado: string | null
          followup_count: number | null
          followup_due: boolean | null
          id: string | null
          last_followup_at: string | null
          lead_source: string | null
          marketing_opt_in: boolean | null
          marketing_opt_in_text: string | null
          mercado_pago_payment_id: string | null
          mercado_pago_preference_id: string | null
          modelo_negocio: string | null
          next_followup_at: string | null
          nome_responsavel: string | null
          paid_at: string | null
          payment_status: string | null
          plano: string | null
          raw_data: Json | null
          segmento: string | null
          slug_sugerido: string | null
          status: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          checkout_url?: string | null
          cidade?: string | null
          converted_company_id?: string | null
          converted_user_id?: string | null
          created_at?: string | null
          dias_sem_converter?: never
          email?: string | null
          empresa_nome?: string | null
          estado?: string | null
          followup_count?: number | null
          followup_due?: never
          id?: string | null
          last_followup_at?: string | null
          lead_source?: string | null
          marketing_opt_in?: boolean | null
          marketing_opt_in_text?: string | null
          mercado_pago_payment_id?: string | null
          mercado_pago_preference_id?: string | null
          modelo_negocio?: string | null
          next_followup_at?: string | null
          nome_responsavel?: string | null
          paid_at?: string | null
          payment_status?: string | null
          plano?: string | null
          raw_data?: Json | null
          segmento?: string | null
          slug_sugerido?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          checkout_url?: string | null
          cidade?: string | null
          converted_company_id?: string | null
          converted_user_id?: string | null
          created_at?: string | null
          dias_sem_converter?: never
          email?: string | null
          empresa_nome?: string | null
          estado?: string | null
          followup_count?: number | null
          followup_due?: never
          id?: string | null
          last_followup_at?: string | null
          lead_source?: string | null
          marketing_opt_in?: boolean | null
          marketing_opt_in_text?: string | null
          mercado_pago_payment_id?: string | null
          mercado_pago_preference_id?: string | null
          modelo_negocio?: string | null
          next_followup_at?: string | null
          nome_responsavel?: string | null
          paid_at?: string | null
          payment_status?: string | null
          plano?: string | null
          raw_data?: Json | null
          segmento?: string | null
          slug_sugerido?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      company_members_public: {
        Row: {
          cargo: string | null
          company_id: string | null
          created_at: string | null
          email: string | null
          id: string | null
          nome: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          cargo?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: never
          id?: string | null
          nome?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          cargo?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: never
          id?: string | null
          nome?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      orcaly_company_health: {
        Row: {
          assinatura_status: string | null
          company_id: string | null
          leads_count: number | null
          logo_url: string | null
          nome: string | null
          open_tasks_count: number | null
          orders_count: number | null
          products_count: number | null
          site_publico_ativo: boolean | null
          site_template: string | null
          slug: string | null
          unread_notifications_count: number | null
          whatsapp: string | null
          whatsapp_enabled: boolean | null
        }
        Insert: {
          assinatura_status?: string | null
          company_id?: string | null
          leads_count?: never
          logo_url?: string | null
          nome?: string | null
          open_tasks_count?: never
          orders_count?: never
          products_count?: never
          site_publico_ativo?: boolean | null
          site_template?: string | null
          slug?: string | null
          unread_notifications_count?: never
          whatsapp?: string | null
          whatsapp_enabled?: boolean | null
        }
        Update: {
          assinatura_status?: string | null
          company_id?: string | null
          leads_count?: never
          logo_url?: string | null
          nome?: string | null
          open_tasks_count?: never
          orders_count?: never
          products_count?: never
          site_publico_ativo?: boolean | null
          site_template?: string | null
          slug?: string | null
          unread_notifications_count?: never
          whatsapp?: string | null
          whatsapp_enabled?: boolean | null
        }
        Relationships: []
      }
      production_dashboard: {
        Row: {
          company_id: string | null
          completed_at: string | null
          completed_steps: number | null
          created_at: string | null
          customer_name: string | null
          customer_whatsapp: string | null
          due_date: string | null
          id: string | null
          order_id: string | null
          priority: string | null
          proposal_id: string | null
          signal_value: number | null
          started_at: string | null
          status: string | null
          title: string | null
          total_steps: number | null
          total_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "production_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals_dashboard: {
        Row: {
          approved_at: string | null
          change_requested_at: string | null
          cliente_nome: string | null
          cliente_whatsapp: string | null
          company_id: string | null
          created_at: string | null
          id: string | null
          order_id: string | null
          pedido_produto: string | null
          pedido_status: string | null
          production_order_id: string | null
          proposta_numero: string | null
          rejected_at: string | null
          sent_at: string | null
          signature_signed_at: string | null
          status: string | null
          titulo: string | null
          token: string | null
          valid_until: string | null
          valor_sinal: number | null
          valor_total: number | null
          viewed_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "orcaly_company_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "proposals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      public_company_profiles: {
        Row: {
          ativo: boolean | null
          cidade: string | null
          cor_principal: string | null
          estado: string | null
          id: string | null
          logo_url: string | null
          modelo_negocio: string | null
          modelo_nome: string | null
          modelo_perguntas: Json | null
          nome: string | null
          segmento: string | null
          site_accent_color: string | null
          site_config: Json | null
          site_primary_color: string | null
          site_status: string | null
          site_template: string | null
          slug: string | null
          subdomain_slug: string | null
          whatsapp: string | null
        }
        Relationships: []
      }
      public_marketplace_companies: {
        Row: {
          aceita_pix: boolean | null
          atendimento_horario: string | null
          atendimento_observacao: string | null
          ativo: boolean | null
          cobrar_sinal: boolean | null
          cor_principal: string | null
          id: string | null
          instagram: string | null
          logo_url: string | null
          modelo_negocio: string | null
          modelo_nome: string | null
          modelo_perguntas: Json | null
          nome: string | null
          percentual_sinal: number | null
          site_accent_color: string | null
          site_primary_color: string | null
          slug: string | null
          subdomain_slug: string | null
          whatsapp: string | null
        }
        Relationships: []
      }
      public_marketplace_products: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          company_id: string | null
          configuracoes: Json | null
          created_at: string | null
          descricao: string | null
          destaque: boolean | null
          id: string | null
          image_urls: string[] | null
          imagem_url: string | null
          nome: string | null
          permite_altura: boolean | null
          permite_comprimento: boolean | null
          permite_largura: boolean | null
          permite_quantidade: boolean | null
          prazo_medio: string | null
          precificacao: string | null
          preco: number | null
          tipo: string | null
          unidade: string | null
          unidade_label: string | null
          valor_minimo: number | null
        }
        Relationships: []
      }
      public_site_companies: {
        Row: {
          atendimento_horario: string | null
          atendimento_observacao: string | null
          cidade: string | null
          estado: string | null
          id: string | null
          instagram: string | null
          logo_url: string | null
          marketplace_ativo: boolean | null
          marketplace_endereco: string | null
          marketplace_mapa_url: string | null
          marketplace_subtitulo: string | null
          marketplace_texto_botao: string | null
          marketplace_titulo: string | null
          modelo_negocio: string | null
          modelo_nome: string | null
          nome: string | null
          segmento: string | null
          site_about_text: string | null
          site_about_title: string | null
          site_accent_color: string | null
          site_art_style: string | null
          site_background_color: string | null
          site_badge_text: string | null
          site_banner_url: string | null
          site_benefits: Json | null
          site_business_hours: Json | null
          site_button_style: string | null
          site_card_color: string | null
          site_contact_title: string | null
          site_cta_text: string | null
          site_custom_sections: Json | null
          site_delivery_options: string[] | null
          site_faq: Json | null
          site_features: Json | null
          site_font_style: string | null
          site_gallery: Json | null
          site_headline: string | null
          site_hero_alignment: string | null
          site_keywords: string[] | null
          site_layout: string | null
          site_payment_methods: string[] | null
          site_primary_color: string | null
          site_promo_active: boolean | null
          site_promo_button_text: string | null
          site_promo_text: string | null
          site_promo_title: string | null
          site_publico_ativo: boolean | null
          site_secondary_cta_text: string | null
          site_seo_description: string | null
          site_seo_title: string | null
          site_services_title: string | null
          site_show_about: boolean | null
          site_show_benefits: boolean | null
          site_show_contact: boolean | null
          site_show_faq: boolean | null
          site_show_featured: boolean | null
          site_show_gallery: boolean | null
          site_show_store: boolean | null
          site_show_testimonials: boolean | null
          site_subheadline: string | null
          site_template: string | null
          site_testimonials: Json | null
          site_text_color: string | null
          site_whatsapp_message: string | null
          slug: string | null
          subdomain_slug: string | null
          whatsapp: string | null
        }
        Relationships: []
      }
      public_site_sections: {
        Row: {
          button_label: string | null
          button_url: string | null
          company_id: string | null
          config: Json | null
          content: string | null
          id: string | null
          image_url: string | null
          sort_order: number | null
          subtitle: string | null
          title: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_store_products: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          company_id: string | null
          descricao: string | null
          destaque: boolean | null
          id: string | null
          image_urls: string[] | null
          imagem_url: string | null
          nome: string | null
          prazo_medio: string | null
          preco: number | null
          variacoes: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_affiliate_payout_admin: {
        Args: { p_payout_id: string; p_reason: string }
        Returns: boolean
      }
      capture_wealth_net_worth: {
        Args: { p_idempotency_key: string }
        Returns: string
      }
      change_signup_lead_sales_stage: {
        Args: {
          p_actor_admin_id: string
          p_lead_id: string
          p_lost_reason?: string
          p_note?: string
          p_stage: string
        }
        Returns: undefined
      }
      change_wealth_recurrence: {
        Args: { p_id: string; p_operation: string; p_version: number }
        Returns: boolean
      }
      claim_background_jobs: {
        Args: { p_limit?: number; p_worker: string }
        Returns: {
          attempts: number
          company_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          metadata: Json
          payload: Json
          run_after: string
          started_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "background_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_company_subscription_trial: {
        Args: { p_company_id: string }
        Returns: {
          access_until: string | null
          aceita_cartao: boolean | null
          aceita_pix: boolean | null
          assinatura_auto_recorrente: boolean | null
          assinatura_cancelada_em: string | null
          assinatura_checkout_url: string | null
          assinatura_expira_em: string | null
          assinatura_forma_pagamento_preferida: string | null
          assinatura_inicio: string | null
          assinatura_mp_payload: Json | null
          assinatura_pix_avulso_status: string | null
          assinatura_pix_avulso_ultimo_pagamento: string | null
          assinatura_plano: string | null
          assinatura_proxima_cobranca: string | null
          assinatura_status: string | null
          assinatura_ultimo_pagamento: string | null
          atendimento_horario: string | null
          atendimento_observacao: string | null
          ativo: boolean | null
          banner_url: string | null
          business_type: string | null
          cancel_at_period_end: boolean
          cidade: string | null
          cobrar_sinal: boolean | null
          cor_principal: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          founder_billing_attempts: number
          founder_billing_authorized_at: string | null
          founder_billing_claim_id: string | null
          founder_billing_claimed_at: string | null
          founder_billing_last_error: string | null
          founder_billing_last_sync_at: string | null
          founder_billing_setup_at: string | null
          founder_number: number | null
          founder_price_cents: number | null
          founder_price_conversion_attempts: number
          founder_price_conversion_claim_id: string | null
          founder_price_conversion_claimed_at: string | null
          founder_price_conversion_last_error: string | null
          founder_price_converted_at: string | null
          founder_price_ends_at: string | null
          founder_started_at: string | null
          founder_trial_ends_at: string | null
          founder_welcome_seen_at: string | null
          id: string
          instagram: string | null
          is_founder: boolean
          logo_url: string | null
          marketplace_ativo: boolean | null
          marketplace_banner_url: string | null
          marketplace_config: Json | null
          marketplace_endereco: string | null
          marketplace_mapa_url: string | null
          marketplace_sobre: string | null
          marketplace_subtitulo: string | null
          marketplace_termos: string | null
          marketplace_texto_botao: string | null
          marketplace_titulo: string | null
          mercado_pago_customer_email: string | null
          mercado_pago_subscription_id: string | null
          mercado_pago_subscription_status: string | null
          modelo_campos_recomendados: string[] | null
          modelo_mensagens: Json | null
          modelo_negocio: string | null
          modelo_nome: string | null
          modelo_perguntas: Json | null
          modelo_proposta: Json | null
          modelo_status: string[] | null
          next_billing_at: string | null
          nome: string
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_current_step: number | null
          onboarding_dismissed: boolean | null
          onboarding_goal: string | null
          onboarding_updated_at: string | null
          owner_id: string | null
          percentual_sinal: number | null
          pix_cidade: string | null
          pix_key: string | null
          pix_nome: string | null
          pix_tipo: string | null
          plano: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          segmento: string | null
          site_about_text: string | null
          site_about_title: string | null
          site_accent_color: string | null
          site_art_style: string | null
          site_art_variant: string | null
          site_background_color: string | null
          site_badge_text: string | null
          site_banner_url: string | null
          site_benefits: Json | null
          site_brand_words: string[] | null
          site_business_hours: Json | null
          site_button_style: string | null
          site_card_color: string | null
          site_cart_button_text: string | null
          site_checkout_button_text: string | null
          site_checkout_mode: string | null
          site_config: Json | null
          site_contact_title: string | null
          site_corner_style: string | null
          site_cta_label: string | null
          site_cta_text: string | null
          site_custom_sections: Json | null
          site_delivery_options: string[] | null
          site_density: string | null
          site_empty_catalog_text: string | null
          site_enable_cart: boolean | null
          site_enable_coupons: boolean | null
          site_faq: Json | null
          site_features: Json | null
          site_font_style: string | null
          site_footer_text: string | null
          site_gallery: Json | null
          site_headline: string | null
          site_hero_alignment: string | null
          site_hero_highlights: Json | null
          site_hero_style: string | null
          site_keywords: string[] | null
          site_layout: string | null
          site_marketplace_subtitle: string | null
          site_marketplace_title: string | null
          site_nav_variant: string | null
          site_payment_methods: string[] | null
          site_primary_color: string | null
          site_product_card_style: string | null
          site_promo_active: boolean | null
          site_promo_button_text: string | null
          site_promo_text: string | null
          site_promo_title: string | null
          site_publico_ativo: boolean | null
          site_secondary_cta_text: string | null
          site_section_style: string | null
          site_sections: Json | null
          site_seo_description: string | null
          site_seo_title: string | null
          site_services_title: string | null
          site_show_about: boolean | null
          site_show_benefits: boolean | null
          site_show_contact: boolean | null
          site_show_faq: boolean | null
          site_show_featured: boolean | null
          site_show_gallery: boolean | null
          site_show_marketplace: boolean | null
          site_show_prices: boolean | null
          site_show_store: boolean | null
          site_show_testimonials: boolean | null
          site_status: string | null
          site_subheadline: string | null
          site_template: string | null
          site_testimonials: Json | null
          site_text_color: string | null
          site_theme: string | null
          site_trust_title: string | null
          site_updated_at: string | null
          site_whatsapp_message: string | null
          slug: string
          subdomain_slug: string | null
          subscription_provider: string | null
          telefone: string | null
          tester_id: string | null
          timezone: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_used_at: string | null
          updated_at: string | null
          whatsapp: string | null
          whatsapp_access_token: string | null
          whatsapp_ai_enabled: boolean | null
          whatsapp_ai_prompt: string | null
          whatsapp_auto_reply_enabled: boolean | null
          whatsapp_business_account_id: string | null
          whatsapp_enabled: boolean | null
          whatsapp_order_notifications: boolean | null
          whatsapp_phone_number_id: string | null
          whatsapp_status_notifications: boolean | null
          whatsapp_verify_token: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_due_founder_price_conversions: {
        Args: { p_limit?: number }
        Returns: {
          claim_id: string
          company_id: string
          founder_price_cents: number
          founder_price_ends_at: string
          normal_price_cents: number
          plan_key: string
          provider_subscription_id: string
        }[]
      }
      claim_founder_activation: {
        Args: { p_claim_id: string; p_email: string; p_token_hash: string }
        Returns: {
          email: string
          founder_number: number
          founder_price_cents: number
          invite_id: string
          plan_key: string
          sales_lead_id: string
        }[]
      }
      claim_founder_billing_setup: {
        Args: { p_claim_id: string; p_company_id: string }
        Returns: {
          billing_start_at: string
          checkout_url: string
          company_id: string
          effective_price_cents: number
          founder_price_cents: number
          normal_price_cents: number
          payer_email: string
          plan_key: string
          plan_payment_id: string
          provider_subscription_id: string
        }[]
      }
      claim_platform_admin_invite: {
        Args: { p_claim_id: string; p_token_hash: string }
        Returns: {
          activated_at: string | null
          activation_claim_id: string | null
          area: string
          claimed_at: string | null
          created_at: string
          created_by_admin_id: string | null
          created_by_email: string
          email: string
          email_normalized: string | null
          expires_at: string
          id: string
          invited_at: string
          last_token_rotated_at: string | null
          nome: string
          observacoes: string | null
          permissions: Json
          platform_admin_id: string | null
          revoked_at: string | null
          role: string
          status: string
          token_hash: string
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_admin_invites"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      classify_wealth_position: {
        Args: {
          p_class: string
          p_entry_id: string
          p_liquidity: string
          p_version: number
        }
        Returns: boolean
      }
      complete_founder_activation: {
        Args: {
          p_business_type: string
          p_cidade?: string
          p_claim_id: string
          p_company_name: string
          p_default_setup?: Json
          p_estado?: string
          p_onboarding_goal?: string
          p_slug: string
          p_user_id: string
          p_whatsapp?: string
        }
        Returns: {
          access_until: string | null
          aceita_cartao: boolean | null
          aceita_pix: boolean | null
          assinatura_auto_recorrente: boolean | null
          assinatura_cancelada_em: string | null
          assinatura_checkout_url: string | null
          assinatura_expira_em: string | null
          assinatura_forma_pagamento_preferida: string | null
          assinatura_inicio: string | null
          assinatura_mp_payload: Json | null
          assinatura_pix_avulso_status: string | null
          assinatura_pix_avulso_ultimo_pagamento: string | null
          assinatura_plano: string | null
          assinatura_proxima_cobranca: string | null
          assinatura_status: string | null
          assinatura_ultimo_pagamento: string | null
          atendimento_horario: string | null
          atendimento_observacao: string | null
          ativo: boolean | null
          banner_url: string | null
          business_type: string | null
          cancel_at_period_end: boolean
          cidade: string | null
          cobrar_sinal: boolean | null
          cor_principal: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          founder_billing_attempts: number
          founder_billing_authorized_at: string | null
          founder_billing_claim_id: string | null
          founder_billing_claimed_at: string | null
          founder_billing_last_error: string | null
          founder_billing_last_sync_at: string | null
          founder_billing_setup_at: string | null
          founder_number: number | null
          founder_price_cents: number | null
          founder_price_conversion_attempts: number
          founder_price_conversion_claim_id: string | null
          founder_price_conversion_claimed_at: string | null
          founder_price_conversion_last_error: string | null
          founder_price_converted_at: string | null
          founder_price_ends_at: string | null
          founder_started_at: string | null
          founder_trial_ends_at: string | null
          founder_welcome_seen_at: string | null
          id: string
          instagram: string | null
          is_founder: boolean
          logo_url: string | null
          marketplace_ativo: boolean | null
          marketplace_banner_url: string | null
          marketplace_config: Json | null
          marketplace_endereco: string | null
          marketplace_mapa_url: string | null
          marketplace_sobre: string | null
          marketplace_subtitulo: string | null
          marketplace_termos: string | null
          marketplace_texto_botao: string | null
          marketplace_titulo: string | null
          mercado_pago_customer_email: string | null
          mercado_pago_subscription_id: string | null
          mercado_pago_subscription_status: string | null
          modelo_campos_recomendados: string[] | null
          modelo_mensagens: Json | null
          modelo_negocio: string | null
          modelo_nome: string | null
          modelo_perguntas: Json | null
          modelo_proposta: Json | null
          modelo_status: string[] | null
          next_billing_at: string | null
          nome: string
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_current_step: number | null
          onboarding_dismissed: boolean | null
          onboarding_goal: string | null
          onboarding_updated_at: string | null
          owner_id: string | null
          percentual_sinal: number | null
          pix_cidade: string | null
          pix_key: string | null
          pix_nome: string | null
          pix_tipo: string | null
          plano: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          segmento: string | null
          site_about_text: string | null
          site_about_title: string | null
          site_accent_color: string | null
          site_art_style: string | null
          site_art_variant: string | null
          site_background_color: string | null
          site_badge_text: string | null
          site_banner_url: string | null
          site_benefits: Json | null
          site_brand_words: string[] | null
          site_business_hours: Json | null
          site_button_style: string | null
          site_card_color: string | null
          site_cart_button_text: string | null
          site_checkout_button_text: string | null
          site_checkout_mode: string | null
          site_config: Json | null
          site_contact_title: string | null
          site_corner_style: string | null
          site_cta_label: string | null
          site_cta_text: string | null
          site_custom_sections: Json | null
          site_delivery_options: string[] | null
          site_density: string | null
          site_empty_catalog_text: string | null
          site_enable_cart: boolean | null
          site_enable_coupons: boolean | null
          site_faq: Json | null
          site_features: Json | null
          site_font_style: string | null
          site_footer_text: string | null
          site_gallery: Json | null
          site_headline: string | null
          site_hero_alignment: string | null
          site_hero_highlights: Json | null
          site_hero_style: string | null
          site_keywords: string[] | null
          site_layout: string | null
          site_marketplace_subtitle: string | null
          site_marketplace_title: string | null
          site_nav_variant: string | null
          site_payment_methods: string[] | null
          site_primary_color: string | null
          site_product_card_style: string | null
          site_promo_active: boolean | null
          site_promo_button_text: string | null
          site_promo_text: string | null
          site_promo_title: string | null
          site_publico_ativo: boolean | null
          site_secondary_cta_text: string | null
          site_section_style: string | null
          site_sections: Json | null
          site_seo_description: string | null
          site_seo_title: string | null
          site_services_title: string | null
          site_show_about: boolean | null
          site_show_benefits: boolean | null
          site_show_contact: boolean | null
          site_show_faq: boolean | null
          site_show_featured: boolean | null
          site_show_gallery: boolean | null
          site_show_marketplace: boolean | null
          site_show_prices: boolean | null
          site_show_store: boolean | null
          site_show_testimonials: boolean | null
          site_status: string | null
          site_subheadline: string | null
          site_template: string | null
          site_testimonials: Json | null
          site_text_color: string | null
          site_theme: string | null
          site_trust_title: string | null
          site_updated_at: string | null
          site_whatsapp_message: string | null
          slug: string
          subdomain_slug: string | null
          subscription_provider: string | null
          telefone: string | null
          tester_id: string | null
          timezone: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_used_at: string | null
          updated_at: string | null
          whatsapp: string | null
          whatsapp_access_token: string | null
          whatsapp_ai_enabled: boolean | null
          whatsapp_ai_prompt: string | null
          whatsapp_auto_reply_enabled: boolean | null
          whatsapp_business_account_id: string | null
          whatsapp_enabled: boolean | null
          whatsapp_order_notifications: boolean | null
          whatsapp_phone_number_id: string | null
          whatsapp_status_notifications: boolean | null
          whatsapp_verify_token: string | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_founder_billing_setup: {
        Args: {
          p_checkout_url: string
          p_claim_id: string
          p_company_id: string
          p_next_payment_date: string
          p_plan_payment_id: string
          p_provider_payload: Json
          p_provider_status: string
          p_subscription_id: string
        }
        Returns: {
          access_until: string | null
          aceita_cartao: boolean | null
          aceita_pix: boolean | null
          assinatura_auto_recorrente: boolean | null
          assinatura_cancelada_em: string | null
          assinatura_checkout_url: string | null
          assinatura_expira_em: string | null
          assinatura_forma_pagamento_preferida: string | null
          assinatura_inicio: string | null
          assinatura_mp_payload: Json | null
          assinatura_pix_avulso_status: string | null
          assinatura_pix_avulso_ultimo_pagamento: string | null
          assinatura_plano: string | null
          assinatura_proxima_cobranca: string | null
          assinatura_status: string | null
          assinatura_ultimo_pagamento: string | null
          atendimento_horario: string | null
          atendimento_observacao: string | null
          ativo: boolean | null
          banner_url: string | null
          business_type: string | null
          cancel_at_period_end: boolean
          cidade: string | null
          cobrar_sinal: boolean | null
          cor_principal: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          founder_billing_attempts: number
          founder_billing_authorized_at: string | null
          founder_billing_claim_id: string | null
          founder_billing_claimed_at: string | null
          founder_billing_last_error: string | null
          founder_billing_last_sync_at: string | null
          founder_billing_setup_at: string | null
          founder_number: number | null
          founder_price_cents: number | null
          founder_price_conversion_attempts: number
          founder_price_conversion_claim_id: string | null
          founder_price_conversion_claimed_at: string | null
          founder_price_conversion_last_error: string | null
          founder_price_converted_at: string | null
          founder_price_ends_at: string | null
          founder_started_at: string | null
          founder_trial_ends_at: string | null
          founder_welcome_seen_at: string | null
          id: string
          instagram: string | null
          is_founder: boolean
          logo_url: string | null
          marketplace_ativo: boolean | null
          marketplace_banner_url: string | null
          marketplace_config: Json | null
          marketplace_endereco: string | null
          marketplace_mapa_url: string | null
          marketplace_sobre: string | null
          marketplace_subtitulo: string | null
          marketplace_termos: string | null
          marketplace_texto_botao: string | null
          marketplace_titulo: string | null
          mercado_pago_customer_email: string | null
          mercado_pago_subscription_id: string | null
          mercado_pago_subscription_status: string | null
          modelo_campos_recomendados: string[] | null
          modelo_mensagens: Json | null
          modelo_negocio: string | null
          modelo_nome: string | null
          modelo_perguntas: Json | null
          modelo_proposta: Json | null
          modelo_status: string[] | null
          next_billing_at: string | null
          nome: string
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_current_step: number | null
          onboarding_dismissed: boolean | null
          onboarding_goal: string | null
          onboarding_updated_at: string | null
          owner_id: string | null
          percentual_sinal: number | null
          pix_cidade: string | null
          pix_key: string | null
          pix_nome: string | null
          pix_tipo: string | null
          plano: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          segmento: string | null
          site_about_text: string | null
          site_about_title: string | null
          site_accent_color: string | null
          site_art_style: string | null
          site_art_variant: string | null
          site_background_color: string | null
          site_badge_text: string | null
          site_banner_url: string | null
          site_benefits: Json | null
          site_brand_words: string[] | null
          site_business_hours: Json | null
          site_button_style: string | null
          site_card_color: string | null
          site_cart_button_text: string | null
          site_checkout_button_text: string | null
          site_checkout_mode: string | null
          site_config: Json | null
          site_contact_title: string | null
          site_corner_style: string | null
          site_cta_label: string | null
          site_cta_text: string | null
          site_custom_sections: Json | null
          site_delivery_options: string[] | null
          site_density: string | null
          site_empty_catalog_text: string | null
          site_enable_cart: boolean | null
          site_enable_coupons: boolean | null
          site_faq: Json | null
          site_features: Json | null
          site_font_style: string | null
          site_footer_text: string | null
          site_gallery: Json | null
          site_headline: string | null
          site_hero_alignment: string | null
          site_hero_highlights: Json | null
          site_hero_style: string | null
          site_keywords: string[] | null
          site_layout: string | null
          site_marketplace_subtitle: string | null
          site_marketplace_title: string | null
          site_nav_variant: string | null
          site_payment_methods: string[] | null
          site_primary_color: string | null
          site_product_card_style: string | null
          site_promo_active: boolean | null
          site_promo_button_text: string | null
          site_promo_text: string | null
          site_promo_title: string | null
          site_publico_ativo: boolean | null
          site_secondary_cta_text: string | null
          site_section_style: string | null
          site_sections: Json | null
          site_seo_description: string | null
          site_seo_title: string | null
          site_services_title: string | null
          site_show_about: boolean | null
          site_show_benefits: boolean | null
          site_show_contact: boolean | null
          site_show_faq: boolean | null
          site_show_featured: boolean | null
          site_show_gallery: boolean | null
          site_show_marketplace: boolean | null
          site_show_prices: boolean | null
          site_show_store: boolean | null
          site_show_testimonials: boolean | null
          site_status: string | null
          site_subheadline: string | null
          site_template: string | null
          site_testimonials: Json | null
          site_text_color: string | null
          site_theme: string | null
          site_trust_title: string | null
          site_updated_at: string | null
          site_whatsapp_message: string | null
          slug: string
          subdomain_slug: string | null
          subscription_provider: string | null
          telefone: string | null
          tester_id: string | null
          timezone: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_used_at: string | null
          updated_at: string | null
          whatsapp: string | null
          whatsapp_access_token: string | null
          whatsapp_ai_enabled: boolean | null
          whatsapp_ai_prompt: string | null
          whatsapp_auto_reply_enabled: boolean | null
          whatsapp_business_account_id: string | null
          whatsapp_enabled: boolean | null
          whatsapp_order_notifications: boolean | null
          whatsapp_phone_number_id: string | null
          whatsapp_status_notifications: boolean | null
          whatsapp_verify_token: string | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_founder_price_conversion: {
        Args: {
          p_action: string
          p_claim_id: string
          p_company_id: string
          p_provider_payload: Json
          p_provider_status: string
        }
        Returns: {
          access_until: string | null
          aceita_cartao: boolean | null
          aceita_pix: boolean | null
          assinatura_auto_recorrente: boolean | null
          assinatura_cancelada_em: string | null
          assinatura_checkout_url: string | null
          assinatura_expira_em: string | null
          assinatura_forma_pagamento_preferida: string | null
          assinatura_inicio: string | null
          assinatura_mp_payload: Json | null
          assinatura_pix_avulso_status: string | null
          assinatura_pix_avulso_ultimo_pagamento: string | null
          assinatura_plano: string | null
          assinatura_proxima_cobranca: string | null
          assinatura_status: string | null
          assinatura_ultimo_pagamento: string | null
          atendimento_horario: string | null
          atendimento_observacao: string | null
          ativo: boolean | null
          banner_url: string | null
          business_type: string | null
          cancel_at_period_end: boolean
          cidade: string | null
          cobrar_sinal: boolean | null
          cor_principal: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          founder_billing_attempts: number
          founder_billing_authorized_at: string | null
          founder_billing_claim_id: string | null
          founder_billing_claimed_at: string | null
          founder_billing_last_error: string | null
          founder_billing_last_sync_at: string | null
          founder_billing_setup_at: string | null
          founder_number: number | null
          founder_price_cents: number | null
          founder_price_conversion_attempts: number
          founder_price_conversion_claim_id: string | null
          founder_price_conversion_claimed_at: string | null
          founder_price_conversion_last_error: string | null
          founder_price_converted_at: string | null
          founder_price_ends_at: string | null
          founder_started_at: string | null
          founder_trial_ends_at: string | null
          founder_welcome_seen_at: string | null
          id: string
          instagram: string | null
          is_founder: boolean
          logo_url: string | null
          marketplace_ativo: boolean | null
          marketplace_banner_url: string | null
          marketplace_config: Json | null
          marketplace_endereco: string | null
          marketplace_mapa_url: string | null
          marketplace_sobre: string | null
          marketplace_subtitulo: string | null
          marketplace_termos: string | null
          marketplace_texto_botao: string | null
          marketplace_titulo: string | null
          mercado_pago_customer_email: string | null
          mercado_pago_subscription_id: string | null
          mercado_pago_subscription_status: string | null
          modelo_campos_recomendados: string[] | null
          modelo_mensagens: Json | null
          modelo_negocio: string | null
          modelo_nome: string | null
          modelo_perguntas: Json | null
          modelo_proposta: Json | null
          modelo_status: string[] | null
          next_billing_at: string | null
          nome: string
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_current_step: number | null
          onboarding_dismissed: boolean | null
          onboarding_goal: string | null
          onboarding_updated_at: string | null
          owner_id: string | null
          percentual_sinal: number | null
          pix_cidade: string | null
          pix_key: string | null
          pix_nome: string | null
          pix_tipo: string | null
          plano: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          segmento: string | null
          site_about_text: string | null
          site_about_title: string | null
          site_accent_color: string | null
          site_art_style: string | null
          site_art_variant: string | null
          site_background_color: string | null
          site_badge_text: string | null
          site_banner_url: string | null
          site_benefits: Json | null
          site_brand_words: string[] | null
          site_business_hours: Json | null
          site_button_style: string | null
          site_card_color: string | null
          site_cart_button_text: string | null
          site_checkout_button_text: string | null
          site_checkout_mode: string | null
          site_config: Json | null
          site_contact_title: string | null
          site_corner_style: string | null
          site_cta_label: string | null
          site_cta_text: string | null
          site_custom_sections: Json | null
          site_delivery_options: string[] | null
          site_density: string | null
          site_empty_catalog_text: string | null
          site_enable_cart: boolean | null
          site_enable_coupons: boolean | null
          site_faq: Json | null
          site_features: Json | null
          site_font_style: string | null
          site_footer_text: string | null
          site_gallery: Json | null
          site_headline: string | null
          site_hero_alignment: string | null
          site_hero_highlights: Json | null
          site_hero_style: string | null
          site_keywords: string[] | null
          site_layout: string | null
          site_marketplace_subtitle: string | null
          site_marketplace_title: string | null
          site_nav_variant: string | null
          site_payment_methods: string[] | null
          site_primary_color: string | null
          site_product_card_style: string | null
          site_promo_active: boolean | null
          site_promo_button_text: string | null
          site_promo_text: string | null
          site_promo_title: string | null
          site_publico_ativo: boolean | null
          site_secondary_cta_text: string | null
          site_section_style: string | null
          site_sections: Json | null
          site_seo_description: string | null
          site_seo_title: string | null
          site_services_title: string | null
          site_show_about: boolean | null
          site_show_benefits: boolean | null
          site_show_contact: boolean | null
          site_show_faq: boolean | null
          site_show_featured: boolean | null
          site_show_gallery: boolean | null
          site_show_marketplace: boolean | null
          site_show_prices: boolean | null
          site_show_store: boolean | null
          site_show_testimonials: boolean | null
          site_status: string | null
          site_subheadline: string | null
          site_template: string | null
          site_testimonials: Json | null
          site_text_color: string | null
          site_theme: string | null
          site_trust_title: string | null
          site_updated_at: string | null
          site_whatsapp_message: string | null
          slug: string
          subdomain_slug: string | null
          subscription_provider: string | null
          telefone: string | null
          tester_id: string | null
          timezone: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_used_at: string | null
          updated_at: string | null
          whatsapp: string | null
          whatsapp_access_token: string | null
          whatsapp_ai_enabled: boolean | null
          whatsapp_ai_prompt: string | null
          whatsapp_auto_reply_enabled: boolean | null
          whatsapp_business_account_id: string | null
          whatsapp_enabled: boolean | null
          whatsapp_order_notifications: boolean | null
          whatsapp_phone_number_id: string | null
          whatsapp_status_notifications: boolean | null
          whatsapp_verify_token: string | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_platform_admin_invite: {
        Args: { p_claim_id: string; p_user_id: string }
        Returns: {
          area: string
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          must_change_password: boolean
          nome: string | null
          observacoes: string | null
          permissions: Json
          role: string
          updated_at: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_admins"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      consume_marketplace_coupon: {
        Args: { p_company_id: string; p_order_id: string }
        Returns: boolean
      }
      create_affiliate_payout_admin: {
        Args: { p_affiliate_id: string }
        Returns: {
          debt_applied: number
          gross_amount: number
          payout_amount: number
          payout_id: string
        }[]
      }
      create_founder_invite_for_sales_lead: {
        Args: {
          p_actor_admin_id: string
          p_lead_id: string
          p_plan_key: string
          p_requested_founder_number?: number
          p_token_expires_at: string
          p_token_hash: string
        }
        Returns: {
          activated_at: string | null
          activation_attempts: number
          activation_claim_id: string | null
          activation_claimed_at: string | null
          activation_last_error: string | null
          company_id: string | null
          created_at: string
          created_by_admin_id: string | null
          created_by_email: string
          email: string
          email_normalized: string | null
          founder_number: number
          founder_price_cents: number
          id: string
          invited_at: string
          plan_key: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_admin_id: string | null
          sales_lead_id: string | null
          status: string
          token_expires_at: string | null
          token_hash: string
          token_rotated_at: string | null
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "founder_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_founder_test_invite: {
        Args: {
          p_actor_admin_id: string
          p_email: string
          p_plan_key: string
          p_token_expires_at: string
          p_token_hash: string
        }
        Returns: {
          activated_at: string | null
          activation_attempts: number
          activation_claim_id: string | null
          activation_claimed_at: string | null
          activation_last_error: string | null
          company_id: string | null
          created_at: string
          created_by_admin_id: string | null
          created_by_email: string
          email: string
          email_normalized: string | null
          founder_number: number
          founder_price_cents: number
          id: string
          invited_at: string
          plan_key: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_admin_id: string | null
          sales_lead_id: string | null
          status: string
          token_expires_at: string | null
          token_hash: string
          token_rotated_at: string | null
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "founder_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_or_claim_sales_prospect: {
        Args: {
          p_actor_admin_id: string
          p_assigned_admin_id: string
          p_cidade?: string
          p_email: string
          p_empresa_nome: string
          p_estado?: string
          p_nome_responsavel?: string
          p_segmento?: string
          p_whatsapp?: string
        }
        Returns: string
      }
      create_wealth_recurrence: { Args: { p_input: Json }; Returns: string }
      expire_due_founder_trials: { Args: never; Returns: number }
      expire_marketplace_stock_reservations: {
        Args: { p_limit?: number }
        Returns: number
      }
      expire_pending_founder_invites: { Args: never; Returns: number }
      fail_affiliate_payout_admin: {
        Args: { p_payout_id: string; p_reason: string }
        Returns: boolean
      }
      get_affiliate_payout_account_admin: {
        Args: { p_affiliate_id: string }
        Returns: {
          affiliate_id: string
          bank_name: string
          holder_document_hash: string
          holder_document_last4: string
          holder_name: string
          is_verified: boolean
          pix_key_encrypted: string
          pix_key_masked: string
          pix_key_type: string
          provider_validation: Json
          updated_at: string
          verified_at: string
        }[]
      }
      get_my_platform_admin_access: {
        Args: never
        Returns: {
          admin_email: string
          admin_id: string
          admin_is_active: boolean
          admin_role: string
          must_change_password: boolean
          permissions: Json
        }[]
      }
      get_platform_qa_vercel_share: { Args: never; Returns: string }
      integration_credentials_delete: {
        Args: { p_company_id: string; p_connection_id: string }
        Returns: undefined
      }
      integration_credentials_read: {
        Args: { p_company_id: string; p_connection_id: string }
        Returns: Json
      }
      integration_credentials_store: {
        Args: {
          p_company_id: string
          p_connection_id: string
          p_secret: string
        }
        Returns: string
      }
      integration_oauth_pkce_store: {
        Args: { p_company_id: string; p_state_id: string; p_verifier: string }
        Returns: string
      }
      integration_oauth_state_consume: {
        Args: {
          p_company_id: string
          p_nonce_hash: string
          p_provider: string
          p_user_id: string
        }
        Returns: {
          pkce_verifier: string
          requested_scopes: string[]
          state_id: string
        }[]
      }
      integration_refresh_lock: {
        Args: {
          p_company_id: string
          p_connection_id: string
          p_lock_id: string
          p_ttl_seconds?: number
        }
        Returns: boolean
      }
      integration_refresh_unlock: {
        Args: {
          p_company_id: string
          p_connection_id: string
          p_lock_id: string
        }
        Returns: undefined
      }
      list_affiliate_payout_accounts_admin: {
        Args: never
        Returns: {
          affiliate_id: string
          bank_name: string
          holder_document_last4: string
          holder_name: string
          is_verified: boolean
          pix_key_masked: string
          pix_key_type: string
          updated_at: string
          verified_at: string
        }[]
      }
      manage_wealth_portfolio: {
        Args: { p_input: Json; p_operation: string }
        Returns: string
      }
      mark_affiliate_payout_paid_admin: {
        Args: {
          p_payout_id: string
          p_proof_url?: string
          p_provider: string
          p_provider_transfer_id: string
        }
        Returns: boolean
      }
      merge_customer_profiles: {
        Args: {
          p_actor?: string
          p_company_id: string
          p_duplicate: string
          p_primary: string
        }
        Returns: Json
      }
      orcaly_consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
      orcaly_normalize_email: { Args: { p_value: string }; Returns: string }
      orcaly_normalize_name: { Args: { p_value: string }; Returns: string }
      orcaly_normalize_phone_br: { Args: { p_value: string }; Returns: string }
      preview_founder_activation: {
        Args: { p_token_hash: string }
        Returns: {
          cidade: string
          email: string
          empresa_nome: string
          estado: string
          founder_number: number
          founder_price_cents: number
          invite_id: string
          modelo_negocio: string
          nome_responsavel: string
          plan_key: string
          sales_lead_id: string
          segmento: string
          slug_sugerido: string
          token_expires_at: string
          whatsapp: string
        }[]
      }
      process_wealth_recurrence: {
        Args: { p_job_id: string; p_worker: string }
        Returns: Json
      }
      record_founder_payment_approved: {
        Args: {
          p_company_id: string
          p_next_payment_date: string
          p_payment_id: string
          p_provider_payload: Json
          p_subscription_id: string
        }
        Returns: {
          access_until: string | null
          aceita_cartao: boolean | null
          aceita_pix: boolean | null
          assinatura_auto_recorrente: boolean | null
          assinatura_cancelada_em: string | null
          assinatura_checkout_url: string | null
          assinatura_expira_em: string | null
          assinatura_forma_pagamento_preferida: string | null
          assinatura_inicio: string | null
          assinatura_mp_payload: Json | null
          assinatura_pix_avulso_status: string | null
          assinatura_pix_avulso_ultimo_pagamento: string | null
          assinatura_plano: string | null
          assinatura_proxima_cobranca: string | null
          assinatura_status: string | null
          assinatura_ultimo_pagamento: string | null
          atendimento_horario: string | null
          atendimento_observacao: string | null
          ativo: boolean | null
          banner_url: string | null
          business_type: string | null
          cancel_at_period_end: boolean
          cidade: string | null
          cobrar_sinal: boolean | null
          cor_principal: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          founder_billing_attempts: number
          founder_billing_authorized_at: string | null
          founder_billing_claim_id: string | null
          founder_billing_claimed_at: string | null
          founder_billing_last_error: string | null
          founder_billing_last_sync_at: string | null
          founder_billing_setup_at: string | null
          founder_number: number | null
          founder_price_cents: number | null
          founder_price_conversion_attempts: number
          founder_price_conversion_claim_id: string | null
          founder_price_conversion_claimed_at: string | null
          founder_price_conversion_last_error: string | null
          founder_price_converted_at: string | null
          founder_price_ends_at: string | null
          founder_started_at: string | null
          founder_trial_ends_at: string | null
          founder_welcome_seen_at: string | null
          id: string
          instagram: string | null
          is_founder: boolean
          logo_url: string | null
          marketplace_ativo: boolean | null
          marketplace_banner_url: string | null
          marketplace_config: Json | null
          marketplace_endereco: string | null
          marketplace_mapa_url: string | null
          marketplace_sobre: string | null
          marketplace_subtitulo: string | null
          marketplace_termos: string | null
          marketplace_texto_botao: string | null
          marketplace_titulo: string | null
          mercado_pago_customer_email: string | null
          mercado_pago_subscription_id: string | null
          mercado_pago_subscription_status: string | null
          modelo_campos_recomendados: string[] | null
          modelo_mensagens: Json | null
          modelo_negocio: string | null
          modelo_nome: string | null
          modelo_perguntas: Json | null
          modelo_proposta: Json | null
          modelo_status: string[] | null
          next_billing_at: string | null
          nome: string
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_current_step: number | null
          onboarding_dismissed: boolean | null
          onboarding_goal: string | null
          onboarding_updated_at: string | null
          owner_id: string | null
          percentual_sinal: number | null
          pix_cidade: string | null
          pix_key: string | null
          pix_nome: string | null
          pix_tipo: string | null
          plano: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          segmento: string | null
          site_about_text: string | null
          site_about_title: string | null
          site_accent_color: string | null
          site_art_style: string | null
          site_art_variant: string | null
          site_background_color: string | null
          site_badge_text: string | null
          site_banner_url: string | null
          site_benefits: Json | null
          site_brand_words: string[] | null
          site_business_hours: Json | null
          site_button_style: string | null
          site_card_color: string | null
          site_cart_button_text: string | null
          site_checkout_button_text: string | null
          site_checkout_mode: string | null
          site_config: Json | null
          site_contact_title: string | null
          site_corner_style: string | null
          site_cta_label: string | null
          site_cta_text: string | null
          site_custom_sections: Json | null
          site_delivery_options: string[] | null
          site_density: string | null
          site_empty_catalog_text: string | null
          site_enable_cart: boolean | null
          site_enable_coupons: boolean | null
          site_faq: Json | null
          site_features: Json | null
          site_font_style: string | null
          site_footer_text: string | null
          site_gallery: Json | null
          site_headline: string | null
          site_hero_alignment: string | null
          site_hero_highlights: Json | null
          site_hero_style: string | null
          site_keywords: string[] | null
          site_layout: string | null
          site_marketplace_subtitle: string | null
          site_marketplace_title: string | null
          site_nav_variant: string | null
          site_payment_methods: string[] | null
          site_primary_color: string | null
          site_product_card_style: string | null
          site_promo_active: boolean | null
          site_promo_button_text: string | null
          site_promo_text: string | null
          site_promo_title: string | null
          site_publico_ativo: boolean | null
          site_secondary_cta_text: string | null
          site_section_style: string | null
          site_sections: Json | null
          site_seo_description: string | null
          site_seo_title: string | null
          site_services_title: string | null
          site_show_about: boolean | null
          site_show_benefits: boolean | null
          site_show_contact: boolean | null
          site_show_faq: boolean | null
          site_show_featured: boolean | null
          site_show_gallery: boolean | null
          site_show_marketplace: boolean | null
          site_show_prices: boolean | null
          site_show_store: boolean | null
          site_show_testimonials: boolean | null
          site_status: string | null
          site_subheadline: string | null
          site_template: string | null
          site_testimonials: Json | null
          site_text_color: string | null
          site_theme: string | null
          site_trust_title: string | null
          site_updated_at: string | null
          site_whatsapp_message: string | null
          slug: string
          subdomain_slug: string | null
          subscription_provider: string | null
          telefone: string | null
          tester_id: string | null
          timezone: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_used_at: string | null
          updated_at: string | null
          whatsapp: string | null
          whatsapp_access_token: string | null
          whatsapp_ai_enabled: boolean | null
          whatsapp_ai_prompt: string | null
          whatsapp_auto_reply_enabled: boolean | null
          whatsapp_business_account_id: string | null
          whatsapp_enabled: boolean | null
          whatsapp_order_notifications: boolean | null
          whatsapp_phone_number_id: string | null
          whatsapp_status_notifications: boolean | null
          whatsapp_verify_token: string | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_signup_lead_sales_followup: {
        Args: {
          p_actor_admin_id: string
          p_channel: string
          p_lead_id: string
          p_message: string
          p_next_action_at?: string
        }
        Returns: string
      }
      recover_stale_background_jobs: {
        Args: { p_limit?: number; p_stale_seconds?: number }
        Returns: number
      }
      refresh_company_data_quality: {
        Args: { p_company_id: string }
        Returns: Json
      }
      refresh_company_data_quality_v1: {
        Args: { p_company_id: string }
        Returns: Json
      }
      refresh_customer_directory: {
        Args: { p_company_id: string }
        Returns: Json
      }
      release_affiliate_commissions_admin: { Args: never; Returns: number }
      release_founder_activation_claim: {
        Args: { p_claim_id: string; p_error?: string }
        Returns: boolean
      }
      release_founder_billing_claim: {
        Args: { p_claim_id: string; p_company_id: string; p_error?: string }
        Returns: boolean
      }
      release_founder_price_conversion_claim: {
        Args: { p_claim_id: string; p_company_id: string; p_error?: string }
        Returns: boolean
      }
      release_platform_admin_invite_claim: {
        Args: { p_claim_id: string }
        Returns: boolean
      }
      reserve_marketplace_stock: {
        Args: {
          p_company_id: string
          p_expires_at: string
          p_items: Json
          p_marketplace_payment_id: string
          p_order_id: string
        }
        Returns: Json
      }
      reverse_affiliate_commission_admin: {
        Args: { p_provider_payment_id: string; p_reason: string }
        Returns: boolean
      }
      review_affiliate_referral_admin: {
        Args: {
          p_actor_email: string
          p_decision: string
          p_note?: string
          p_referral_id: string
        }
        Returns: Json
      }
      revoke_founder_invite: {
        Args: {
          p_actor_admin_id: string
          p_invite_id: string
          p_reason?: string
        }
        Returns: {
          activated_at: string | null
          activation_attempts: number
          activation_claim_id: string | null
          activation_claimed_at: string | null
          activation_last_error: string | null
          company_id: string | null
          created_at: string
          created_by_admin_id: string | null
          created_by_email: string
          email: string
          email_normalized: string | null
          founder_number: number
          founder_price_cents: number
          id: string
          invited_at: string
          plan_key: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_admin_id: string | null
          sales_lead_id: string | null
          status: string
          token_expires_at: string | null
          token_hash: string
          token_rotated_at: string | null
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "founder_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rotate_founder_invite_token: {
        Args: {
          p_actor_admin_id: string
          p_invite_id: string
          p_token_expires_at: string
          p_token_hash: string
        }
        Returns: {
          activated_at: string | null
          activation_attempts: number
          activation_claim_id: string | null
          activation_claimed_at: string | null
          activation_last_error: string | null
          company_id: string | null
          created_at: string
          created_by_admin_id: string | null
          created_by_email: string
          email: string
          email_normalized: string | null
          founder_number: number
          founder_price_cents: number
          id: string
          invited_at: string
          plan_key: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_admin_id: string | null
          sales_lead_id: string | null
          status: string
          token_expires_at: string | null
          token_hash: string
          token_rotated_at: string | null
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "founder_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_my_wealth_recurrences: { Args: never; Returns: Json }
      save_affiliate_payout_account_admin: {
        Args: {
          p_affiliate_id: string
          p_bank_name: string
          p_holder_document_hash: string
          p_holder_document_last4: string
          p_holder_name: string
          p_is_verified: boolean
          p_pix_key_encrypted: string
          p_pix_key_masked: string
          p_pix_key_type: string
          p_provider_validation: Json
          p_verified_by: string
        }
        Returns: boolean
      }
      save_wealth_debt: {
        Args: { p_entry_id?: string; p_input: Json; p_version?: number }
        Returns: string
      }
      set_affiliate_payout_account_verification_admin: {
        Args: {
          p_affiliate_id: string
          p_note?: string
          p_verified: boolean
          p_verified_by: string
        }
        Returns: boolean
      }
      settle_background_job: {
        Args: {
          p_error?: string
          p_job_id: string
          p_metadata_patch?: Json
          p_run_after?: string
          p_status: string
          p_worker: string
        }
        Returns: boolean
      }
      settle_marketplace_stock: {
        Args: {
          p_company_id: string
          p_marketplace_payment_id: string
          p_payment_status: string
          p_reason?: string
        }
        Returns: Json
      }
      settle_wealth_debt: {
        Args: { p_confirmed: boolean; p_entry_id: string; p_version: number }
        Returns: boolean
      }
      wealth_health_inputs: { Args: never; Returns: Json }
      wealth_net_worth: { Args: never; Returns: Json }
      wealth_portfolio_view: {
        Args: { p_id: string; p_page?: number }
        Returns: Json
      }
      wealth_summary: { Args: { p_month: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
