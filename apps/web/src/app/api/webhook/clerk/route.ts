import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createSupabaseAdmin } from '@saas/db'
import { validateEnv } from '@saas/config'

const env = validateEnv(process.env)

export async function POST(req: NextRequest) {
  const webhookSecret = env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const payload = await req.json()
  const headers = req.headers

  const svixId = headers.get('svix-id')
  const svixTimestamp = headers.get('svix-timestamp')
  const svixSignature = headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const wh = new Webhook(webhookSecret)

  let evt: any

  try {
    evt = wh.verify(JSON.stringify(payload), {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const { type, data } = evt

  try {
    const supabase = createSupabaseAdmin({
      SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY!,
    })

    switch (type) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, primary_email_address_id, ...rest } = data
        const email = email_addresses.find((e: any) => e.id === primary_email_address_id)?.email_address

        await supabase.from('users').upsert({
          clerk_id: id,
          email,
          raw_json: data,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'clerk_id' })
        break
      }

      case 'user.deleted': {
        await supabase.from('users').delete().eq('clerk_id', data.id)
        break
      }

      default:
        console.log(`Unhandled Clerk event type: ${type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Clerk webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}