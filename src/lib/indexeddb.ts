import { openDB, type IDBPDatabase } from 'idb'
import type { Song, SongMaterial, RecentSong, FavoriteSong } from '@/types'

const DB_NAME = 'melody-detector'
const DB_VERSION = 4 // v4 にアップグレードして既存の v3 ユーザーにもストア作成を強制

type DB = {
  songs: {
    key: string
    value: Song
    indexes: { 'by-church': string }
  }
  song_materials: {
    key: string
    value: SongMaterial
    indexes: { 'by-song': string }
  }
  recents: {
    key: string
    value: RecentSong
  }
  favorites: {
    key: string
    value: FavoriteSong
  }
}

let dbPromise: Promise<IDBPDatabase<DB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<DB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('songs')) {
          const songStore = db.createObjectStore('songs', { keyPath: 'id' })
          songStore.createIndex('by-church', 'church_id')
        }
        // v1: kana → v2: song_materials (migration)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((db as any).objectStoreNames.contains('kana')) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(db as any).deleteObjectStore('kana')
        }
        if (!db.objectStoreNames.contains('song_materials')) {
          const matStore = db.createObjectStore('song_materials', { keyPath: 'id' })
          matStore.createIndex('by-song', 'song_id')
        }
        if (!db.objectStoreNames.contains('recents')) {
          db.createObjectStore('recents', { keyPath: 'song_id' })
        }
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'song_id' })
        }
      },
    })
  }
  return dbPromise
}

export const cache = {
  async getSong(id: string): Promise<Song | undefined> {
    const db = await getDB()
    return db.get('songs', id)
  },

  async putSong(song: Song): Promise<void> {
    const db = await getDB()
    await db.put('songs', song)
  },

  async getSongMaterial(songId: string): Promise<SongMaterial | undefined> {
    const db = await getDB()
    const results = await db.getAllFromIndex('song_materials', 'by-song', songId)
    const material = results[0]
    if (material) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawMat = material as any
      if (rawMat.sections && !material.kanarubi_document) {
        material.kanarubi_document = { sections: rawMat.sections }
      }
      if (rawMat.raw_korean && !material.source_lyrics) {
        material.source_lyrics = rawMat.raw_korean
      }
    }
    return material
  },

  async putSongMaterial(material: SongMaterial): Promise<void> {
    const db = await getDB()
    await db.put('song_materials', material)
  },

  // --- 履歴 (Recents) 関連 ---
  async getRecents(): Promise<RecentSong[]> {
    const db = await getDB()
    const all = await db.getAll('recents')
    
    // 防衛的コード：古いデータで title_ko がない場合の自己修復
    const resolved: RecentSong[] = []
    for (const item of all) {
      if (!item.title_ko) {
        try {
          const song = await db.get('songs', item.song_id)
          if (song) {
            item.title_ko = song.title_ko
            item.title_ja = song.title_ja
            item.artist = song.artist
            await db.put('recents', item) // 補完して再保存
            resolved.push(item)
          } else {
            // 曲情報もない場合は、整合性を保つためスキップ・削除
            await db.delete('recents', item.song_id)
          }
        } catch (e) {
          console.warn('Failed to heal recent song item:', e)
        }
      } else {
        resolved.push(item)
      }
    }

    return resolved
      .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime())
  },

  // 既存の呼び出し元（引数songId: string）と互換性を維持しながら、メタデータを補完して保存する
  async addRecent(songId: string): Promise<void> {
    const db = await getDB()
    const song = await db.get('songs', songId)
    
    const recentItem: RecentSong = {
      song_id: songId,
      title_ko: song?.title_ko || '不明な曲',
      title_ja: song?.title_ja || null,
      artist: song?.artist || null,
      viewed_at: new Date().toISOString()
    }
    
    await db.put('recents', recentItem)

    // 最大30件制限。溢れた古い履歴は自動削除
    const all = await db.getAll('recents')
    if (all.length > 30) {
      all.sort((a, b) => new Date(a.viewed_at).getTime() - new Date(b.viewed_at).getTime())
      const toDelete = all.slice(0, all.length - 30)
      for (const item of toDelete) {
        await db.delete('recents', item.song_id)
      }
    }
  },

  async removeRecentSong(songId: string): Promise<void> {
    const db = await getDB()
    await db.delete('recents', songId)
  },

  async clearRecentSongs(): Promise<void> {
    const db = await getDB()
    await db.clear('recents')
  },

  // --- お気に入り (Favorites) 関連 ---
  async getFavoriteSongs(): Promise<FavoriteSong[]> {
    const db = await getDB()
    const all = await db.getAll('favorites')
    
    // 防衛的コード：古いデータ（{ song_id, user_id } 等）で title_ko がない場合の自己修復
    const resolved: FavoriteSong[] = []
    for (const item of all) {
      if (!item.title_ko) {
        try {
          const song = await db.get('songs', item.song_id)
          if (song) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawItem = item as any
            const healedItem: FavoriteSong = {
              song_id: item.song_id,
              title_ko: song.title_ko,
              title_ja: song.title_ja,
              artist: song.artist,
              added_at: rawItem.added_at || new Date().toISOString()
            }
            await db.put('favorites', healedItem) // 新しい構造にアップデートして再保存
            resolved.push(healedItem)
          } else {
            // 曲情報もない場合は、整合性を保つためスキップ・削除
            await db.delete('favorites', item.song_id)
          }
        } catch (e) {
          console.warn('Failed to heal favorite song item:', e)
        }
      } else {
        resolved.push(item)
      }
    }

    return resolved.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime())
  },

  async addFavoriteSong(song: Song): Promise<void> {
    const db = await getDB()
    const favItem: FavoriteSong = {
      song_id: song.id,
      title_ko: song.title_ko,
      title_ja: song.title_ja,
      artist: song.artist,
      added_at: new Date().toISOString()
    }
    await db.put('favorites', favItem)
  },

  async removeFavoriteSong(songId: string): Promise<void> {
    const db = await getDB()
    await db.delete('favorites', songId)
  },

  async isFavoriteSong(songId: string): Promise<boolean> {
    const db = await getDB()
    const item = await db.get('favorites', songId)
    return !!item
  },
}
