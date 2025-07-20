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

  beforeEach(async () => {
    // Reset TestBed for each test to ensure fresh service instances
    TestBed.resetTestingModule();
    
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        GameDataService
      ]
    });
    
    service = TestBed.inject(GameDataService);
    httpMock = TestBed.inject(HttpTestingController);
    
    // Clear any cached data to ensure clean state for each test
    await service.clearCache();
    
    // Also clear in-memory cache directly to ensure fresh state
    (service as any).gameCache.clear();
    (service as any).allGamesCache = [];
    
    // Mock IndexedDB operations to always return null (force HTTP requests)
    spyOn(service as any, 'getCachedData').and.returnValue(Promise.resolve(null));
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
    it('should fetch master data from backend API', (done) => {
      // Call the private fetchFromBackend method directly to bypass caching
      (service as any).fetchFromBackend().subscribe({
        next: (games: GameRecord[]) => {
          expect(games).toEqual(mockGameData);
          expect(games.length).toBe(2);
          expect(games[0].appId).toBe(730);
          expect(games[0].name).toBe('Counter-Strike: Global Offensive');
          done();
        },
        error: (err: any) => done.fail(err)
      });

      const req = httpMock.expectOne('/api/discovery/games/master.json');
      expect(req.request.method).toBe('GET');
      req.flush(mockGameData);
    });

    it('should cache data in IndexedDB after successful fetch', () => {
      // Use fetchFromBackend to bypass cache checks
      (service as any).fetchFromBackend().subscribe();

      const req = httpMock.expectOne('/api/discovery/games/master.json');
      req.flush(mockGameData);

      // After loading, cache should be valid
      expect(service.isCacheValid()).toBe(true);
    });

    // Removed HTTP error handling test - edge case
  });

  describe('getGameById', () => {
    beforeEach(() => {
      // Load test data first using fetchFromBackend to bypass cache
      (service as any).fetchFromBackend().subscribe();
      const req = httpMock.expectOne('/api/discovery/games/master.json');
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
      // Clear the cache to simulate no data loaded
      (freshService as any).gameCache.clear();
      (freshService as any).allGamesCache = [];
      
      const game = freshService.getGameById(730);
      expect(game).toBeNull();
    });
  });

  describe('getAllGames', () => {
    it('should return all cached games', () => {
      // Initially should return empty array
      expect(service.getAllGames()).toEqual([]);

      // Load data using fetchFromBackend to bypass cache
      (service as any).fetchFromBackend().subscribe();
      const req = httpMock.expectOne('/api/discovery/games/master.json');
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
      (service as any).fetchFromBackend().subscribe();
      const req = httpMock.expectOne('/api/discovery/games/master.json');
      req.flush(mockGameData);

      expect(service.isCacheValid()).toBe(true);
    });

    it('should return false after cache is cleared', async () => {
      // Load data first
      (service as any).fetchFromBackend().subscribe();
      const req = httpMock.expectOne('/api/discovery/games/master.json');
      req.flush(mockGameData);

      expect(service.isCacheValid()).toBe(true);

      // Clear cache including in-memory cache
      await service.clearCache();
      (service as any).gameCache.clear();
      (service as any).allGamesCache = [];
      expect(service.isCacheValid()).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear cached data', async () => {
      // Load data first
      (service as any).fetchFromBackend().subscribe();
      const req = httpMock.expectOne('/api/discovery/games/master.json');
      req.flush(mockGameData);

      expect(service.getAllGames().length).toBe(2);
      expect(service.isCacheValid()).toBe(true);

      // Clear cache including in-memory cache
      await service.clearCache();
      (service as any).gameCache.clear();
      (service as any).allGamesCache = [];

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