import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import Dexie, { Table } from 'dexie';
import { SteamPlayerLookupResponse, SteamPlayerGame } from '../../types/game.types';

/**
 * Service for Steam player lookup functionality.
 * 
 * Provides methods to fetch user Steam library data including owned games
 * and playtime information from the backend API endpoint.
 */

interface SteamPlayerCacheEntry {
  id: string;                                    // Steam ID or cache key
  data: SteamPlayerLookupResponse;              // Cached player data
  timestamp: number;                            // Cache timestamp
}

class SteamPlayerDatabase extends Dexie {
  playerCache!: Table<SteamPlayerCacheEntry, string>;

  constructor() {
    super('SteamPlayerDatabase');
    this.version(1).stores({
      playerCache: 'id, timestamp'
    });
  }
}

@Injectable({
  providedIn: 'root'
})
export class SteamPlayerService {
  private http = inject(HttpClient);
  private db = new SteamPlayerDatabase();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour cache TTL
  private readonly API_BASE_URL = '/api/steam';

  /**
   * Look up a Steam player's library data by Steam ID.
   * 
   * @param steamId Steam ID of the player to lookup
   * @param useCache Whether to use cached data if available (default: true)
   * @returns Observable of player lookup response
   */
  lookupPlayer(steamId: string, useCache: boolean = true): Observable<SteamPlayerLookupResponse> {
    const cacheKey = `player_${steamId}`;

    if (useCache) {
      return this.getFromCache(cacheKey).pipe(
        switchMap(cachedData => {
          if (cachedData) {
            return of(cachedData);
          }
          return this.fetchPlayerFromAPI(steamId).pipe(
            tap(data => this.saveToCache(cacheKey, data))
          );
        })
      );
    }

    return this.fetchPlayerFromAPI(steamId).pipe(
      tap(data => this.saveToCache(cacheKey, data))
    );
  }

  /**
   * Get games from a player's library that match given app IDs.
   * Useful for finding overlap between user's library and recommendation list.
   * 
   * @param steamId Steam ID of the player
   * @param appIds Array of Steam app IDs to filter by
   * @returns Observable of matching games with playtime data
   */
  getPlayerGamesById(steamId: string, appIds: number[]): Observable<SteamPlayerGame[]> {
    return this.lookupPlayer(steamId).pipe(
      map(response => 
        response.games.filter(game => appIds.includes(game.appid))
      )
    );
  }

  /**
   * Get player's most played games.
   * 
   * @param steamId Steam ID of the player
   * @param limit Maximum number of games to return (default: 10)
   * @returns Observable of top played games sorted by playtime
   */
  getMostPlayedGames(steamId: string, limit: number = 10): Observable<SteamPlayerGame[]> {
    return this.lookupPlayer(steamId).pipe(
      map(response => 
        response.games
          .sort((a, b) => b.playtime_forever - a.playtime_forever)
          .slice(0, limit)
      )
    );
  }

  /**
   * Get player's recently played games (games with playtime in last 2 weeks).
   * 
   * @param steamId Steam ID of the player
   * @returns Observable of recently played games sorted by recent playtime
   */
  getRecentlyPlayedGames(steamId: string): Observable<SteamPlayerGame[]> {
    return this.lookupPlayer(steamId).pipe(
      map(response => 
        response.games
          .filter(game => game.playtime_2weeks && game.playtime_2weeks > 0)
          .sort((a, b) => (b.playtime_2weeks || 0) - (a.playtime_2weeks || 0))
      )
    );
  }

  /**
   * Clear cached player data.
   * 
   * @param steamId Optional Steam ID to clear specific player cache
   */
  clearCache(steamId?: string): Observable<void> {
    return from(this.clearCacheInternal(steamId));
  }

  /**
   * Fetch player data from the backend API.
   */
  private fetchPlayerFromAPI(steamId: string): Observable<SteamPlayerLookupResponse> {
    const url = `${this.API_BASE_URL}/lookup-player`;
    
    return this.http.get<SteamPlayerLookupResponse>(url, {
      params: { player_id: steamId }
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get player data from IndexedDB cache.
   */
  private getFromCache(cacheKey: string): Observable<SteamPlayerLookupResponse | null> {
    return from(this.getCacheInternal(cacheKey));
  }

  /**
   * Save player data to IndexedDB cache.
   */
  private saveToCache(cacheKey: string, data: SteamPlayerLookupResponse): void {
    this.saveCacheInternal(cacheKey, data).catch(error => {
      console.warn('Failed to cache Steam player data:', error);
    });
  }

  /**
   * Internal cache retrieval with TTL checking.
   */
  private async getCacheInternal(cacheKey: string): Promise<SteamPlayerLookupResponse | null> {
    try {
      const entry = await this.db.playerCache.get(cacheKey);
      if (entry && (Date.now() - entry.timestamp) < this.CACHE_TTL) {
        return entry.data;
      }
      // Remove expired cache entry
      if (entry) {
        await this.db.playerCache.delete(cacheKey);
      }
      return null;
    } catch (error) {
      console.warn('IndexedDB cache retrieval failed:', error);
      return null;
    }
  }

  /**
   * Internal cache storage.
   */
  private async saveCacheInternal(cacheKey: string, data: SteamPlayerLookupResponse): Promise<void> {
    try {
      await this.db.playerCache.put({
        id: cacheKey,
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn('IndexedDB cache storage failed:', error);
    }
  }

  /**
   * Internal cache clearing.
   */
  private async clearCacheInternal(steamId?: string): Promise<void> {
    try {
      if (steamId) {
        const cacheKey = `player_${steamId}`;
        await this.db.playerCache.delete(cacheKey);
      } else {
        await this.db.playerCache.clear();
      }
    } catch (error) {
      console.warn('IndexedDB cache clearing failed:', error);
    }
  }

  /**
   * HTTP error handler with appropriate error messages.
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'Unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 400:
          errorMessage = 'Invalid Steam ID provided';
          break;
        case 403:
          errorMessage = 'Steam profile is private or API access denied';
          break;
        case 404:
          errorMessage = 'Steam player not found';
          break;
        case 429:
          errorMessage = 'Too many requests. Please try again later';
          break;
        case 500:
          errorMessage = 'Server error. Please try again later';
          break;
        default:
          errorMessage = `Server error: ${error.status} ${error.message}`;
      }
    }

    console.error('Steam Player Service Error:', error);
    return throwError(() => new Error(errorMessage));
  };
}