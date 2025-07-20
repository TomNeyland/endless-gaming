import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProgressBarComponent } from './progress-bar.component';
import { ProgressInfo } from '../../../types/game.types';

describe('ProgressBarComponent', () => {
  let component: ProgressBarComponent;
  let fixture: ComponentFixture<ProgressBarComponent>;

  const mockProgressStart: ProgressInfo = {
    current: 0,
    total: 20
  };

  const mockProgressMidway: ProgressInfo = {
    current: 10,
    total: 20
  };

  const mockProgressComplete: ProgressInfo = {
    current: 20,
    total: 20
  };

  const mockProgressPartial: ProgressInfo = {
    current: 7,
    total: 20
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressBarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressBarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('input handling', () => {
    it('should accept null progress initially', () => {
      expect(component.progress).toBeNull();
    });

    it('should accept valid progress data', () => {
      component.progress = mockProgressStart;
      expect(component.progress).toBe(mockProgressStart);
    });

    it('should handle showPercentage input', () => {
      component.showPercentage = false;
      expect(component.showPercentage).toBe(false);
    });

    it('should handle showCount input', () => {
      component.showCount = false;
      expect(component.showCount).toBe(false);
    });

    it('should use default input values', () => {
      expect(component.showPercentage).toBe(true);
      expect(component.showCount).toBe(true);
    });
  });

  describe('template rendering with progress', () => {
    beforeEach(() => {
      component.progress = mockProgressMidway;
      fixture.detectChanges();
    });

    it('should display progress section when progress available', () => {
      const progressSection = fixture.debugElement.query(By.css('.progress-section'));
      const noProgress = fixture.debugElement.query(By.css('.no-progress'));

      expect(progressSection).toBeTruthy();
      expect(noProgress).toBeFalsy();
    });

    it('should display progress text when showCount is true', () => {
      component.showCount = true;
      fixture.detectChanges();

      const progressText = fixture.debugElement.query(By.css('.progress-text'));
      expect(progressText).toBeTruthy();
    });

    it('should hide progress text when showCount is false', () => {
      component.showCount = false;
      fixture.detectChanges();

      const progressText = fixture.debugElement.query(By.css('.progress-text'));
      expect(progressText).toBeFalsy();
    });

    it('should display progress bar elements', () => {
      const progressBar = fixture.debugElement.query(By.css('.progress-bar'));
      const progressTrack = fixture.debugElement.query(By.css('.progress-track'));
      const progressFill = fixture.debugElement.query(By.css('.progress-fill'));

      expect(progressBar).toBeTruthy();
      expect(progressTrack).toBeTruthy();
      expect(progressFill).toBeTruthy();
    });

    it('should display percentage when showPercentage is true', () => {
      component.showPercentage = true;
      fixture.detectChanges();

      const progressPercentage = fixture.debugElement.query(By.css('.progress-percentage'));
      expect(progressPercentage).toBeTruthy();
    });

    it('should hide percentage when showPercentage is false', () => {
      component.showPercentage = false;
      fixture.detectChanges();

      const progressPercentage = fixture.debugElement.query(By.css('.progress-percentage'));
      expect(progressPercentage).toBeFalsy();
    });

    it('should not display completion message when not complete', () => {
      const completionMessage = fixture.debugElement.query(By.css('.completion-message'));
      expect(completionMessage).toBeFalsy();
    });
  });

  describe('template rendering without progress', () => {
    beforeEach(() => {
      component.progress = null;
      fixture.detectChanges();
    });

    it('should display no progress message when progress is null', () => {
      const progressSection = fixture.debugElement.query(By.css('.progress-section'));
      const noProgress = fixture.debugElement.query(By.css('.no-progress'));

      expect(progressSection).toBeFalsy();
      expect(noProgress).toBeTruthy();
      expect(noProgress.nativeElement.textContent).toContain('Progress not available');
    });
  });

  describe('completion state', () => {
    beforeEach(() => {
      component.progress = mockProgressComplete;
      fixture.detectChanges();
    });

    it('should display completion message when progress is complete', () => {
      const completionMessage = fixture.debugElement.query(By.css('.completion-message'));
      expect(completionMessage).toBeTruthy();
      expect(completionMessage.nativeElement.textContent).toContain('Comparisons Complete!');
    });

    it('should display checkmark in completion message', () => {
      const checkmark = fixture.debugElement.query(By.css('.checkmark'));
      expect(checkmark).toBeTruthy();
      expect(checkmark.nativeElement.textContent.trim()).toBe('✓');
    });
  });

  describe('component methods', () => {
    it('should implement hasProgress method', () => {
      component.progress = null;
      expect(component.hasProgress()).toBe(false);
      
      component.progress = mockProgressMidway;
      expect(component.hasProgress()).toBe(true);
    });

    it('should implement getProgressPercentage method', () => {
      component.progress = mockProgressMidway; // 10/20 = 50%
      expect(component.getProgressPercentage()).toBe(50);
      
      component.progress = mockProgressComplete; // 20/20 = 100%
      expect(component.getProgressPercentage()).toBe(100);
    });

    it('should implement getProgressText method', () => {
      component.progress = mockProgressMidway;
      expect(component.getProgressText()).toBe('10 / 20 comparisons');
      
      component.progress = null;
      expect(component.getProgressText()).toBe('No progress data');
    });

    it('should implement getPercentageText method', () => {
      component.progress = mockProgressMidway;
      expect(component.getPercentageText()).toBe('50%');
      
      component.progress = mockProgressComplete;
      expect(component.getPercentageText()).toBe('100%');
    });

    it('should implement isComplete method', () => {
      component.progress = mockProgressMidway;
      expect(component.isComplete()).toBe(false);
      
      component.progress = mockProgressComplete;
      expect(component.isComplete()).toBe(true);
    });
  });

  describe('various progress states', () => {
    it('should handle early progress state', () => {
      component.progress = { current: 2, total: 20 };
      fixture.detectChanges();

      const progressSection = fixture.debugElement.query(By.css('.progress-section'));
      expect(progressSection).toBeTruthy();
    });

    it('should handle mid progress state', () => {
      component.progress = mockProgressMidway;
      fixture.detectChanges();

      const progressSection = fixture.debugElement.query(By.css('.progress-section'));
      expect(progressSection).toBeTruthy();
    });

    it('should handle late progress state', () => {
      component.progress = { current: 18, total: 20 };
      fixture.detectChanges();

      const progressSection = fixture.debugElement.query(By.css('.progress-section'));
      expect(progressSection).toBeTruthy();
    });

    it('should handle complete progress state', () => {
      component.progress = mockProgressComplete;
      fixture.detectChanges();

      const progressSection = fixture.debugElement.query(By.css('.progress-section'));
      const completionMessage = fixture.debugElement.query(By.css('.completion-message'));
      
      expect(progressSection).toBeTruthy();
      expect(completionMessage).toBeTruthy();
    });
  });


});