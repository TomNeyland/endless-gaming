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
    publisher: 'Valve',
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
      const priceElement = fixture.debugElement.query(By.css('.price'));
      expect(priceElement).toBeTruthy();
      expect(priceElement.nativeElement.textContent.trim()).toBe('Free');
    });

    it('should display developer information', () => {
      const developerElement = fixture.debugElement.query(By.css('.developer'));
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
      const tagChips = fixture.debugElement.queryAll(By.css('.tag'));
      expect(tagChips.length).toBeGreaterThan(0);
      expect(tagChips.length).toBeLessThanOrEqual(3); // Should limit to top 3 tags as per template
    });

    it('should display genre information', () => {
      const genreElement = fixture.debugElement.query(By.css('.genre'));
      expect(genreElement).toBeTruthy();
      expect(genreElement.nativeElement.textContent.trim()).toBe('Action'); // Primary genre only
    });

    it('should display review information', () => {
      const reviewElement = fixture.debugElement.query(By.css('.reviews'));
      expect(reviewElement).toBeTruthy();
      expect(reviewElement.nativeElement.textContent).toContain('91% positive');
    });
  });

  describe('template rendering without game', () => {
    beforeEach(() => {
      component.game = null;
      fixture.detectChanges();
    });

    it('should display placeholder when no game provided', () => {
      const gameCard = fixture.debugElement.query(By.css('.card-content'));
      const emptyCard = fixture.debugElement.query(By.css('.empty-card'));

      expect(gameCard).toBeFalsy();
      expect(emptyCard).toBeTruthy();
      expect(emptyCard.nativeElement.textContent).toContain('No game data available');
    });
  });

  describe('cover image handling', () => {
    it('should use fallback image when no cover URL', () => {
      component.game = { ...mockGame, coverUrl: null };
      const coverUrl = component.getCoverImage();
      expect(coverUrl).toBe('/assets/images/game-placeholder.png');
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
      const scoreElement = fixture.debugElement.query(By.css('.score'));
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

      const scoreElement = fixture.debugElement.query(By.css('.score'));
      expect(scoreElement).toBeFalsy();
    });
  });

  describe('component methods', () => {
    it('should implement getFormattedPrice method', () => {
      component.game = null;
      expect(component.getFormattedPrice()).toBe('Price unavailable');
      
      component.game = { ...mockGame, price: 'Free' };
      expect(component.getFormattedPrice()).toBe('Free');
      
      component.game = mockGameWithPrice;
      expect(component.getFormattedPrice()).toBe('$59.99');
    });

    it('should implement getTopTags method', () => {
      component.game = mockGame;
      const topTags = component.getTopTags(3);
      
      expect(topTags.length).toBe(3);
      expect(topTags[0].tag).toBe('FPS'); // Highest votes (91172)
      expect(topTags[1].tag).toBe('Shooter'); // Second highest (65634)
    });

    it('should implement getReviewPercentage method', () => {
      component.game = mockGame;
      const percentage = component.getReviewPercentage();
      
      expect(percentage).toBe(91); // 1000000 / (1000000 + 100000) = 90.9% ≈ 91%
    });

    it('should implement getReviewText method', () => {
      component.game = mockGame;
      const reviewText = component.getReviewText();
      
      expect(reviewText).toContain('91% positive');
      expect(reviewText).toContain('1,100,000 reviews');
    });

    it('should implement hasValidGame method', () => {
      component.game = null;
      expect(component.hasValidGame()).toBe(false);
      
      component.game = mockGame;
      expect(component.hasValidGame()).toBe(true);
    });

    it('should implement getDeveloperText method', () => {
      component.game = mockGame;
      expect(component.getDeveloperText()).toBe('Valve'); // Same developer and publisher
      
      component.game = null;
      expect(component.getDeveloperText()).toBe('Unknown');
    });
  });
});