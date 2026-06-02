'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  redirect: z.string().optional(),
})

export async function signInWithEmail(formData: FormData) {
  const parsed = emailSchema.safeParse({
    email: formData.get('email'),
    redirect: formData.get('redirect'),
  })

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input'
    redirect(`/login?error=${encodeURIComponent(message)}`)
  }

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const callbackParams = new URLSearchParams()
  if (parsed.data.redirect) callbackParams.set('next', parsed.data.redirect)

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback${
        callbackParams.toString() ? `?${callbackParams.toString()}` : ''
      }`,
    },
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/login?sent=${encodeURIComponent(parsed.data.email)}`)
}
