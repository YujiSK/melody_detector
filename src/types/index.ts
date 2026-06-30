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
  church_id: string | null
  title_ko: string
  title_ja: string | null
  artist: string | null
  acrcloud_music_id: string | null
  acrcloud_external_id: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LyricSection {
  type: 'Intro' | 'Verse' | 'Pre-Chorus' | 'Chorus' | 'Bridge' | 'Instrumental' | 'Ending' | 'Outro'
  label: string
  lines: LyricLine[]
  order?: number
}

export interface LyricLine {
  kana: string
  translation: string | null
  is_english: boolean
  korean?: string | null
}

export interface SongMaterial {
  id: string
  song_id: string
  kanarubi_document: {
    sections: LyricSection[]
  } | null
  source_lyrics: string | null
  created_at: string
  updated_at: string
}

export interface UserSongActivity {
  id: string
  user_id: string
  song_id: string
  is_favorite: boolean
  last_viewed_at: string | null
  view_count: number
  song?: Song
}

export interface RecognitionLog {
  id: string
  user_id: string
  church_id: string
  recognized: boolean
  acrcloud_music_id: string | null
  matched_song_id: string | null
  created_at: string
}

// ローカルキャッシュ用
export interface RecentSong {
  song_id: string
  viewed_at: string
  song?: Song
}
