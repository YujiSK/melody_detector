import { openDB, type IDBPDatabase } from 'idb'
import type { Song, Kana, RecentSong } from '@/types'

const DB_NAME = 'melody-detector'
const DB_VERSION = 1

type DB = {
  songs: {
    key: string
    value: Song
    indexes: { 'by-church': string }
  }
  kana: {
    key: string
    value: Kana
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
        const songStore = db.createObjectStore('songs', { keyPath: 'id' })
        songStore.createIndex('by-church', 'church_id')

        const kanaStore = db.createObjectStore('kana', { keyPath: 'id' })
        kanaStore.createIndex('by-song', 'song_id')

        db.createObjectStore('recents', { keyPath: 'song_id' })

        const favStore = db.createObjectStore('favorites', { keyPath: 'song_id' })
        favStore.createIndex('by-user', 'user_id')
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

  async getKana(songId: string): Promise<Kana | undefined> {
    const db = await getDB()
    const results = await db.getAllFromIndex('kana', 'by-song', songId)
    return results[0]
  },

  async putKana(kana: Kana): Promise<void> {
    const db = await getDB()
    await db.put('kana', kana)
  },

  async getRecents(): Promise<RecentSong[]> {
    const db = await getDB()
    const all = await db.getAll('recents')
    return all.sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime()).slice(0, 20)
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
