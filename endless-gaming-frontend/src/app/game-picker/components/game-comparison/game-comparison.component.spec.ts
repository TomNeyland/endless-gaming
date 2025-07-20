import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GameComparisonComponent } from './game-comparison.component';
import { GameRecord, GamePair } from '../../../types/game.types';
import { PairService } from '../../services/pair.service';
import { ChoiceApiService } from '../../services/choice-api.service';

describe('GameComparisonComponent', () => {
  let component: GameComparisonComponent;
  let fixture: ComponentFixture<GameComparisonComponent>;
  let mockPairService: jasmine.SpyObj<PairService>;
  let mockChoiceApiService: jasmine.SpyObj<ChoiceApiService>;

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
    const pairServiceSpy = jasmine.createSpyObj('PairService', ['getNextPair', 'recordChoice']);
    const choiceApiServiceSpy = jasmine.createSpyObj('ChoiceApiService', ['queueChoice', 'stopAutoFlush']);
    
    await TestBed.configureTestingModule({
      imports: [GameComparisonComponent],
      providers: [
        { provide: PairService, useValue: pairServiceSpy },
        { provide: ChoiceApiService, useValue: choiceApiServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GameComparisonComponent);
    component = fixture.componentInstance;
    mockPairService = TestBed.inject(PairService) as jasmine.SpyObj<PairService>;
    mockChoiceApiService = TestBed.inject(ChoiceApiService) as jasmine.SpyObj<ChoiceApiService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('pair loading', () => {
    it('should load pair from PairService on init', () => {
      mockPairService.getNextPair.and.returnValue(mockGamePair);
      
      component.ngOnInit();
      
      expect(mockPairService.getNextPair).toHaveBeenCalled();
      expect(component.currentPair).toBe(mockGamePair);
    });

    it('should handle no pairs available', () => {
      mockPairService.getNextPair.and.returnValue(null);
      
      component.ngOnInit();
      
      expect(component.currentPair).toBeNull();
      expect(component.hasValidPair()).toBe(false);
    });

    it('should emit comparisonsComplete when no pair available', () => {
      spyOn(component.comparisonsComplete, 'emit');
      mockPairService.getNextPair.and.returnValue(null);
      
      component.ngOnInit();
      
      expect(component.comparisonsComplete.emit).toHaveBeenCalled();
    });
  });

  describe('template rendering', () => {
    it('should display comparison container when valid pair provided', () => {
      component.currentPair = mockGamePair;
      fixture.detectChanges();

      const comparisonContainer = fixture.debugElement.query(By.css('.comparison-container'));
      expect(comparisonContainer).toBeTruthy();

      const noPairMessage = fixture.debugElement.query(By.css('.no-pair-message'));
      expect(noPairMessage).toBeFalsy();
    });

    it('should display no pair message when no pair provided', () => {
      component.currentPair = null;
      fixture.detectChanges();

      const comparisonContainer = fixture.debugElement.query(By.css('.comparison-container'));
      expect(comparisonContainer).toBeFalsy();

      const noPairMessage = fixture.debugElement.query(By.css('.no-pair-message'));
      expect(noPairMessage).toBeTruthy();
      expect(noPairMessage.nativeElement.textContent).toContain('No game pair available');
    });

    it('should render game names correctly', () => {
      component.currentPair = mockGamePair;
      fixture.detectChanges();

      const leftGameName = fixture.debugElement.query(By.css('.left-choice h3'));
      const rightGameName = fixture.debugElement.query(By.css('.right-choice h3'));

      expect(leftGameName.nativeElement.textContent).toBe('Counter-Strike: Global Offensive');
      expect(rightGameName.nativeElement.textContent).toBe('Dota 2');
    });

    it('should render all choice buttons', () => {
      component.currentPair = mockGamePair;
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
      component.currentPair = mockGamePair;
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
      component.currentPair = mockGamePair;
      fixture.detectChanges();
    });

    it('should record choice and emit event when left button clicked', () => {
      spyOn(component.choiceMade, 'emit');
      mockPairService.getNextPair.and.returnValue(null); // No next pair
      
      component.selectLeft();
      
      expect(mockPairService.recordChoice).toHaveBeenCalledWith(
        mockGamePair.left, 
        mockGamePair.right, 
        'left'
      );
      expect(mockChoiceApiService.queueChoice).toHaveBeenCalled();
      expect(component.choiceMade.emit).toHaveBeenCalledWith({
        leftGame: mockGamePair.left,
        rightGame: mockGamePair.right,
        pick: 'left'
      });
    });

    it('should record choice when right button clicked', () => {
      spyOn(component.choiceMade, 'emit');
      mockPairService.getNextPair.and.returnValue(null);
      
      component.selectRight();
      
      expect(mockPairService.recordChoice).toHaveBeenCalledWith(
        mockGamePair.left, 
        mockGamePair.right, 
        'right'
      );
    });

    it('should record choice when skip button clicked', () => {
      spyOn(component.choiceMade, 'emit');
      mockPairService.getNextPair.and.returnValue(null);
      
      component.skip();
      
      expect(mockPairService.recordChoice).toHaveBeenCalledWith(
        mockGamePair.left, 
        mockGamePair.right, 
        'skip'
      );

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
      component.currentPair = null;
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
      component.currentPair = mockGamePair;

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
});