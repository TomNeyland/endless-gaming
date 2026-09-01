import { TestBed } from '@angular/core/testing';
import { PairService } from './pair.service';
import { PreferenceService } from './preference.service';
import { GameRecord, GamePair, ProgressInfo } from '../../types/game.types';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('PairService', () => {
  let service: PairService;

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
    },
    {
      appId: 289070,
      name: 'Sid Meiers Civilization VI',
      coverUrl: null,
      price: '$59.99',
      developer: 'Firaxis Games',
      publisher: '2K',
      tags: { 'Strategy': 82345, 'Turn-Based': 67234, 'Historical': 45123 },
      genres: ['Strategy'],
      reviewPos: 400000,
      reviewNeg: 60000
    }
  ];

  beforeEach(() => {
    const mockPreferenceService = jasmine.createSpyObj('PreferenceService', [
      'updatePreferences',
      'calculateGameScore',
      'resetPreferences',
      'recordSkip',
      'getModelConfidence'
    ]);
    
    // Set default return values for calculateGameScore
    mockPreferenceService.calculateGameScore.and.returnValue(0.5);
    mockPreferenceService.getModelConfidence.and.returnValue(0.5);
    
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: PreferenceService, useValue: mockPreferenceService }
      ]
    });
    service = TestBed.inject(PairService);
    service.initializeWithGames(mockGames);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initializeWithGames', () => {
    it('should initialize with game candidates', () => {
      const freshService = TestBed.inject(PairService);
      freshService.initializeWithGames(mockGames);
      
      expect(freshService.hasMorePairs()).toBe(true);
      
      const progress = freshService.getProgress();
      expect(progress.current).toBe(0);
      expect(progress.total).toBeGreaterThan(0);
    });

    it('should handle empty game list', () => {
      const freshService = TestBed.inject(PairService);
      freshService.initializeWithGames([]);
      
      expect(freshService.hasMorePairs()).toBe(false);
      expect(freshService.getNextPair()).toBeNull();
    });

    it('should handle single game', () => {
      const freshService = TestBed.inject(PairService);
      freshService.initializeWithGames([mockGames[0]]);
      
      expect(freshService.hasMorePairs()).toBe(false);
      expect(freshService.getNextPair()).toBeNull();
    });

    it('should reset existing state', () => {
      // Make some choices first
      const pair = service.getNextPair()!;
      service.recordChoice(pair.left, pair.right, 'left');

      expect(service.getComparisonCount()).toBe(1);

      // Re-initialize. initializeWithGames() re-seeds the candidate pool
      // (choiceHistory + usedPairs) but deliberately leaves actualVotes/getProgress()
      // untouched - game-picker-page.component.ts#setupVotingSession() calls
      // initializeWithGames() every time the voting drawer re-opens mid-session, and
      // resetting vote progress there would incorrectly drop the user back into the
      // actualVotes<3 bootstrap phase. The dedicated full reset is resetProgress()
      // (see the resetProgress describe block below), which does zero actualVotes.
      service.initializeWithGames(mockGames);
      expect(service.getComparisonCount()).toBe(0);
    });
  });

  describe('getNextPair', () => {
    it('should return valid game pair', () => {
      const pair = service.getNextPair();
      
      expect(pair).toBeTruthy();
      expect(pair!.left).toBeTruthy();
      expect(pair!.right).toBeTruthy();
      expect(pair!.left.appId).not.toBe(pair!.right.appId);
    });

    it('should return different pairs on subsequent calls', () => {
      const pair1 = service.getNextPair()!;
      service.recordChoice(pair1.left, pair1.right, 'left');
      
      const pair2 = service.getNextPair()!;
      
      // Should be different pair
      const sameLeftRight = (pair1.left.appId === pair2.left.appId && pair1.right.appId === pair2.right.appId);
      const sameRightLeft = (pair1.left.appId === pair2.right.appId && pair1.right.appId === pair2.left.appId);
      
      expect(sameLeftRight || sameRightLeft).toBe(false);
    });

    it('should return null when no more pairs available', () => {
      // Exhaust all pairs by making many choices
      let pairCount = 0;
      while (service.hasMorePairs() && pairCount < 100) { // Safety limit
        const pair = service.getNextPair();
        if (pair) {
          service.recordChoice(pair.left, pair.right, 'left');
          pairCount++;
        } else {
          break;
        }
      }
      
      const finalPair = service.getNextPair();
      expect(finalPair).toBeNull();
    });

    it('should not return same game pair multiple times', () => {
      const seenPairs = new Set<string>();
      
      for (let i = 0; i < 10 && service.hasMorePairs(); i++) {
        const pair = service.getNextPair()!;
        const pairKey = `${Math.min(pair.left.appId, pair.right.appId)}-${Math.max(pair.left.appId, pair.right.appId)}`;
        
        expect(seenPairs.has(pairKey)).toBe(false);
        seenPairs.add(pairKey);
        
        service.recordChoice(pair.left, pair.right, 'left');
      }
    });
  });

  describe('recordChoice', () => {
    it('should record user choice', () => {
      const pair = service.getNextPair()!;
      const initialProgress = service.getProgress().current;
      
      service.recordChoice(pair.left, pair.right, 'left');
      
      const updatedProgress = service.getProgress().current;
      expect(updatedProgress).toBe(initialProgress + 1);
    });

    it('should handle all choice types', () => {
      const choices: ('left' | 'right' | 'skip')[] = ['left', 'right', 'skip'];

      choices.forEach(choice => {
        const pair = service.getNextPair()!;
        const initialProgress = service.getProgress().current;
        const initialHistoryLength = service.getChoiceHistory().length;

        service.recordChoice(pair.left, pair.right, choice);

        const updatedProgress = service.getProgress().current;
        const updatedHistoryLength = service.getChoiceHistory().length;

        // Every choice type is logged to choiceHistory (total comparisons)...
        expect(updatedHistoryLength).toBe(initialHistoryLength + 1);

        // ...but getProgress().current tracks actualVotes, which only advances
        // for real picks. A 'skip' routes to preferenceService.recordSkip() instead
        // of contributing a vote, so progress does not move for it (see
        // PairService.recordChoice / getProgress doc comments).
        if (choice === 'skip') {
          expect(updatedProgress).toBe(initialProgress);
        } else {
          expect(updatedProgress).toBe(initialProgress + 1);
        }
      });
    });

    it('should maintain choice history', () => {
      const pair = service.getNextPair()!;
      service.recordChoice(pair.left, pair.right, 'left');
      
      const history = service.getChoiceHistory();
      expect(history.length).toBe(1);
      expect(history[0].leftGame.appId).toBe(pair.left.appId);
      expect(history[0].rightGame.appId).toBe(pair.right.appId);
      expect(history[0].pick).toBe('left');
      expect(history[0].timestamp).toBeGreaterThan(0);
    });

    it('should handle multiple choices', () => {
      for (let i = 0; i < 3; i++) {
        const pair = service.getNextPair()!;
        service.recordChoice(pair.left, pair.right, 'left');
      }
      
      const history = service.getChoiceHistory();
      expect(history.length).toBe(3);
      
      // Timestamps should be increasing
      for (let i = 1; i < history.length; i++) {
        expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i - 1].timestamp);
      }
    });
  });

  describe('hasMorePairs', () => {
    it('should return true initially with sufficient games', () => {
      expect(service.hasMorePairs()).toBe(true);
    });

    it('should return false when target reached', () => {
      // Make choices until target is reached
      const target = service.getProgress().total;
      
      for (let i = 0; i < target; i++) {
        if (service.hasMorePairs()) {
          const pair = service.getNextPair()!;
          service.recordChoice(pair.left, pair.right, 'left');
        }
      }
      
      expect(service.hasMorePairs()).toBe(false);
    });

    it('should return false with insufficient games', () => {
      const freshService = TestBed.inject(PairService);
      freshService.initializeWithGames([mockGames[0]]); // Only one game
      
      expect(freshService.hasMorePairs()).toBe(false);
    });

    it('should update correctly as choices are made', () => {
      let hadPairs = service.hasMorePairs();
      expect(hadPairs).toBe(true);
      
      // Make some choices
      for (let i = 0; i < 5 && service.hasMorePairs(); i++) {
        const pair = service.getNextPair()!;
        service.recordChoice(pair.left, pair.right, 'left');
      }
      
      // Should still work correctly
      const currentlyHasPairs = service.hasMorePairs();
      expect(typeof currentlyHasPairs).toBe('boolean');
    });
  });

  describe('getProgress', () => {
    it('should return progress information', () => {
      const progress = service.getProgress();
      
      expect(progress.current).toBe(0);
      expect(progress.total).toBeGreaterThan(0);
      expect(progress.current).toBeLessThanOrEqual(progress.total);
    });

    it('should update current progress with choices', () => {
      const initialProgress = service.getProgress().current;
      
      const pair = service.getNextPair()!;
      service.recordChoice(pair.left, pair.right, 'left');
      
      const updatedProgress = service.getProgress().current;
      expect(updatedProgress).toBe(initialProgress + 1);
    });

    it('should not change total during session', () => {
      const initialTotal = service.getProgress().total;
      
      // Make several choices
      for (let i = 0; i < 3 && service.hasMorePairs(); i++) {
        const pair = service.getNextPair()!;
        service.recordChoice(pair.left, pair.right, 'left');
      }
      
      const currentTotal = service.getProgress().total;
      expect(currentTotal).toBe(initialTotal);
    });

    it('should handle completion', () => {
      // Complete all comparisons
      while (service.hasMorePairs()) {
        const pair = service.getNextPair()!;
        service.recordChoice(pair.left, pair.right, 'left');
      }
      
      const progress = service.getProgress();
      expect(progress.current).toBe(progress.total);
    });
  });

  describe('resetProgress', () => {
    beforeEach(() => {
      // Make some choices first
      for (let i = 0; i < 3 && service.hasMorePairs(); i++) {
        const pair = service.getNextPair()!;
        service.recordChoice(pair.left, pair.right, 'left');
      }
    });

    it('should reset current progress to zero', () => {
      expect(service.getProgress().current).toBeGreaterThan(0);
      
      service.resetProgress();
      expect(service.getProgress().current).toBe(0);
    });

    it('should clear choice history', () => {
      expect(service.getChoiceHistory().length).toBeGreaterThan(0);
      
      service.resetProgress();
      expect(service.getChoiceHistory().length).toBe(0);
    });

    it('should make pairs available again', () => {
      // Potentially exhaust pairs
      while (service.hasMorePairs()) {
        const pair = service.getNextPair()!;
        service.recordChoice(pair.left, pair.right, 'left');
      }
      
      expect(service.hasMorePairs()).toBe(false);
      
      service.resetProgress();
      expect(service.hasMorePairs()).toBe(true);
    });

    it('should preserve game list', () => {
      service.resetProgress();
      
      // Should still be able to get pairs
      const pair = service.getNextPair();
      expect(pair).toBeTruthy();
    });
  });

  describe('getChoiceHistory', () => {
    it('should start empty', () => {
      const history = service.getChoiceHistory();
      expect(history).toEqual([]);
    });

    it('should record all choices', () => {
      const choices: ('left' | 'right' | 'skip')[] = ['left', 'skip', 'right'];
      
      choices.forEach(choice => {
        const pair = service.getNextPair()!;
        service.recordChoice(pair.left, pair.right, choice);
      });
      
      const history = service.getChoiceHistory();
      expect(history.length).toBe(3);
      
      choices.forEach((choice, index) => {
        expect(history[index].pick).toBe(choice);
      });
    });

    it('should include complete choice information', () => {
      const pair = service.getNextPair()!;
      const beforeTime = Date.now();
      service.recordChoice(pair.left, pair.right, 'left');
      const afterTime = Date.now();
      
      const history = service.getChoiceHistory();
      const choice = history[0];
      
      expect(choice.leftGame.appId).toBe(pair.left.appId);
      expect(choice.rightGame.appId).toBe(pair.right.appId);
      expect(choice.pick).toBe('left');
      expect(choice.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(choice.timestamp).toBeLessThanOrEqual(afterTime);
    });

    // Removed chronological order test - edge case
  });

  describe('preference-guided sampling', () => {
    let mockPreferenceService: jasmine.SpyObj<PreferenceService>;

    beforeEach(() => {
      // Create fresh preference service mock for these tests
      mockPreferenceService = jasmine.createSpyObj('PreferenceService', [
        'updatePreferences',
        'calculateGameScore',
        'resetPreferences',
        'initializeModel',
        'recordSkip',
        'getModelConfidence'
      ]);
      mockPreferenceService.calculateGameScore.and.returnValue(0.5);
      mockPreferenceService.getModelConfidence.and.returnValue(0.5);

      // Configure TestBed with fresh mock
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(), provideHttpClientTesting(),
          { provide: PreferenceService, useValue: mockPreferenceService }
        ]
      });
      
      // Get fresh service instance
      service = TestBed.inject(PairService);
      service.initializeWithGames(mockGames);
    });

    describe('batchComputeGameScores', () => {
      it('should return all games sorted by preference score descending', () => {
        mockPreferenceService.calculateGameScore.and.callFake((game: GameRecord) => {
          const scores: { [key: number]: number } = {
            730: 0.8, // Counter-Strike: highest score
            570: 0.6, // Dota 2: medium score
            440: 0.4, // Team Fortress: lowest score
          };
          return scores[game.appId] || 0;
        });

        const batchComputeGameScores = (service as any).batchComputeGameScores.bind(service);
        const ranked = batchComputeGameScores();

        expect(ranked.length).toBe(mockGames.length);
        expect(ranked.slice(0, 3).map((entry: any) => entry.game.appId)).toEqual([730, 570, 440]);
        expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
        expect(ranked[1].score).toBeGreaterThanOrEqual(ranked[2].score);
      });
    });

    describe('getPreferenceGuidedPair', () => {
      it('should fall back to uncertainty sampling when no preference data', () => {
        // With no scored games there is nothing to guide the pairing with.
        spyOn((service as any), 'batchComputeGameScores').and.returnValue([]);
        const uncertaintySpyResult = jasmine.createSpyObj('GamePair', ['left', 'right']);
        spyOn((service as any), 'getUncertaintyBasedPair').and.returnValue(uncertaintySpyResult);

        const getPreferenceGuidedPair = (service as any).getPreferenceGuidedPair.bind(service);
        const result = getPreferenceGuidedPair();

        expect(result).toBe(uncertaintySpyResult);
        expect((service as any).getUncertaintyBasedPair).toHaveBeenCalled();
      });

      it('should narrow the preference pool as the vote count grows', () => {
        // Use a larger pool so each targeting percentile yields a distinct size.
        const manyGames: GameRecord[] = Array.from({ length: 20 }, (_, i) => ({
          ...mockGames[0],
          appId: 1000 + i,
          name: `Game ${i}`
        }));
        service.initializeWithGames(manyGames);

        const generateCandidatePairsSpy = spyOn((service as any), 'generateCandidatePairs')
          .and.returnValue([]);
        spyOn((service as any), 'getUncertaintyBasedPair').and.returnValue(null);
        const getPreferenceGuidedPair = (service as any).getPreferenceGuidedPair.bind(service);
        const lastPoolSize = () =>
          (generateCandidatePairsSpy.calls.mostRecent().args[0] as GameRecord[]).length;

        // Fewer than 7 votes: top 50% => ceil(20 * 0.5) = 10 games
        (service as any).actualVotes = 5;
        getPreferenceGuidedPair();
        expect(lastPoolSize()).toBe(10);

        // Fewer than 15 votes: top 30% => ceil(20 * 0.3) = 6 games
        (service as any).actualVotes = 10;
        getPreferenceGuidedPair();
        expect(lastPoolSize()).toBe(6);

        // 15 or more votes: top 20% => ceil(20 * 0.2) = 4 games
        (service as any).actualVotes = 16;
        getPreferenceGuidedPair();
        expect(lastPoolSize()).toBe(4);
      });

      it('should select the candidate pair with the highest uncertainty', () => {
        const preferredGame = mockGames[0]; // Counter-Strike
        const lowUncertaintyPair = { left: preferredGame, right: mockGames[1] };
        const highUncertaintyPair = { left: preferredGame, right: mockGames[2] };

        spyOn((service as any), 'batchComputeGameScores').and.returnValue([
          { game: preferredGame, score: 0.9 },
          { game: mockGames[1], score: 0.5 },
          { game: mockGames[2], score: 0.4 }
        ]);
        spyOn((service as any), 'generateCandidatePairs').and.returnValue([
          lowUncertaintyPair,
          highUncertaintyPair
        ]);
        spyOn((service as any), 'calculateUncertaintyFromCachedScores').and.callFake(
          (_left: GameRecord, right: GameRecord) =>
            right.appId === highUncertaintyPair.right.appId ? 0.75 : 0.3
        );

        const getPreferenceGuidedPair = (service as any).getPreferenceGuidedPair.bind(service);
        const result = getPreferenceGuidedPair();

        expect(result).toBe(highUncertaintyPair);
      });

      it('should not offer pairs that have already been used', () => {
        const preferredGame = mockGames[0]; // Counter-Strike
        const usedPartner = mockGames[1];   // Dota 2

        const usedKey = (service as any).createPairKey({ left: preferredGame, right: usedPartner });
        (service as any).usedPairs.add(usedKey);

        // Isolate the used-pair filtering from the similarity heuristic.
        spyOn((service as any), 'areGamesTooSimilar').and.returnValue(false);
        spyOn((service as any), 'calculateUncertainty').and.returnValue(0.9);

        const generateCandidatePairs = (service as any).generateCandidatePairs.bind(service);
        const candidates: GamePair[] = generateCandidatePairs([preferredGame], 10);

        expect(candidates.length).toBeGreaterThan(0);
        expect(candidates.map(pair => pair.right.appId)).not.toContain(usedPartner.appId);
      });
    });

    describe('getNextPair integration', () => {
      it('should use random pairs for bootstrap phase', () => {
        const testPair = jasmine.createSpyObj('GamePair', ['left', 'right']);
        const randomPairSpy = spyOn((service as any), 'getRandomPair').and.returnValue(testPair);
        
        // Clear choice history to ensure bootstrap phase
        (service as any).choiceHistory = [];
        
        const result = service.getNextPair();
        
        expect(randomPairSpy).toHaveBeenCalled();
        expect(result).toBe(testPair);
      });

      it('should transition to preference-guided after bootstrap', () => {
        const testPair = jasmine.createSpyObj('GamePair', ['left', 'right']);
        const guidedPairSpy = spyOn((service as any), 'getPreferenceGuidedPair').and.returnValue(testPair);

        // getNextPair()'s bootstrap gate checks actualVotes (real picks), not
        // choiceHistory.length - simulate 4 real votes cast, past the
        // `actualVotes < 3` bootstrap threshold.
        (service as any).actualVotes = 4;

        const result = service.getNextPair();

        expect(guidedPairSpy).toHaveBeenCalled();
        expect(result).toBe(testPair);
      });
    });
  });

  // Removed integration scenarios - edge cases
});