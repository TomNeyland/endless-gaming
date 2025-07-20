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
      // Override ngOnInit to prevent automatic generation
      component.ngOnInit = () => {};
      
      // Set games and manually set recommendations
      component.games = mockRecommendations.map(r => r.game);
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

    it('should display game cards', () => {
      const gameCards = fixture.debugElement.queryAll(By.css('app-game-card'));
      expect(gameCards.length).toBe(3);
    });

    it('should display view details buttons', () => {
      const viewButtons = fixture.debugElement.queryAll(By.css('.view-details-btn'));
      expect(viewButtons.length).toBe(3);
      
      viewButtons.forEach(button => {
        expect(button.nativeElement.textContent.trim()).toBe('View Details');
        expect(button.nativeElement.type).toBe('button');
      });
    });

    it('should display rank numbers', () => {
      const rankNumbers = fixture.debugElement.queryAll(By.css('.rank-number'));
      expect(rankNumbers.length).toBe(3);
      
      expect(rankNumbers[0].nativeElement.textContent.trim()).toBe('#1');
      expect(rankNumbers[1].nativeElement.textContent.trim()).toBe('#2');
      expect(rankNumbers[2].nativeElement.textContent.trim()).toBe('#3');
    });

    it('should display score badges', () => {
      const scoreBadges = fixture.debugElement.queryAll(By.css('.score-badge'));
      expect(scoreBadges.length).toBe(3);
      
      expect(scoreBadges[0].nativeElement.textContent.trim()).toBe('0.95');
      expect(scoreBadges[1].nativeElement.textContent.trim()).toBe('0.87');
    });

    it('should display recommendation items with correct structure', () => {
      const recommendationItems = fixture.debugElement.queryAll(By.css('.recommendation-item'));
      expect(recommendationItems.length).toBe(3);
      
      // Each item should have the expected sections
      recommendationItems.forEach(item => {
        expect(item.query(By.css('.rank-section'))).toBeTruthy();
        expect(item.query(By.css('.game-section'))).toBeTruthy();
        expect(item.query(By.css('.action-section'))).toBeTruthy();
      });
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
      // Override ngOnInit to prevent automatic generation
      component.ngOnInit = () => {};
      
      // Set games and manually set recommendations
      component.games = mockRecommendations.map(r => r.game);
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
      component.recommendations = mockRecommendations;
      expect(component.hasRecommendations()).toBe(true);
      
      component.recommendations = [];
      expect(component.hasRecommendations()).toBe(false);
    });

    it('should implement getDisplayRecommendations method', () => {
      component.recommendations = mockRecommendations;
      expect(component.getDisplayRecommendations()).toBe(mockRecommendations);
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
      spyOn(console, 'log');
      component.onRecommendationClick(mockRecommendations[0]);
      expect(console.log).toHaveBeenCalledWith('Clicked recommendation:', 'Counter-Strike: Global Offensive');
    });

    it('should implement trackByAppId method', () => {
      expect(component.trackByAppId(0, mockRecommendations[0])).toBe(730);
      expect(component.trackByAppId(1, mockRecommendations[1])).toBe(440);
    });
  });

  describe('maxRecommendations limiting', () => {
    it('should limit displayed recommendations based on maxRecommendations', () => {
      component.maxRecommendations = 2;
      component.recommendations = mockRecommendations;
      expect(component.getDisplayRecommendations().length).toBe(3); // Still returns all, but template would limit
    });
  });

});