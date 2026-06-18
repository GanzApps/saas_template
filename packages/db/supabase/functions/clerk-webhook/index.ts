import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const webhookSecret = Deno.env.get('CLERK_WEBHOOK_SECRET')
  if (!webhookSecret) {
    return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const payload = await req.json()
  const headers = req.headers

  const svixId = headers.get('svix-id')
  const svixTimestamp = headers.get('svix-timestamp')
  const svixSignature = headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response(JSON.stringify({ error: 'Missing svix headers' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify with svix
  const crypto = await import('node:crypto')
  const hmac = crypto.createHmac('sha256', webhookSecret)
  const msg = `${svixId}.${svixTimestamp}.${JSON.stringify(payload)}`
  const expectedSig = hmac.update(msg).digest('base64')

  if (expectedSig !== svixSignature) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { type, data } = payload

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    switch (type) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, primary_email_address_id, ...rest } = data
        const email = email_addresses.find((e: any) => e.id === primary_email_address_id)?.email_address

        // Upsert user
        await supabase.from('users').upsert({
          clerk_id: id,
          email,
          raw_json: data,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'clerk_id' })

        // If user has organization membership, ensure org exists
        if (data.organization_memberships && data.organization_memberships.length > 0) {
          for (const membership of data.organization_memberships) {
            await supabase.from('organizations').upsert({
              clerk_org_id: membership.organization.id,
              name: membership.organization.name || 'Unnamed Organization',
            }, { onConflict: 'clerk_org_id' })
          }
        }
        break
      }
      case 'user.deleted': {
        await supabase.from('users').delete().eq('clerk_id', data.id)
        break
      }
      case 'organization.created':
      case 'organization.updated': {
        await supabase.from('organizations').upsert({
          clerk_org_id: data.id,
          name: data.name || 'Unnamed Organization',
          settings: data.public_metadata || {},
          updated_at: new Date().toISOString(),
        }, { onConflict: 'clerk_org_id' })
        break
      }
      case 'organization.deleted': {
        await supabase.from('organizations').delete().eq('clerk_org_id', data.id)
        break
      }
      case 'organizationMembership.created':
      case 'organizationMembership.updated': {
        // Link user to organization
        await supabase.from('users').update({
          organization_id: data.organization.id,
          role: data.role,
          updated_at: new Date().toISOString(),
        }).eq('clerk_id', data.public_user_data.user_id)
        break
      }
      case 'organizationMembership.deleted': {
        // Remove user from organization
        await supabase.from('users').update({
          organization_id: null,
          role: 'member',
          updated_at: new Date().toISOString(),
        }).eq('clerk_id', data.public_user_data.user_id)
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Clerk webhook error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})