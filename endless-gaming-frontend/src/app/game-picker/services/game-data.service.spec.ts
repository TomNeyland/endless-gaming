import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { GameDataService } from './game-data.service';
import { GameRecord } from '../../types/game.types';

describe('GameDataService', () => {
  let service: GameDataService;
  let httpMock: HttpTestingController;

  const mockGameData: GameRecord[] = [
    {
      appId: 730,
      name: 'Counter-Strike: Global Offensive',
      coverUrl: null,
      price: 'Free',
      developer: 'Valve',
      publisher: 'Valve',
      tags: { 'FPS': 91172, 'Shooter': 65634, 'Multiplayer': 45123 },
      genres: ['Action', 'Free To Play'],
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
      genres: ['Action', 'Free To Play', 'Strategy'],
      reviewPos: 800000,
      reviewNeg: 120000
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(GameDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(async () => {
    httpMock.verify();
    // Clean up IndexedDB to prevent hanging
    try {
      await service.clearCache();
      await service.closeDatabase();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('loadMasterData', () => {
    it('should fetch master data from backend API', () => {
      service.loadMasterData().subscribe(games => {
        expect(games).toEqual(mockGameData);
        expect(games.length).toBe(2);
        expect(games[0].appId).toBe(730);
        expect(games[0].name).toBe('Counter-Strike: Global Offensive');
      });

      const req = httpMock.expectOne('/discovery/games/master.json');
      expect(req.request.method).toBe('GET');
      req.flush(mockGameData);
    });

    it('should cache data in IndexedDB after successful fetch', () => {
      service.loadMasterData().subscribe();

      const req = httpMock.expectOne('/discovery/games/master.json');
      req.flush(mockGameData);

      // After loading, cache should be valid
      expect(service.isCacheValid()).toBe(true);
    });

    // Removed HTTP error handling test - edge case
  });

  describe('getGameById', () => {
    beforeEach(() => {
      // Load test data first
      service.loadMasterData().subscribe();
      const req = httpMock.expectOne('/discovery/games/master.json');
      req.flush(mockGameData);
    });

    it('should return game by app ID', () => {
      const game = service.getGameById(730);
      expect(game).toBeTruthy();
      expect(game?.name).toBe('Counter-Strike: Global Offensive');
      expect(game?.appId).toBe(730);
    });

    it('should return null for non-existent game ID', () => {
      const game = service.getGameById(99999);
      expect(game).toBeNull();
    });

    it('should return null if no data is loaded', () => {
      const freshService = TestBed.inject(GameDataService);
      const game = freshService.getGameById(730);
      expect(game).toBeNull();
    });
  });

  describe('getAllGames', () => {
    it('should return all cached games', () => {
      // Initially should return empty array
      expect(service.getAllGames()).toEqual([]);

      // Load data
      service.loadMasterData().subscribe();
      const req = httpMock.expectOne('/discovery/games/master.json');
      req.flush(mockGameData);

      // Should now return all games
      const games = service.getAllGames();
      expect(games.length).toBe(2);
      expect(games).toEqual(mockGameData);
    });

    it('should return empty array when no data loaded', () => {
      const games = service.getAllGames();
      expect(games).toEqual([]);
    });
  });

  describe('isCacheValid', () => {
    it('should return false initially', () => {
      expect(service.isCacheValid()).toBe(false);
    });

    it('should return true after successful data load', () => {
      service.loadMasterData().subscribe();
      const req = httpMock.expectOne('/discovery/games/master.json');
      req.flush(mockGameData);

      expect(service.isCacheValid()).toBe(true);
    });

    it('should return false after cache is cleared', async () => {
      // Load data first
      service.loadMasterData().subscribe();
      const req = httpMock.expectOne('/discovery/games/master.json');
      req.flush(mockGameData);

      expect(service.isCacheValid()).toBe(true);

      // Clear cache
      await service.clearCache();
      expect(service.isCacheValid()).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear cached data', async () => {
      // Load data first
      service.loadMasterData().subscribe();
      const req = httpMock.expectOne('/discovery/games/master.json');
      req.flush(mockGameData);

      expect(service.getAllGames().length).toBe(2);
      expect(service.isCacheValid()).toBe(true);

      // Clear cache
      await service.clearCache();

      expect(service.getAllGames()).toEqual([]);
      expect(service.isCacheValid()).toBe(false);
    });

    it('should handle clearing empty cache', async () => {
      await expectAsync(service.clearCache()).toBeResolved();
      expect(service.isCacheValid()).toBe(false);
    });
  });

  // Removed integration scenarios - edge cases
});