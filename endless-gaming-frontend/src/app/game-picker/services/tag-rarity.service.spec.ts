import { TestBed } from '@angular/core/testing';
import { TagRarityService } from './tag-rarity.service';
import { GameRecord, TagRarityAnalysis, TFIDFConfig } from '../../types/game.types';

describe('TagRarityService', () => {
  let service: TagRarityService;

  const mockGames: GameRecord[] = [
    {
      appId: 730,
      name: 'Counter-Strike: Global Offensive',
      coverUrl: null,
      price: 'Free',
      developer: 'Valve',
      publisher: 'Valve',
      tags: { 'FPS': 91172, 'Shooter': 65634, 'Action': 45123 }, // Common tags
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
      tags: { 'MOBA': 55432, 'Strategy': 34521, 'Action': 67890 }, // MOBA is rare, Action is common
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
      tags: { 'FPS': 72134, 'Shooter': 48291, 'Action': 31205 }, // FPS, Shooter, Action all common
      genres: ['Action'],
      reviewPos: 600000,
      reviewNeg: 80000
    },
    {
      appId: 12210,
      name: 'Grand Theft Auto IV',
      coverUrl: null,
      price: '19.99',
      developer: 'Rockstar North',
      publisher: 'Rockstar Games',
      tags: { 'Open World': 89123, 'Crime': 45612, 'Action': 78345 }, // Crime is rare
      genres: ['Action'],
      reviewPos: 400000,
      reviewNeg: 200000
    },
    {
      appId: 35720,
      name: 'Trine 2',
      coverUrl: null,
      price: '14.99',
      developer: 'Frozenbyte',
      publisher: 'Frozenbyte',
      tags: { 'Puzzle-Platformer': 12345, 'Co-op': 23456, 'Fantasy': 34567 }, // All very rare tags
      genres: ['Adventure'],
      reviewPos: 50000,
      reviewNeg: 5000
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TagRarityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('calculateTagRarity', () => {
    it('should calculate correct tag frequencies', () => {
      const analysis = service.calculateTagRarity(mockGames);
      
      // Action appears in 4 games
      expect(analysis.tagFrequency.get('Action')).toBe(4);
      
      // FPS appears in 2 games  
      expect(analysis.tagFrequency.get('FPS')).toBe(2);
      
      // MOBA appears in 1 game
      expect(analysis.tagFrequency.get('MOBA')).toBe(1);
      
      // Puzzle-Platformer appears in 1 game
      expect(analysis.tagFrequency.get('Puzzle-Platformer')).toBe(1);
      
      expect(analysis.totalGames).toBe(5);
    });

    it('should calculate correct inverse document frequency (IDF) values', () => {
      const analysis = service.calculateTagRarity(mockGames);
      
      // IDF = log(total_games / games_with_tag)
      // For Action (4/5 games): log(5/4) ≈ 0.223
      const actionIDF = analysis.inverseFrequency.get('Action');
      expect(actionIDF).toBeCloseTo(Math.log(5 / 4), 3);
      
      // For MOBA (1/5 games): log(5/1) ≈ 1.609
      const mobaIDF = analysis.inverseFrequency.get('MOBA');
      expect(mobaIDF).toBeCloseTo(Math.log(5 / 1), 3);
      
      // For FPS (2/5 games): log(5/2) ≈ 0.916
      const fpsIDF = analysis.inverseFrequency.get('FPS');
      expect(fpsIDF).toBeCloseTo(Math.log(5 / 2), 3);
    });

    it('should handle empty games array gracefully', () => {
      const analysis = service.calculateTagRarity([]);
      
      expect(analysis.tagFrequency.size).toBe(0);
      expect(analysis.inverseFrequency.size).toBe(0);
      expect(analysis.totalGames).toBe(0);
    });

    it('should handle games with no tags', () => {
      const gamesWithNoTags: GameRecord[] = [
        {
          appId: 999,
          name: 'Test Game',
          coverUrl: null,
          price: 'Free',
          developer: 'Test',
          publisher: 'Test',
          tags: {},
          genres: ['Test'],
          reviewPos: 100,
          reviewNeg: 10
        }
      ];
      
      const analysis = service.calculateTagRarity(gamesWithNoTags);
      
      expect(analysis.tagFrequency.size).toBe(0);
      expect(analysis.inverseFrequency.size).toBe(0);
      expect(analysis.totalGames).toBe(1);
    });
  });

  describe('getTagImportanceMultiplier', () => {
    beforeEach(() => {
      // Initialize service with test data
      service.calculateTagRarity(mockGames);
    });

    it('should return higher multipliers for rare tags', () => {
      const mobaMultiplier = service.getTagImportanceMultiplier('MOBA');
      const actionMultiplier = service.getTagImportanceMultiplier('Action');
      
      // MOBA is rarer than Action, so should have higher multiplier
      expect(mobaMultiplier).toBeGreaterThan(actionMultiplier);
    });

    it('should apply smoothing to prevent extreme multipliers', () => {
      const config: TFIDFConfig = {
        maxMultiplier: 3.0,
        minMultiplier: 0.5,
        smoothingEnabled: true
      };
      
      // Configure service with smoothing
      service.configure(config);
      service.calculateTagRarity(mockGames);
      
      const mobaMultiplier = service.getTagImportanceMultiplier('MOBA');
      const actionMultiplier = service.getTagImportanceMultiplier('Action');
      
      // Should be within configured bounds
      expect(mobaMultiplier).toBeLessThanOrEqual(3.0);
      expect(mobaMultiplier).toBeGreaterThanOrEqual(0.5);
      expect(actionMultiplier).toBeLessThanOrEqual(3.0);
      expect(actionMultiplier).toBeGreaterThanOrEqual(0.5);
    });

    it('should return neutral multiplier for unknown tags', () => {
      const unknownMultiplier = service.getTagImportanceMultiplier('NonExistentTag');
      expect(unknownMultiplier).toBe(1.0);
    });

    it('should handle service not being initialized', () => {
      const uninitializedService = new TagRarityService();
      const multiplier = uninitializedService.getTagImportanceMultiplier('Action');
      expect(multiplier).toBe(1.0);
    });
  });

  describe('configuration', () => {
    it('should use default configuration values', () => {
      const defaultConfig = service.getConfiguration();
      
      expect(defaultConfig.maxMultiplier).toBe(3.0);
      expect(defaultConfig.minMultiplier).toBe(0.5);
      expect(defaultConfig.smoothingEnabled).toBe(true);
    });

    it('should allow custom configuration', () => {
      const customConfig: TFIDFConfig = {
        maxMultiplier: 2.5,
        minMultiplier: 0.8,
        smoothingEnabled: false
      };
      
      service.configure(customConfig);
      const retrievedConfig = service.getConfiguration();
      
      expect(retrievedConfig.maxMultiplier).toBe(2.5);
      expect(retrievedConfig.minMultiplier).toBe(0.8);
      expect(retrievedConfig.smoothingEnabled).toBe(false);
    });
  });

  describe('performance and caching', () => {
    it('should cache analysis results to avoid recalculation', () => {
      spyOn(console, 'log'); // Suppress debug logs
      
      // First calculation
      const analysis1 = service.calculateTagRarity(mockGames);
      
      // Second calculation with same data
      const analysis2 = service.calculateTagRarity(mockGames);
      
      // Should return same cached instance
      expect(analysis1).toBe(analysis2);
    });

    it('should handle large game catalogs efficiently', () => {
      // Create a large number of games for performance testing
      const largeGameSet: GameRecord[] = [];
      
      for (let i = 0; i < 1000; i++) {
        largeGameSet.push({
          appId: i,
          name: `Game ${i}`,
          coverUrl: null,
          price: 'Free',
          developer: 'Test',
          publisher: 'Test',
          tags: { 
            [`Tag${i % 100}`]: Math.floor(Math.random() * 10000),
            'Common': Math.floor(Math.random() * 1000),
            [`Rare${i % 10}`]: Math.floor(Math.random() * 100)
          },
          genres: ['Test'],
          reviewPos: Math.floor(Math.random() * 100000),
          reviewNeg: Math.floor(Math.random() * 10000)
        });
      }
      
      const startTime = performance.now();
      const analysis = service.calculateTagRarity(largeGameSet);
      const endTime = performance.now();
      
      // Should complete within reasonable time (less than 100ms for 1000 games)
      expect(endTime - startTime).toBeLessThan(100);
      expect(analysis.totalGames).toBe(1000);
      expect(analysis.tagFrequency.size).toBeGreaterThan(0);
    });
  });
});