import type { SupabaseClient } from '@supabase/supabase-js'
import type { Branch, BranchStatus, ProviderId } from './types'

export interface CreateBranchInput {
  userId: string
  nodeId: string
  title: string
  provider: ProviderId
  model?: string | null
}

export async function createBranch(
  supabase: SupabaseClient,
  input: CreateBranchInput,
): Promise<Branch> {
  const { data, error } = await supabase
    .from('branches')
    .insert({
      user_id: input.userId,
      node_id: input.nodeId,
      title: input.title,
      provider: input.provider,
      model: input.model ?? null,
      status: 'open',
    })
    .select('*')
    .single()

  if (error) throw new Error(`createBranch: ${error.message}`)
  return data as Branch
}

export async function getBranch(
  supabase: SupabaseClient,
  userId: string,
  branchId: string,
): Promise<Branch | null> {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('user_id', userId)
    .eq('id', branchId)
    .maybeSingle()
  if (error) throw new Error(`getBranch: ${error.message}`)
  return (data as Branch | null) ?? null
}

export async function listBranchesForNode(
  supabase: SupabaseClient,
  userId: string,
  nodeId: string,
): Promise<Branch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`listBranchesForNode: ${error.message}`)
  return (data ?? []) as Branch[]
}

export async function listBranchesForCourse(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<Branch[]> {
  // Inner-join via outline_nodes to filter by course.
  const { data, error } = await supabase
    .from('branches')
    .select('*, outline_nodes!inner(course_id)')
    .eq('user_id', userId)
    .eq('outline_nodes.course_id', courseId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`listBranchesForCourse: ${error.message}`)
  return (data ?? []) as Branch[]
}

export async function setBranchStatus(
  supabase: SupabaseClient,
  userId: string,
  branchId: string,
  status: BranchStatus,
  summaryMd?: string,
): Promise<Branch> {
  const patch: Record<string, unknown> = { status }
  if (status === 'merged' || status === 'abandoned') {
    patch.merged_at = new Date().toISOString()
  }
  if (summaryMd !== undefined) patch.summary_md = summaryMd

  const { data, error } = await supabase
    .from('branches')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', branchId)
    .select('*')
    .single()
  if (error) throw new Error(`setBranchStatus: ${error.message}`)
  return data as Branch
}
