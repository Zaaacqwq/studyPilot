'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { clsx } from 'clsx'
import {
  abandonBranchAction,
  mergeBranchAction,
} from '@/app/courses/[id]/branches/actions'
import type { Branch, Message } from '@/lib/db/types'

interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface BranchChatProps {
  branch: Branch
  initialMessages: Message[]
  courseId: string
  nodeBackHref: string
}

export function BranchChat({
  branch,
  initialMessages,
  courseId,
  nodeBackHref,
}: BranchChatProps) {
  const [turns, setTurns] = useState<ChatTurn[]>(() =>
    initialMessages
      .filter((m): m is Message & { role: 'user' | 'assistant' } =>
        m.role === 'user' || m.role === 'assistant',
      )
      .map((m) => ({ id: m.id, role: m.role, content: m.content })),
  )
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const autoTriggeredRef = useRef(false)
  const scrollerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when turns change or chunks arrive.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [turns])

  // If the conversation ends in an unreplied user turn, auto-stream once.
  useEffect(() => {
    if (autoTriggeredRef.current) return
    if (streaming) return
    const last = turns.at(-1)
    if (last && last.role === 'user') {
      autoTriggeredRef.current = true
      void streamResponse(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function streamResponse(content: string | null) {
    setStreaming(true)
    setError(null)

    const placeholderId = `streaming-${Date.now()}`
    if (content) {
      const userId = `optimistic-user-${Date.now()}`
      setTurns((prev) => [
        ...prev,
        { id: userId, role: 'user', content },
        { id: placeholderId, role: 'assistant', content: '' },
      ])
    } else {
      setTurns((prev) => [
        ...prev,
        { id: placeholderId, role: 'assistant', content: '' },
      ])
    }

    try {
      const response = await fetch(`/api/branches/${branch.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content ? { content } : {}),
      })

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        assistantText += chunk
        setTurns((prev) =>
          prev.map((t) =>
            t.id === placeholderId ? { ...t, content: assistantText } : t,
          ),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setStreaming(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (streaming) return
    const trimmed = input.trim()
    if (!trimmed) return
    setInput('')
    await streamResponse(trimmed)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter newlines.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const form = event.currentTarget.form
      form?.requestSubmit()
    }
  }

  return (
    <article className="flex h-full flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">
            Branch · {branch.status}
          </p>
          <h2 className="truncate text-sm font-semibold">{branch.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={nodeBackHref}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Back to node
          </Link>
          {branch.status === 'open' && (
            <>
              <form action={mergeBranchAction}>
                <input type="hidden" name="courseId" value={courseId} />
                <input type="hidden" name="branchId" value={branch.id} />
                <button
                  type="submit"
                  disabled={streaming || turns.length === 0}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900"
                >
                  Merge
                </button>
              </form>
              <form action={abandonBranchAction}>
                <input type="hidden" name="courseId" value={courseId} />
                <input type="hidden" name="branchId" value={branch.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                >
                  Abandon
                </button>
              </form>
            </>
          )}
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="flex-1 space-y-3 overflow-y-auto p-4"
      >
        {branch.status === 'merged' && branch.summary_md && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Merged into outline
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-emerald-900 dark:text-emerald-100">
              <ReactMarkdown>{branch.summary_md}</ReactMarkdown>
            </div>
          </div>
        )}
        {turns.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">
            No messages yet.
          </p>
        ) : (
          turns.map((t) => <Turn key={t.id} turn={t} streaming={streaming} />)
        )}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {branch.status === 'open' && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={streaming}
              placeholder={
                streaming
                  ? 'Streaming…'
                  : 'Ask a follow-up (Enter to send · Shift+Enter for newline)'
              }
              className="block min-h-[3rem] flex-1 resize-none rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {streaming ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      )}
    </article>
  )
}

interface TurnProps {
  turn: ChatTurn
  streaming: boolean
}

function Turn({ turn, streaming }: TurnProps) {
  const isUser = turn.role === 'user'
  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900'
            : 'border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{turn.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            {turn.content ? (
              <ReactMarkdown>{turn.content}</ReactMarkdown>
            ) : (
              <span className="inline-block animate-pulse text-zinc-400">
                {streaming ? 'Thinking…' : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
