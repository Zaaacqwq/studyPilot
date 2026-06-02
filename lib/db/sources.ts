import type { SupabaseClient } from '@supabase/supabase-js'
import type { SourceDocument, SourceKind } from './types'

export interface CreateSourceInput {
  userId: string
  courseId: string
  kind: SourceKind
  filename: string | null
  storagePath: string | null
  rawText: string | null
  tokenCount: number | null
}

export async function listSources(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<SourceDocument[]> {
  const { data, error } = await supabase
    .from('source_documents')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`listSources: ${error.message}`)
  return (data ?? []) as SourceDocument[]
}

export async function createSource(
  supabase: SupabaseClient,
  input: CreateSourceInput,
): Promise<SourceDocument> {
  const { data, error } = await supabase
    .from('source_documents')
    .insert({
      user_id: input.userId,
      course_id: input.courseId,
      kind: input.kind,
      filename: input.filename,
      storage_path: input.storagePath,
      raw_text: input.rawText,
      token_count: input.tokenCount,
    })
    .select('*')
    .single()

  if (error) throw new Error(`createSource: ${error.message}`)
  return data as SourceDocument
}

export async function deleteSource(
  supabase: SupabaseClient,
  userId: string,
  sourceId: string,
): Promise<{ storagePath: string | null }> {
  // Fetch first so we can also remove the file from storage.
  const { data: row, error: fetchError } = await supabase
    .from('source_documents')
    .select('storage_path')
    .eq('user_id', userId)
    .eq('id', sourceId)
    .maybeSingle()

  if (fetchError) throw new Error(`deleteSource (fetch): ${fetchError.message}`)
  if (!row) return { storagePath: null }

  const { error } = await supabase
    .from('source_documents')
    .delete()
    .eq('user_id', userId)
    .eq('id', sourceId)

  if (error) throw new Error(`deleteSource: ${error.message}`)
  return { storagePath: row.storage_path as string | null }
}

export async function sumTokens(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('source_documents')
    .select('token_count')
    .eq('user_id', userId)
    .eq('course_id', courseId)

  if (error) throw new Error(`sumTokens: ${error.message}`)
  return (data ?? []).reduce((acc, r) => acc + (r.token_count ?? 0), 0)
}
