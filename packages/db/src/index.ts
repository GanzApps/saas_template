import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '@saas/config'

/**
 * Supabase client for server-side operations (uses service role key).
 * Only use in trusted environments (API routes, edge functions, scripts).
 */
export function createSupabaseAdmin(env: Pick<Env, 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>): SupabaseClient {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client')
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Supabase client for client-side operations (uses anon key).
 * Safe to use in browser.
 */
export function createSupabaseClient(env: Pick<Env, 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'>): SupabaseClient {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/**
 * Database types generated from Supabase.
 * Run `pnpm db:types` to regenerate after schema changes.
 */
export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          clerk_org_id: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          settings: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          clerk_org_id?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          settings?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          clerk_org_id?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          settings?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          clerk_id: string
          organization_id: string | null
          email: string | null
          role: string
          raw_json: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_id: string
          organization_id?: string | null
          email?: string | null
          role?: string
          raw_json?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_id?: string
          organization_id?: string | null
          email?: string | null
          role?: string
          raw_json?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
      }
      google_accounts: {
        Row: {
          id: string
          organization_id: string
          google_account_email: string
          access_token_encrypted: string
          refresh_token_encrypted: string
          token_expires_at: string
          account_name: string | null
          account_type: string | null
          is_active: boolean
          last_sync_at: string | null
          sync_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          google_account_email: string
          access_token_encrypted: string
          refresh_token_encrypted: string
          token_expires_at: string
          account_name?: string | null
          account_type?: string | null
          is_active?: boolean
          last_sync_at?: string | null
          sync_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          google_account_email?: string
          access_token_encrypted?: string
          refresh_token_encrypted?: string
          token_expires_at?: string
          account_name?: string | null
          account_type?: string | null
          is_active?: boolean
          last_sync_at?: string | null
          sync_error?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      locations: {
        Row: {
          id: string
          google_account_id: string
          organization_id: string
          google_location_id: string
          name: string
          address: string | null
          phone: string | null
          website: string | null
          primary_category: string | null
          place_id: string | null
          maps_uri: string | null
          is_active: boolean
          review_count: number
          average_rating: number | null
          last_review_sync_at: string | null
          settings: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          google_account_id: string
          organization_id: string
          google_location_id: string
          name: string
          address?: string | null
          phone?: string | null
          website?: string | null
          primary_category?: string | null
          place_id?: string | null
          maps_uri?: string | null
          is_active?: boolean
          review_count?: number
          average_rating?: number | null
          last_review_sync_at?: string | null
          settings?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          google_account_id?: string
          organization_id?: string
          google_location_id?: string
          name?: string
          address?: string | null
          phone?: string | null
          website?: string | null
          primary_category?: string | null
          place_id?: string | null
          maps_uri?: string | null
          is_active?: boolean
          review_count?: number
          average_rating?: number | null
          last_review_sync_at?: string | null
          settings?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          location_id: string
          organization_id: string
          google_review_id: string
          google_reviewer_id: string | null
          reviewer_name: string | null
          reviewer_profile_photo: string | null
          star_rating: number
          comment: string | null
          review_time: string
          reply_text: string | null
          reply_time: string | null
          reply_author: string | null
          has_reply: boolean
          is_replied_by_us: boolean
          internal_notes: string | null
          assigned_to: string | null
          status: string
          raw_json: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          location_id: string
          organization_id: string
          google_review_id: string
          google_reviewer_id?: string | null
          reviewer_name?: string | null
          reviewer_profile_photo?: string | null
          star_rating: number
          comment?: string | null
          review_time: string
          reply_text?: string | null
          reply_time?: string | null
          reply_author?: string | null
          has_reply?: boolean
          is_replied_by_us?: boolean
          internal_notes?: string | null
          assigned_to?: string | null
          status?: string
          raw_json?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          organization_id?: string
          google_review_id?: string
          google_reviewer_id?: string | null
          reviewer_name?: string | null
          reviewer_profile_photo?: string | null
          star_rating?: number
          comment?: string | null
          review_time?: string
          reply_text?: string | null
          reply_time?: string | null
          reply_author?: string | null
          has_reply?: boolean
          is_replied_by_us?: boolean
          internal_notes?: string | null
          assigned_to?: string | null
          status?: string
          raw_json?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          organization_id: string
          location_id: string | null
          name: string
          type: string
          template_sms: string | null
          template_email_subject: string | null
          template_email_body: string | null
          trigger_type: string
          is_active: boolean
          settings: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          location_id?: string | null
          name: string
          type: string
          template_sms?: string | null
          template_email_subject?: string | null
          template_email_body?: string | null
          trigger_type?: string
          is_active?: boolean
          settings?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          location_id?: string | null
          name?: string
          type?: string
          template_sms?: string | null
          template_email_subject?: string | null
          template_email_body?: string | null
          trigger_type?: string
          is_active?: boolean
          settings?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
      }
      campaign_recipients: {
        Row: {
          id: string
          campaign_id: string
          organization_id: string
          customer_name: string | null
          customer_phone: string | null
          customer_email: string | null
          status: string
          sent_at: string | null
          delivered_at: string | null
          clicked_at: string | null
          submitted_at: string | null
          error_message: string | null
          external_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          organization_id: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_email?: string | null
          status?: string
          sent_at?: string | null
          delivered_at?: string | null
          clicked_at?: string | null
          submitted_at?: string | null
          error_message?: string | null
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          organization_id?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_email?: string | null
          status?: string
          sent_at?: string | null
          delivered_at?: string | null
          clicked_at?: string | null
          submitted_at?: string | null
          error_message?: string | null
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      response_templates: {
        Row: {
          id: string
          organization_id: string
          name: string
          content: string
          category: string | null
          is_default: boolean
          usage_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          content: string
          category?: string | null
          is_default?: boolean
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          content?: string
          category?: string | null
          is_default?: boolean
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      webhook_logs: {
        Row: {
          id: string
          organization_id: string | null
          source: string
          event_type: string | null
          payload: Record<string, unknown> | null
          status: string
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          source: string
          event_type?: string | null
          payload?: Record<string, unknown> | null
          status?: string
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          source?: string
          event_type?: string | null
          payload?: Record<string, unknown> | null
          status?: string
          error_message?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Tables = {
  organizations: Database['public']['Tables']['organizations']['Row']
  users: Database['public']['Tables']['users']['Row']
  google_accounts: Database['public']['Tables']['google_accounts']['Row']
  locations: Database['public']['Tables']['locations']['Row']
  reviews: Database['public']['Tables']['reviews']['Row']
  campaigns: Database['public']['Tables']['campaigns']['Row']
  campaign_recipients: Database['public']['Tables']['campaign_recipients']['Row']
  response_templates: Database['public']['Tables']['response_templates']['Row']
  webhook_logs: Database['public']['Tables']['webhook_logs']['Row']
}

export type Inserts = {
  organizations: Database['public']['Tables']['organizations']['Insert']
  users: Database['public']['Tables']['users']['Insert']
  google_accounts: Database['public']['Tables']['google_accounts']['Insert']
  locations: Database['public']['Tables']['locations']['Insert']
  reviews: Database['public']['Tables']['reviews']['Insert']
  campaigns: Database['public']['Tables']['campaigns']['Insert']
  campaign_recipients: Database['public']['Tables']['campaign_recipients']['Insert']
  response_templates: Database['public']['Tables']['response_templates']['Insert']
  webhook_logs: Database['public']['Tables']['webhook_logs']['Insert']
}

export type Updates = {
  organizations: Database['public']['Tables']['organizations']['Update']
  users: Database['public']['Tables']['users']['Update']
  google_accounts: Database['public']['Tables']['google_accounts']['Update']
  locations: Database['public']['Tables']['locations']['Update']
  reviews: Database['public']['Tables']['reviews']['Update']
  campaigns: Database['public']['Tables']['campaigns']['Update']
  campaign_recipients: Database['public']['Tables']['campaign_recipients']['Update']
  response_templates: Database['public']['Tables']['response_templates']['Update']
  webhook_logs: Database['public']['Tables']['webhook_logs']['Update']
}