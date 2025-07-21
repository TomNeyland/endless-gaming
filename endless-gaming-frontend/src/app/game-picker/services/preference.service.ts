import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameRecord, PreferenceSummary, UserPreferenceState, GameRecommendation, TagDictionary } from '../../types/game.types';
import { VectorService } from './vector.service';

/**
 * Service for managing user preferences and ML model.
 * 
 * Implements logistic SGD to learn user preferences from pairwise comparisons.
 * Provides real-time preference summaries and game rankings.
 */
@Injectable({
  providedIn: 'root'
})
export class PreferenceService {
  private vectorService = inject(VectorService);
  
  private preferenceSummary$ = new BehaviorSubject<PreferenceSummary>({ likedTags: [], dislikedTags: [] });
  private weightVector: Float32Array = new Float32Array(0);
  private tagDict: TagDictionary | null = null;
  private comparisonCount = 0;
  private readonly learningRate = 0.1;
  
  // Sliding window preference history for adaptive weighting
  private preferenceHistory: Array<{
    winnerGame: GameRecord;
    loserGame: GameRecord;
    timestamp: number;
    weightUpdate: { winnerVec: any; loserVec: any; gradient: number; };
  }> = [];

  /**
   * Update preferences based on a user choice.
   * Uses sliding window weighted SGD to emphasize recent preferences.
   */
  updatePreferences(winnerGame: GameRecord, loserGame: GameRecord): void {
    if (!this.tagDict) {
      throw new Error('Model not initialized. Call initializeModel() first.');
    }

    // Convert games to sparse vectors
    const winnerVec = this.vectorService.gameToSparseVector(winnerGame, this.tagDict);
    const loserVec = this.vectorService.gameToSparseVector(loserGame, this.tagDict);

    // Calculate current scores
    const winnerScore = this.vectorService.dotProduct(winnerVec, this.weightVector);
    const loserScore = this.vectorService.dotProduct(loserVec, this.weightVector);

    // Logistic SGD calculation
    const scoreDiff = winnerScore - loserScore;
    const probability = 1 / (1 + Math.exp(-scoreDiff));
    const gradient = 1 - probability;

    // Store this preference in history for sliding window
    this.preferenceHistory.push({
      winnerGame,
      loserGame,
      timestamp: Date.now(),
      weightUpdate: { winnerVec, loserVec, gradient }
    });

    // Rebuild weight vector using sliding window approach
    this.rebuildWeightsWithSlidingWindow();

    this.comparisonCount++;
    this.updatePreferenceSummary();
  }

  /**
   * Rebuild the entire weight vector using sliding window weighting.
   * This ensures recent preferences have more influence than historical ones.
   */
  private rebuildWeightsWithSlidingWindow(): void {
    if (!this.tagDict || this.preferenceHistory.length === 0) {
      return;
    }

    // Reset weight vector
    this.weightVector = new Float32Array(this.tagDict.size);

    const weights = this.getSlidingWindowWeights();
    const { recentStart, mediumStart } = this.getSlidingWindowIndices();
    const totalVotes = this.preferenceHistory.length;

    // Apply updates with sliding window weights
    for (let i = 0; i < totalVotes; i++) {
      const entry = this.preferenceHistory[i];
      const { winnerVec, loserVec, gradient } = entry.weightUpdate;
      
      // Determine which window this vote belongs to and its weight
      let windowWeight: number;
      if (i >= recentStart) {
        // Recent window (last 5 votes)
        windowWeight = weights.recent / Math.min(5, totalVotes - recentStart);
      } else if (i >= mediumStart) {
        // Medium-term window (last 40% excluding recent 5)
        const mediumTermSize = recentStart - mediumStart;
        windowWeight = mediumTermSize > 0 ? weights.mediumTerm / mediumTermSize : 0;
      } else {
        // Historical window (everything else)
        const historicalSize = mediumStart;
        windowWeight = historicalSize > 0 ? weights.historical / historicalSize : 0;
      }

      // Apply weighted SGD update
      const weightedLearningRate = this.learningRate * windowWeight;
      this.updateWeightsFromVector(winnerVec, gradient * weightedLearningRate);
      this.updateWeightsFromVector(loserVec, -gradient * weightedLearningRate);
    }
  }

  /**
   * Get current preference summary as observable.
   * Shows top liked and disliked tags with weights.
   */
  getPreferenceSummary(): Observable<PreferenceSummary> {
    return this.preferenceSummary$.asObservable();
  }

  /**
   * Rank games by preference score.
   * Returns games sorted by predicted preference (highest first).
   */
  rankGames(games: GameRecord[]): GameRecommendation[] {
    if (!this.tagDict) {
      return games.map((game, index) => ({
        game,
        score: 0,
        rank: index + 1
      }));
    }

    const recommendations = games.map(game => ({
      game,
      score: this.calculateGameScore(game),
      rank: 0 // Will be set after sorting
    }));

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    // Set ranks
    recommendations.forEach((rec, index) => {
      rec.rank = index + 1;
    });

    return recommendations;
  }

  /**
   * Reset all preferences and start over.
   * Clears weight vector, comparison count, and preference history.
   */
  resetPreferences(): void {
    if (this.tagDict) {
      this.weightVector = new Float32Array(this.tagDict.size);
    }
    this.comparisonCount = 0;
    this.preferenceHistory = [];
    this.updatePreferenceSummary();
  }

  /**
   * Initialize the preference model with tag dictionary.
   * Sets up the weight vector dimensions and clears history.
   */
  initializeModel(tagDict: TagDictionary): void {
    this.tagDict = tagDict;
    this.weightVector = new Float32Array(tagDict.size);
    this.comparisonCount = 0;
    this.preferenceHistory = [];
    this.updatePreferenceSummary();
  }

  /**
   * Get current user preference state.
   * Used for persistence to IndexedDB.
   */
  getPreferenceState(): UserPreferenceState {
    return {
      weightVector: Array.from(this.weightVector),
      comparisonCount: this.comparisonCount,
      tagDict: this.tagDict
    };
  }

  /**
   * Load preference state from storage.
   * Restores previous user session.
   */
  loadPreferenceState(state: UserPreferenceState): void {
    if (state.tagDict) {
      this.tagDict = state.tagDict;
      this.weightVector = new Float32Array(state.weightVector);
      this.comparisonCount = state.comparisonCount;
      this.updatePreferenceSummary();
    }
  }

  /**
   * Calculate preference score for a single game.
   * Returns dot product of game vector and weight vector.
   */
  calculateGameScore(game: GameRecord): number {
    if (!this.tagDict) {
      return 0;
    }

    const gameVector = this.vectorService.gameToSparseVector(game, this.tagDict);
    return this.vectorService.dotProduct(gameVector, this.weightVector);
  }

  /**
   * Get current comparison count.
   */
  getComparisonCount(): number {
    return this.comparisonCount;
  }

  /**
   * Calculate model confidence based on recent preference consistency and weight strength.
   * Returns a value between 0 (no confidence) and 1 (high confidence).
   * 
   * Confidence is based on:
   * - Recent preference consistency (sliding window focus)
   * - Weight vector magnitude (stronger preferences = higher confidence)
   * - Number of comparisons (more data = higher confidence)
   * - Weight distribution (focused weights = higher confidence)
   */
  getModelConfidence(): number {
    if (!this.tagDict || this.comparisonCount === 0) {
      return 0;
    }

    // Factor 1: Recent preference consistency (emphasize last 5-10 votes)
    const recentConsistency = this.calculateRecentPreferenceConsistency();

    // Factor 2: Weight vector magnitude (normalized)
    const weightMagnitude = Math.sqrt(this.weightVector.reduce((sum, w) => sum + w * w, 0));
    const normalizedMagnitude = Math.min(weightMagnitude / 5, 1); // Cap at reasonable max

    // Factor 3: Comparison count (diminishing returns, but prioritize recent data)
    const recentVotes = Math.min(this.preferenceHistory.length, 10);
    const comparisonFactor = Math.min(recentVotes / 10, 1);

    // Factor 4: Weight concentration (focused vs scattered preferences)
    const sortedWeights = Array.from(this.weightVector).map(Math.abs).sort((a, b) => b - a);
    const top10Sum = sortedWeights.slice(0, 10).reduce((sum, w) => sum + w, 0);
    const totalSum = sortedWeights.reduce((sum, w) => sum + w, 0);
    const concentrationFactor = totalSum > 0 ? top10Sum / totalSum : 0;

    // Combine factors with emphasis on recent consistency
    const confidence = 
      0.4 * recentConsistency +       // 40% based on recent preference patterns
      0.25 * normalizedMagnitude +    // 25% based on weight strength  
      0.2 * comparisonFactor +        // 20% based on data amount
      0.15 * concentrationFactor;     // 15% based on focus

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate consistency of recent preferences to assess model confidence.
   * Looks at prediction accuracy on recent votes.
   */
  private calculateRecentPreferenceConsistency(): number {
    if (this.preferenceHistory.length < 3) {
      return 0; // Need at least 3 votes for consistency assessment
    }

    // Look at last 10 votes (or all if fewer)
    const recentVotes = this.preferenceHistory.slice(-10);
    let correctPredictions = 0;

    for (const vote of recentVotes) {
      // Calculate what our model would have predicted
      const winnerScore = this.vectorService.dotProduct(vote.weightUpdate.winnerVec, this.weightVector);
      const loserScore = this.vectorService.dotProduct(vote.weightUpdate.loserVec, this.weightVector);
      
      // Model correctly predicted if winner has higher score
      if (winnerScore > loserScore) {
        correctPredictions++;
      }
    }

    return correctPredictions / recentVotes.length;
  }

  /**
   * Get sliding window weights for preference learning.
   * 35% weight to last 5 votes, 35% to last 40% of votes, 30% to all historical votes.
   */
  private getSlidingWindowWeights(): { recent: number; mediumTerm: number; historical: number } {
    const totalVotes = this.preferenceHistory.length;
    
    if (totalVotes <= 5) {
      // Not enough data for sliding window, use equal weighting
      return { recent: 0.33, mediumTerm: 0.33, historical: 0.34 };
    }

    return {
      recent: 0.35,      // Last 5 votes
      mediumTerm: 0.35,  // Last 40% of all votes (excluding the recent 5)
      historical: 0.30   // All historical votes
    };
  }

  /**
   * Get indices for sliding window segments.
   */
  private getSlidingWindowIndices(): { recentStart: number; mediumStart: number } {
    const totalVotes = this.preferenceHistory.length;
    
    // Recent: last 5 votes
    const recentStart = Math.max(0, totalVotes - 5);
    
    // Medium term: last 40% of votes, excluding the recent 5
    const mediumTermSize = Math.max(0, Math.floor(totalVotes * 0.4) - 5);
    const mediumStart = Math.max(0, recentStart - mediumTermSize);
    
    return { recentStart, mediumStart };
  }

  /**
   * Update weights from a sparse vector.
   * Helper method for SGD updates.
   */
  private updateWeightsFromVector(sparseVec: any, factor: number): void {
    for (let i = 0; i < sparseVec.indices.length; i++) {
      const index = sparseVec.indices[i];
      const value = sparseVec.values[i];
      if (index < this.weightVector.length) {
        this.weightVector[index] += factor * value;
      }
    }
  }

  /**
   * Update the preference summary with current top liked/disliked tags.
   */
  private updatePreferenceSummary(): void {
    if (!this.tagDict) {
      this.preferenceSummary$.next({ likedTags: [], dislikedTags: [] });
      return;
    }

    const tagWeights: Array<{ tag: string; weight: number }> = [];
    
    for (let i = 0; i < this.weightVector.length; i++) {
      const weight = this.weightVector[i];
      const tag = this.tagDict.indexToTag[i];
      if (tag && Math.abs(weight) > 0.01) { // Only include significant weights
        tagWeights.push({ tag, weight });
      }
    }

    // Sort by weight and take top 5 liked and disliked
    tagWeights.sort((a, b) => b.weight - a.weight);
    
    const likedTags = tagWeights.filter(tw => tw.weight > 0).slice(0, 5);
    const dislikedTags = tagWeights.filter(tw => tw.weight < 0).slice(-5).reverse();

    this.preferenceSummary$.next({
      likedTags: likedTags.map(tw => ({ tag: tw.tag, weight: tw.weight })),
      dislikedTags: dislikedTags.map(tw => ({ tag: tw.tag, weight: tw.weight }))
    });
  }
}