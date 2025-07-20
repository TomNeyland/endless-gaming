import { TestBed } from '@angular/core/testing';
import { VectorService } from './vector.service';
import { GameRecord, TagDictionary, SparseVector } from '../../types/game.types';

describe('VectorService', () => {
  let service: VectorService;

  const mockGames: GameRecord[] = [
    {
      appId: 730,
      name: 'Counter-Strike: Global Offensive',
      coverUrl: null,
      price: 'Free',
      developer: 'Valve',
      publisher: 'Valve',
      tags: { 'FPS': 91172, 'Shooter': 65634, 'Multiplayer': 45123 },
      genres: ['Action'],
      reviewPos: 1000000,
      reviewNeg: 100000
    },
    {
      appId: 570,
      name: 'Dota 2',
      coverUrl: null,
      price: 'Free',
      developer: 'Valve',
      publisher: 'Valve',
      tags: { 'MOBA': 55432, 'Strategy': 34521, 'Multiplayer': 67890 },
      genres: ['Strategy'],
      reviewPos: 800000,
      reviewNeg: 120000
    },
    {
      appId: 440,
      name: 'Team Fortress 2',
      coverUrl: null,
      price: 'Free',
      developer: 'Valve',
      publisher: 'Valve',
      tags: { 'FPS': 72134, 'Shooter': 48291, 'Team-based': 31205 },
      genres: ['Action'],
      reviewPos: 600000,
      reviewNeg: 80000
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VectorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('buildTagDictionary', () => {
    it('should build tag dictionary from games', () => {
      const tagDict = service.buildTagDictionary(mockGames);
      
      expect(tagDict.size).toBe(6); // FPS, Shooter, Multiplayer, MOBA, Strategy, Team-based
      expect(tagDict.tagToIndex.has('FPS')).toBe(true);
      expect(tagDict.tagToIndex.has('MOBA')).toBe(true);
      expect(tagDict.tagToIndex.has('Shooter')).toBe(true);
      
      // Check bidirectional mapping
      const fpsIndex = tagDict.tagToIndex.get('FPS')!;
      expect(tagDict.indexToTag.get(fpsIndex)).toBe('FPS');
    });

    it('should handle games with no tags', () => {
      const gamesWithoutTags: GameRecord[] = [
        {
          ...mockGames[0],
          tags: {}
        }
      ];
      
      const tagDict = service.buildTagDictionary(gamesWithoutTags);
      expect(tagDict.size).toBe(0);
    });

    it('should create sequential indices', () => {
      const tagDict = service.buildTagDictionary(mockGames);
      const indices = Array.from(tagDict.tagToIndex.values()).sort();
      
      // Should be sequential starting from 0
      for (let i = 0; i < indices.length; i++) {
        expect(indices[i]).toBe(i);
      }
    });

    it('should handle empty game list', () => {
      const tagDict = service.buildTagDictionary([]);
      expect(tagDict.size).toBe(0);
      expect(tagDict.tagToIndex.size).toBe(0);
      expect(tagDict.indexToTag.size).toBe(0);
    });
  });

  describe('gameToSparseVector', () => {
    let tagDict: TagDictionary;

    beforeEach(() => {
      tagDict = service.buildTagDictionary(mockGames);
    });

    it('should convert game to sparse vector', () => {
      const maxTagVotes = service.getMaxTagVotes(mockGames);
      const normalizedTags = service.normalizeTagCounts(mockGames[0].tags, maxTagVotes);
      
      const sparseVec = service.gameToSparseVector(mockGames[0], tagDict);
      
      expect(sparseVec.indices).toBeInstanceOf(Uint16Array);
      expect(sparseVec.values).toBeInstanceOf(Float32Array);
      expect(sparseVec.indices.length).toBe(sparseVec.values.length);
      expect(sparseVec.indices.length).toBe(3); // FPS, Shooter, Multiplayer
    });

    it('should handle game with no tags', () => {
      const gameWithoutTags: GameRecord = {
        ...mockGames[0],
        tags: {}
      };
      
      const sparseVec = service.gameToSparseVector(gameWithoutTags, tagDict);
      expect(sparseVec.indices.length).toBe(0);
      expect(sparseVec.values.length).toBe(0);
    });

    it('should only include tags in dictionary', () => {
      const gameWithExtraTags: GameRecord = {
        ...mockGames[0],
        tags: { 'FPS': 1000, 'UnknownTag': 500 }
      };
      
      const sparseVec = service.gameToSparseVector(gameWithExtraTags, tagDict);
      expect(sparseVec.indices.length).toBe(1); // Only FPS should be included
    });

    it('should sort indices in ascending order', () => {
      const sparseVec = service.gameToSparseVector(mockGames[0], tagDict);
      
      for (let i = 1; i < sparseVec.indices.length; i++) {
        expect(sparseVec.indices[i]).toBeGreaterThan(sparseVec.indices[i - 1]);
      }
    });
  });

  describe('normalizeTagCounts', () => {
    it('should normalize tag counts to [0, 1] range', () => {
      const tags = { 'FPS': 50, 'Shooter': 25 };
      const maxTagVotes = { 'FPS': 100, 'Shooter': 50 };
      
      const normalized = service.normalizeTagCounts(tags, maxTagVotes);
      
      expect(normalized['FPS']).toBe(0.5);
      expect(normalized['Shooter']).toBe(0.5);
    });

    it('should handle zero max votes', () => {
      const tags = { 'FPS': 50 };
      const maxTagVotes = { 'FPS': 0 };
      
      const normalized = service.normalizeTagCounts(tags, maxTagVotes);
      
      expect(normalized['FPS']).toBe(0);
    });

    it('should handle missing max vote data', () => {
      const tags = { 'FPS': 50 };
      const maxTagVotes = {};
      
      const normalized = service.normalizeTagCounts(tags, maxTagVotes);
      
      expect(normalized['FPS']).toBe(0);
    });

    it('should preserve original tags object', () => {
      const tags = { 'FPS': 50, 'Shooter': 25 };
      const maxTagVotes = { 'FPS': 100, 'Shooter': 50 };
      
      service.normalizeTagCounts(tags, maxTagVotes);
      
      // Original should be unchanged
      expect(tags['FPS']).toBe(50);
      expect(tags['Shooter']).toBe(25);
    });
  });

  describe('dotProduct', () => {
    it('should calculate dot product correctly', () => {
      const sparseVec: SparseVector = {
        indices: new Uint16Array([0, 2, 4]),
        values: new Float32Array([0.5, 0.8, 0.3])
      };
      const denseVec = new Float32Array([1.0, 0.0, 2.0, 0.0, 4.0]);
      
      const result = service.dotProduct(sparseVec, denseVec);
      // 0.5 * 1.0 + 0.8 * 2.0 + 0.3 * 4.0 = 0.5 + 1.6 + 1.2 = 3.3
      expect(result).toBeCloseTo(3.3);
    });

    it('should handle empty sparse vector', () => {
      const sparseVec: SparseVector = {
        indices: new Uint16Array([]),
        values: new Float32Array([])
      };
      const denseVec = new Float32Array([1.0, 2.0, 3.0]);
      
      const result = service.dotProduct(sparseVec, denseVec);
      expect(result).toBe(0);
    });

    it('should handle single element vectors', () => {
      const sparseVec: SparseVector = {
        indices: new Uint16Array([1]),
        values: new Float32Array([0.7])
      };
      const denseVec = new Float32Array([0.0, 3.0, 0.0]);
      
      const result = service.dotProduct(sparseVec, denseVec);
      expect(result).toBeCloseTo(2.1);
    });
  });

  describe('getMaxTagVotes', () => {
    it('should find maximum votes for each tag', () => {
      const maxVotes = service.getMaxTagVotes(mockGames);
      
      expect(maxVotes['FPS']).toBe(91172); // Max between CS:GO and TF2
      expect(maxVotes['Shooter']).toBe(65634); // CS:GO has more
      expect(maxVotes['Multiplayer']).toBe(67890); // Dota 2 has more
      expect(maxVotes['MOBA']).toBe(55432); // Only in Dota 2
    });

    it('should handle single game', () => {
      const maxVotes = service.getMaxTagVotes([mockGames[0]]);
      
      expect(maxVotes['FPS']).toBe(91172);
      expect(maxVotes['Shooter']).toBe(65634);
      expect(maxVotes['Multiplayer']).toBe(45123);
    });

    it('should handle empty game list', () => {
      const maxVotes = service.getMaxTagVotes([]);
      expect(Object.keys(maxVotes)).toEqual([]);
    });

    it('should handle games with no tags', () => {
      const gamesWithoutTags = mockGames.map(game => ({ ...game, tags: {} }));
      const maxVotes = service.getMaxTagVotes(gamesWithoutTags);
      expect(Object.keys(maxVotes)).toEqual([]);
    });
  });

  describe('filterSignificantTags', () => {
    it('should filter out tags below minimum votes', () => {
      const tags = { 'FPS': 1000, 'Shooter': 500, 'Indie': 50 };
      const minVotes = 100;
      
      const filtered = service.filterSignificantTags(tags, minVotes);
      
      expect(filtered['FPS']).toBe(1000);
      expect(filtered['Shooter']).toBe(500);
      expect(filtered['Indie']).toBeUndefined();
    });

    it('should keep all tags if all meet minimum', () => {
      const tags = { 'FPS': 1000, 'Shooter': 500, 'Action': 200 };
      const minVotes = 100;
      
      const filtered = service.filterSignificantTags(tags, minVotes);
      
      expect(Object.keys(filtered)).toEqual(['FPS', 'Shooter', 'Action']);
    });

    it('should handle empty tags', () => {
      const filtered = service.filterSignificantTags({}, 100);
      expect(Object.keys(filtered)).toEqual([]);
    });

    it('should handle zero minimum votes', () => {
      const tags = { 'FPS': 0, 'Shooter': 10 };
      const filtered = service.filterSignificantTags(tags, 0);
      
      expect(Object.keys(filtered)).toEqual(['FPS', 'Shooter']);
    });

    it('should preserve original tags object', () => {
      const tags = { 'FPS': 1000, 'Shooter': 50 };
      service.filterSignificantTags(tags, 100);
      
      // Original should be unchanged
      expect(tags['FPS']).toBe(1000);
      expect(tags['Shooter']).toBe(50);
    });
  });

  describe('integration scenarios', () => {
    it('should work with full pipeline: dictionary -> vector -> dot product', () => {
      const tagDict = service.buildTagDictionary(mockGames);
      const maxVotes = service.getMaxTagVotes(mockGames);
      const sparseVec = service.gameToSparseVector(mockGames[0], tagDict);
      
      // Create a simple weight vector (all ones)
      const weightVec = new Float32Array(tagDict.size).fill(1.0);
      
      const score = service.dotProduct(sparseVec, weightVec);
      expect(score).toBeGreaterThan(0);
    });

    it('should handle tag filtering in pipeline', () => {
      const tagDict = service.buildTagDictionary(mockGames);
      const maxVotes = service.getMaxTagVotes(mockGames);
      
      // Filter to only significant tags
      const significantTags = service.filterSignificantTags(mockGames[0].tags, 50000);
      
      expect(Object.keys(significantTags).length).toBeLessThanOrEqual(Object.keys(mockGames[0].tags).length);
    });
  });
});