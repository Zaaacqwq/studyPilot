import type { SupabaseClient } from '@supabase/supabase-js'
import type { Course, ProviderId } from './types'

export interface CreateCourseInput {
  userId: string
  title: string
  description?: string | null
  defaultProvider: ProviderId
}

export interface UpdateCourseInput {
  title?: string
  description?: string | null
  defaultProvider?: ProviderId
}

export async function listCourses(
  supabase: SupabaseClient,
  userId: string,
): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`listCourses: ${error.message}`)
  return (data ?? []) as Course[]
}

export async function getCourse(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .eq('id', courseId)
    .maybeSingle()

  if (error) throw new Error(`getCourse: ${error.message}`)
  return (data as Course | null) ?? null
}

export async function createCourse(
  supabase: SupabaseClient,
  input: CreateCourseInput,
): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .insert({
      user_id: input.userId,
      title: input.title,
      description: input.description ?? null,
      default_provider: input.defaultProvider,
    })
    .select('*')
    .single()

  if (error) throw new Error(`createCourse: ${error.message}`)
  return data as Course
}

export async function updateCourse(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  input: UpdateCourseInput,
): Promise<Course> {
  const patch: Record<string, unknown> = {}
  if (input.title !== undefined) patch.title = input.title
  if (input.description !== undefined) patch.description = input.description
  if (input.defaultProvider !== undefined) patch.default_provider = input.defaultProvider

  const { data, error } = await supabase
    .from('courses')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', courseId)
    .select('*')
    .single()

  if (error) throw new Error(`updateCourse: ${error.message}`)
  return data as Course
}

export async function deleteCourse(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('user_id', userId)
    .eq('id', courseId)

  if (error) throw new Error(`deleteCourse: ${error.message}`)
}
