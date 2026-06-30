import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'

type QueryResult<T> = {
  data: T | null
  error: { code?: string; message: string } | null
}

type ProfileRow = {
  id: string
  display_name: string | null
}

type ChurchMemberRow = {
  id?: string
  church_id: string
  role: string
}

type ChurchRow = {
  id: string
  name: string | null
}

export type UserContextDebug = {
  auth_user_id: string
  auth_email: string | null
  profile_query_result: QueryResult<ProfileRow>
  church_member_query_result: QueryResult<ChurchMemberRow>
  church_query_result: QueryResult<ChurchRow>
  setup_logs?: string[]
  setup_error?: string
}

export type CurrentUserContext = {
  user: User
  profile: ProfileRow | null
  member: ChurchMemberRow | null
  church: ChurchRow | null
  churchId: string | null
  role: string | null
  debug: UserContextDebug
}

function serializeError(error: unknown): { code?: string; message: string } | null {
  if (!error) return null
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    return {
      code: typeof record.code === 'string' ? record.code : undefined,
      message: typeof record.message === 'string' ? record.message : String(error),
    }
  }
  return { message: String(error) }
}

export async function ensureInitialSetup(user: User) {
  const adminSupabase = await createAdminClient()
  const logs: string[] = []

  let churchId = ''
  const { data: existingChurches, error: churchFindError } = await adminSupabase
    .from('churches')
    .select('id')
    .limit(1)

  if (churchFindError) logs.push(`church lookup failed: ${churchFindError.message}`)

  if (existingChurches && existingChurches.length > 0) {
    churchId = existingChurches[0].id
    logs.push(`church found: ${churchId}`)
  } else {
    const { data: newChurch, error: churchInsertError } = await adminSupabase
      .from('churches')
      .insert({ name: 'Default Church' })
      .select('id')
      .single()

    if (churchInsertError) throw new Error(`Failed to create default church: ${churchInsertError.message}`)
    churchId = newChurch.id
    logs.push(`church created: ${churchId}`)
  }

  const { data: existingProfile, error: profileFindError } = await adminSupabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', user.id)
    .single()

  if (profileFindError && profileFindError.code !== 'PGRST116') {
    logs.push(`profile lookup failed: ${profileFindError.message}`)
  }

  let profile = existingProfile as ProfileRow | null
  if (!profile) {
    const displayName = user.email?.split('@')[0] || 'User'
    const { data: newProfile, error: profileInsertError } = await adminSupabase
      .from('profiles')
      .insert({ id: user.id, display_name: displayName })
      .select('id, display_name')
      .single()

    if (profileInsertError) throw new Error(`Failed to create profile: ${profileInsertError.message}`)
    profile = newProfile
    logs.push('profile created')
  }

  const { data: existingMember, error: memberFindError } = await adminSupabase
    .from('church_members')
    .select('id, church_id, role')
    .eq('user_id', user.id)
    .single()

  if (memberFindError && memberFindError.code !== 'PGRST116') {
    logs.push(`member lookup failed: ${memberFindError.message}`)
  }

  let member = existingMember as ChurchMemberRow | null
  if (!member) {
    const { data: newMember, error: memberInsertError } = await adminSupabase
      .from('church_members')
      .insert({ church_id: churchId, user_id: user.id, role: 'admin' })
      .select('id, church_id, role')
      .single()

    if (memberInsertError) throw new Error(`Failed to insert church membership: ${memberInsertError.message}`)
    member = newMember
    logs.push('member created')
  }

  return { profile, member, logs }
}

export async function getCurrentUserContext(user: User, options: { autoSetup?: boolean } = {}): Promise<CurrentUserContext> {
  const adminSupabase = await createAdminClient()
  const setupLogs: string[] = []
  let setupError: string | undefined

  async function load() {
    const profileResult = await adminSupabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', user.id)
      .single()

    const memberResult = await adminSupabase
      .from('church_members')
      .select('id, church_id, role')
      .eq('user_id', user.id)
      .single()

    const member = memberResult.data as ChurchMemberRow | null
    const churchResult = member?.church_id
      ? await adminSupabase
        .from('churches')
        .select('id, name')
        .eq('id', member.church_id)
        .single()
      : { data: null, error: null }

    return { profileResult, memberResult, churchResult }
  }

  let results = await load()

  if (options.autoSetup && (!results.profileResult.data || !results.memberResult.data)) {
    try {
      const setup = await ensureInitialSetup(user)
      setupLogs.push(...setup.logs)
      results = await load()
    } catch (error) {
      setupError = error instanceof Error ? error.message : String(error)
    }
  }

  const profile = results.profileResult.data as ProfileRow | null
  const member = results.memberResult.data as ChurchMemberRow | null
  const church = results.churchResult.data as ChurchRow | null

  return {
    user,
    profile,
    member,
    church,
    churchId: member?.church_id ?? null,
    role: member?.role ?? null,
    debug: {
      auth_user_id: user.id,
      auth_email: user.email ?? null,
      profile_query_result: {
        data: profile,
        error: serializeError(results.profileResult.error),
      },
      church_member_query_result: {
        data: member,
        error: serializeError(results.memberResult.error),
      },
      church_query_result: {
        data: church,
        error: serializeError(results.churchResult.error),
      },
      setup_logs: setupLogs.length > 0 ? setupLogs : undefined,
      setup_error: setupError,
    },
  }
}
