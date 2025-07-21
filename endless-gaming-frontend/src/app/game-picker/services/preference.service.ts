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
   * Uses incremental SGD with sliding window decay to emphasize recent preferences.
   */
  updatePreferences(winnerGame: GameRecord, loserGame: GameRecord): void {
    if (!this.tagDict) {
      throw new Error('Model not initialized. Call initializeModel() first.');
    }

    // Apply sliding window decay to existing weights before new update
    this.applySlidingWindowDecay();

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

    // Store this preference in history for confidence calculation
    this.preferenceHistory.push({
      winnerGame,
      loserGame,
      timestamp: Date.now(),
      weightUpdate: { winnerVec, loserVec, gradient }
    });

    // Apply incremental SGD update with full learning rate (this is the "recent" vote)
    this.updateWeightsFromVector(winnerVec, gradient * this.learningRate);
    this.updateWeightsFromVector(loserVec, -gradient * this.learningRate);

    this.comparisonCount++;
    this.updatePreferenceSummary();
    
    // Debug logging to track preference summary health
    this.logPreferenceSummaryDebugInfo();
  }

  /**
   * Apply sliding window decay to existing weight vector.
   * Recent preferences maintain full strength, older ones are gradually decayed.
   */
  private applySlidingWindowDecay(): void {
    if (!this.tagDict || this.preferenceHistory.length < 2) {
      return; // No decay needed for first vote or if no history
    }

    // Calculate decay factor based on sliding window position
    const decayFactor = this.calculateDecayFactor();
    
    // Apply decay to all weights
    for (let i = 0; i < this.weightVector.length; i++) {
      this.weightVector[i] *= decayFactor;
    }
  }

  /**
   * Calculate decay factor for sliding window effect.
   * Returns value between 0.85-0.95 to gradually reduce older preference influence.
   */
  private calculateDecayFactor(): number {
    const totalVotes = this.preferenceHistory.length;
    
    // Early voting: minimal decay to build up preferences
    if (totalVotes <= 5) {
      return 0.95; // Very light decay
    }
    
    // As we get more votes, increase decay to emphasize recent preferences
    if (totalVotes <= 20) {
      return 0.92; // Light decay
    }
    
    // For many votes, stronger decay to maintain sliding window effect
    return 0.88; // Moderate decay
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
   * Debug logging to track preference summary health and weight magnitudes.
   */
  private logPreferenceSummaryDebugInfo(): void {
    if (!this.tagDict) return;

    // Calculate weight statistics
    const nonZeroWeights = Array.from(this.weightVector).filter(w => Math.abs(w) > 0);
    const significantWeights = Array.from(this.weightVector).filter(w => Math.abs(w) > 0.01);
    const weightMagnitude = Math.sqrt(this.weightVector.reduce((sum, w) => sum + w * w, 0));
    
    // Get current preference summary
    const currentSummary = this.preferenceSummary$.value;
    const hasPreferences = currentSummary.likedTags.length > 0 || currentSummary.dislikedTags.length > 0;

    console.log(`🔍 Preference Debug [Vote ${this.comparisonCount}]:`, {
      hasPreferences,
      weightMagnitude: weightMagnitude.toFixed(3),
      nonZeroWeights: nonZeroWeights.length,
      significantWeights: significantWeights.length,
      likedTags: currentSummary.likedTags.length,
      dislikedTags: currentSummary.dislikedTags.length,
      maxWeight: Math.max(...Array.from(this.weightVector).map(Math.abs)).toFixed(4),
      minSignificantWeight: significantWeights.length > 0 ? Math.min(...significantWeights.map(Math.abs)).toFixed(4) : '0'
    });
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