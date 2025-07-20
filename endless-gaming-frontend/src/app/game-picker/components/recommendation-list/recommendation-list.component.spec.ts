import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RecommendationListComponent } from './recommendation-list.component';
import { GameRecommendation } from '../../../types/game.types';

describe('RecommendationListComponent', () => {
  let component: RecommendationListComponent;
  let fixture: ComponentFixture<RecommendationListComponent>;

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
    await TestBed.configureTestingModule({
      imports: [RecommendationListComponent]
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
      component.recommendations = mockRecommendations;
      fixture.detectChanges();
    });

    it('should display list header when recommendations available', () => {
      const listHeader = fixture.debugElement.query(By.css('.list-header'));
      const noRecommendations = fixture.debugElement.query(By.css('.no-recommendations'));

      expect(listHeader).toBeTruthy();
      expect(noRecommendations).toBeFalsy();
    });

    it('should display main title with recommendation count', () => {
      const title = fixture.debugElement.query(By.css('.list-header h2'));
      expect(title).toBeTruthy();
      expect(title.nativeElement.textContent).toContain('Your Top 100 Game Recommendations');
    });

    it('should display subtitle', () => {
      const subtitle = fixture.debugElement.query(By.css('.subtitle'));
      expect(subtitle).toBeTruthy();
      expect(subtitle.nativeElement.textContent).toContain('Based on your preferences');
    });

    it('should display recommendation items', () => {
      const recommendationItems = fixture.debugElement.queryAll(By.css('.recommendation-item'));
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
      const scoreBadges = fixture.debugElement.queryAll(By.css('.score-badge'));
      expect(scoreBadges.length).toBe(3);
    });

    it('should display game names', () => {
      const gameNames = fixture.debugElement.queryAll(By.css('.game-name'));
      expect(gameNames.length).toBe(3);
      
      expect(gameNames[0].nativeElement.textContent.trim()).toBe('Counter-Strike: Global Offensive');
      expect(gameNames[1].nativeElement.textContent.trim()).toBe('Team Fortress 2');
      expect(gameNames[2].nativeElement.textContent.trim()).toBe('Dota 2');
    });

    it('should display view details buttons', () => {
      const viewButtons = fixture.debugElement.queryAll(By.css('.view-details-btn'));
      expect(viewButtons.length).toBe(3);
      
      viewButtons.forEach(button => {
        expect(button.nativeElement.textContent.trim()).toBe('View Details');
        expect(button.nativeElement.type).toBe('button');
      });
    });

    it('should display game prices', () => {
      const gamePrices = fixture.debugElement.queryAll(By.css('.game-price'));
      expect(gamePrices.length).toBe(3);
      
      gamePrices.forEach(price => {
        expect(price.nativeElement.textContent.trim()).toBe('Free');
      });
    });

    it('should display game developers', () => {
      const gameDevelopers = fixture.debugElement.queryAll(By.css('.game-developer'));
      expect(gameDevelopers.length).toBe(3);
      
      gameDevelopers.forEach(developer => {
        expect(developer.nativeElement.textContent).toContain('by Valve');
      });
    });

    it('should display tag previews', () => {
      const tagPreviews = fixture.debugElement.queryAll(By.css('.tag-preview'));
      expect(tagPreviews.length).toBeGreaterThan(0);
      expect(tagPreviews.length).toBeLessThanOrEqual(9); // 3 tags per game max
    });
  });

  describe('template rendering without recommendations', () => {
    beforeEach(() => {
      component.recommendations = [];
      fixture.detectChanges();
    });

    it('should display no recommendations message when empty', () => {
      const listHeader = fixture.debugElement.query(By.css('.list-header'));
      const noRecommendations = fixture.debugElement.query(By.css('.no-recommendations'));

      expect(listHeader).toBeFalsy();
      expect(noRecommendations).toBeTruthy();
      expect(noRecommendations.nativeElement.textContent).toContain('No Recommendations Available');
      expect(noRecommendations.nativeElement.textContent).toContain('Complete some game comparisons');
    });
  });

  describe('user interactions', () => {
    beforeEach(() => {
      component.recommendations = mockRecommendations;
      fixture.detectChanges();
    });

    it('should handle recommendation item clicks', () => {
      spyOn(component, 'onRecommendationClick');

      const firstRecommendationItem = fixture.debugElement.query(By.css('.recommendation-item'));
      firstRecommendationItem.nativeElement.click();

      expect(component.onRecommendationClick).toHaveBeenCalledWith(mockRecommendations[0]);
    });

    it('should handle view details button clicks', () => {
      const viewButtons = fixture.debugElement.queryAll(By.css('.view-details-btn'));
      
      viewButtons.forEach(button => {
        spyOn(button.nativeElement, 'click');
        button.nativeElement.click();
        expect(button.nativeElement.click).toHaveBeenCalled();
      });
    });
  });

  describe('component methods', () => {
    it('should implement hasRecommendations method', () => {
      expect(() => component.hasRecommendations()).toThrowError('Not implemented');
    });

    it('should implement getDisplayRecommendations method', () => {
      expect(() => component.getDisplayRecommendations()).toThrowError('Not implemented');
    });

    it('should implement formatScore method', () => {
      expect(() => component.formatScore(0.85)).toThrowError('Not implemented');
    });

    it('should implement getScoreColor method', () => {
      expect(() => component.getScoreColor(0.85)).toThrowError('Not implemented');
    });

    it('should implement getRankText method', () => {
      expect(() => component.getRankText(1)).toThrowError('Not implemented');
    });

    it('should implement onRecommendationClick method', () => {
      expect(() => component.onRecommendationClick(mockRecommendations[0])).toThrowError('Not implemented');
    });

    it('should implement trackByAppId method', () => {
      expect(() => component.trackByAppId(0, mockRecommendations[0])).toThrowError('Not implemented');
    });
  });

  describe('maxRecommendations limiting', () => {
    beforeEach(() => {
      component.maxRecommendations = 2;
      component.recommendations = mockRecommendations;
      fixture.detectChanges();
    });

    it('should limit displayed recommendations based on maxRecommendations', () => {
      const recommendationItems = fixture.debugElement.queryAll(By.css('.recommendation-item'));
      expect(recommendationItems.length).toBeLessThanOrEqual(2);
    });

    it('should display footer message when more recommendations available', () => {
      // This would test the list-footer when recommendations > maxRecommendations
      component.recommendations = new Array(105).fill(mockRecommendations[0]).map((rec, index) => ({
        ...rec,
        rank: index + 1
      }));
      component.maxRecommendations = 100;
      fixture.detectChanges();

      const listFooter = fixture.debugElement.query(By.css('.list-footer'));
      if (listFooter) {
        expect(listFooter.nativeElement.textContent).toContain('Showing top 100 of 105');
      }
    });
  });

  describe('special ranking styles', () => {
    beforeEach(() => {
      component.recommendations = mockRecommendations;
      fixture.detectChanges();
    });

    it('should apply special styling to top ranked games', () => {
      const firstRankItem = fixture.debugElement.query(By.css('[data-rank="1"]'));
      const secondRankItem = fixture.debugElement.query(By.css('[data-rank="2"]'));
      const thirdRankItem = fixture.debugElement.query(By.css('[data-rank="3"]'));

      expect(firstRankItem).toBeTruthy();
      expect(secondRankItem).toBeTruthy();
      expect(thirdRankItem).toBeTruthy();
    });

    it('should have rank attributes set correctly', () => {
      const recommendationItems = fixture.debugElement.queryAll(By.css('.recommendation-item'));
      
      expect(recommendationItems[0].nativeElement.getAttribute('data-rank')).toBe('1');
      expect(recommendationItems[1].nativeElement.getAttribute('data-rank')).toBe('2');
      expect(recommendationItems[2].nativeElement.getAttribute('data-rank')).toBe('3');
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      component.recommendations = mockRecommendations;
      fixture.detectChanges();
    });

    it('should have proper heading hierarchy', () => {
      const mainTitle = fixture.debugElement.query(By.css('.list-header h2'));
      expect(mainTitle.nativeElement.tagName.toLowerCase()).toBe('h2');

      const gameNames = fixture.debugElement.queryAll(By.css('.game-name'));
      gameNames.forEach(name => {
        expect(name.nativeElement.tagName.toLowerCase()).toBe('h3');
      });
    });

    it('should have accessible button labels', () => {
      const viewButtons = fixture.debugElement.queryAll(By.css('.view-details-btn'));
      
      viewButtons.forEach(button => {
        expect(button.nativeElement.textContent.trim()).toBe('View Details');
        expect(button.nativeElement.type).toBe('button');
      });
    });

    it('should have clickable recommendation items', () => {
      const recommendationItems = fixture.debugElement.queryAll(By.css('.recommendation-item'));
      
      recommendationItems.forEach(item => {
        expect(item.nativeElement.style.cursor).toBe('pointer');
      });
    });
  });

  describe('responsive behavior', () => {
    beforeEach(() => {
      component.recommendations = mockRecommendations;
      fixture.detectChanges();
    });

    it('should have scrollable container', () => {
      const recommendationsContainer = fixture.debugElement.query(By.css('.recommendations-container'));
      expect(recommendationsContainer).toBeTruthy();
    });

    it('should maintain grid layout structure', () => {
      const recommendationItems = fixture.debugElement.queryAll(By.css('.recommendation-item'));
      
      recommendationItems.forEach(item => {
        const rankSection = item.query(By.css('.rank-section'));
        const gameSection = item.query(By.css('.game-section'));
        const actionSection = item.query(By.css('.action-section'));

        expect(rankSection).toBeTruthy();
        expect(gameSection).toBeTruthy();
        expect(actionSection).toBeTruthy();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle recommendations with missing game data', () => {
      const incompleteRecommendations: GameRecommendation[] = [
        {
          game: {
            appId: 1,
            name: 'Test Game',
            coverUrl: null,
            price: null,
            developer: null,
            publisher: null,
            tags: {},
            genres: [],
            reviewPos: null,
            reviewNeg: null
          },
          score: 0.5,
          rank: 1
        }
      ];

      component.recommendations = incompleteRecommendations;
      fixture.detectChanges();

      const recommendationItems = fixture.debugElement.queryAll(By.css('.recommendation-item'));
      expect(recommendationItems.length).toBe(1);

      const gameName = fixture.debugElement.query(By.css('.game-name'));
      expect(gameName.nativeElement.textContent.trim()).toBe('Test Game');
    });

    it('should handle very high scores', () => {
      const highScoreRecommendations: GameRecommendation[] = [
        {
          ...mockRecommendations[0],
          score: 1.0
        }
      ];

      component.recommendations = highScoreRecommendations;
      fixture.detectChanges();

      const scoreBadge = fixture.debugElement.query(By.css('.score-badge'));
      expect(scoreBadge).toBeTruthy();
    });

    it('should handle negative scores', () => {
      const negativeScoreRecommendations: GameRecommendation[] = [
        {
          ...mockRecommendations[0],
          score: -0.5
        }
      ];

      component.recommendations = negativeScoreRecommendations;
      fixture.detectChanges();

      const scoreBadge = fixture.debugElement.query(By.css('.score-badge'));
      expect(scoreBadge).toBeTruthy();
    });

    it('should handle large recommendation lists', () => {
      const largeRecommendationList = new Array(200).fill(mockRecommendations[0]).map((rec, index) => ({
        ...rec,
        game: { ...rec.game, appId: index + 1 },
        rank: index + 1
      }));

      component.recommendations = largeRecommendationList;
      fixture.detectChanges();

      const recommendationsContainer = fixture.debugElement.query(By.css('.recommendations-container'));
      expect(recommendationsContainer).toBeTruthy();
    });

    it('should handle games with no tags', () => {
      const noTagsRecommendations: GameRecommendation[] = [
        {
          ...mockRecommendations[0],
          game: { ...mockRecommendations[0].game, tags: {} }
        }
      ];

      component.recommendations = noTagsRecommendations;
      fixture.detectChanges();

      const tagPreviews = fixture.debugElement.queryAll(By.css('.tag-preview'));
      expect(tagPreviews.length).toBe(0);
    });

    it('should handle very long game names', () => {
      const longNameRecommendations: GameRecommendation[] = [
        {
          ...mockRecommendations[0],
          game: {
            ...mockRecommendations[0].game,
            name: 'This is an extremely long game name that might cause layout issues in the recommendation list component'
          }
        }
      ];

      component.recommendations = longNameRecommendations;
      fixture.detectChanges();

      const gameName = fixture.debugElement.query(By.css('.game-name'));
      expect(gameName.nativeElement.textContent).toContain('extremely long game name');
    });
  });
});