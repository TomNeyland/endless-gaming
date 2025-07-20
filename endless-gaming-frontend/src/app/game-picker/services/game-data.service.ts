import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GameRecord } from '../../types/game.types';

/**
 * Service for loading and caching game data from the backend API.
 * 
 * Handles fetching master.json from the backend and caching in IndexedDB
 * for offline access and improved performance.
 */
@Injectable({
  providedIn: 'root'
})
export class GameDataService {

  /**
   * Load master game data from backend API.
   * Caches data in IndexedDB for offline access.
   */
  loadMasterData(): Observable<GameRecord[]> {
    throw new Error('Not implemented');
  }

  /**
   * Get a specific game by its app ID.
   * Returns null if game not found.
   */
  getGameById(appId: number): GameRecord | null {
    throw new Error('Not implemented');
  }

  /**
   * Get all cached games.
   * Returns empty array if no data loaded.
   */
  getAllGames(): GameRecord[] {
    throw new Error('Not implemented');
  }

  /**
   * Check if master data is currently cached.
   */
  isCacheValid(): boolean {
    throw new Error('Not implemented');
  }

  /**
   * Clear cached data and force reload on next request.
   */
  clearCache(): Promise<void> {
    throw new Error('Not implemented');
  }
}