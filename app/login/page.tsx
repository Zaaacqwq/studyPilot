import { signInWithEmail } from './actions'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { SetupRequired } from '@/components/SetupRequired'

interface LoginPageProps {
  searchParams: Promise<{
    error?: string
    sent?: string
    redirect?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!isSupabaseConfigured()) return <SetupRequired />

  const { error, sent, redirect } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">StudyPilot</h1>
          <p className="text-sm text-zinc-500">
            Sign in to your course outline.
          </p>
        </div>

        {sent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            We sent a magic link to <strong>{sent}</strong>. Open the email and
            click the link to finish signing in.
          </div>
        ) : (
          <form action={signInWithEmail} className="space-y-3">
            <input type="hidden" name="redirect" value={redirect ?? ''} />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Send magic link
            </button>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
