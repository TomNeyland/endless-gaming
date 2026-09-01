import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';
import { GameCardComponent } from './game-card.component';
import { GameRecord } from '../../../types/game.types';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

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
      providers: [provideHttpClient(), provideHttpClientTesting()],
      imports: [GameCardComponent],
      schemas: [NO_ERRORS_SCHEMA]
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
      // Material migration: title is now rendered via <mat-card-title>
      // rather than a custom ".game-title" class.
      const titleElement = fixture.debugElement.query(By.css('mat-card-title'));
      expect(titleElement).toBeTruthy();
      expect(titleElement.nativeElement.textContent).toBe('Counter-Strike: Global Offensive');
    });

    it('should display game price', () => {
      // Material migration: price now lives in a <mat-card-subtitle class="price-tag">
      // alongside a mat-icon, so the text also contains the icon ligature.
      const priceElement = fixture.debugElement.query(By.css('.price-tag'));
      expect(priceElement).toBeTruthy();
      expect(priceElement.nativeElement.textContent.trim()).toContain('Free');
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
      // Material migration: tags now render as <mat-chip class="tag-chip tag-<type>">
      // via getEnhancedTags(2, 3), which falls back (no tagRarityAnalysis input here)
      // to up to 5 popular tags (2 + 3) when no TF-IDF analysis is supplied.
      const tagChips = fixture.debugElement.queryAll(By.css('.tag-chip'));
      expect(tagChips.length).toBeGreaterThan(0);
      expect(tagChips.length).toBeLessThanOrEqual(5); // getEnhancedTags(2, 3) fallback caps at 5 tags
    });

    it('should display genre information', () => {
      // Material migration: genre now lives in a <mat-card-subtitle class="genre-tag">
      // alongside a mat-icon, so the text also contains the icon ligature.
      const genreElement = fixture.debugElement.query(By.css('.genre-tag'));
      expect(genreElement).toBeTruthy();
      expect(genreElement.nativeElement.textContent.trim()).toContain('Action'); // Primary genre only
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
      // getCoverImage() no longer falls back to a static placeholder asset;
      // it now derives a Steam CDN header image from the game's appId
      // (see GameCardComponent.getCoverImage), which is a richer fallback
      // than a generic placeholder. A canvas-generated placeholder is used
      // only as a last resort when appId is also unavailable.
      component.game = { ...mockGame, coverUrl: null };
      const coverUrl = component.getCoverImage();
      expect(coverUrl).toBe('https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg');
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
      // Material migration: the rank badge now pairs a <mat-icon>star</mat-icon>
      // with the rank number instead of rendering "#3" as plain text. Still
      // assert the actual rank number is shown, plus the icon used.
      const rankBadge = fixture.debugElement.query(By.css('.rank-badge'));
      expect(rankBadge).toBeTruthy();
      expect(rankBadge.nativeElement.textContent.trim()).toContain('3');

      const rankIcon = rankBadge.query(By.css('mat-icon'));
      expect(rankIcon).toBeTruthy();
      expect(rankIcon.nativeElement.textContent.trim()).toBe('star');
    });

    it('should display preference score when showScore is true and score provided', () => {
      // Material migration: score now lives in a ".score-section" div
      // (with a mat-icon) rather than a ".score" element.
      const scoreElement = fixture.debugElement.query(By.css('.score-section'));
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