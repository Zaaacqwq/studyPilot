import Link from 'next/link'

interface AppHeaderProps {
  email: string | null
  current?: 'home' | 'settings'
}

export function AppHeader({ email, current }: AppHeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-base font-semibold tracking-tight">
            StudyPilot
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/"
              className={
                current === 'home'
                  ? 'font-medium text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }
            >
              Home
            </Link>
            <Link
              href="/settings/providers"
              className={
                current === 'settings'
                  ? 'font-medium text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }
            >
              Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {email && <span className="text-zinc-500">{email}</span>}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
