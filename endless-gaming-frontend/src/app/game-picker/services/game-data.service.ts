import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import Dexie, { Table } from 'dexie';
import { GameRecord } from '../../types/game.types';

/**
 * Service for loading and caching game data from the backend API.
 * 
 * Handles fetching master.json from the backend and caching in IndexedDB
 * for offline access and improved performance.
 */
interface CacheEntry {
  id: string;
  data: GameRecord[];
  timestamp: number;
}

class GameDatabase extends Dexie {
  games!: Table<GameRecord, number>;
  cache!: Table<CacheEntry, string>;

  constructor() {
    super('GameDatabase');
    this.version(1).stores({
      games: 'appId, name, developer, publisher, *genres',
      cache: 'id, timestamp'
    });
  }
}

@Injectable({
  providedIn: 'root'
})
export class GameDataService {
  private http = inject(HttpClient);
  private db = new GameDatabase();
  private readonly CACHE_KEY = 'master_data';
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly API_URL = '/api/discovery/games/master.json';
  private gameCache = new Map<number, GameRecord>();
  private allGamesCache: GameRecord[] = [];

  /**
   * Load master game data from backend API.
   * Caches data in IndexedDB for offline access.
   */
  loadMasterData(): Observable<GameRecord[]> {
    // Check in-memory cache first for immediate response
    if (this.isCacheValid()) {
      return of(this.allGamesCache);
    }
    
    // Try IndexedDB cache, then fetch from backend if needed
    return from(this.getCachedData()).pipe(
      switchMap(cachedData => {
        if (cachedData && cachedData.length > 0) {
          this.populateInMemoryCache(cachedData);
          return of(cachedData);
        }
        return this.fetchFromBackend();
      }),
      catchError(error => {
        console.error('Cache check failed, fetching from backend:', error);
        return this.fetchFromBackend();
      })
    );
  }

  /**
   * Get a specific game by its app ID.
   * Returns null if game not found.
   */
  getGameById(appId: number): GameRecord | null {
    return this.gameCache.get(appId) || null;
  }

  /**
   * Get all cached games.
   * Returns empty array if no data loaded.
   */
  getAllGames(): GameRecord[] {
    return [...this.allGamesCache];
  }

  /**
   * Get games as Observable, loading from backend if needed.
   * Returns cached data immediately if available, otherwise loads from API.
   */
  getGames(): Observable<GameRecord[]> {
    console.log('📡 GameDataService: getGames called');
    console.log('📡 GameDataService: isCacheValid() =', this.isCacheValid());
    console.log('📡 GameDataService: allGamesCache.length =', this.allGamesCache.length);
    
    // If we have cached data, return it immediately
    if (this.isCacheValid()) {
      console.log('📡 GameDataService: Returning cached data:', this.getAllGames().length, 'games');
      return of(this.getAllGames());
    }

    // Otherwise, load from backend
    console.log('📡 GameDataService: No valid cache, fetching from backend...');
    return this.fetchFromBackend();
  }

  /**
   * Check if master data is currently cached.
   */
  isCacheValid(): boolean {
    return this.allGamesCache.length > 0;
  }

  /**
   * Clear cached data and force reload on next request.
   */
  async clearCache(): Promise<void> {
    try {
      await this.db.cache.delete(this.CACHE_KEY);
      await this.db.games.clear();
      this.gameCache.clear();
      this.allGamesCache = [];
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }
  
  /**
   * Close database connection for cleanup
   */
  async closeDatabase(): Promise<void> {
    try {
      await this.db.close();
    } catch (error) {
      console.warn('Database close failed:', error);
    }
  }

  /**
   * Fetch games from backend API.
   */
  private fetchFromBackend(): Observable<GameRecord[]> {
    console.log('📡 GameDataService: Fetching from', this.API_URL);
    return this.http.get<GameRecord[]>(this.API_URL).pipe(
      tap(data => {
        console.log('📡 GameDataService: Received data from backend:', data.length, 'games');
        if (data.length > 0) {
          console.log('📡 GameDataService: First game:', data[0].name);
        }
        this.cacheData(data).catch(error => 
          console.warn('Cache failed, but data loaded:', error)
        );
        this.populateInMemoryCache(data);
      }),
      catchError(error => {
        console.error('📡 GameDataService: Failed to fetch games from backend:', error);
        return throwError(() => error);
      })
    );
  }

  private async getCachedData(): Promise<GameRecord[] | null> {
    try {
      // In test environment, IndexedDB might not work properly, so fall back gracefully
      if (!this.db) return null;
      
      const cacheEntry = await this.db.cache.get(this.CACHE_KEY);
      if (!cacheEntry) return null;
      
      const age = Date.now() - cacheEntry.timestamp;
      if (age >= this.CACHE_TTL) {
        await this.clearCache();
        return null;
      }
      
      return cacheEntry.data;
    } catch (error) {
      // In tests, IndexedDB operations might fail - this is OK, just fetch from backend
      console.warn('Cache read failed, will fetch from backend:', error);
      return null;
    }
  }


  private async cacheData(games: GameRecord[]): Promise<void> {
    try {
      await this.db.transaction('rw', this.db.games, this.db.cache, async () => {
        await this.db.games.clear();
        await this.db.games.bulkAdd(games);
        await this.db.cache.put({
          id: this.CACHE_KEY,
          data: games,
          timestamp: Date.now()
        });
      });
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  private populateInMemoryCache(games: GameRecord[]): void {
    this.gameCache.clear();
    this.allGamesCache = games;
    games.forEach(game => {
      this.gameCache.set(game.appId, game);
    });
  }
}