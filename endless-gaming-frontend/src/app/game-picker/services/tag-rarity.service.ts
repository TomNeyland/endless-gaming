import { Injectable } from '@angular/core';
import { GameRecord, TagRarityAnalysis, TFIDFConfig } from '../../types/game.types';

/**
 * Service for calculating and managing TF-IDF tag rarity analysis.
 * 
 * Implements inverse document frequency (IDF) weighting to make rare tags
 * more important in preference learning than common tags.
 */
@Injectable({
  providedIn: 'root'
})
export class TagRarityService {
  private cachedAnalysis: TagRarityAnalysis | null = null;
  private cachedGamesHash: string = '';
  
  private config: TFIDFConfig = {
    maxMultiplier: 3.0,
    minMultiplier: 0.5,
    smoothingEnabled: true
  };

  /**
   * Calculate TF-IDF tag rarity analysis for a set of games.
   * 
   * @param games Array of games to analyze
   * @returns TagRarityAnalysis with frequency and IDF data
   */
  calculateTagRarity(games: GameRecord[]): TagRarityAnalysis {
    // Generate hash of games to check if we can use cached analysis
    const gamesHash = this.generateGamesHash(games);
    
    if (this.cachedAnalysis && this.cachedGamesHash === gamesHash) {
      return this.cachedAnalysis;
    }

    const tagFrequency = new Map<string, number>();
    const totalGames = games.length;

    // Count how many games contain each tag
    games.forEach(game => {
      const gameTags = new Set(Object.keys(game.tags));
      gameTags.forEach(tag => {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      });
    });

    // Calculate inverse document frequency (IDF) for each tag
    const inverseFrequency = new Map<string, number>();
    
    tagFrequency.forEach((count, tag) => {
      if (count > 0 && totalGames > 0) {
        // IDF formula: log(total_documents / documents_containing_term)
        const idf = Math.log(totalGames / count);
        inverseFrequency.set(tag, idf);
      } else {
        inverseFrequency.set(tag, 0);
      }
    });

    // Cache the results
    this.cachedAnalysis = {
      tagFrequency,
      inverseFrequency,
      totalGames
    };
    this.cachedGamesHash = gamesHash;

    return this.cachedAnalysis;
  }

  /**
   * Get the importance multiplier for a specific tag.
   * 
   * @param tag Tag name to get multiplier for
   * @returns Multiplier value (0.5-3.0 by default)
   */
  getTagImportanceMultiplier(tag: string): number {
    if (!this.cachedAnalysis) {
      return 1.0; // Neutral multiplier if not initialized
    }

    const idf = this.cachedAnalysis.inverseFrequency.get(tag);
    
    if (idf === undefined) {
      return 1.0; // Neutral multiplier for unknown tags
    }

    if (!this.config.smoothingEnabled) {
      return idf;
    }

    // Apply smoothing to prevent extreme multipliers
    const smoothedMultiplier = Math.min(
      this.config.maxMultiplier,
      Math.max(this.config.minMultiplier, idf)
    );

    return smoothedMultiplier;
  }

  /**
   * Configure the TF-IDF service with custom parameters.
   * 
   * @param config Configuration object with multiplier bounds and smoothing settings
   */
  configure(config: TFIDFConfig): void {
    this.config = { ...config };
    // Clear cache since configuration has changed
    this.cachedAnalysis = null;
    this.cachedGamesHash = '';
  }

  /**
   * Get current configuration.
   * 
   * @returns Current TFIDFConfig
   */
  getConfiguration(): TFIDFConfig {
    return { ...this.config };
  }

  /**
   * Clear cached analysis to force recalculation.
   */
  clearCache(): void {
    this.cachedAnalysis = null;
    this.cachedGamesHash = '';
  }

  /**
   * Generate a simple hash of games array for cache validation.
   * Uses game count and first/last app IDs as a lightweight hash.
   * 
   * @param games Array of games
   * @returns Hash string
   */
  private generateGamesHash(games: GameRecord[]): string {
    if (games.length === 0) {
      return 'empty';
    }

    const firstAppId = games[0]?.appId || 0;
    const lastAppId = games[games.length - 1]?.appId || 0;
    
    return `${games.length}-${firstAppId}-${lastAppId}`;
  }
}