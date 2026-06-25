export type UserRole = 'admin' | 'member'

export interface Church {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  church_id: string
  role: UserRole
  display_name: string
  email: string
  created_at: string
}

export interface Song {
  id: string
  church_id: string
  title: string
  title_ja: string | null
  artist: string | null
  acr_id: string | null
  status: 'pending' | 'ready'
  created_at: string
  updated_at: string
}

export interface LyricSection {
  type: 'Intro' | 'Verse' | 'Pre-Chorus' | 'Chorus' | 'Bridge' | 'Instrumental' | 'Ending' | 'Outro'
  label: string
  lines: LyricLine[]
}

export interface LyricLine {
  kana: string
  translation: string | null
  is_english: boolean
}

export interface Kana {
  id: string
  song_id: string
  church_id: string
  sections: LyricSection[]
  raw_korean: string | null
  created_at: string
  updated_at: string
}

export interface Favorite {
  id: string
  user_id: string
  song_id: string
  created_at: string
  song?: Song
}

export interface RecentSong {
  song_id: string
  viewed_at: string
  song?: Song
}
