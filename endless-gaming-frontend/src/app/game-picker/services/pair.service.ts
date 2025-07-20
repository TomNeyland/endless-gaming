import { Injectable, inject } from '@angular/core';
import { GameRecord, GamePair, ProgressInfo, MLConfig } from '../../types/game.types';
import { PreferenceService } from './preference.service';

/**
 * Service for managing game pair selection and comparison progress.
 * 
 * Implements uncertainty sampling to select informative game pairs
 * and tracks progress through the comparison phase.
 */
@Injectable({
  providedIn: 'root'
})
export class PairService {
  private preferenceService = inject(PreferenceService);
  
  private games: GameRecord[] = [];
  private choiceHistory: Array<{
    leftGame: GameRecord;
    rightGame: GameRecord;
    pick: 'left' | 'right' | 'skip';
    timestamp: number;
  }> = [];
  
  private readonly TARGET_COMPARISONS = 20;
  private readonly MIN_UNCERTAINTY = 0.1; // Minimum uncertainty threshold
  private readonly DIVERSITY_WINDOW = 5; // Recent pairs to check for diversity

  /**
   * Get the next pair of games for comparison.
   * Uses uncertainty sampling to select informative pairs.
   * Returns null if no more pairs available or insufficient data.
   */
  getNextPair(): GamePair | null {
    if (!this.hasMorePairs() || this.games.length < 2) {
      return null;
    }

    // Bootstrap phase: use random pairs for first few comparisons
    if (this.choiceHistory.length < 3) {
      return this.getRandomPair();
    }

    // Uncertainty sampling phase
    return this.getUncertaintyBasedPair();
  }

  /**
   * Record a user choice between two games.
   * Updates internal state for pair selection algorithm.
   */
  recordChoice(leftGame: GameRecord, rightGame: GameRecord, pick: 'left' | 'right' | 'skip'): void {
    const choice = {
      leftGame,
      rightGame,
      pick,
      timestamp: Date.now()
    };
    
    this.choiceHistory.push(choice);

    // Update preferences if not skipped
    if (pick === 'left') {
      this.preferenceService.updatePreferences(leftGame, rightGame);
    } else if (pick === 'right') {
      this.preferenceService.updatePreferences(rightGame, leftGame);
    }
  }

  /**
   * Check if more pairs are available for comparison.
   * Based on target comparison count and algorithm state.
   */
  hasMorePairs(): boolean {
    return this.choiceHistory.length < this.TARGET_COMPARISONS && this.games.length >= 2;
  }

  /**
   * Get current progress information.
   * Returns completion status for progress display.
   */
  getProgress(): ProgressInfo {
    return {
      current: this.choiceHistory.length,
      total: this.TARGET_COMPARISONS
    };
  }

  /**
   * Initialize the pair service with available games.
   * Sets up the candidate pool for uncertainty sampling.
   */
  initializeWithGames(games: GameRecord[]): void {
    this.games = [...games];
    this.choiceHistory = [];
  }

  /**
   * Reset comparison progress and start over.
   * Clears all recorded choices and resets state.
   */
  resetProgress(): void {
    this.choiceHistory = [];
    this.preferenceService.resetPreferences();
  }

  /**
   * Get all recorded choices for analytics.
   * Returns history of user decisions.
   */
  getChoiceHistory(): Array<{
    leftGame: GameRecord;
    rightGame: GameRecord;
    pick: 'left' | 'right' | 'skip';
    timestamp: number;
  }> {
    return [...this.choiceHistory];
  }

  /**
   * Get a random pair for bootstrap phase.
   */
  private getRandomPair(): GamePair | null {
    if (this.games.length < 2) {
      return null;
    }

    // Avoid recent pairs for diversity
    const recentPairs = this.getRecentPairs();
    const candidates: GamePair[] = [];

    for (let i = 0; i < this.games.length; i++) {
      for (let j = i + 1; j < this.games.length; j++) {
        const pair = { left: this.games[i], right: this.games[j] };
        
        // Check if this pair was used recently
        const isRecent = recentPairs.some(recent => 
          this.isPairSame(pair, recent)
        );
        
        if (!isRecent) {
          candidates.push(pair);
        }
      }
    }

    if (candidates.length === 0) {
      // If all pairs are recent, pick any random pair
      const i = Math.floor(Math.random() * this.games.length);
      let j = Math.floor(Math.random() * this.games.length);
      while (j === i) {
        j = Math.floor(Math.random() * this.games.length);
      }
      return { left: this.games[i], right: this.games[j] };
    }

    // Return random candidate
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }

  /**
   * Get uncertainty-based pair using preference model.
   */
  private getUncertaintyBasedPair(): GamePair | null {
    if (this.games.length < 2) {
      return null;
    }

    const recentPairs = this.getRecentPairs();
    let bestPair: GamePair | null = null;
    let maxUncertainty = -1;

    // Sample pairs and find highest uncertainty
    const sampleSize = Math.min(100, (this.games.length * (this.games.length - 1)) / 2);
    const candidates = this.sampleGamePairs(sampleSize);

    for (const pair of candidates) {
      // Skip recent pairs for diversity
      const isRecent = recentPairs.some(recent => this.isPairSame(pair, recent));
      if (isRecent) {
        continue;
      }

      const uncertainty = this.calculateUncertainty(pair.left, pair.right);
      if (uncertainty > maxUncertainty) {
        maxUncertainty = uncertainty;
        bestPair = pair;
      }
    }

    // If no uncertain pairs found, fall back to random
    if (!bestPair || maxUncertainty < this.MIN_UNCERTAINTY) {
      return this.getRandomPair();
    }

    return bestPair;
  }

  /**
   * Sample game pairs efficiently.
   */
  private sampleGamePairs(sampleSize: number): GamePair[] {
    const pairs: GamePair[] = [];
    const totalPairs = (this.games.length * (this.games.length - 1)) / 2;
    
    if (sampleSize >= totalPairs) {
      // Return all pairs
      for (let i = 0; i < this.games.length; i++) {
        for (let j = i + 1; j < this.games.length; j++) {
          pairs.push({ left: this.games[i], right: this.games[j] });
        }
      }
    } else {
      // Random sampling
      const sampled = new Set<string>();
      while (pairs.length < sampleSize && sampled.size < totalPairs) {
        const i = Math.floor(Math.random() * this.games.length);
        let j = Math.floor(Math.random() * this.games.length);
        while (j === i) {
          j = Math.floor(Math.random() * this.games.length);
        }
        
        const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
        if (!sampled.has(key)) {
          sampled.add(key);
          pairs.push({ left: this.games[i], right: this.games[j] });
        }
      }
    }

    return pairs;
  }

  /**
   * Calculate uncertainty for a potential game pair.
   * Used internally by the uncertainty sampling algorithm.
   */
  private calculateUncertainty(game1: GameRecord, game2: GameRecord): number {
    const score1 = this.preferenceService.calculateGameScore(game1);
    const score2 = this.preferenceService.calculateGameScore(game2);
    
    // Calculate probability using logistic function
    const scoreDiff = score1 - score2;
    const probability = 1 / (1 + Math.exp(-scoreDiff));
    
    // Uncertainty is highest when probability is close to 0.5
    return 1 - Math.abs(probability - 0.5) * 2;
  }

  /**
   * Get recent pairs for diversity checking.
   */
  private getRecentPairs(): GamePair[] {
    return this.choiceHistory
      .slice(-this.DIVERSITY_WINDOW)
      .map(choice => ({ left: choice.leftGame, right: choice.rightGame }));
  }

  /**
   * Check if two pairs are the same (order doesn't matter).
   */
  private isPairSame(pair1: GamePair, pair2: GamePair): boolean {
    return (pair1.left.appId === pair2.left.appId && pair1.right.appId === pair2.right.appId) ||
           (pair1.left.appId === pair2.right.appId && pair1.right.appId === pair2.left.appId);
  }

  /**
   * Apply diversity penalty to avoid repetitive pairs.
   * Reduces likelihood of showing similar games repeatedly.
   */
  private applyDiversityPenalty(candidates: GamePair[], recentPairs: GamePair[]): GamePair[] {
    return candidates.filter(candidate => 
      !recentPairs.some(recent => this.isPairSame(candidate, recent))
    );
  }
}