import { Injectable, inject } from '@angular/core';
import { GameRecord, GamePair, ProgressInfo, MLConfig, TagDictionary } from '../../types/game.types';
import { PreferenceService } from './preference.service';
import { VectorService } from './vector.service';

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
  private vectorService = inject(VectorService);
  
  private games: GameRecord[] = [];
  private tagDict: TagDictionary | null = null;
  private choiceHistory: Array<{
    leftGame: GameRecord;
    rightGame: GameRecord;
    pick: 'left' | 'right' | 'skip';
    timestamp: number;
  }> = [];
  
  private usedPairs = new Set<string>(); // Track all used pairs to prevent duplicates
  
  // Performance caches
  private scoreCache = new Map<number, number>(); // gameId -> score
  private vectorCache = new Map<number, any>(); // gameId -> SparseVector
  private cacheVersion = 0; // Increment when preferences change to invalidate caches
  
  private readonly TARGET_COMPARISONS = 5;
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
      this.invalidateCaches(); // Preference model changed
    } else if (pick === 'right') {
      this.preferenceService.updatePreferences(rightGame, leftGame);
      this.invalidateCaches(); // Preference model changed
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
  initializeWithGames(games: GameRecord[], tagDict?: TagDictionary): void {
    console.log('🎲 PairService: Initializing with', games.length, 'games');
    this.games = [...games];
    this.choiceHistory = [];
    this.usedPairs.clear(); // Clear used pairs for fresh start
    
    // Store tag dictionary for vector caching
    if (tagDict) {
      this.tagDict = tagDict;
      this.precomputeVectors();
    }
    
    console.log('🎲 PairService: Initialization complete. Can create pairs:', this.games.length >= 2);
  }

  /**
   * Reset comparison progress and start over.
   * Clears all recorded choices and resets state.
   */
  resetProgress(): void {
    this.choiceHistory = [];
    this.usedPairs.clear(); // Clear used pairs to allow all pairs again
    this.invalidateCaches(); // Clear performance caches
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
   * Get the total number of comparisons made.
   */
  getComparisonCount(): number {
    return this.choiceHistory.length;
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
   * Get preference-guided pair using optimized batch processing.
   * Uses pre-computed scores and efficient sampling instead of nested loops.
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

    // Batch compute scores for all games at once using caching
    const gamesWithScores = this.batchComputeGameScores();
    if (gamesWithScores.length === 0) {
      return this.getUncertaintyBasedPair();
    }

    // Get high-preference games from pre-sorted array
    const topCount = Math.max(1, Math.ceil(gamesWithScores.length * preferencePercentile));
    const highPreferenceGames = gamesWithScores.slice(0, topCount).map(item => item.game);

    // Efficiently sample candidate pairs with random sampling depth
    const maxPairs = this.getRandomSamplingDepth();
    const candidatePairs = this.generateCandidatePairs(highPreferenceGames, maxPairs);
    
    if (candidatePairs.length === 0) {
      return this.getUncertaintyBasedPair();
    }

    // Find best uncertainty among candidates using cached scores with threshold filtering
    let bestPair: GamePair | null = null;
    let maxUncertainty = -1;

    for (const pair of candidatePairs) {
      const uncertainty = this.calculateUncertaintyFromCachedScores(pair.left, pair.right, gamesWithScores);
      
      // Early termination: if we find a pair with very high uncertainty, use it immediately
      if (uncertainty > 0.8) {
        return pair;
      }
      
      if (uncertainty > maxUncertainty && uncertainty >= this.MIN_UNCERTAINTY) {
        maxUncertainty = uncertainty;
        bestPair = pair;
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

    // Get top games using optimized batch scoring
    const gamesWithScores = this.batchComputeGameScores();
    const topCount = Math.max(2, Math.ceil(gamesWithScores.length * topPercentile));
    const topGames = gamesWithScores.slice(0, topCount).map(item => item.game);
    
    if (topGames.length < 2) {
      // Not enough top games, fall back to regular pairing
      return this.getPreferenceGuidedPair();
    }

    let bestPair: GamePair | null = null;
    let maxUncertainty = -1;

    // Find the most uncertain pair among top games (using O(n²) here is ok since topGames is small)
    for (let i = 0; i < topGames.length; i++) {
      for (let j = i + 1; j < topGames.length; j++) {
        const pair = { left: topGames[i], right: topGames[j] };
        const pairKey = this.createPairKey(pair);

        // In infinite mode, allow reusing pairs after some time
        const shouldSkipPair = this.shouldSkipPairInInfiniteMode(pairKey);
        if (shouldSkipPair) {
          continue;
        }

        const uncertainty = this.calculateUncertaintyFromCachedScores(topGames[i], topGames[j], gamesWithScores);
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

  /**
   * Invalidate all performance caches when preferences change.
   */
  private invalidateCaches(): void {
    this.cacheVersion++;
    this.scoreCache.clear();
    // Note: Vector cache doesn't need clearing as vectors don't change with preferences
  }

  /**
   * Get cached game score or compute and cache it.
   */
  private getCachedGameScore(game: GameRecord): number {
    const cacheKey = game.appId;
    if (this.scoreCache.has(cacheKey)) {
      return this.scoreCache.get(cacheKey)!;
    }
    
    const score = this.preferenceService.calculateGameScore(game);
    this.scoreCache.set(cacheKey, score);
    return score;
  }

  /**
   * Pre-compute and cache sparse vectors for all games.
   */
  private precomputeVectors(): void {
    if (!this.tagDict) {
      return;
    }
    
    console.log('🎲 PairService: Pre-computing vectors for', this.games.length, 'games');
    this.vectorCache.clear();
    
    this.games.forEach(game => {
      const vector = this.vectorService.gameToSparseVector(game, this.tagDict!);
      this.vectorCache.set(game.appId, vector);
    });
    
    console.log('🎲 PairService: Vector pre-computation complete');
  }

  /**
   * Get cached sparse vector or compute and cache it.
   */
  private getCachedGameVector(game: GameRecord): any {
    const cacheKey = game.appId;
    if (this.vectorCache.has(cacheKey)) {
      return this.vectorCache.get(cacheKey);
    }
    
    if (this.tagDict) {
      const vector = this.vectorService.gameToSparseVector(game, this.tagDict);
      this.vectorCache.set(cacheKey, vector);
      return vector;
    }
    
    return null;
  }

  /**
   * Batch compute and cache scores for all games.
   * Returns sorted array (highest score first) for efficient access.
   */
  private batchComputeGameScores(): Array<{ game: GameRecord; score: number }> {
    const gamesWithScores = this.games.map(game => ({
      game,
      score: this.getCachedGameScore(game)
    }));

    // Sort by score descending (highest preference first)
    gamesWithScores.sort((a, b) => b.score - a.score);
    return gamesWithScores;
  }

  /**
   * Generate candidate pairs efficiently without nested loops.
   * Samples pairs from high-preference games with all other games, filtering by uncertainty threshold and diversity.
   */
  private generateCandidatePairs(highPreferenceGames: GameRecord[], maxPairs: number): GamePair[] {
    const candidates: GamePair[] = [];
    const sampled = new Set<string>();
    
    // Get recent pair keys for diversity checking (O(1) lookups)
    const recentPairKeys = new Set(
      this.choiceHistory
        .slice(-this.DIVERSITY_WINDOW)
        .map(choice => this.createPairKey({ left: choice.leftGame, right: choice.rightGame }))
    );

    // For each high-preference game, sample some pairings with other games
    const pairsPerGame = Math.ceil(maxPairs / highPreferenceGames.length);
    
    for (const preferredGame of highPreferenceGames) {
      let pairsForThisGame = 0;
      const otherGames = this.games.filter(g => g.appId !== preferredGame.appId);
      
      // Shuffle other games for random sampling
      for (let i = otherGames.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherGames[i], otherGames[j]] = [otherGames[j], otherGames[i]];
      }

      for (const candidateGame of otherGames) {
        if (pairsForThisGame >= pairsPerGame || candidates.length >= maxPairs) {
          break;
        }

        const pair = { left: preferredGame, right: candidateGame };
        const pairKey = this.createPairKey(pair);

        // Skip already used pairs, duplicates, and recent pairs for diversity
        if (!this.usedPairs.has(pairKey) && !sampled.has(pairKey) && !recentPairKeys.has(pairKey)) {
          // Skip games that are too similar (DLCs, editions, etc.)
          if (this.areGamesTooSimilar(preferredGame, candidateGame)) {
            continue;
          }
          
          // Quick uncertainty check - only add pairs that meet minimum threshold
          const uncertainty = this.calculateUncertainty(preferredGame, candidateGame);
          if (uncertainty >= this.MIN_UNCERTAINTY) {
            candidates.push(pair);
            sampled.add(pairKey);
            pairsForThisGame++;
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Calculate uncertainty using pre-computed scores to avoid redundant score calculations.
   */
  private calculateUncertaintyFromCachedScores(
    game1: GameRecord, 
    game2: GameRecord, 
    gamesWithScores: Array<{ game: GameRecord; score: number }>
  ): number {
    // Find scores in pre-computed array
    const score1 = gamesWithScores.find(g => g.game.appId === game1.appId)?.score ?? 0;
    const score2 = gamesWithScores.find(g => g.game.appId === game2.appId)?.score ?? 0;
    
    // Calculate probability using logistic function
    const scoreDiff = score1 - score2;
    const probability = 1 / (1 + Math.exp(-scoreDiff));
    
    // Uncertainty is highest when probability is close to 0.5
    return 1 - Math.abs(probability - 0.5) * 2;
  }

  /**
   * Get random sampling depth based on model confidence for current vote.
   * Uses weighted random selection across 5 different sampling mechanisms.
   * Each vote independently selects a mechanism to maintain variety.
   */
  private getRandomSamplingDepth(): number {
    const confidence = this.preferenceService.getModelConfidence();
    
    // Define sampling mechanisms with their pair ranges
    const mechanisms = [
      { name: 'ultra-focused', min: 10, max: 25 },
      { name: 'focused', min: 25, max: 50 },
      { name: 'balanced', min: 50, max: 75 },
      { name: 'exploratory', min: 75, max: 100 },
      { name: 'wide-discovery', min: 100, max: 150 }
    ];

    // Dynamic weights based on confidence
    let weights: number[];
    if (confidence > 0.7) {
      // High confidence: bias toward focused mechanisms
      weights = [0.30, 0.35, 0.25, 0.08, 0.02];
    } else if (confidence < 0.3) {
      // Low confidence: bias toward exploratory mechanisms  
      weights = [0.05, 0.15, 0.25, 0.30, 0.25];
    } else {
      // Medium confidence: balanced distribution
      weights = [0.15, 0.25, 0.30, 0.20, 0.10];
    }

    // Weighted random selection
    const random = Math.random();
    let cumulativeWeight = 0;
    let selectedMechanism = mechanisms[2]; // Default to balanced

    for (let i = 0; i < mechanisms.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        selectedMechanism = mechanisms[i];
        break;
      }
    }

    // Return random value within selected mechanism's range
    const { min, max } = selectedMechanism;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /**
   * Check if two games are too similar to provide meaningful comparison.
   * Filters out DLCs, expansions, editions, and games with nearly identical tags.
   */
  private areGamesTooSimilar(game1: GameRecord, game2: GameRecord): boolean {
    // 1. Name similarity check - catch DLCs, expansions, editions
    if (this.areNamesTooSimilar(game1.name, game2.name)) {
      return true;
    }

    // 2. Tag similarity check - catch games with nearly identical tag profiles
    const tagSimilarity = this.calculateTagSimilarity(game1, game2);
    if (tagSimilarity > 0.92) { // Very conservative threshold
      return true;
    }

    return false;
  }

  /**
   * Check if game names suggest they're the same series/DLC/edition.
   * Conservative approach to avoid false positives.
   */
  private areNamesTooSimilar(name1: string, name2: string): boolean {
    // Normalize names for comparison
    const normalize = (name: string) => 
      name.toLowerCase()
        .replace(/[^\w\s]/g, ' ')  // Remove punctuation
        .replace(/\s+/g, ' ')      // Normalize spaces
        .trim();

    const norm1 = normalize(name1);
    const norm2 = normalize(name2);

    // Extract base name by removing common expansion/edition markers
    const extractBaseName = (name: string) => {
      return name
        .replace(/\b(dlc|expansion|pack|edition|bundle|collection|goty|deluxe|premium|ultimate|complete|enhanced|directors cut|remastered|redux|definitive)\b/gi, '')
        .replace(/\b(episode|chapter|part|volume|season)\s*\d+/gi, '')
        .replace(/\s*[:\-]\s*.*/g, '') // Remove subtitle after colon/dash
        .trim();
    };

    const base1 = extractBaseName(norm1);
    const base2 = extractBaseName(norm2);

    // Debug logging for name analysis
    if (name1.toLowerCase().includes('f.e.a.r') || name2.toLowerCase().includes('f.e.a.r') || 
        norm1.includes('f e a r') || norm2.includes('f e a r')) {
      console.log(`🔍 Name Analysis: "${name1}" vs "${name2}"`, {
        norm1,
        norm2,
        base1,
        base2,
        baseNamesEqual: base1 === base2,
        baseLength1: base1.length,
        baseLength2: base2.length,
        wouldFilter: (base1 === base2 && base1.length > 3)
      });
    }

    // If base names are identical or very similar, they're likely the same game
    if (base1 === base2 && base1.length > 3) {
      return true;
    }

    // Check for substring containment (one name contains most of the other)
    const shorter = base1.length < base2.length ? base1 : base2;
    const longer = base1.length < base2.length ? base2 : base1;
    
    if (shorter.length > 5 && longer.includes(shorter)) {
      return true;
    }

    return false;
  }

  /**
   * Calculate tag similarity between two games using cosine similarity.
   * Returns 0-1 where 1 means identical tag profiles.
   */
  private calculateTagSimilarity(game1: GameRecord, game2: GameRecord): number {
    const tags1 = game1.tags || {};
    const tags2 = game2.tags || {};

    // Get all unique tags
    const allTags = new Set([...Object.keys(tags1), ...Object.keys(tags2)]);
    
    if (allTags.size === 0) {
      return 1; // Both games have no tags, consider them identical
    }

    // Create normalized vectors (0-1 scale based on max votes per game)
    const getMaxVotes = (tags: {[key: string]: number}) => 
      Math.max(1, ...Object.values(tags)); // Prevent division by zero

    const max1 = getMaxVotes(tags1);
    const max2 = getMaxVotes(tags2);

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const tag of allTags) {
      const value1 = (tags1[tag] || 0) / max1;
      const value2 = (tags2[tag] || 0) / max2;
      
      dotProduct += value1 * value2;
      magnitude1 += value1 * value1;
      magnitude2 += value2 * value2;
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 1; // One game has no tags, avoid division by zero
    }

    // Cosine similarity
    return dotProduct / (magnitude1 * magnitude2);
  }
}