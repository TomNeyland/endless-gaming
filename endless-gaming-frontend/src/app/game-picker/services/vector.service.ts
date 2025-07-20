import { Injectable } from '@angular/core';
import { GameRecord, SparseVector, TagDictionary } from '../../types/game.types';

/**
 * Service for vector operations and tag normalization.
 * 
 * Handles conversion of games to sparse vectors, tag dictionary management,
 * and normalization of tag vote counts for ML operations.
 */
@Injectable({
  providedIn: 'root'
})
export class VectorService {

  /**
   * Build a tag dictionary from all games.
   * Maps tag names to indices for sparse vector operations.
   */
  buildTagDictionary(games: GameRecord[]): TagDictionary {
    const tagSet = new Set<string>();
    
    // Collect all unique tags from all games
    games.forEach(game => {
      Object.keys(game.tags).forEach(tag => tagSet.add(tag));
    });
    
    // Create tag → index mapping
    const tagToIndex: { [tag: string]: number } = {};
    const indexToTag: string[] = [];
    
    Array.from(tagSet).sort().forEach((tag, index) => {
      tagToIndex[tag] = index;
      indexToTag[index] = tag;
    });
    
    return {
      tagToIndex,
      indexToTag,
      size: indexToTag.length
    };
  }

  /**
   * Convert a game to a sparse vector representation.
   * Uses the tag dictionary to map tags to indices.
   */
  gameToSparseVector(game: GameRecord, tagDict: TagDictionary): SparseVector {
    const indices: number[] = [];
    const values: number[] = [];
    
    // Convert game tags to sparse vector format
    Object.entries(game.tags).forEach(([tag, votes]) => {
      const index = tagDict.tagToIndex[tag];
      if (index !== undefined && votes > 0) {
        indices.push(index);
        values.push(votes);
      }
    });
    
    return {
      indices: new Uint16Array(indices),
      values: new Float32Array(values),
      size: tagDict.size
    };
  }

  /**
   * Normalize tag vote counts to [0, 1] range.
   * Divides each tag's votes by the maximum votes for that tag across all games.
   */
  normalizeTagCounts(tags: { [tag: string]: number }, maxTagVotes: { [tag: string]: number }): { [tag: string]: number } {
    const normalized: { [tag: string]: number } = {};
    
    Object.entries(tags).forEach(([tag, votes]) => {
      const maxVotes = maxTagVotes[tag];
      if (maxVotes && maxVotes > 0) {
        normalized[tag] = votes / maxVotes;
      } else {
        normalized[tag] = 0;
      }
    });
    
    return normalized;
  }

  /**
   * Calculate dot product between sparse vector and dense weight vector.
   * Used for preference scoring.
   */
  dotProduct(sparseVec: SparseVector, denseVec: Float32Array): number {
    let result = 0;
    
    for (let i = 0; i < sparseVec.indices.length; i++) {
      const index = sparseVec.indices[i];
      const value = sparseVec.values[i];
      
      if (index < denseVec.length) {
        result += value * denseVec[index];
      }
    }
    
    return result;
  }

  /**
   * Get maximum tag vote counts across all games.
   * Used for normalization.
   */
  getMaxTagVotes(games: GameRecord[]): { [tag: string]: number } {
    const maxVotes: { [tag: string]: number } = {};
    
    games.forEach(game => {
      Object.entries(game.tags).forEach(([tag, votes]) => {
        if (!maxVotes[tag] || votes > maxVotes[tag]) {
          maxVotes[tag] = votes;
        }
      });
    });
    
    return maxVotes;
  }

  /**
   * Filter out tags with insufficient vote counts.
   * Helps reduce noise in the ML model.
   */
  filterSignificantTags(tags: { [tag: string]: number }, minVotes: number): { [tag: string]: number } {
    const filtered: { [tag: string]: number } = {};
    
    Object.entries(tags).forEach(([tag, votes]) => {
      if (votes >= minVotes) {
        filtered[tag] = votes;
      }
    });
    
    return filtered;
  }
}