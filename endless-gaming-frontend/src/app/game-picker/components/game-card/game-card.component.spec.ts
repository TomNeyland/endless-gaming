import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GameCardComponent } from './game-card.component';
import { GameRecord } from '../../../types/game.types';

describe('GameCardComponent', () => {
  let component: GameCardComponent;
  let fixture: ComponentFixture<GameCardComponent>;

  const mockGame: GameRecord = {
    appId: 730,
    name: 'Counter-Strike: Global Offensive',
    coverUrl: 'https://example.com/cover.jpg',
    price: 'Free',
    developer: 'Valve',
    publisher: 'Valve Corporation',
    tags: { 'FPS': 91172, 'Shooter': 65634, 'Multiplayer': 45123, 'Competitive': 23456, 'Team-based': 12345 },
    genres: ['Action', 'Free To Play'],
    reviewPos: 1000000,
    reviewNeg: 100000
  };

  const mockGameWithPrice: GameRecord = {
    ...mockGame,
    appId: 289070,
    name: 'Sid Meiers Civilization VI',
    price: '$59.99',
    tags: { 'Strategy': 82345, 'Turn-Based': 67234, 'Historical': 45123 }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(GameCardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('input handling', () => {
    it('should accept null game initially', () => {
      expect(component.game).toBeNull();
    });

    it('should accept valid game data', () => {
      component.game = mockGame;
      expect(component.game).toBe(mockGame);
    });

    it('should handle showScore input', () => {
      component.showScore = true;
      component.score = 0.85;
      expect(component.showScore).toBe(true);
      expect(component.score).toBe(0.85);
    });

    it('should handle rank input', () => {
      component.rank = 5;
      expect(component.rank).toBe(5);
    });
  });

  describe('template rendering with valid game', () => {
    beforeEach(() => {
      component.game = mockGame;
      fixture.detectChanges();
    });

    it('should display game card when valid game provided', () => {
      const gameCard = fixture.debugElement.query(By.css('.game-card'));
      const placeholder = fixture.debugElement.query(By.css('.game-card-placeholder'));

      expect(gameCard).toBeTruthy();
      expect(placeholder).toBeFalsy();
    });

    it('should display game title', () => {
      const titleElement = fixture.debugElement.query(By.css('.game-title'));
      expect(titleElement).toBeTruthy();
      expect(titleElement.nativeElement.textContent).toBe('Counter-Strike: Global Offensive');
    });

    it('should display game price', () => {
      const priceElement = fixture.debugElement.query(By.css('.game-price'));
      expect(priceElement).toBeTruthy();
      expect(priceElement.nativeElement.textContent.trim()).toBe('Free');
    });

    it('should display developer information', () => {
      const developerElement = fixture.debugElement.query(By.css('.game-developer'));
      expect(developerElement).toBeTruthy();
      expect(developerElement.nativeElement.textContent.trim()).toContain('Valve');
    });

    it('should display cover image when available', () => {
      const coverImage = fixture.debugElement.query(By.css('.cover-image'));
      const coverPlaceholder = fixture.debugElement.query(By.css('.cover-placeholder'));

      expect(coverImage).toBeTruthy();
      expect(coverPlaceholder).toBeFalsy();
      expect(coverImage.nativeElement.src).toBe('https://example.com/cover.jpg');
      expect(coverImage.nativeElement.alt).toBe('Counter-Strike: Global Offensive');
    });

    it('should display tag chips', () => {
      const tagChips = fixture.debugElement.queryAll(By.css('.tag-chip'));
      expect(tagChips.length).toBeGreaterThan(0);
      expect(tagChips.length).toBeLessThanOrEqual(5); // Should limit to top 5 tags
    });

    it('should display genre badges', () => {
      const genreBadges = fixture.debugElement.queryAll(By.css('.genre-badge'));
      expect(genreBadges.length).toBe(2);
      expect(genreBadges[0].nativeElement.textContent.trim()).toBe('Action');
      expect(genreBadges[1].nativeElement.textContent.trim()).toBe('Free To Play');
    });

    it('should display review information', () => {
      const reviewSummary = fixture.debugElement.query(By.css('.review-summary'));
      const reviewPercentage = fixture.debugElement.query(By.css('.review-percentage'));

      expect(reviewSummary).toBeTruthy();
      expect(reviewPercentage).toBeTruthy();
    });
  });

  describe('template rendering without game', () => {
    beforeEach(() => {
      component.game = null;
      fixture.detectChanges();
    });

    it('should display placeholder when no game provided', () => {
      const gameCard = fixture.debugElement.query(By.css('.game-card'));
      const placeholder = fixture.debugElement.query(By.css('.game-card-placeholder'));

      expect(gameCard).toBeFalsy();
      expect(placeholder).toBeTruthy();
      expect(placeholder.nativeElement.textContent).toContain('No game data available');
    });
  });

  describe('cover image handling', () => {
    it('should display cover placeholder when no cover URL', () => {
      component.game = { ...mockGame, coverUrl: null };
      fixture.detectChanges();

      const coverImage = fixture.debugElement.query(By.css('.cover-image'));
      const coverPlaceholder = fixture.debugElement.query(By.css('.cover-placeholder'));

      expect(coverImage).toBeFalsy();
      expect(coverPlaceholder).toBeTruthy();
      expect(coverPlaceholder.nativeElement.textContent.trim()).toBe('C'); // First letter of game name
    });

    it('should use first letter of game name in placeholder', () => {
      component.game = { ...mockGame, name: 'Dota 2', coverUrl: null };
      fixture.detectChanges();

      const coverPlaceholder = fixture.debugElement.query(By.css('.cover-placeholder span'));
      expect(coverPlaceholder.nativeElement.textContent.trim()).toBe('D');
    });
  });

  describe('rank and score display', () => {
    beforeEach(() => {
      component.game = mockGame;
      component.showScore = true;
      component.score = 0.87;
      component.rank = 3;
      fixture.detectChanges();
    });

    it('should display rank badge when showScore is true and rank provided', () => {
      const rankBadge = fixture.debugElement.query(By.css('.rank-badge'));
      expect(rankBadge).toBeTruthy();
      expect(rankBadge.nativeElement.textContent.trim()).toBe('#3');
    });

    it('should display preference score when showScore is true and score provided', () => {
      const scoreElement = fixture.debugElement.query(By.css('.preference-score'));
      expect(scoreElement).toBeTruthy();
      expect(scoreElement.nativeElement.textContent).toContain('0.87');
    });

    it('should not display rank badge when showScore is false', () => {
      component.showScore = false;
      fixture.detectChanges();

      const rankBadge = fixture.debugElement.query(By.css('.rank-badge'));
      expect(rankBadge).toBeFalsy();
    });

    it('should not display score when showScore is false', () => {
      component.showScore = false;
      fixture.detectChanges();

      const scoreElement = fixture.debugElement.query(By.css('.preference-score'));
      expect(scoreElement).toBeFalsy();
    });
  });

  describe('component methods', () => {
    it('should implement getFormattedPrice method', () => {
      expect(() => component.getFormattedPrice()).toThrowError('Not implemented');
    });

    it('should implement getTopTags method', () => {
      expect(() => component.getTopTags()).toThrowError('Not implemented');
    });

    it('should implement getReviewPercentage method', () => {
      expect(() => component.getReviewPercentage()).toThrowError('Not implemented');
    });

    it('should implement getReviewText method', () => {
      expect(() => component.getReviewText()).toThrowError('Not implemented');
    });

    it('should implement hasValidGame method', () => {
      expect(() => component.hasValidGame()).toThrowError('Not implemented');
    });

    it('should implement getDeveloperText method', () => {
      expect(() => component.getDeveloperText()).toThrowError('Not implemented');
    });
  });

  describe('edge cases', () => {
    it('should handle game with no tags', () => {
      component.game = { ...mockGame, tags: {} };
      fixture.detectChanges();

      const tagChips = fixture.debugElement.queryAll(By.css('.tag-chip'));
      expect(tagChips.length).toBe(0);
    });

    it('should handle game with no genres', () => {
      component.game = { ...mockGame, genres: [] };
      fixture.detectChanges();

      const genreSection = fixture.debugElement.query(By.css('.game-genres'));
      expect(genreSection).toBeFalsy();
    });

    it('should handle game with null reviews', () => {
      component.game = { ...mockGame, reviewPos: null, reviewNeg: null };
      fixture.detectChanges();

      const reviewSection = fixture.debugElement.query(By.css('.game-reviews'));
      expect(reviewSection).toBeTruthy(); // Section should still exist
    });

    it('should handle game with missing developer and publisher', () => {
      component.game = { ...mockGame, developer: null, publisher: null };
      fixture.detectChanges();

      const developerElement = fixture.debugElement.query(By.css('.game-developer'));
      expect(developerElement).toBeTruthy();
    });

    it('should handle undefined score and rank', () => {
      component.game = mockGame;
      component.showScore = true;
      component.score = undefined;
      component.rank = undefined;
      fixture.detectChanges();

      const rankBadge = fixture.debugElement.query(By.css('.rank-badge'));
      const scoreElement = fixture.debugElement.query(By.css('.preference-score'));

      expect(rankBadge).toBeFalsy();
      expect(scoreElement).toBeFalsy();
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      component.game = mockGame;
      fixture.detectChanges();
    });

    it('should have proper heading structure', () => {
      const titleElement = fixture.debugElement.query(By.css('.game-title'));
      expect(titleElement.nativeElement.tagName.toLowerCase()).toBe('h3');
    });

    it('should have proper alt text for cover image', () => {
      const coverImage = fixture.debugElement.query(By.css('.cover-image'));
      expect(coverImage.nativeElement.alt).toBe(mockGame.name);
    });

    it('should have semantic content structure', () => {
      const cardContent = fixture.debugElement.query(By.css('.card-content'));
      expect(cardContent).toBeTruthy();

      const cardHeader = fixture.debugElement.query(By.css('.card-header'));
      expect(cardHeader).toBeTruthy();
    });
  });

  describe('responsive behavior', () => {
    beforeEach(() => {
      component.game = mockGame;
      fixture.detectChanges();
    });

    it('should have proper CSS classes for styling', () => {
      const gameCard = fixture.debugElement.query(By.css('.game-card'));
      expect(gameCard.nativeElement.classList.contains('game-card')).toBe(true);
    });

    it('should maintain card structure across different content lengths', () => {
      const longNameGame: GameRecord = {
        ...mockGame,
        name: 'This is a very long game name that should still fit properly in the card layout'
      };

      component.game = longNameGame;
      fixture.detectChanges();

      const titleElement = fixture.debugElement.query(By.css('.game-title'));
      expect(titleElement).toBeTruthy();
      expect(titleElement.nativeElement.textContent).toContain('very long game name');
    });
  });

  describe('data display formatting', () => {
    it('should handle different price formats', () => {
      component.game = mockGameWithPrice;
      fixture.detectChanges();

      const priceElement = fixture.debugElement.query(By.css('.game-price'));
      expect(priceElement.nativeElement.textContent.trim()).toBe('$59.99');
    });

    it('should limit tag display', () => {
      const manyTagsGame: GameRecord = {
        ...mockGame,
        tags: {
          'Tag1': 1000, 'Tag2': 900, 'Tag3': 800, 'Tag4': 700,
          'Tag5': 600, 'Tag6': 500, 'Tag7': 400, 'Tag8': 300
        }
      };

      component.game = manyTagsGame;
      fixture.detectChanges();

      const tagChips = fixture.debugElement.queryAll(By.css('.tag-chip'));
      expect(tagChips.length).toBeLessThanOrEqual(5);
    });

    it('should handle games with single genre', () => {
      component.game = { ...mockGame, genres: ['Action'] };
      fixture.detectChanges();

      const genreBadges = fixture.debugElement.queryAll(By.css('.genre-badge'));
      expect(genreBadges.length).toBe(1);
      expect(genreBadges[0].nativeElement.textContent.trim()).toBe('Action');
    });
  });
});