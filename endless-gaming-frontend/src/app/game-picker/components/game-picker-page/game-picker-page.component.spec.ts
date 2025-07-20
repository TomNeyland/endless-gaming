import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA, Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { GamePickerPageComponent } from './game-picker-page.component';
import { GamePickerState, GameRecord } from '../../../types/game.types';
import { GameDataService } from '../../services/game-data.service';

// Mock child components to prevent interference
@Component({
  selector: 'app-game-comparison',
  template: '<div class="mock-game-comparison">Mock Game Comparison</div>',
  standalone: false
})
class MockGameComparisonComponent {}

@Component({
  selector: 'app-progress-bar',
  template: '<div class="mock-progress-bar">Mock Progress Bar</div>',
  standalone: false
})
class MockProgressBarComponent {}

@Component({
  selector: 'app-preference-summary',
  template: '<div class="mock-preference-summary">Mock Preference Summary</div>',
  standalone: false
})
class MockPreferenceSummaryComponent {}

@Component({
  selector: 'app-recommendation-list',
  template: '<div class="mock-recommendation-list">Mock Recommendation List</div>',
  standalone: false
})
class MockRecommendationListComponent {}

describe('GamePickerPageComponent', () => {
  let component: GamePickerPageComponent;
  let fixture: ComponentFixture<GamePickerPageComponent>;
  let mockGameDataService: jasmine.SpyObj<GameDataService>;
  let startGamePickerSpy: jasmine.Spy;

  const mockGames: GameRecord[] = [
    {
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
    {
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
  ];

  beforeEach(async () => {
    // Create mock GameDataService
    mockGameDataService = jasmine.createSpyObj('GameDataService', ['getGames']);
    mockGameDataService.getGames.and.returnValue(of(mockGames));

    await TestBed.configureTestingModule({
      imports: [GamePickerPageComponent],
      declarations: [
        MockGameComparisonComponent,
        MockProgressBarComponent,
        MockPreferenceSummaryComponent,
        MockRecommendationListComponent
      ],
      providers: [
        { provide: GameDataService, useValue: mockGameDataService },
        provideHttpClient(),
        provideHttpClientTesting()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(GamePickerPageComponent);
    component = fixture.componentInstance;
    
    // Prevent automatic initialization to allow tests to control state manually
    startGamePickerSpy = spyOn(component, 'startGamePicker');
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
      // Prevent child components from interfering with state changes
      spyOn(component, 'onComparisonsComplete');
      
      component.state.set('comparing');
      fixture.detectChanges();
      
      // Force additional change detection cycles for Angular signals
      fixture.detectChanges();
      
      const comparingElement = fixture.debugElement.query(By.css('.comparison-state'));
      expect(comparingElement).toBeTruthy();
      
      // Check that other states are not rendered
      const loadingElement = fixture.debugElement.query(By.css('.loading-state'));
      const recommendationsElement = fixture.debugElement.query(By.css('.recommendations-state'));
      const errorElement = fixture.debugElement.query(By.css('.error-state'));
      
      expect(loadingElement).toBeFalsy();
      expect(recommendationsElement).toBeFalsy();
      expect(errorElement).toBeFalsy();
    });

    it('should transition to recommendations state', () => {
      component.state.set('recommendations');
      fixture.detectChanges();

      const recommendationsElement = fixture.debugElement.query(By.css('.recommendations-state'));
      const restartButton = fixture.debugElement.query(By.css('.restart-btn'));
      
      expect(recommendationsElement).toBeTruthy();
      expect(restartButton).toBeTruthy();
      
      // Check that other states are not rendered
      const loadingElement = fixture.debugElement.query(By.css('.loading-state'));
      const comparingElement = fixture.debugElement.query(By.css('.comparison-state'));
      const errorElement = fixture.debugElement.query(By.css('.error-state'));
      
      expect(loadingElement).toBeFalsy();
      expect(comparingElement).toBeFalsy();
      expect(errorElement).toBeFalsy();
    });

    it('should display error state', () => {
      component.state.set('error');
      fixture.detectChanges();

      const errorElement = fixture.debugElement.query(By.css('.error-state'));
      const retryButton = fixture.debugElement.query(By.css('.retry-btn'));
      
      expect(errorElement).toBeTruthy();
      expect(retryButton).toBeTruthy();
      
      // Check that other states are not rendered
      const loadingElement = fixture.debugElement.query(By.css('.loading-state'));
      const comparingElement = fixture.debugElement.query(By.css('.comparison-state'));
      const recommendationsElement = fixture.debugElement.query(By.css('.recommendations-state'));
      
      expect(loadingElement).toBeFalsy();
      expect(comparingElement).toBeFalsy();
      expect(recommendationsElement).toBeFalsy();
    });
  });

  describe('user interactions', () => {
    it('should handle retry button click in error state', () => {
      // Reset the spy to ensure it's fresh for this test
      startGamePickerSpy.calls.reset();
      
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
      // Configure the existing spy to call through for this test
      startGamePickerSpy.and.callThrough();
      startGamePickerSpy.calls.reset();
      
      component.startGamePicker();
      
      expect(component.startGamePicker).toHaveBeenCalled();
      // Since the mock GameDataService returns data immediately,
      // the component transitions from 'loading' to 'comparing'
      expect(component.state()).toBe('comparing');
    });

    it('should implement onStartComparisons method', () => {
      component.onStartComparisons();
      
      expect(component.state()).toBe('comparing');
    });

    it('should implement onComparisonsComplete method', () => {
      component.onComparisonsComplete();
      
      expect(component.state()).toBe('recommendations');
    });

    it('should implement resetGamePicker method', () => {
      component.resetGamePicker();
      
      expect(component.state()).toBe('comparing');
    });

    it('should implement onError method', () => {
      const error = new Error('Test error');
      
      component.onError(error);
      
      expect(component.state()).toBe('error');
      expect(component.getErrorMessage()).toBe('Test error');
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
      // Prevent child components from interfering with state changes
      spyOn(component, 'onComparisonsComplete');
      
      component.state.set('comparing');
      fixture.detectChanges();
      
      // Force additional change detection cycles for Angular signals
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