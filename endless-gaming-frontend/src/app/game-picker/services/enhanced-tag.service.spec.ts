import { TestBed } from '@angular/core/testing';
import { EnhancedTagService } from './enhanced-tag.service';
import { TagRarityService } from './tag-rarity.service';
import { GameRecord, TagRarityAnalysis, EnhancedTag, EnhancedTagDisplay } from '../../types/game.types';

describe('EnhancedTagService', () => {
  let service: EnhancedTagService;
  let mockTagRarityService: jasmine.SpyObj<TagRarityService>;

  const mockGame: GameRecord = {
    appId: 730,
    name: 'Counter-Strike: Global Offensive',
    coverUrl: null,
    price: 'Free',
    developer: 'Valve',
    publisher: 'Valve',
    tags: { 
      'Action': 50000,      // Very popular
      'FPS': 45000,         // Popular
      'Shooter': 40000,     // Popular
      'Roguelike': 1500,    // Rare but high TF-IDF
      'Metroidvania': 800   // Very rare, very high TF-IDF
    },
    genres: ['Action'],
    reviewPos: 1000000,
    reviewNeg: 100000
  };

  const mockTFIDFAnalysis: TagRarityAnalysis = {
    tagFrequency: new Map([
      ['Action', 800],        // Common in many games
      ['FPS', 400],          // Moderately common
      ['Shooter', 350],      // Moderately common
      ['Roguelike', 50],     // Rare
      ['Metroidvania', 20]   // Very rare
    ]),
    inverseFrequency: new Map([
      ['Action', 0.2],         // Low IDF (common)
      ['FPS', 0.7],           // Medium IDF
      ['Shooter', 0.8],       // Medium IDF
      ['Roguelike', 2.9],     // High IDF (rare)
      ['Metroidvania', 3.4]   // Very high IDF (very rare)
    ]),
    totalGames: 1000
  };

  beforeEach(() => {
    const tagRaritySpy = jasmine.createSpyObj('TagRarityService', ['getTagImportanceMultiplier']);
    
    TestBed.configureTestingModule({
      providers: [
        { provide: TagRarityService, useValue: tagRaritySpy }
      ]
    });
    
    service = TestBed.inject(EnhancedTagService);
    mockTagRarityService = TestBed.inject(TagRarityService) as jasmine.SpyObj<TagRarityService>;
    
    // Configure mock multipliers
    mockTagRarityService.getTagImportanceMultiplier.and.callFake((tag: string) => {
      const multipliers: Record<string, number> = {
        'Action': 0.5,         // Low multiplier (common)
        'FPS': 1.2,           // Medium multiplier
        'Shooter': 1.3,       // Medium multiplier
        'Roguelike': 2.8,     // High multiplier (rare)
        'Metroidvania': 3.0   // Max multiplier (very rare)
      };
      return multipliers[tag] || 1.0;
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getPopularTags', () => {
    it('should return top tags sorted by vote count', () => {
      const popularTags = service.getPopularTags(mockGame, 3);
      
      expect(popularTags).toEqual([
        { tag: 'Action', votes: 50000, type: 'popular' },
        { tag: 'FPS', votes: 45000, type: 'popular' },
        { tag: 'Shooter', votes: 40000, type: 'popular' }
      ]);
    });

    it('should handle empty tags gracefully', () => {
      const gameWithNoTags: GameRecord = { ...mockGame, tags: {} };
      const popularTags = service.getPopularTags(gameWithNoTags, 3);
      
      expect(popularTags).toEqual([]);
    });

    it('should respect the count limit', () => {
      const popularTags = service.getPopularTags(mockGame, 2);
      
      expect(popularTags.length).toBe(2);
      expect(popularTags[0].tag).toBe('Action');
      expect(popularTags[1].tag).toBe('FPS');
    });

    it('should return all tags if count exceeds available tags', () => {
      const popularTags = service.getPopularTags(mockGame, 10);
      
      expect(popularTags.length).toBe(5); // Only 5 tags available
    });
  });

  describe('getUniqueTags', () => {
    it('should return top tags sorted by TF-IDF score', () => {
      const uniqueTags = service.getUniqueTags(mockGame, mockTFIDFAnalysis, 3);
      
      expect(uniqueTags.length).toBe(3);
      expect(uniqueTags[0].tag).toBe('Metroidvania'); // Highest TF-IDF
      expect(uniqueTags[0].tfidfScore).toBe(3.4);
      expect(uniqueTags[1].tag).toBe('Roguelike');    // Second highest TF-IDF
      expect(uniqueTags[1].tfidfScore).toBe(2.9);
      expect(uniqueTags[2].tag).toBe('Shooter');      // Third highest TF-IDF
    });

    it('should include multiplier information when TagRarityService available', () => {
      const uniqueTags = service.getUniqueTags(mockGame, mockTFIDFAnalysis, 2, mockTagRarityService);
      
      expect(uniqueTags[0].multiplier).toBe(3.0); // Metroidvania multiplier
      expect(uniqueTags[1].multiplier).toBe(2.8); // Roguelike multiplier
    });

    it('should work without TagRarityService', () => {
      const uniqueTags = service.getUniqueTags(mockGame, mockTFIDFAnalysis, 2);
      
      expect(uniqueTags[0].multiplier).toBeUndefined();
      expect(uniqueTags[1].multiplier).toBeUndefined();
    });

    it('should handle games with no matching TF-IDF analysis', () => {
      const gameWithUnknownTags: GameRecord = { 
        ...mockGame, 
        tags: { 'UnknownTag1': 1000, 'UnknownTag2': 500 } 
      };
      
      const uniqueTags = service.getUniqueTags(gameWithUnknownTags, mockTFIDFAnalysis, 3);
      
      expect(uniqueTags).toEqual([]);
    });
  });

  describe('getEnhancedTagDisplay', () => {
    it('should return combined popular and unique tags with deduplication', () => {
      const display = service.getEnhancedTagDisplay(mockGame, mockTFIDFAnalysis, 3, 2, mockTagRarityService);
      
      // Popular tags (top 3 by votes)
      expect(display.popularTags.length).toBe(3);
      expect(display.popularTags[0].tag).toBe('Action');
      expect(display.popularTags[1].tag).toBe('FPS');
      expect(display.popularTags[2].tag).toBe('Shooter');
      
      // Unique tags (top 2 by TF-IDF, excluding duplicates)
      expect(display.uniqueTags.length).toBe(2);
      expect(display.uniqueTags[0].tag).toBe('Metroidvania'); // Not in popular list
      expect(display.uniqueTags[1].tag).toBe('Roguelike');    // Not in popular list
      
      // All tags combined
      expect(display.allTags.length).toBe(5); // 3 popular + 2 unique (no overlap in this case)
    });

    it('should handle deduplication when popular and unique tags overlap', () => {
      // Create a scenario where high-vote tags also have high TF-IDF
      const modifiedTFIDFAnalysis: TagRarityAnalysis = {
        ...mockTFIDFAnalysis,
        inverseFrequency: new Map([
          ['Action', 2.5],        // High IDF despite high votes
          ['FPS', 2.8],          // High IDF
          ['Shooter', 0.8],      // Low IDF
          ['Roguelike', 2.9],    // High IDF
          ['Metroidvania', 3.4]  // Very high IDF
        ])
      };
      
      const display = service.getEnhancedTagDisplay(mockGame, modifiedTFIDFAnalysis, 3, 3, mockTagRarityService);
      
      // Should not duplicate tags between popular and unique lists
      const allTagNames = display.allTags.map(t => t.tag);
      const uniqueTagNames = new Set(allTagNames);
      expect(allTagNames.length).toBe(uniqueTagNames.size);
    });

    it('should work without TagRarityService', () => {
      const display = service.getEnhancedTagDisplay(mockGame, mockTFIDFAnalysis, 2, 2);
      
      expect(display.popularTags.length).toBe(2);
      expect(display.uniqueTags.length).toBe(2);
      expect(display.allTags.length).toBe(4);
      
      // Should not have multiplier information
      display.allTags.forEach(tag => {
        expect(tag.multiplier).toBeUndefined();
      });
    });

    it('should handle games with few tags gracefully', () => {
      const gameWithFewTags: GameRecord = { 
        ...mockGame, 
        tags: { 'Action': 1000, 'Roguelike': 500 } 
      };
      
      const display = service.getEnhancedTagDisplay(gameWithFewTags, mockTFIDFAnalysis, 3, 3);
      
      expect(display.popularTags.length).toBeLessThanOrEqual(2);
      expect(display.uniqueTags.length).toBeLessThanOrEqual(2);
      expect(display.allTags.length).toBeLessThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('should handle games with no tags', () => {
      const gameWithNoTags: GameRecord = { ...mockGame, tags: {} };
      
      const popularTags = service.getPopularTags(gameWithNoTags, 3);
      const uniqueTags = service.getUniqueTags(gameWithNoTags, mockTFIDFAnalysis, 3);
      const display = service.getEnhancedTagDisplay(gameWithNoTags, mockTFIDFAnalysis, 3, 3);
      
      expect(popularTags).toEqual([]);
      expect(uniqueTags).toEqual([]);
      expect(display.popularTags).toEqual([]);
      expect(display.uniqueTags).toEqual([]);
      expect(display.allTags).toEqual([]);
    });

    it('should handle empty TF-IDF analysis', () => {
      const emptyAnalysis: TagRarityAnalysis = {
        tagFrequency: new Map(),
        inverseFrequency: new Map(),
        totalGames: 0
      };
      
      const uniqueTags = service.getUniqueTags(mockGame, emptyAnalysis, 3);
      const display = service.getEnhancedTagDisplay(mockGame, emptyAnalysis, 3, 3);
      
      expect(uniqueTags).toEqual([]);
      expect(display.uniqueTags).toEqual([]);
      expect(display.popularTags.length).toBeGreaterThan(0); // Popular tags still work
    });

    it('should handle zero counts gracefully', () => {
      const popularTags = service.getPopularTags(mockGame, 0);
      const uniqueTags = service.getUniqueTags(mockGame, mockTFIDFAnalysis, 0);
      const display = service.getEnhancedTagDisplay(mockGame, mockTFIDFAnalysis, 0, 0);
      
      expect(popularTags).toEqual([]);
      expect(uniqueTags).toEqual([]);
      expect(display.popularTags).toEqual([]);
      expect(display.uniqueTags).toEqual([]);
      expect(display.allTags).toEqual([]);
    });
  });
});