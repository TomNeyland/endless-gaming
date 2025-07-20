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
  
  private usedPairs = new Set<string>(); // Track all used pairs to prevent duplicates
  
  private readonly TARGET_COMPARISONS = 20;
  private readonly MIN_UNCERTAINTY = 0.1; // Minimum uncertainty threshold
  private readonly DIVERSITY_WINDOW = 5; // Recent pairs to check for diversity
  private infiniteMode = false; // Enable infinite voting beyond target

  /**
   * Get the next pair of games for comparison.
   * Uses uncertainty sampling to select informative pairs.
   * Returns null if no more pairs available or insufficient data.
   */
  getNextPair(): GamePair | null {
    console.log('🎲 PairService: getNextPair called');
    console.log('🎲 PairService: games.length =', this.games.length);
    console.log('🎲 PairService: choiceHistory.length =', this.choiceHistory.length);
    console.log('🎲 PairService: hasMorePairs() =', this.hasMorePairs());
    
    if (!this.hasMorePairs() || this.games.length < 2) {
      console.log('🎲 PairService: Returning null - no more pairs or insufficient games');
      return null;
    }

    // Bootstrap phase: use random pairs for first few comparisons
    if (this.choiceHistory.length < 3) {
      console.log('🎲 PairService: Bootstrap phase - getting random pair');
      return this.getRandomPair();
    }

    // Preference-guided sampling phase (comparisons 4+)
    console.log('🎲 PairService: Preference-guided sampling phase');
    
    // In infinite mode with many comparisons, focus on top games
    if (this.infiniteMode && this.choiceHistory.length >= this.TARGET_COMPARISONS) {
      console.log('🎲 PairService: Infinite mode - focusing on top games');
      return this.getTopGamesPair();
    }
    
    return this.getPreferenceGuidedPair();
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
    
    // Track this pair as used to prevent duplicates
    const pairKey = this.createPairKey({ left: leftGame, right: rightGame });
    this.usedPairs.add(pairKey);

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
    console.log('🎲 PairService: hasMorePairs check');
    console.log('🎲 PairService: games.length =', this.games.length);
    console.log('🎲 PairService: choiceHistory.length =', this.choiceHistory.length);
    console.log('🎲 PairService: TARGET_COMPARISONS =', this.TARGET_COMPARISONS);
    console.log('🎲 PairService: infiniteMode =', this.infiniteMode);
    console.log('🎲 PairService: usedPairs.size =', this.usedPairs.size);
    
    if (this.games.length < 2) {
      console.log('🎲 PairService: hasMorePairs = false (< 2 games)');
      return false;
    }
    
    // In infinite mode, always allow more comparisons (for continuous voting)
    if (this.infiniteMode) {
      console.log('🎲 PairService: hasMorePairs = true (infinite mode)');
      return true;
    }
    
    // Normal mode: check target comparisons
    if (this.choiceHistory.length >= this.TARGET_COMPARISONS) {
      console.log('🎲 PairService: hasMorePairs = false (reached target)');
      return false;
    }
    
    // Check if there are any unused pairs remaining
    const totalPossiblePairs = (this.games.length * (this.games.length - 1)) / 2;
    const hasMore = this.usedPairs.size < totalPossiblePairs;
    console.log('🎲 PairService: totalPossiblePairs =', totalPossiblePairs);
    console.log('🎲 PairService: hasMorePairs =', hasMore);
    return hasMore;
  }

  /**
   * Get current progress information.
   * Returns completion status for progress display.
   */
  getProgress(): ProgressInfo {
    // Calculate maximum possible unique pairs
    const maxPossiblePairs = this.games.length >= 2 
      ? (this.games.length * (this.games.length - 1)) / 2 
      : 0;
    
    // The total is the minimum of target comparisons and possible unique pairs
    const total = Math.min(this.TARGET_COMPARISONS, maxPossiblePairs);
    
    return {
      current: this.choiceHistory.length,
      total: total
    };
  }

  /**
   * Initialize the pair service with available games.
   * Sets up the candidate pool for uncertainty sampling.
   */
  initializeWithGames(games: GameRecord[]): void {
    console.log('🎲 PairService: Initializing with', games.length, 'games');
    this.games = [...games];
    this.choiceHistory = [];
    this.usedPairs.clear(); // Clear used pairs for fresh start
    console.log('🎲 PairService: Initialization complete. Can create pairs:', this.games.length >= 2);
  }

  /**
   * Reset comparison progress and start over.
   * Clears all recorded choices and resets state.
   */
  resetProgress(): void {
    this.choiceHistory = [];
    this.usedPairs.clear(); // Clear used pairs to allow all pairs again
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

    // Find all unused pairs
    const candidates: GamePair[] = [];

    for (let i = 0; i < this.games.length; i++) {
      for (let j = i + 1; j < this.games.length; j++) {
        const pair = { left: this.games[i], right: this.games[j] };
        const pairKey = this.createPairKey(pair);
        
        // Check if this pair has never been used
        if (!this.usedPairs.has(pairKey)) {
          candidates.push(pair);
        }
      }
    }

    if (candidates.length === 0) {
      // No unused pairs available
      return null;
    }

    // Return random unused pair
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
      // Skip already used pairs
      const pairKey = this.createPairKey(pair);
      if (this.usedPairs.has(pairKey)) {
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
   * Get preference-guided pair using hybrid sampling approach.
   * One game from high-preference pool, second game for maximum uncertainty.
   */
  private getPreferenceGuidedPair(): GamePair | null {
    if (this.games.length < 2) {
      return null;
    }

    // Determine preference pool size based on comparison count (progressive targeting)
    let preferencePercentile: number;
    if (this.choiceHistory.length < 7) {
      preferencePercentile = 0.5; // Top 50% (moderate targeting)
    } else if (this.choiceHistory.length < 15) {
      preferencePercentile = 0.3; // Top 30% (higher targeting)
    } else {
      preferencePercentile = 0.2; // Top 20% (maximum targeting)
    }

    const highPreferenceGames = this.getHighPreferenceGames(preferencePercentile);
    if (highPreferenceGames.length === 0) {
      // Fallback to regular uncertainty sampling if no preference data
      return this.getUncertaintyBasedPair();
    }

    let bestPair: GamePair | null = null;
    let maxUncertainty = -1;

    // For each high-preference game, find the best uncertainty-based pairing
    for (const preferredGame of highPreferenceGames) {
      for (const candidateGame of this.games) {
        // Skip pairing with itself
        if (candidateGame.appId === preferredGame.appId) {
          continue;
        }

        const pair = { left: preferredGame, right: candidateGame };
        const pairKey = this.createPairKey(pair);

        // Skip already used pairs
        if (this.usedPairs.has(pairKey)) {
          continue;
        }

        const uncertainty = this.calculateUncertainty(preferredGame, candidateGame);
        if (uncertainty > maxUncertainty) {
          maxUncertainty = uncertainty;
          bestPair = pair;
        }
      }
    }

    // If no good preference-guided pairs found, fall back to uncertainty sampling
    if (!bestPair || maxUncertainty < this.MIN_UNCERTAINTY) {
      return this.getUncertaintyBasedPair();
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
   * Create a unique key for a pair (order doesn't matter).
   */
  private createPairKey(pair: GamePair): string {
    const appId1 = pair.left.appId;
    const appId2 = pair.right.appId;
    return `${Math.min(appId1, appId2)}-${Math.max(appId1, appId2)}`;
  }

  /**
   * Get high-preference games based on current preference model.
   * Returns games the user is likely to prefer, sorted by score.
   */
  private getHighPreferenceGames(percentile: number): GameRecord[] {
    if (this.games.length === 0 || percentile <= 0 || percentile > 1) {
      return [];
    }

    // Calculate scores for all games
    const gamesWithScores = this.games.map(game => ({
      game,
      score: this.preferenceService.calculateGameScore(game)
    }));

    // Sort by score descending (highest preference first)
    gamesWithScores.sort((a, b) => b.score - a.score);

    // Return top percentile of games
    const topCount = Math.max(1, Math.ceil(this.games.length * percentile));
    return gamesWithScores.slice(0, topCount).map(item => item.game);
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

  /**
   * Enable infinite voting mode for continuous preference refinement.
   * Used by voting bottom sheet component.
   */
  enableInfiniteMode(): void {
    console.log('🎲 PairService: Enabling infinite mode');
    this.infiniteMode = true;
  }

  /**
   * Disable infinite voting mode and return to normal target-based mode.
   */
  disableInfiniteMode(): void {
    console.log('🎲 PairService: Disabling infinite mode');
    this.infiniteMode = false;
  }

  /**
   * Check if infinite mode is currently enabled.
   */
  isInfiniteMode(): boolean {
    return this.infiniteMode;
  }

  /**
   * Get pairs focused on top-ranked games for refinement.
   * Used in infinite mode to prioritize uncertain pairs among high-scoring games.
   */
  getTopGamesPair(topPercentile: number = 0.3): GamePair | null {
    if (this.games.length < 2) {
      return null;
    }

    // Get top games by current preference score
    const topGames = this.getHighPreferenceGames(topPercentile);
    if (topGames.length < 2) {
      // Not enough top games, fall back to regular pairing
      return this.getPreferenceGuidedPair();
    }

    let bestPair: GamePair | null = null;
    let maxUncertainty = -1;

    // Find the most uncertain pair among top games
    for (let i = 0; i < topGames.length; i++) {
      for (let j = i + 1; j < topGames.length; j++) {
        const pair = { left: topGames[i], right: topGames[j] };
        const pairKey = this.createPairKey(pair);

        // In infinite mode, allow reusing pairs after some time
        const shouldSkipPair = this.shouldSkipPairInInfiniteMode(pairKey);
        if (shouldSkipPair) {
          continue;
        }

        const uncertainty = this.calculateUncertainty(topGames[i], topGames[j]);
        if (uncertainty > maxUncertainty) {
          maxUncertainty = uncertainty;
          bestPair = pair;
        }
      }
    }

    return bestPair || this.getPreferenceGuidedPair();
  }

  /**
   * In infinite mode, decide if a pair should be skipped.
   * Allows reusing pairs after they haven't been seen for a while.
   */
  private shouldSkipPairInInfiniteMode(pairKey: string): boolean {
    if (!this.infiniteMode) {
      return this.usedPairs.has(pairKey);
    }

    // In infinite mode, allow reusing pairs if we haven't seen them recently
    const recentPairKeys = this.choiceHistory
      .slice(-this.DIVERSITY_WINDOW * 2) // Larger window for infinite mode
      .map(choice => this.createPairKey({ left: choice.leftGame, right: choice.rightGame }));

    return recentPairKeys.includes(pairKey);
  }
}