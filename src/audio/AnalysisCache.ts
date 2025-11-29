/**
 * AnalysisCache - Persistent caching for audio analysis using IndexedDB
 *
 * Caches pre-analysis results to avoid re-analyzing the same song.
 * Uses a hash of the audio file (first 1MB + file size + name) as the key.
 */

import { PreAnalysisResult } from './CueScheduler';

/**
 * Cache version - increment to invalidate old caches
 */
const CACHE_VERSION = 1;

/**
 * IndexedDB database name
 */
const DB_NAME = 'lightshow-analysis-cache';

/**
 * IndexedDB store name
 */
const STORE_NAME = 'analyses';

/**
 * Cached analysis entry
 */
interface CacheEntry {
  hash: string;
  analysis: PreAnalysisResult;
  createdAt: number;
  version: number;
  fileName: string;
}

/**
 * Manages persistent caching of audio analysis results
 */
export class AnalysisCache {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, CACHE_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Generate a hash from an audio file
   * Uses first 1MB + file size + name for fast hashing
   */
  private async generateHash(file: File): Promise<string> {
    // Read first 1MB of file (or entire file if smaller)
    const chunkSize = Math.min(1024 * 1024, file.size);
    const chunk = file.slice(0, chunkSize);
    const arrayBuffer = await chunk.arrayBuffer();

    // Create a simple hash from the data
    const bytes = new Uint8Array(arrayBuffer);
    let hash = 0;

    for (let i = 0; i < bytes.length; i++) {
      hash = ((hash << 5) - hash) + bytes[i];
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Combine with file size and name
    const hashString = `${hash}_${file.size}_${file.name}`;

    // Use SubtleCrypto to create a proper hash
    const encoder = new TextEncoder();
    const data = encoder.encode(hashString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  /**
   * Get cached analysis for a file
   * @param file - Audio file
   * @returns Cached analysis or null if not found
   */
  async get(file: File): Promise<PreAnalysisResult | null> {
    try {
      const db = await this.initDB();
      const hash = await this.generateHash(file);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(hash);

        request.onsuccess = () => {
          const entry = request.result as CacheEntry | undefined;

          if (!entry) {
            console.log('Cache miss - no entry found');
            resolve(null);
            return;
          }

          // Check version
          if (entry.version !== CACHE_VERSION) {
            console.log('Cache miss - version mismatch');
            resolve(null);
            return;
          }

          console.log(`Cache hit for "${entry.fileName}" (cached ${new Date(entry.createdAt).toLocaleString()})`);
          resolve(entry.analysis);
        };

        request.onerror = () => {
          console.error('Error reading from cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Save analysis to cache
   * @param file - Audio file
   * @param analysis - Pre-analysis result
   */
  async set(file: File, analysis: PreAnalysisResult): Promise<void> {
    try {
      const db = await this.initDB();
      const hash = await this.generateHash(file);

      const entry: CacheEntry = {
        hash,
        analysis,
        createdAt: Date.now(),
        version: CACHE_VERSION,
        fileName: file.name
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entry);

        request.onsuccess = () => {
          console.log(`Analysis cached for "${file.name}"`);
          resolve();
        };

        request.onerror = () => {
          console.error('Error writing to cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Cache set error:', error);
      throw error;
    }
  }

  /**
   * Clear all cached analyses
   */
  async clear(): Promise<void> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('Analysis cache cleared');
          resolve();
        };

        request.onerror = () => {
          console.error('Error clearing cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Cache clear error:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ count: number; entries: Array<{ fileName: string; createdAt: number }> }> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const entries = request.result as CacheEntry[];
          resolve({
            count: entries.length,
            entries: entries.map(e => ({
              fileName: e.fileName,
              createdAt: e.createdAt
            }))
          });
        };

        request.onerror = () => {
          console.error('Error reading cache stats:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Cache stats error:', error);
      return { count: 0, entries: [] };
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.dbPromise = null;
    }
  }
}
