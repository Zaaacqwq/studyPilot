import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message, MessageRole } from './types'

export interface CreateMessageInput {
  userId: string
  branchId: string
  role: MessageRole
  content: string
  tokenUsage?: Record<string, unknown> | null
}

export async function createMessage(
  supabase: SupabaseClient,
  input: CreateMessageInput,
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      user_id: input.userId,
      branch_id: input.branchId,
      role: input.role,
      content: input.content,
      token_usage: input.tokenUsage ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(`createMessage: ${error.message}`)
  return data as Message
}

export async function listMessages(
  supabase: SupabaseClient,
  userId: string,
  branchId: string,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`listMessages: ${error.message}`)
  return (data ?? []) as Message[]
}
