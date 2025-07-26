import { TestBed } from '@angular/core/testing';
import { PreferenceService } from './preference.service';
import { TagRarityService } from './tag-rarity.service';
import { GameRecord, TagDictionary, UserPreferenceState, PreferenceSummary, GameRecommendation } from '../../types/game.types';

describe('PreferenceService', () => {
  let service: PreferenceService;

  const mockTagDict: TagDictionary = {
    tagToIndex: {
      'FPS': 0,
      'Shooter': 1,
      'Multiplayer': 2,
      'MOBA': 3,
      'Strategy': 4
    },
    indexToTag: ['FPS', 'Shooter', 'Multiplayer', 'MOBA', 'Strategy'],
    size: 5
  };

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
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PreferenceService);
    
    // Clear localStorage to ensure test isolation
    localStorage.clear();
    
    // Initialize with clean state
    service.initializeModel(mockTagDict);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initializeModel', () => {
    it('should initialize weight vector with correct dimensions', () => {
      const freshService = TestBed.inject(PreferenceService);
      freshService.initializeModel(mockTagDict);
      
      const state = freshService.getPreferenceState();
      expect(state.weightVector.length).toBe(mockTagDict.size);
      expect(state.comparisonCount).toBe(0);
    });

    it('should initialize weights to zero', () => {
      const state = service.getPreferenceState();
      for (let i = 0; i < state.weightVector.length; i++) {
        expect(state.weightVector[i]).toBe(0);
      }
    });

    it('should reset existing preferences', () => {
      // Make some updates first
      service.updatePreferences(mockGames[0], mockGames[1]);
      expect(service.getComparisonCount()).toBe(1);
      
      // Re-initialize
      service.initializeModel(mockTagDict);
      expect(service.getComparisonCount()).toBe(0);
    });
  });

  describe('updatePreferences', () => {
    it('should update weight vector based on choice', () => {
      const initialState = service.getPreferenceState();
      const initialWeights = Array.from(initialState.weightVector);
      
      service.updatePreferences(mockGames[0], mockGames[1]);
      
      const updatedState = service.getPreferenceState();
      
      // Weights should have changed
      let weightsChanged = false;
      for (let i = 0; i < initialWeights.length; i++) {
        if (initialWeights[i] !== updatedState.weightVector[i]) {
          weightsChanged = true;
          break;
        }
      }
      expect(weightsChanged).toBe(true);
    });

    it('should increment comparison count', () => {
      expect(service.getComparisonCount()).toBe(0);
      
      service.updatePreferences(mockGames[0], mockGames[1]);
      expect(service.getComparisonCount()).toBe(1);
      
      service.updatePreferences(mockGames[1], mockGames[0]);
      expect(service.getComparisonCount()).toBe(2);
    });

    it('should handle multiple updates', () => {
      for (let i = 0; i < 5; i++) {
        service.updatePreferences(mockGames[0], mockGames[1]);
      }
      
      expect(service.getComparisonCount()).toBe(5);
    });

    it('should track comparison count', () => {
      service.initializeModel(mockTagDict);
      expect(service.getComparisonCount()).toBe(0);
      
      service.updatePreferences(mockGames[0], mockGames[1]);
      expect(service.getComparisonCount()).toBe(1);
      
      const state = service.getPreferenceState();
      expect(state.comparisonCount).toBe(1);
    });
  });

  describe('getPreferenceSummary', () => {
    it('should return observable of preference summary', (done) => {
      service.getPreferenceSummary().subscribe(summary => {
        expect(summary).toBeTruthy();
        expect(summary.likedTags).toBeDefined();
        expect(summary.dislikedTags).toBeDefined();
        expect(Array.isArray(summary.likedTags)).toBe(true);
        expect(Array.isArray(summary.dislikedTags)).toBe(true);
        done();
      });
    });

    it('should update when preferences change', (done) => {
      let summaryCount = 0;
      service.getPreferenceSummary().subscribe(summary => {
        summaryCount++;
        if (summaryCount === 2) {
          // Should have received updated summary
          done();
        }
      });
      
      // Trigger an update
      service.updatePreferences(mockGames[0], mockGames[1]);
    });

    it('should return top liked and disliked tags', (done) => {
      // Make several updates to build preferences
      service.updatePreferences(mockGames[0], mockGames[1]); // FPS wins
      service.updatePreferences(mockGames[0], mockGames[1]); // FPS wins again
      
      service.getPreferenceSummary().subscribe(summary => {
        // Should have some preferences by now
        expect(summary.likedTags.length + summary.dislikedTags.length).toBeGreaterThan(0);
        
        // Tags should have weights
        if (summary.likedTags.length > 0) {
          expect(summary.likedTags[0].weight).toBeGreaterThan(0);
        }
        if (summary.dislikedTags.length > 0) {
          expect(summary.dislikedTags[0].weight).toBeLessThan(0);
        }
        
        done();
      });
    });
  });

  describe('rankGames', () => {
    beforeEach(() => {
      // Build some preferences
      service.updatePreferences(mockGames[0], mockGames[1]); // FPS preference
    });

    it('should return games ranked by preference score', () => {
      const recommendations = service.rankGames(mockGames);
      
      expect(recommendations.length).toBe(mockGames.length);
      expect(recommendations[0].rank).toBe(1);
      expect(recommendations[1].rank).toBe(2);
      
      // Should be sorted by score (highest first)
      expect(recommendations[0].score).toBeGreaterThanOrEqual(recommendations[1].score);
    });

    it('should include game data in recommendations', () => {
      const recommendations = service.rankGames(mockGames);
      
      recommendations.forEach((rec, index) => {
        expect(rec.game).toBeTruthy();
        expect(rec.game.appId).toBeTruthy();
        expect(rec.rank).toBe(index + 1);
      });
    });

    it('should handle empty game list', () => {
      const recommendations = service.rankGames([]);
      expect(recommendations).toEqual([]);
    });

    it('should handle single game', () => {
      const recommendations = service.rankGames([mockGames[0]]);
      expect(recommendations.length).toBe(1);
      expect(recommendations[0].rank).toBe(1);
    });

    it('should assign different scores to different games', () => {
      const recommendations = service.rankGames(mockGames);
      
      if (recommendations.length > 1) {
        // With built preferences, games should have different scores
        expect(recommendations[0].score).not.toBe(recommendations[1].score);
      }
    });
  });

  describe('calculateGameScore', () => {
    beforeEach(() => {
      // Build some preferences
      service.updatePreferences(mockGames[0], mockGames[1]);
    });

    it('should calculate score for individual game', () => {
      const score = service.calculateGameScore(mockGames[0]);
      expect(typeof score).toBe('number');
    });

    it('should return consistent scores', () => {
      const score1 = service.calculateGameScore(mockGames[0]);
      const score2 = service.calculateGameScore(mockGames[0]);
      expect(score1).toBe(score2);
    });

    it('should handle game with no tags', () => {
      const gameWithoutTags: GameRecord = {
        ...mockGames[0],
        tags: {}
      };
      
      const score = service.calculateGameScore(gameWithoutTags);
      expect(score).toBe(0);
    });
  });

  describe('resetPreferences', () => {
    beforeEach(() => {
      // Build some preferences first
      service.updatePreferences(mockGames[0], mockGames[1]);
      service.updatePreferences(mockGames[1], mockGames[0]);
    });

    it('should reset comparison count', () => {
      expect(service.getComparisonCount()).toBeGreaterThan(0);
      
      service.resetPreferences();
      expect(service.getComparisonCount()).toBe(0);
    });

    it('should reset weight vector to zeros', () => {
      service.resetPreferences();
      
      const state = service.getPreferenceState();
      for (let i = 0; i < state.weightVector.length; i++) {
        expect(state.weightVector[i]).toBe(0);
      }
    });

    it('should emit updated preference summary', (done) => {
      let summaryCount = 0;
      service.getPreferenceSummary().subscribe(summary => {
        summaryCount++;
        if (summaryCount === 2) {
          // After reset, should have empty preferences
          expect(summary.likedTags.length).toBe(0);
          expect(summary.dislikedTags.length).toBe(0);
          done();
        }
      });
      
      service.resetPreferences();
    });
  });

  describe('state persistence', () => {
    it('should get and load preference state', () => {
      // Build some preferences
      service.updatePreferences(mockGames[0], mockGames[1]);
      const originalCount = service.getComparisonCount();
      
      // Get state
      const state = service.getPreferenceState();
      expect(state.comparisonCount).toBe(originalCount);
      
      // Create new service and load state
      const freshService = TestBed.inject(PreferenceService);
      freshService.initializeModel(mockTagDict);
      freshService.loadPreferenceState(state);
      
      expect(freshService.getComparisonCount()).toBe(originalCount);
    });

    it('should preserve weight vector in state', () => {
      // Build preferences
      service.updatePreferences(mockGames[0], mockGames[1]);
      
      const originalState = service.getPreferenceState();
      const originalWeights = Array.from(originalState.weightVector);
      
      // Load into fresh service
      const freshService = TestBed.inject(PreferenceService);
      freshService.initializeModel(mockTagDict);
      freshService.loadPreferenceState(originalState);
      
      const loadedState = freshService.getPreferenceState();
      const loadedWeights = Array.from(loadedState.weightVector);
      
      expect(loadedWeights).toEqual(originalWeights);
    });

    it('should handle invalid state gracefully', () => {
      const invalidState: UserPreferenceState = {
        weightVector: [1, 2], // Wrong size
        comparisonCount: -1, // Invalid count
        tagDict: null
      };
      
      expect(() => service.loadPreferenceState(invalidState)).not.toThrow();
    });
  });

  describe('getComparisonCount', () => {
    it('should start at zero', () => {
      expect(service.getComparisonCount()).toBe(0);
    });

    it('should increment with each update', () => {
      for (let i = 1; i <= 5; i++) {
        service.updatePreferences(mockGames[0], mockGames[1]);
        expect(service.getComparisonCount()).toBe(i);
      }
    });

    it('should reset to zero', () => {
      service.updatePreferences(mockGames[0], mockGames[1]);
      expect(service.getComparisonCount()).toBe(1);
      
      service.resetPreferences();
      expect(service.getComparisonCount()).toBe(0);
    });
  });

  describe('integration scenarios', () => {
    it('should build meaningful preferences over multiple comparisons', () => {
      // Consistently prefer FPS games
      for (let i = 0; i < 5; i++) {
        service.updatePreferences(mockGames[0], mockGames[1]); // FPS wins
      }
      
      const recommendations = service.rankGames(mockGames);
      
      // FPS game should rank higher
      const fpsGameRec = recommendations.find(r => r.game.appId === 730)!;
      const mobaGameRec = recommendations.find(r => r.game.appId === 570)!;
      
      expect(fpsGameRec.score).toBeGreaterThan(mobaGameRec.score);
      expect(fpsGameRec.rank).toBeLessThan(mobaGameRec.rank);
    });

    it('should provide consistent ranking across multiple calls', () => {
      // Build preferences
      service.updatePreferences(mockGames[0], mockGames[1]);
      
      const rec1 = service.rankGames(mockGames);
      const rec2 = service.rankGames(mockGames);
      
      expect(rec1[0].score).toBe(rec2[0].score);
      expect(rec1[0].rank).toBe(rec2[0].rank);
    });
  });

  describe('TF-IDF Integration', () => {
    let tagRarityService: TagRarityService;

    // Extended mock games for TF-IDF testing
    const tfidfMockGames: GameRecord[] = [
      {
        appId: 730,
        name: 'Counter-Strike: Global Offensive',
        coverUrl: null,
        price: 'Free',
        developer: 'Valve',
        publisher: 'Valve',
        tags: { 'FPS': 91172, 'Shooter': 65634, 'Action': 45123 }, // Action is common
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
        tags: { 'MOBA': 55432, 'Strategy': 34521, 'Action': 67890 }, // MOBA is rare, Action common
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
        tags: { 'FPS': 72134, 'Shooter': 48291, 'Action': 31205 }, // All common tags
        genres: ['Action'],
        reviewPos: 600000,
        reviewNeg: 80000
      },
      {
        appId: 12210,
        name: 'Grand Theft Auto IV',
        coverUrl: null,
        price: '19.99',
        developer: 'Rockstar',
        publisher: 'Rockstar',
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
        tags: { 'Puzzle-Platformer': 12345, 'Co-op': 23456, 'Fantasy': 34567 }, // All very rare
        genres: ['Adventure'],
        reviewPos: 50000,
        reviewNeg: 5000
      }
    ];

    const tfidfTagDict: TagDictionary = {
      tagToIndex: {
        'FPS': 0,
        'Shooter': 1,
        'Action': 2,
        'MOBA': 3,
        'Strategy': 4,
        'Open World': 5,
        'Crime': 6,
        'Puzzle-Platformer': 7,
        'Co-op': 8,
        'Fantasy': 9
      },
      indexToTag: ['FPS', 'Shooter', 'Action', 'MOBA', 'Strategy', 'Open World', 'Crime', 'Puzzle-Platformer', 'Co-op', 'Fantasy'],
      size: 10
    };

    beforeEach(() => {
      tagRarityService = TestBed.inject(TagRarityService);
      
      // Clear localStorage to ensure test isolation
      localStorage.clear();
      
      // Initialize with clean state
      service.initializeModel(tfidfTagDict);
    });

    it('should initialize with TagRarityService integration', () => {
      service.setTagRarityService(tagRarityService);
      expect(service.hasTFIDFEnabled()).toBe(true);
    });

    it('should calculate TF-IDF analysis when TF-IDF is enabled', () => {
      service.setTagRarityService(tagRarityService);
      service.enableTFIDF(tfidfMockGames);
      
      const analysis = service.getTagRarityAnalysis();
      expect(analysis).toBeTruthy();
      expect(analysis!.totalGames).toBe(tfidfMockGames.length);
      
      // Action appears in 4 games, should have lower IDF
      const actionFreq = analysis!.tagFrequency.get('Action');
      expect(actionFreq).toBe(4);
      
      // MOBA appears in 1 game, should have higher IDF
      const mobaFreq = analysis!.tagFrequency.get('MOBA');
      expect(mobaFreq).toBe(1);
    });

    it('should apply higher learning weights to rare tags during preference updates', () => {
      service.setTagRarityService(tagRarityService);
      service.enableTFIDF(tfidfMockGames);
      
      // Clear initial weights
      service.resetPreferences();
      const initialState = service.getPreferenceState();
      const initialWeights = Array.from(initialState.weightVector);
      
      // Update preferences: choose MOBA game (rare tags) over Action game (common tags)
      const mobaGame = tfidfMockGames[1]; // Dota 2 - has MOBA tag (rare)
      const actionGame = tfidfMockGames[0]; // CS:GO - has FPS, Shooter, Action (common)
      
      service.updatePreferences(mobaGame, actionGame);
      
      const updatedState = service.getPreferenceState();
      
      // Get indices for comparison
      const mobaIndex = tfidfTagDict.tagToIndex['MOBA'];
      const actionIndex = tfidfTagDict.tagToIndex['Action'];
      
      // MOBA should have received a larger weight increase due to TF-IDF
      const mobaWeightChange = Math.abs(updatedState.weightVector[mobaIndex] - initialWeights[mobaIndex]);
      const actionWeightChange = Math.abs(updatedState.weightVector[actionIndex] - initialWeights[actionIndex]);
      
      // The exact values depend on the TF-IDF calculation, but MOBA should have more impact
      expect(mobaWeightChange).toBeGreaterThan(0);
      expect(actionWeightChange).toBeLessThan(mobaWeightChange);
    });

    it('should work without TF-IDF when not enabled (backward compatibility)', () => {
      // Don't set TagRarityService - should work normally
      expect(service.hasTFIDFEnabled()).toBe(false);
      
      service.updatePreferences(tfidfMockGames[0], tfidfMockGames[1]);
      
      expect(service.getComparisonCount()).toBe(1);
      
      const state = service.getPreferenceState();
      let hasNonZeroWeights = false;
      for (let weight of state.weightVector) {
        if (Math.abs(weight) > 0) {
          hasNonZeroWeights = true;
          break;
        }
      }
      expect(hasNonZeroWeights).toBe(true);
    });

    it('should disable TF-IDF when TagRarityService is removed', () => {
      service.setTagRarityService(tagRarityService);
      service.enableTFIDF(tfidfMockGames);
      expect(service.hasTFIDFEnabled()).toBe(true);
      
      service.setTagRarityService(null);
      expect(service.hasTFIDFEnabled()).toBe(false);
    });

    it('should reflect TF-IDF impact in preference summaries', () => {
      service.setTagRarityService(tagRarityService);
      service.enableTFIDF(tfidfMockGames);
      
      // Build preferences by choosing rare tag games
      const rareTagGame = tfidfMockGames[4]; // Trine 2 - very rare tags
      const commonTagGame = tfidfMockGames[0]; // CS:GO - common tags
      
      service.updatePreferences(rareTagGame, commonTagGame);
      
      service.getPreferenceSummary().subscribe(summary => {
        // Should show preference for rare tags with higher weights
        expect(summary.likedTags.length).toBeGreaterThan(0);
        
        // Find if any rare tags appear in the summary
        const rareTagsInSummary = summary.likedTags.filter(tagWeight => 
          ['Puzzle-Platformer', 'Co-op', 'Fantasy'].includes(tagWeight.tag)
        );
        expect(rareTagsInSummary.length).toBeGreaterThan(0);
      });
    });

    it('should improve game ranking quality with TF-IDF enabled', () => {
      service.setTagRarityService(tagRarityService);
      service.enableTFIDF(tfidfMockGames);
      
      // Train preferences to like rare tags
      const rareTagGame = tfidfMockGames[4]; // Trine 2
      const commonTagGame = tfidfMockGames[0]; // CS:GO
      
      // Multiple training iterations
      for (let i = 0; i < 3; i++) {
        service.updatePreferences(rareTagGame, commonTagGame);
      }
      
      const recommendations = service.rankGames(tfidfMockGames);
      
      // The rare tag game should rank higher due to TF-IDF weighting
      const rareGameRec = recommendations.find(r => r.game.appId === rareTagGame.appId);
      const commonGameRec = recommendations.find(r => r.game.appId === commonTagGame.appId);
      
      expect(rareGameRec!.score).toBeGreaterThan(commonGameRec!.score);
      expect(rareGameRec!.rank).toBeLessThan(commonGameRec!.rank);
    });

    it('should handle TF-IDF configuration changes', () => {
      service.setTagRarityService(tagRarityService);
      
      // Configure TF-IDF with custom settings
      const customConfig = {
        maxMultiplier: 2.5,
        minMultiplier: 0.8,
        smoothingEnabled: true
      };
      
      tagRarityService.configure(customConfig);
      service.enableTFIDF(tfidfMockGames);
      
      // Verify configuration is applied
      const retrievedConfig = tagRarityService.getConfiguration();
      expect(retrievedConfig.maxMultiplier).toBe(2.5);
      expect(retrievedConfig.minMultiplier).toBe(0.8);
    });
  });
});