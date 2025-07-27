import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { GameRecord, GameRecommendation, SteamPlayerLookupResponse, SteamPlayerGame } from '../../types/game.types';
import { SteamPlayerService } from '../../shared/services/steam-player.service';

/**
 * Service for integrating Steam player data with game recommendations.
 * 
 * Provides utilities for playtime-based preference weighting, owned game
 * identification, and Steam-enhanced recommendation scoring.
 */

export interface PlaytimeCategory {
  category: 'unplayed' | 'light' | 'moderate' | 'heavy' | 'obsessed';
  description: string;
  multiplier: number;  // Preference weight multiplier for similar games
}

export interface SteamGameInsight {
  game: SteamPlayerGame;
  category: PlaytimeCategory;
  isRecentlyPlayed: boolean;
  preferenceWeight: number;  // How much this game should influence recommendations
}

export interface SteamPreferenceProfile {
  totalGames: number;
  totalPlaytime: number;
  averagePlaytime: number;
  topGenres: Array<{ genre: string; totalPlaytime: number; gameCount: number }>;
  playtimeInsights: SteamGameInsight[];
  preferenceMultipliers: Map<string, number>;  // Tag -> multiplier
}

@Injectable({
  providedIn: 'root'
})
export class SteamIntegrationService {
  private steamPlayerService = inject(SteamPlayerService);

  /**
   * Generate a Steam preference profile from user's library data.
   * Analyzes playtime patterns to understand user preferences.
   */
  generatePreferenceProfile(steamData: SteamPlayerLookupResponse, masterGames: GameRecord[]): SteamPreferenceProfile {
    const playtimeInsights = this.analyzePlaytimePatterns(steamData.games);
    const preferenceMultipliers = this.calculateTagPreferences(playtimeInsights, masterGames);
    
    const totalPlaytime = steamData.games.reduce((sum, game) => sum + game.playtime_forever, 0);
    const averagePlaytime = steamData.games.length > 0 ? totalPlaytime / steamData.games.length : 0;
    
    return {
      totalGames: steamData.game_count,
      totalPlaytime,
      averagePlaytime,
      topGenres: this.calculateTopGenres(playtimeInsights, masterGames),
      playtimeInsights,
      preferenceMultipliers
    };
  }

  /**
   * Check if a game is owned by the Steam user.
   */
  isGameOwned(game: GameRecord, steamData: SteamPlayerLookupResponse): boolean {
    return steamData.games.some(steamGame => steamGame.appid === game.appId);
  }

  /**
   * Get playtime data for an owned game.
   */
  getGamePlaytime(game: GameRecord, steamData: SteamPlayerLookupResponse): SteamPlayerGame | null {
    return steamData.games.find(steamGame => steamGame.appid === game.appId) || null;
  }

  /**
   * Calculate Steam-enhanced preference scores for games.
   * Boosts scores based on similarity to heavily played games.
   */
  calculateSteamEnhancedScores(
    recommendations: GameRecommendation[],
    steamProfile: SteamPreferenceProfile
  ): GameRecommendation[] {
    return recommendations.map(rec => ({
      ...rec,
      score: this.enhanceGameScore(rec.game, rec.score, steamProfile)
    }));
  }

  /**
   * Get playtime category and description for display.
   */
  getPlaytimeCategory(playtimeMinutes: number): PlaytimeCategory {
    const hours = playtimeMinutes / 60;
    
    if (hours === 0) {
      return {
        category: 'unplayed',
        description: 'Never played',
        multiplier: 0.8  // Slight penalty - owned but never played
      };
    } else if (hours < 2) {
      return {
        category: 'light',
        description: 'Briefly tried',
        multiplier: 0.9  // Small penalty - tried but didn't stick
      };
    } else if (hours < 20) {
      return {
        category: 'moderate',
        description: 'Casually played',
        multiplier: 1.2  // Moderate boost
      };
    } else if (hours < 100) {
      return {
        category: 'heavy',
        description: 'Heavily played',
        multiplier: 1.5  // Strong boost
      };
    } else {
      return {
        category: 'obsessed',
        description: 'Obsessively played',
        multiplier: 2.0  // Maximum boost
      };
    }
  }

  /**
   * Get Steam-specific insights for recommendation display.
   */
  getSteamInsights(
    game: GameRecord, 
    steamData: SteamPlayerLookupResponse,
    steamProfile?: SteamPreferenceProfile
  ): {
    isOwned: boolean;
    playtime?: SteamPlayerGame;
    category?: PlaytimeCategory;
    preferenceBoost?: number;
    recommendation?: string;
  } {
    const isOwned = this.isGameOwned(game, steamData);
    
    if (!isOwned) {
      return { isOwned: false };
    }

    const playtime = this.getGamePlaytime(game, steamData)!;
    const category = this.getPlaytimeCategory(playtime.playtime_forever);
    
    let preferenceBoost = 0;
    let recommendation = '';

    if (steamProfile) {
      preferenceBoost = this.calculateGamePreferenceBoost(game, steamProfile);
      recommendation = this.generateRecommendationReason(game, playtime, category, preferenceBoost);
    }

    return {
      isOwned: true,
      playtime,
      category,
      preferenceBoost,
      recommendation
    };
  }

  /**
   * Format playtime for display.
   */
  formatPlaytime(playtimeMinutes: number): string {
    if (playtimeMinutes === 0) {
      return 'Never played';
    }
    
    const hours = Math.floor(playtimeMinutes / 60);
    const minutes = playtimeMinutes % 60;
    
    if (hours === 0) {
      return `${minutes}m`;
    } else if (hours < 10 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${hours}h`;
    }
  }

  /**
   * Format recent playtime for display.
   */
  formatRecentPlaytime(recentMinutes?: number): string {
    if (!recentMinutes || recentMinutes === 0) {
      return '';
    }
    return `${this.formatPlaytime(recentMinutes)} recently`;
  }

  /**
   * Analyze playtime patterns to categorize games by engagement level.
   */
  private analyzePlaytimePatterns(steamGames: SteamPlayerGame[]): SteamGameInsight[] {
    return steamGames.map(game => {
      const category = this.getPlaytimeCategory(game.playtime_forever);
      const isRecentlyPlayed = (game.playtime_2weeks || 0) > 0;
      
      // Calculate preference weight based on playtime and recency
      let preferenceWeight = category.multiplier;
      if (isRecentlyPlayed) {
        preferenceWeight *= 1.3; // Boost for recent activity
      }
      
      return {
        game,
        category,
        isRecentlyPlayed,
        preferenceWeight
      };
    });
  }

  /**
   * Calculate tag preference multipliers based on Steam library analysis.
   */
  private calculateTagPreferences(
    insights: SteamGameInsight[],
    masterGames: GameRecord[]
  ): Map<string, number> {
    const tagWeights = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    
    // For each played game, find its tags and weight them by preference
    insights.forEach(insight => {
      const masterGame = masterGames.find(g => g.appId === insight.game.appid);
      if (masterGame && masterGame.tags) {
        Object.entries(masterGame.tags).forEach(([tag, votes]) => {
          const currentWeight = tagWeights.get(tag) || 0;
          const currentCount = tagCounts.get(tag) || 0;
          
          // Weight by both playtime preference and tag popularity in the game
          const tagInfluence = insight.preferenceWeight * Math.log(votes + 1);
          
          tagWeights.set(tag, currentWeight + tagInfluence);
          tagCounts.set(tag, currentCount + 1);
        });
      }
    });
    
    // Normalize weights and convert to multipliers
    const maxWeight = Math.max(...Array.from(tagWeights.values()));
    const multipliers = new Map<string, number>();
    
    tagWeights.forEach((weight, tag) => {
      const count = tagCounts.get(tag) || 1;
      const normalizedWeight = weight / maxWeight;
      const averageWeight = normalizedWeight / count;
      
      // Convert to multiplier (1.0 = neutral, >1.0 = boost, <1.0 = penalty)
      const multiplier = 1.0 + (averageWeight * 0.5); // Max boost of 1.5x
      multipliers.set(tag, multiplier);
    });
    
    return multipliers;
  }

  /**
   * Calculate top genres based on playtime analysis.
   */
  private calculateTopGenres(
    insights: SteamGameInsight[],
    masterGames: GameRecord[]
  ): Array<{ genre: string; totalPlaytime: number; gameCount: number }> {
    const genreData = new Map<string, { totalPlaytime: number; gameCount: number }>();
    
    insights.forEach(insight => {
      const masterGame = masterGames.find(g => g.appId === insight.game.appid);
      if (masterGame && masterGame.genres) {
        masterGame.genres.forEach(genre => {
          const current = genreData.get(genre) || { totalPlaytime: 0, gameCount: 0 };
          genreData.set(genre, {
            totalPlaytime: current.totalPlaytime + insight.game.playtime_forever,
            gameCount: current.gameCount + 1
          });
        });
      }
    });
    
    return Array.from(genreData.entries())
      .map(([genre, data]) => ({ genre, ...data }))
      .sort((a, b) => b.totalPlaytime - a.totalPlaytime)
      .slice(0, 5); // Top 5 genres
  }

  /**
   * Enhance a game's recommendation score based on Steam preferences.
   */
  private enhanceGameScore(
    game: GameRecord,
    baseScore: number,
    steamProfile: SteamPreferenceProfile
  ): number {
    let enhancedScore = baseScore;
    
    // Apply tag preference multipliers
    if (game.tags) {
      let totalMultiplier = 0;
      let tagCount = 0;
      
      Object.entries(game.tags).forEach(([tag, votes]) => {
        const multiplier = steamProfile.preferenceMultipliers.get(tag);
        if (multiplier) {
          totalMultiplier += multiplier * Math.log(votes + 1);
          tagCount++;
        }
      });
      
      if (tagCount > 0) {
        const averageMultiplier = totalMultiplier / tagCount;
        enhancedScore = baseScore * averageMultiplier;
      }
    }
    
    return enhancedScore;
  }

  /**
   * Calculate preference boost for a specific game.
   */
  private calculateGamePreferenceBoost(
    game: GameRecord,
    steamProfile: SteamPreferenceProfile
  ): number {
    if (!game.tags) return 0;
    
    let boost = 0;
    let tagCount = 0;
    
    Object.entries(game.tags).forEach(([tag, votes]) => {
      const multiplier = steamProfile.preferenceMultipliers.get(tag);
      if (multiplier && multiplier > 1.0) {
        boost += (multiplier - 1.0) * Math.log(votes + 1);
        tagCount++;
      }
    });
    
    return tagCount > 0 ? boost / tagCount : 0;
  }

  /**
   * Generate recommendation reason based on Steam data.
   */
  private generateRecommendationReason(
    game: GameRecord,
    playtime: SteamPlayerGame,
    category: PlaytimeCategory,
    preferenceBoost: number
  ): string {
    if (category.category === 'unplayed') {
      return 'You own this but haven\'t played it yet';
    }
    
    if (category.category === 'light') {
      return 'You tried this briefly - might be worth another look';
    }
    
    if (preferenceBoost > 0.3) {
      return `Similar to games you love (${this.formatPlaytime(playtime.playtime_forever)} played)`;
    }
    
    if (playtime.playtime_2weeks) {
      return `You're currently playing this (${this.formatPlaytime(playtime.playtime_2weeks)} recently)`;
    }
    
    return `You've enjoyed this (${this.formatPlaytime(playtime.playtime_forever)} played)`;
  }
}