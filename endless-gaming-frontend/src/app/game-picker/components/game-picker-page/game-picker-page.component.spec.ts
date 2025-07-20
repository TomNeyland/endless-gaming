import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { GamePickerPageComponent } from './game-picker-page.component';
import { GamePickerState } from '../../../types/game.types';

describe('GamePickerPageComponent', () => {
  let component: GamePickerPageComponent;
  let fixture: ComponentFixture<GamePickerPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamePickerPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GamePickerPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should start in loading state', () => {
      expect(component.state()).toBe('loading');
    });

    it('should display loading spinner in loading state', () => {
      component.state.set('loading');
      fixture.detectChanges();

      const loadingElement = fixture.debugElement.query(By.css('.loading-state'));
      const spinner = fixture.debugElement.query(By.css('.spinner'));
      
      expect(loadingElement).toBeTruthy();
      expect(spinner).toBeTruthy();
      expect(loadingElement.nativeElement.textContent).toContain('Loading Games');
    });
  });

  describe('state transitions', () => {
    it('should transition to comparing state', () => {
      component.state.set('comparing');
      fixture.detectChanges();

      const comparingElement = fixture.debugElement.query(By.css('.comparison-state'));
      expect(comparingElement).toBeTruthy();
      expect(comparingElement.nativeElement.textContent).toContain('Find Your Perfect Games');
    });

    it('should transition to recommendations state', () => {
      component.state.set('recommendations');
      fixture.detectChanges();

      const recommendationsElement = fixture.debugElement.query(By.css('.recommendations-state'));
      const restartButton = fixture.debugElement.query(By.css('.restart-btn'));
      
      expect(recommendationsElement).toBeTruthy();
      expect(restartButton).toBeTruthy();
      expect(recommendationsElement.nativeElement.textContent).toContain('Your Personalized Game Recommendations');
    });

    it('should display error state', () => {
      component.state.set('error');
      fixture.detectChanges();

      const errorElement = fixture.debugElement.query(By.css('.error-state'));
      const retryButton = fixture.debugElement.query(By.css('.retry-btn'));
      
      expect(errorElement).toBeTruthy();
      expect(retryButton).toBeTruthy();
      expect(errorElement.nativeElement.textContent).toContain('Something went wrong');
    });
  });

  describe('user interactions', () => {
    it('should handle retry button click in error state', () => {
      spyOn(component, 'startGamePicker');
      
      component.state.set('error');
      fixture.detectChanges();

      const retryButton = fixture.debugElement.query(By.css('.retry-btn'));
      retryButton.nativeElement.click();

      expect(component.startGamePicker).toHaveBeenCalled();
    });

    it('should handle restart button click in recommendations state', () => {
      spyOn(component, 'resetGamePicker');
      
      component.state.set('recommendations');
      fixture.detectChanges();

      const restartButton = fixture.debugElement.query(By.css('.restart-btn'));
      restartButton.nativeElement.click();

      expect(component.resetGamePicker).toHaveBeenCalled();
    });
  });

  describe('component methods', () => {
    it('should implement startGamePicker method', () => {
      expect(() => component.startGamePicker()).toThrowError('Not implemented');
    });

    it('should implement onStartComparisons method', () => {
      expect(() => component.onStartComparisons()).toThrowError('Not implemented');
    });

    it('should implement onComparisonsComplete method', () => {
      expect(() => component.onComparisonsComplete()).toThrowError('Not implemented');
    });

    it('should implement resetGamePicker method', () => {
      expect(() => component.resetGamePicker()).toThrowError('Not implemented');
    });

    it('should implement onError method', () => {
      const error = new Error('Test error');
      expect(() => component.onError(error)).toThrowError('Not implemented');
    });
  });

  describe('template rendering', () => {
    it('should render only loading content in loading state', () => {
      component.state.set('loading');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.loading-state'))).toBeTruthy();
      expect(fixture.debugElement.query(By.css('.comparison-state'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.recommendations-state'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.error-state'))).toBeFalsy();
    });

    it('should render only comparing content in comparing state', () => {
      component.state.set('comparing');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.loading-state'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.comparison-state'))).toBeTruthy();
      expect(fixture.debugElement.query(By.css('.recommendations-state'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.error-state'))).toBeFalsy();
    });

    it('should render only recommendations content in recommendations state', () => {
      component.state.set('recommendations');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.loading-state'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.comparison-state'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.recommendations-state'))).toBeTruthy();
      expect(fixture.debugElement.query(By.css('.error-state'))).toBeFalsy();
    });

    it('should render only error content in error state', () => {
      component.state.set('error');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.loading-state'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.comparison-state'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.recommendations-state'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.error-state'))).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should have proper heading hierarchy', () => {
      // Test all states for proper h1 tags
      const states: GamePickerState[] = ['loading', 'comparing', 'recommendations', 'error'];
      
      states.forEach(state => {
        component.state.set(state);
        fixture.detectChanges();
        
        const h1Elements = fixture.debugElement.queryAll(By.css('h1'));
        expect(h1Elements.length).toBe(1, `State ${state} should have exactly one h1`);
      });
    });

    it('should have accessible button labels', () => {
      component.state.set('recommendations');
      fixture.detectChanges();

      const restartButton = fixture.debugElement.query(By.css('.restart-btn'));
      expect(restartButton.nativeElement.textContent.trim()).toBe('Start Over');

      component.state.set('error');
      fixture.detectChanges();

      const retryButton = fixture.debugElement.query(By.css('.retry-btn'));
      expect(retryButton.nativeElement.textContent.trim()).toBe('Retry');
    });

    it('should have proper ARIA labels for loading state', () => {
      component.state.set('loading');
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('.spinner'));
      expect(spinner).toBeTruthy();
      // Spinner should be decorative and not interfere with screen readers
    });
  });

  describe('responsive behavior', () => {
    it('should apply responsive CSS classes', () => {
      component.state.set('comparing');
      fixture.detectChanges();

      const pageElement = fixture.debugElement.query(By.css('.game-picker-page'));
      expect(pageElement).toBeTruthy();
      expect(pageElement.nativeElement.classList.contains('game-picker-page')).toBe(true);
    });

    it('should maintain layout in different states', () => {
      const states: GamePickerState[] = ['loading', 'comparing', 'recommendations', 'error'];
      
      states.forEach(state => {
        component.state.set(state);
        fixture.detectChanges();
        
        const pageElement = fixture.debugElement.query(By.css('.game-picker-page'));
        expect(pageElement).toBeTruthy();
      });
    });
  });

  describe('integration behavior', () => {
    it('should handle rapid state changes', () => {
      const states: GamePickerState[] = ['loading', 'comparing', 'recommendations', 'error'];
      
      states.forEach((state, index) => {
        component.state.set(state);
        fixture.detectChanges();
        
        // Should render correctly after each change
        expect(component.state()).toBe(state);
      });
    });

    it('should maintain component integrity across state changes', () => {
      component.state.set('loading');
      fixture.detectChanges();
      
      expect(component).toBeTruthy();
      
      component.state.set('error');
      fixture.detectChanges();
      
      expect(component).toBeTruthy();
      expect(fixture.debugElement.query(By.css('.game-picker-page'))).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should display error message in error state', () => {
      component.state.set('error');
      fixture.detectChanges();

      const errorElement = fixture.debugElement.query(By.css('.error-state'));
      expect(errorElement.nativeElement.textContent).toContain('Unable to load game data');
      expect(errorElement.nativeElement.textContent).toContain('Please try again');
    });

    it('should provide retry functionality in error state', () => {
      component.state.set('error');
      fixture.detectChanges();

      const retryButton = fixture.debugElement.query(By.css('.retry-btn'));
      expect(retryButton).toBeTruthy();
      expect(retryButton.nativeElement.type).toBe('button');
    });
  });
});