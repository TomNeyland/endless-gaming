import { TestBed } from '@angular/core/testing';
import { PairService } from './pair.service';
import { GameRecord, GamePair, ProgressInfo } from '../../types/game.types';

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
    TestBed.configureTestingModule({});
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
      
      expect(service.getProgress().current).toBe(1);
      
      // Re-initialize
      service.initializeWithGames(mockGames);
      expect(service.getProgress().current).toBe(0);
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
        
        service.recordChoice(pair.left, pair.right, choice);
        
        const updatedProgress = service.getProgress().current;
        expect(updatedProgress).toBe(initialProgress + 1);
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

    it('should preserve chronological order', () => {
      for (let i = 0; i < 3; i++) {
        const pair = service.getNextPair()!;
        service.recordChoice(pair.left, pair.right, 'left');
      }
      
      const history = service.getChoiceHistory();
      
      for (let i = 1; i < history.length; i++) {
        expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i - 1].timestamp);
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete comparison session', () => {
      let choiceCount = 0;
      const maxChoices = service.getProgress().total;
      
      while (service.hasMorePairs() && choiceCount < maxChoices) {
        const pair = service.getNextPair();
        expect(pair).toBeTruthy();
        
        service.recordChoice(pair!.left, pair!.right, 'left');
        choiceCount++;
        
        const progress = service.getProgress();
        expect(progress.current).toBe(choiceCount);
      }
      
      expect(choiceCount).toBe(maxChoices);
      expect(service.hasMorePairs()).toBe(false);
      expect(service.getChoiceHistory().length).toBe(choiceCount);
    });

    it('should work with small game sets', () => {
      const smallGameSet = mockGames.slice(0, 2);
      const freshService = TestBed.inject(PairService);
      freshService.initializeWithGames(smallGameSet);
      
      if (freshService.hasMorePairs()) {
        const pair = freshService.getNextPair()!;
        freshService.recordChoice(pair.left, pair.right, 'left');
        
        const progress = freshService.getProgress();
        expect(progress.current).toBe(1);
      }
    });

    it('should handle reset and restart', () => {
      // Complete some comparisons
      for (let i = 0; i < 3 && service.hasMorePairs(); i++) {
        const pair = service.getNextPair()!;
        service.recordChoice(pair.left, pair.right, 'left');
      }
      
      const midProgress = service.getProgress().current;
      expect(midProgress).toBeGreaterThan(0);
      
      // Reset and start over
      service.resetProgress();
      expect(service.getProgress().current).toBe(0);
      expect(service.hasMorePairs()).toBe(true);
      
      // Should be able to continue
      const newPair = service.getNextPair();
      expect(newPair).toBeTruthy();
    });
  });
});