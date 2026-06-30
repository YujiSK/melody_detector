import { openDB, type IDBPDatabase } from 'idb'
import type { Song, SongMaterial, RecentSong } from '@/types'

const DB_NAME = 'melody-detector'
const DB_VERSION = 3

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
    value: { song_id: string; user_id: string }
    indexes: { 'by-user': string }
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
          const favStore = db.createObjectStore('favorites', { keyPath: 'song_id' })
          favStore.createIndex('by-user', 'user_id')
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

  async getRecents(): Promise<RecentSong[]> {
    const db = await getDB()
    const all = await db.getAll('recents')
    return all
      .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime())
      .slice(0, 20)
  },

  async addRecent(songId: string): Promise<void> {
    const db = await getDB()
    await db.put('recents', { song_id: songId, viewed_at: new Date().toISOString() })
  },

  async getFavorites(userId: string): Promise<string[]> {
    const db = await getDB()
    const results = await db.getAllFromIndex('favorites', 'by-user', userId)
    return results.map(r => r.song_id)
  },

  async addFavorite(userId: string, songId: string): Promise<void> {
    const db = await getDB()
    await db.put('favorites', { song_id: songId, user_id: userId })
  },

  async removeFavorite(songId: string): Promise<void> {
    const db = await getDB()
    await db.delete('favorites', songId)
  },
}
