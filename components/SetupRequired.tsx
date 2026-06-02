export function SetupRequired() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="space-y-5 rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            StudyPilot — setup needed
          </h1>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            Supabase isn&apos;t configured yet. Finish these steps and reload.
          </p>
        </div>

        <ol className="list-decimal space-y-3 pl-5 text-sm text-zinc-700 dark:text-zinc-200">
          <li>
            Create a Supabase project at{' '}
            <a
              href="https://supabase.com/dashboard/projects"
              className="font-medium underline"
              target="_blank"
              rel="noreferrer"
            >
              supabase.com
            </a>
            .
          </li>
          <li>
            In <strong>Settings → API</strong>, copy the <code>Project URL</code> and{' '}
            <code>anon public</code> key.
          </li>
          <li>
            <code>cp .env.local.example .env.local</code> and fill in:
            <pre className="mt-2 overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">
{`NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}
            </pre>
          </li>
          <li>
            Open the Supabase SQL editor and run{' '}
            <code>supabase/migrations/0001_init.sql</code>.
          </li>
          <li>
            In <strong>Authentication → URL Configuration</strong>, set the Site URL to{' '}
            <code>http://localhost:3000</code> and add{' '}
            <code>http://localhost:3000/auth/callback</code> as a redirect URL.
          </li>
          <li>
            Stop and restart <code>npm run dev</code> so the new env vars load.
          </li>
        </ol>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Full instructions are in <code>README.md</code>.
        </p>
      </div>
    </main>
  )
}
