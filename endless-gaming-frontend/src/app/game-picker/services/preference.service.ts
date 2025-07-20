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

  /**
   * Update preferences based on a user choice.
   * Uses logistic SGD to update the weight vector.
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

    // Logistic SGD update
    const scoreDiff = winnerScore - loserScore;
    const probability = 1 / (1 + Math.exp(-scoreDiff));
    const gradient = 1 - probability;

    // Update weights based on feature differences
    this.updateWeightsFromVector(winnerVec, gradient * this.learningRate);
    this.updateWeightsFromVector(loserVec, -gradient * this.learningRate);

    this.comparisonCount++;
    this.updatePreferenceSummary();
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
   * Clears weight vector and comparison count.
   */
  resetPreferences(): void {
    if (this.tagDict) {
      this.weightVector = new Float32Array(this.tagDict.size);
    }
    this.comparisonCount = 0;
    this.updatePreferenceSummary();
  }

  /**
   * Initialize the preference model with tag dictionary.
   * Sets up the weight vector dimensions.
   */
  initializeModel(tagDict: TagDictionary): void {
    this.tagDict = tagDict;
    this.weightVector = new Float32Array(tagDict.size);
    this.comparisonCount = 0;
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