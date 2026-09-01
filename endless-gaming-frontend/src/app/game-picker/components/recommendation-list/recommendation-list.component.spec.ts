import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { RecommendationListComponent } from './recommendation-list.component';
import { GameRecommendation } from '../../../types/game.types';
import { PreferenceService } from '../../services/preference.service';
import { GameDetailsService } from '../../services/game-details.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('RecommendationListComponent', () => {
  let component: RecommendationListComponent;
  let fixture: ComponentFixture<RecommendationListComponent>;
  let mockPreferenceService: jasmine.SpyObj<PreferenceService>;

  const mockRecommendations: GameRecommendation[] = [
    {
      game: {
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
      score: 0.95,
      rank: 1
    },
    {
      game: {
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
      score: 0.87,
      rank: 2
    },
    {
      game: {
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
      score: 0.23,
      rank: 3
    }
  ];

  beforeEach(async () => {
    // Create mock PreferenceService
    mockPreferenceService = jasmine.createSpyObj('PreferenceService', [
      'rankGames',
      'rankGamesWithSteamData',
      'getPreferenceSummary',
      'getTagRarityAnalysis'
    ]);
    
    // Configure default behavior - return mock recommendations when rankGames is called
    mockPreferenceService.rankGames.and.returnValue(mockRecommendations);
    mockPreferenceService.rankGamesWithSteamData.and.returnValue(mockRecommendations);
    mockPreferenceService.getPreferenceSummary.and.returnValue(of({ likedTags: [], dislikedTags: [] }));
    mockPreferenceService.getTagRarityAnalysis.and.returnValue(null);
    
    await TestBed.configureTestingModule({
      imports: [RecommendationListComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: PreferenceService, useValue: mockPreferenceService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(RecommendationListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('input handling', () => {
    it('should accept empty recommendations initially', () => {
      expect(component.recommendations).toEqual([]);
    });

    it('should accept valid recommendations', () => {
      component.recommendations = mockRecommendations;
      expect(component.recommendations).toBe(mockRecommendations);
    });

    it('should handle maxRecommendations input', () => {
      component.maxRecommendations = 50;
      expect(component.maxRecommendations).toBe(50);
    });

    it('should use default maxRecommendations value', () => {
      expect(component.maxRecommendations).toBe(100);
    });
  });

  describe('template rendering with recommendations', () => {
    beforeEach(() => {
      // Set input games - the component will use the mocked service to generate recommendations
      component.games = mockRecommendations.map(r => r.game);
      fixture.detectChanges(); // This triggers ngOnInit which calls the mocked rankGames
    });

    it('should display list header when recommendations available', () => {
      // '.list-header' no longer exists post Material redesign; the top-level
      // recommendations content is now the premium-recommendations section,
      // which renders whenever recommendations are available.
      const premiumSection = fixture.debugElement.query(By.css('.premium-section'));
      const noRecommendations = fixture.debugElement.query(By.css('.no-recommendations'));

      expect(premiumSection).toBeTruthy();
      expect(noRecommendations).toBeFalsy();
    });

    it('should display main title with recommendation count', () => {
      // The dedicated "Your Top 100 Game Recommendations" heading moved up to the
      // parent game-picker-page component. Within this component, the recommendation
      // count is now communicated via the stats footer summary line.
      const statsFooter = fixture.debugElement.query(By.css('.stats-footer'));
      expect(statsFooter).toBeTruthy();
      expect(statsFooter.nativeElement.textContent).toContain('3 personalized recommendations');
    });

    it('should display subtitle', () => {
      // The "Based on your preferences" subtitle also moved to the parent component.
      // The closest remaining descriptive heading within this component is the
      // premium section's title, introducing the recommendations that follow.
      const sectionTitle = fixture.debugElement.query(By.css('.premium-section .section-title'));
      expect(sectionTitle).toBeTruthy();
      expect(sectionTitle.nativeElement.textContent).toContain('Top Recommendations');
    });

    it('should display recommendation items', () => {
      const recommendationItems = fixture.debugElement.queryAll(By.css('.premium-card, .compact-item'));
      expect(recommendationItems.length).toBe(3);
    });

    it('should display rank numbers correctly', () => {
      const rankNumbers = fixture.debugElement.queryAll(By.css('.rank-number'));
      expect(rankNumbers.length).toBe(3);
      
      expect(rankNumbers[0].nativeElement.textContent.trim()).toContain('1');
      expect(rankNumbers[1].nativeElement.textContent.trim()).toContain('2');
      expect(rankNumbers[2].nativeElement.textContent.trim()).toContain('3');
    });

    it('should display score badges', () => {
      // '.score-badge' was renamed to '.score' in the Material redesign.
      const scoreBadges = fixture.debugElement.queryAll(By.css('.score'));
      expect(scoreBadges.length).toBe(3);
    });

    it('should display game cards', () => {
      // This component no longer delegates to a reusable <app-game-card>; each
      // top recommendation now renders inline as a Material 'premium-card'.
      const gameCards = fixture.debugElement.queryAll(By.css('.premium-card'));
      expect(gameCards.length).toBe(3);
    });

    it('should display view details buttons', () => {
      // The dedicated "View Details" button was replaced by a whole-card click
      // (see 'user interactions > should handle recommendation item clicks').
      // The one action button that remains on every premium card links out to
      // the Steam store page, so assert that specific, still-present button.
      const viewButtons = fixture.debugElement.queryAll(By.css('.steam-link-button'));
      expect(viewButtons.length).toBe(3);

      viewButtons.forEach(button => {
        expect(button.nativeElement.tagName.toLowerCase()).toBe('button');
        expect(button.nativeElement.textContent).toContain('Steam Store');
      });
    });

    it('should display rank numbers', () => {
      // Premium cards render the bare rank number (no leading '#'); only the
      // compact list items keep the '#' prefix. All 3 mock recommendations
      // land in the premium section, so assert the plain numbers shown there.
      const rankNumbers = fixture.debugElement.queryAll(By.css('.rank-number'));
      expect(rankNumbers.length).toBe(3);

      expect(rankNumbers[0].nativeElement.textContent.trim()).toBe('1');
      expect(rankNumbers[1].nativeElement.textContent.trim()).toBe('2');
      expect(rankNumbers[2].nativeElement.textContent.trim()).toBe('3');
    });

    it('should display score badges', () => {
      // '.score-badge' was renamed to '.score'; it now also contains a
      // mat-icon, so check the formatted score is present rather than an
      // exact text match.
      const scoreBadges = fixture.debugElement.queryAll(By.css('.score'));
      expect(scoreBadges.length).toBe(3);

      expect(scoreBadges[0].nativeElement.textContent).toContain('0.95');
      expect(scoreBadges[1].nativeElement.textContent).toContain('0.87');
    });

    it('should display recommendation items with correct structure', () => {
      // '.rank-section' / '.game-section' / '.action-section' were replaced by
      // the premium card's rank badge, Material card content, and card actions.
      const recommendationItems = fixture.debugElement.queryAll(By.css('.premium-card'));
      expect(recommendationItems.length).toBe(3);

      // Each item should have the expected sections
      recommendationItems.forEach(item => {
        expect(item.query(By.css('.rank-badge'))).toBeTruthy();
        expect(item.query(By.css('mat-card-content'))).toBeTruthy();
        expect(item.query(By.css('mat-card-actions'))).toBeTruthy();
      });
    });
  });

  describe('template rendering without recommendations', () => {
    beforeEach(() => {
      // Don't set any games - component will have empty recommendations
      component.games = [];
      fixture.detectChanges();
    });

    it('should display no recommendations message when empty', () => {
      // '.list-header' no longer exists; use its replacement, '.premium-section',
      // to confirm the recommendations content is absent in the empty state.
      const premiumSection = fixture.debugElement.query(By.css('.premium-section'));
      const noRecommendations = fixture.debugElement.query(By.css('.no-recommendations'));

      expect(premiumSection).toBeFalsy();
      expect(noRecommendations).toBeTruthy();
      expect(noRecommendations.nativeElement.textContent).toContain('No Recommendations Available');
      // NOTE: this assertion is intentionally left pointing at the original expected
      // copy. It currently fails - see report: suspected GameFilterService bug makes
      // isFiltering() true by default, so this branch always renders the "No games
      // match your current filters" copy instead. Not fixed here (production code).
      expect(noRecommendations.nativeElement.textContent).toContain('Complete some game comparisons');
    });
  });

  describe('user interactions', () => {
    beforeEach(() => {
      // Set input games - the component will use the mocked service to generate recommendations
      component.games = mockRecommendations.map(r => r.game);
      fixture.detectChanges(); // This triggers ngOnInit which calls the mocked rankGames
    });

    it('should handle recommendation item clicks', () => {
      spyOn(component, 'onRecommendationClick');

      // '.recommendation-item' was replaced by '.premium-card' (top 3) and
      // '.compact-item' (the rest); the whole card is now clickable.
      const firstRecommendationItem = fixture.debugElement.query(By.css('.premium-card, .compact-item'));
      firstRecommendationItem.nativeElement.click();

      expect(component.onRecommendationClick).toHaveBeenCalledWith(mockRecommendations[0]);
    });

    it('should handle view details button clicks', () => {
      // '.view-details-btn' was replaced by '.steam-link-button' (see above).
      const viewButtons = fixture.debugElement.queryAll(By.css('.steam-link-button'));
      expect(viewButtons.length).toBe(3);

      viewButtons.forEach(button => {
        spyOn(button.nativeElement, 'click');
        button.nativeElement.click();
        expect(button.nativeElement.click).toHaveBeenCalled();
      });
    });
  });

  describe('component methods', () => {
    it('should implement hasRecommendations method', () => {
      // Set games and initialize to get recommendations from service
      component.games = mockRecommendations.map(r => r.game);
      component.ngOnInit();
      expect(component.hasRecommendations()).toBe(true);
      
      // Reset with no games
      component.games = [];
      component.ngOnInit();
      expect(component.hasRecommendations()).toBe(false);
    });

    it('should implement getDisplayRecommendations method', () => {
      // Set games and initialize to get recommendations from service
      component.games = mockRecommendations.map(r => r.game);
      component.ngOnInit();
      expect(component.getDisplayRecommendations()).toEqual(mockRecommendations);
    });

    it('should implement formatScore method', () => {
      expect(component.formatScore(0.85)).toBe('0.85');
      expect(component.formatScore(0.956)).toBe('0.96');
    });

    it('should implement getScoreColor method', () => {
      expect(component.getScoreColor(2.5)).toBe('#27ae60'); // Strong positive
      expect(component.getScoreColor(1.5)).toBe('#2ecc71'); // Positive
      expect(component.getScoreColor(0.85)).toBe('#f39c12'); // Mild positive
      expect(component.getScoreColor(-0.5)).toBe('#e67e22'); // Mild negative
    });

    it('should implement getRankText method', () => {
      expect(component.getRankText(1)).toBe('#1');
      expect(component.getRankText(42)).toBe('#42');
    });

    it('should implement onRecommendationClick method', () => {
      // onRecommendationClick no longer just logs to the console - it now opens
      // the game details modal via GameDetailsService. Verify that behavior instead.
      const gameDetailsService = TestBed.inject(GameDetailsService);
      spyOn(gameDetailsService, 'openGameDetails');

      component.onRecommendationClick(mockRecommendations[0]);

      expect(gameDetailsService.openGameDetails).toHaveBeenCalledWith(mockRecommendations[0].game);
    });

    it('should implement trackByAppId method', () => {
      expect(component.trackByAppId(0, mockRecommendations[0])).toBe(730);
      expect(component.trackByAppId(1, mockRecommendations[1])).toBe(440);
    });
  });

  describe('maxRecommendations limiting', () => {
    it('should limit displayed recommendations based on maxRecommendations', () => {
      component.maxRecommendations = 2;
      component.games = mockRecommendations.map(r => r.game);
      component.ngOnInit();
      expect(component.getDisplayRecommendations().length).toBe(2); // Should be limited by maxRecommendations
    });
  });

});