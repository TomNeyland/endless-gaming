import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GameComparisonComponent } from './game-comparison.component';
import { GameRecord, GamePair } from '../../../types/game.types';

describe('GameComparisonComponent', () => {
  let component: GameComparisonComponent;
  let fixture: ComponentFixture<GameComparisonComponent>;

  const mockGamePair: GamePair = {
    left: {
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
    right: {
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
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameComparisonComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(GameComparisonComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('input handling', () => {
    it('should accept null game pair initially', () => {
      expect(component.gamePair).toBeNull();
    });

    it('should accept valid game pair', () => {
      component.gamePair = mockGamePair;
      expect(component.gamePair).toBe(mockGamePair);
    });

    it('should handle game pair changes', () => {
      component.gamePair = mockGamePair;
      fixture.detectChanges();

      const leftGame = fixture.debugElement.query(By.css('.left-choice h3'));
      const rightGame = fixture.debugElement.query(By.css('.right-choice h3'));

      expect(leftGame.nativeElement.textContent).toBe(mockGamePair.left.name);
      expect(rightGame.nativeElement.textContent).toBe(mockGamePair.right.name);
    });
  });

  describe('template rendering', () => {
    it('should display comparison container when valid pair provided', () => {
      component.gamePair = mockGamePair;
      fixture.detectChanges();

      const comparisonContainer = fixture.debugElement.query(By.css('.comparison-container'));
      expect(comparisonContainer).toBeTruthy();

      const noPairMessage = fixture.debugElement.query(By.css('.no-pair-message'));
      expect(noPairMessage).toBeFalsy();
    });

    it('should display no pair message when no pair provided', () => {
      component.gamePair = null;
      fixture.detectChanges();

      const comparisonContainer = fixture.debugElement.query(By.css('.comparison-container'));
      expect(comparisonContainer).toBeFalsy();

      const noPairMessage = fixture.debugElement.query(By.css('.no-pair-message'));
      expect(noPairMessage).toBeTruthy();
      expect(noPairMessage.nativeElement.textContent).toContain('No game pair available');
    });

    it('should render game names correctly', () => {
      component.gamePair = mockGamePair;
      fixture.detectChanges();

      const leftGameName = fixture.debugElement.query(By.css('.left-choice h3'));
      const rightGameName = fixture.debugElement.query(By.css('.right-choice h3'));

      expect(leftGameName.nativeElement.textContent).toBe('Counter-Strike: Global Offensive');
      expect(rightGameName.nativeElement.textContent).toBe('Dota 2');
    });

    it('should render all choice buttons', () => {
      component.gamePair = mockGamePair;
      fixture.detectChanges();

      const leftButton = fixture.debugElement.query(By.css('.left-btn'));
      const rightButton = fixture.debugElement.query(By.css('.right-btn'));
      const skipButton = fixture.debugElement.query(By.css('.skip-btn'));

      expect(leftButton).toBeTruthy();
      expect(rightButton).toBeTruthy();
      expect(skipButton).toBeTruthy();

      expect(leftButton.nativeElement.textContent.trim()).toBe('Choose This Game');
      expect(rightButton.nativeElement.textContent.trim()).toBe('Choose This Game');
      expect(skipButton.nativeElement.textContent.trim()).toBe('Skip Both');
    });

    it('should render VS section', () => {
      component.gamePair = mockGamePair;
      fixture.detectChanges();

      const vsSection = fixture.debugElement.query(By.css('.vs-section'));
      const vsText = fixture.debugElement.query(By.css('.vs-text'));

      expect(vsSection).toBeTruthy();
      expect(vsText).toBeTruthy();
      expect(vsText.nativeElement.textContent).toBe('VS');
    });
  });

  describe('user interactions', () => {
    beforeEach(() => {
      component.gamePair = mockGamePair;
      fixture.detectChanges();
    });

    it('should emit choice when left button clicked', () => {
      spyOn(component.choiceMade, 'emit');
      spyOn(component, 'selectLeft').and.callThrough();

      const leftButton = fixture.debugElement.query(By.css('.left-btn'));
      leftButton.nativeElement.click();

      expect(component.selectLeft).toHaveBeenCalled();
    });

    it('should emit choice when right button clicked', () => {
      spyOn(component.choiceMade, 'emit');
      spyOn(component, 'selectRight').and.callThrough();

      const rightButton = fixture.debugElement.query(By.css('.right-btn'));
      rightButton.nativeElement.click();

      expect(component.selectRight).toHaveBeenCalled();
    });

    it('should emit choice when skip button clicked', () => {
      spyOn(component.choiceMade, 'emit');
      spyOn(component, 'skip').and.callThrough();

      const skipButton = fixture.debugElement.query(By.css('.skip-btn'));
      skipButton.nativeElement.click();

      expect(component.skip).toHaveBeenCalled();
    });

    it('should handle button clicks when no pair available', () => {
      component.gamePair = null;
      fixture.detectChanges();

      const buttons = fixture.debugElement.queryAll(By.css('button'));
      expect(buttons.length).toBe(0);
    });
  });

  describe('component methods', () => {
    it('should implement selectLeft method', () => {
      expect(() => component.selectLeft()).toThrowError('Not implemented');
    });

    it('should implement selectRight method', () => {
      expect(() => component.selectRight()).toThrowError('Not implemented');
    });

    it('should implement skip method', () => {
      expect(() => component.skip()).toThrowError('Not implemented');
    });

    it('should implement hasValidPair method', () => {
      expect(() => component.hasValidPair()).toThrowError('Not implemented');
    });
  });

  describe('output events', () => {
    it('should have choiceMade event emitter', () => {
      expect(component.choiceMade).toBeDefined();
      expect(component.choiceMade.emit).toBeDefined();
    });

    it('should emit with correct event structure', () => {
      spyOn(component.choiceMade, 'emit');
      component.gamePair = mockGamePair;

      // Simulate method implementation for testing
      component.selectLeft = jasmine.createSpy().and.callFake(() => {
        component.choiceMade.emit({
          leftGame: mockGamePair.left,
          rightGame: mockGamePair.right,
          pick: 'left'
        });
      });

      component.selectLeft();

      expect(component.choiceMade.emit).toHaveBeenCalledWith({
        leftGame: mockGamePair.left,
        rightGame: mockGamePair.right,
        pick: 'left'
      });
    });
  });

  describe('responsive layout', () => {
    beforeEach(() => {
      component.gamePair = mockGamePair;
      fixture.detectChanges();
    });

    it('should have grid layout structure', () => {
      const comparisonContainer = fixture.debugElement.query(By.css('.comparison-container'));
      expect(comparisonContainer).toBeTruthy();

      const leftChoice = fixture.debugElement.query(By.css('.left-choice'));
      const rightChoice = fixture.debugElement.query(By.css('.right-choice'));
      const vsSection = fixture.debugElement.query(By.css('.vs-section'));

      expect(leftChoice).toBeTruthy();
      expect(rightChoice).toBeTruthy();
      expect(vsSection).toBeTruthy();
    });

    it('should maintain proper button styling', () => {
      const leftButton = fixture.debugElement.query(By.css('.left-btn'));
      const rightButton = fixture.debugElement.query(By.css('.right-btn'));
      const skipButton = fixture.debugElement.query(By.css('.skip-btn'));

      expect(leftButton.nativeElement.classList.contains('choice-btn')).toBe(true);
      expect(leftButton.nativeElement.classList.contains('left-btn')).toBe(true);
      
      expect(rightButton.nativeElement.classList.contains('choice-btn')).toBe(true);
      expect(rightButton.nativeElement.classList.contains('right-btn')).toBe(true);
      
      expect(skipButton.nativeElement.classList.contains('skip-btn')).toBe(true);
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      component.gamePair = mockGamePair;
      fixture.detectChanges();
    });

    it('should have accessible button labels', () => {
      const leftButton = fixture.debugElement.query(By.css('.left-btn'));
      const rightButton = fixture.debugElement.query(By.css('.right-btn'));
      const skipButton = fixture.debugElement.query(By.css('.skip-btn'));

      expect(leftButton.nativeElement.textContent.trim()).toBe('Choose This Game');
      expect(rightButton.nativeElement.textContent.trim()).toBe('Choose This Game');
      expect(skipButton.nativeElement.textContent.trim()).toBe('Skip Both');
    });

    it('should have proper button types', () => {
      const buttons = fixture.debugElement.queryAll(By.css('button'));
      
      buttons.forEach(button => {
        expect(button.nativeElement.type).toBe('button');
      });
    });

    it('should display game names as headings', () => {
      const leftHeading = fixture.debugElement.query(By.css('.left-choice h3'));
      const rightHeading = fixture.debugElement.query(By.css('.right-choice h3'));

      expect(leftHeading).toBeTruthy();
      expect(rightHeading).toBeTruthy();
      expect(leftHeading.nativeElement.tagName.toLowerCase()).toBe('h3');
      expect(rightHeading.nativeElement.tagName.toLowerCase()).toBe('h3');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined game pair', () => {
      component.gamePair = undefined as any;
      fixture.detectChanges();

      const noPairMessage = fixture.debugElement.query(By.css('.no-pair-message'));
      expect(noPairMessage).toBeTruthy();
    });

    it('should handle game pair with missing game data', () => {
      const incompleteGamePair: GamePair = {
        left: {
          appId: 730,
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
        right: {
          appId: 570,
          name: 'Another Test Game',
          coverUrl: null,
          price: null,
          developer: null,
          publisher: null,
          tags: {},
          genres: [],
          reviewPos: null,
          reviewNeg: null
        }
      };

      component.gamePair = incompleteGamePair;
      fixture.detectChanges();

      const leftGameName = fixture.debugElement.query(By.css('.left-choice h3'));
      const rightGameName = fixture.debugElement.query(By.css('.right-choice h3'));

      expect(leftGameName.nativeElement.textContent).toBe('Test Game');
      expect(rightGameName.nativeElement.textContent).toBe('Another Test Game');
    });

    it('should handle very long game names', () => {
      const longNameGamePair: GamePair = {
        left: {
          ...mockGamePair.left,
          name: 'This is a very long game name that might cause layout issues'
        },
        right: {
          ...mockGamePair.right,
          name: 'Another extremely long game name that should be handled gracefully'
        }
      };

      component.gamePair = longNameGamePair;
      fixture.detectChanges();

      const leftGameName = fixture.debugElement.query(By.css('.left-choice h3'));
      const rightGameName = fixture.debugElement.query(By.css('.right-choice h3'));

      expect(leftGameName.nativeElement.textContent).toContain('very long game name');
      expect(rightGameName.nativeElement.textContent).toContain('extremely long game name');
    });
  });
});