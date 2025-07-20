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
});