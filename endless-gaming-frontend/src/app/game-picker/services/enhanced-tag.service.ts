import { Injectable } from '@angular/core';
import { GameRecord, TagRarityAnalysis, EnhancedTag, EnhancedTagDisplay } from '../../types/game.types';
import { TagRarityService } from './tag-rarity.service';

/**
 * Service for creating enhanced tag displays that show both popular and unique tags.
 * 
 * Combines raw popularity (vote counts) with TF-IDF rarity insights to give users
 * a complete view of both mainstream appeal and distinctive characteristics.
 */
@Injectable({
  providedIn: 'root'
})
export class EnhancedTagService {

  /**
   * Get popular tags sorted by raw vote count.
   * These represent mainstream appeal and broad categorization.
   * 
   * @param game Game to analyze
   * @param count Maximum number of popular tags to return
   * @returns Array of popular tags sorted by vote count (descending)
   */
  getPopularTags(game: GameRecord, count: number): EnhancedTag[] {
    if (!game.tags || count <= 0) {
      return [];
    }

    return Object.entries(game.tags)
      .map(([tag, votes]) => ({
        tag,
        votes,
        type: 'popular' as const
      }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, count);
  }

  /**
   * Get unique tags sorted by TF-IDF importance score.
   * These represent distinctive characteristics that set the game apart.
   * 
   * @param game Game to analyze
   * @param tfidfAnalysis TF-IDF analysis data for tag rarity
   * @param count Maximum number of unique tags to return
   * @param tagRarityService Optional service for getting importance multipliers
   * @returns Array of unique tags sorted by TF-IDF score (descending)
   */
  getUniqueTags(
    game: GameRecord, 
    tfidfAnalysis: TagRarityAnalysis, 
    count: number,
    tagRarityService?: TagRarityService
  ): EnhancedTag[] {
    if (!game.tags || count <= 0) {
      return [];
    }

    const tagTFIDFScores: Array<{ tag: string; votes: number; tfidfScore: number; multiplier?: number }> = [];

    // Calculate TF-IDF score for each tag in the game
    Object.entries(game.tags).forEach(([tag, votes]) => {
      const idfScore = tfidfAnalysis.inverseFrequency.get(tag);
      
      if (idfScore !== undefined) {
        // Term Frequency (TF): normalized vote count within this game
        // Simple normalization: votes / max_votes_in_this_game
        const maxVotesInGame = Math.max(...Object.values(game.tags));
        const tf = maxVotesInGame > 0 ? votes / maxVotesInGame : 0;
        
        // TF-IDF = Term Frequency * Inverse Document Frequency
        const tfidfScore = tf * idfScore;
        
        let multiplier: number | undefined;
        if (tagRarityService) {
          multiplier = tagRarityService.getTagImportanceMultiplier(tag);
        }

        tagTFIDFScores.push({ 
          tag, 
          votes, 
          tfidfScore,
          multiplier
        });
      }
    });

    // Sort by TF-IDF score (descending) and take top N
    return tagTFIDFScores
      .sort((a, b) => b.tfidfScore - a.tfidfScore)
      .slice(0, count)
      .map(({ tag, votes, tfidfScore, multiplier }) => ({
        tag,
        votes,
        type: 'unique' as const,
        tfidfScore,
        multiplier
      }));
  }

  /**
   * Get complete enhanced tag display with both popular and unique tags.
   * Automatically deduplicates tags that appear in both lists.
   * 
   * @param game Game to analyze
   * @param tfidfAnalysis TF-IDF analysis data for tag rarity
   * @param popularCount Number of popular tags to include
   * @param uniqueCount Number of unique tags to include
   * @param tagRarityService Optional service for getting importance multipliers
   * @returns Complete enhanced tag display with separated and combined lists
   */
  getEnhancedTagDisplay(
    game: GameRecord, 
    tfidfAnalysis: TagRarityAnalysis, 
    popularCount: number,
    uniqueCount: number,
    tagRarityService?: TagRarityService
  ): EnhancedTagDisplay {
    
    // Get popular tags
    const popularTags = this.getPopularTags(game, popularCount);
    
    // Get unique tags - fetch more candidates to ensure we have enough after deduplication
    const allUniqueTags = this.getUniqueTags(game, tfidfAnalysis, Math.max(uniqueCount * 3, 10), tagRarityService);
    
    // DEBUG: Log TF-IDF calculation results
    if (game.name.includes('Palworld') || game.name.includes('Counter-Strike')) {
      console.log(`🔍 TF-IDF Debug for "${game.name}":`, {
        allUniqueTags: allUniqueTags.map(t => ({ tag: t.tag, tfidfScore: t.tfidfScore, votes: t.votes })),
        popularTags: popularTags.map(t => ({ tag: t.tag, votes: t.votes }))
      });
    }
    
    // Deduplicate: remove unique tags that are already in popular tags
    const popularTagNames = new Set(popularTags.map(t => t.tag));
    const uniqueTags = allUniqueTags
      .filter(tag => !popularTagNames.has(tag.tag))
      .slice(0, uniqueCount);
      
    // If user wants unique tags but we found none after deduplication, 
    // try to guarantee at least 1 unique tag by getting more candidates
    if (uniqueCount > 0 && uniqueTags.length === 0 && allUniqueTags.length > 0) {
      // Take the first available unique tag that's not popular
      const guaranteedUnique = allUniqueTags.find(tag => !popularTagNames.has(tag.tag));
      if (guaranteedUnique) {
        uniqueTags.push(guaranteedUnique);
      }
    }

    // Combine all tags for display
    const allTags = [...popularTags, ...uniqueTags];

    return {
      popularTags,
      uniqueTags,
      allTags
    };
  }

  /**
   * Get ALL game tags with enhanced type classification.
   * Classifies each tag as either popular or unique based on TF-IDF analysis.
   * 
   * @param game Game to analyze
   * @param tfidfAnalysis TF-IDF analysis data for tag rarity
   * @param tagRarityService Optional service for getting importance multipliers
   * @returns Array of all tags sorted by vote count with type classification
   */
  getAllEnhancedTags(
    game: GameRecord, 
    tfidfAnalysis: TagRarityAnalysis, 
    tagRarityService?: TagRarityService
  ): EnhancedTag[] {
    if (!game.tags) {
      return [];
    }

    const enhancedTags: EnhancedTag[] = [];

    // Analyze each tag to determine its type
    Object.entries(game.tags).forEach(([tag, votes]) => {
      const idfScore = tfidfAnalysis.inverseFrequency.get(tag);
      
      let tagType: 'popular' | 'unique' = 'popular';
      let tfidfScore: number | undefined;
      let multiplier: number | undefined;

      // If we have TF-IDF data, calculate rarity
      if (idfScore !== undefined) {
        const maxVotesInGame = Math.max(...Object.values(game.tags));
        const tf = maxVotesInGame > 0 ? votes / maxVotesInGame : 0;
        tfidfScore = tf * idfScore;

        // Classify as unique if TF-IDF score is above a threshold
        // This threshold determines what constitutes a "rare" tag
        const uniqueThreshold = 0.1; // Adjust this to fine-tune classification
        if (tfidfScore > uniqueThreshold) {
          tagType = 'unique';
        }

        if (tagRarityService) {
          multiplier = tagRarityService.getTagImportanceMultiplier(tag);
        }
      }

      enhancedTags.push({
        tag,
        votes,
        type: tagType,
        tfidfScore,
        multiplier
      });
    });

    // Sort by vote count (most popular first)
    return enhancedTags.sort((a, b) => b.votes - a.votes);
  }
}