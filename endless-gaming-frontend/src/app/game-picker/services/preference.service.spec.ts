import { TestBed } from '@angular/core/testing';
import { PreferenceService } from './preference.service';
import { GameRecord, TagDictionary, UserPreferenceState, PreferenceSummary, GameRecommendation } from '../../types/game.types';

describe('PreferenceService', () => {
  let service: PreferenceService;

  const mockTagDict: TagDictionary = {
    tagToIndex: new Map([
      ['FPS', 0],
      ['Shooter', 1],
      ['Multiplayer', 2],
      ['MOBA', 3],
      ['Strategy', 4]
    ]),
    indexToTag: new Map([
      [0, 'FPS'],
      [1, 'Shooter'],
      [2, 'Multiplayer'],
      [3, 'MOBA'],
      [4, 'Strategy']
    ]),
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

    it('should update lastUpdated timestamp', () => {
      const beforeTime = Date.now();
      service.updatePreferences(mockGames[0], mockGames[1]);
      const afterTime = Date.now();
      
      const state = service.getPreferenceState();
      expect(state.lastUpdated).toBeGreaterThanOrEqual(beforeTime);
      expect(state.lastUpdated).toBeLessThanOrEqual(afterTime);
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
        weightVector: new Float32Array([1, 2]), // Wrong size
        comparisonCount: -1, // Invalid count
        lastUpdated: 0
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
});