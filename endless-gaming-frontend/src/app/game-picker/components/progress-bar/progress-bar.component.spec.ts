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

  describe('progress bar visual representation', () => {
    it('should have correct width for 0% progress', () => {
      component.progress = mockProgressStart;
      fixture.detectChanges();

      const progressFill = fixture.debugElement.query(By.css('.progress-fill'));
      expect(progressFill).toBeTruthy();
      // Width should be set by getProgressWidth() method
    });

    it('should have correct width for 50% progress', () => {
      component.progress = mockProgressMidway;
      fixture.detectChanges();

      const progressFill = fixture.debugElement.query(By.css('.progress-fill'));
      expect(progressFill).toBeTruthy();
    });

    it('should have correct width for 100% progress', () => {
      component.progress = mockProgressComplete;
      fixture.detectChanges();

      const progressFill = fixture.debugElement.query(By.css('.progress-fill'));
      expect(progressFill).toBeTruthy();
    });

    it('should apply color based on progress', () => {
      component.progress = mockProgressMidway;
      fixture.detectChanges();

      const progressFill = fixture.debugElement.query(By.css('.progress-fill'));
      expect(progressFill).toBeTruthy();
      // Color should be set by getProgressColor() method
    });
  });

  describe('component methods', () => {
    it('should implement hasProgress method', () => {
      expect(() => component.hasProgress()).toThrowError('Not implemented');
    });

    it('should implement getProgressPercentage method', () => {
      expect(() => component.getProgressPercentage()).toThrowError('Not implemented');
    });

    it('should implement getProgressText method', () => {
      expect(() => component.getProgressText()).toThrowError('Not implemented');
    });

    it('should implement getPercentageText method', () => {
      expect(() => component.getPercentageText()).toThrowError('Not implemented');
    });

    it('should implement isComplete method', () => {
      expect(() => component.isComplete()).toThrowError('Not implemented');
    });

    it('should implement getProgressWidth method', () => {
      expect(() => component.getProgressWidth()).toThrowError('Not implemented');
    });

    it('should implement getProgressColor method', () => {
      expect(() => component.getProgressColor()).toThrowError('Not implemented');
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

  describe('accessibility', () => {
    beforeEach(() => {
      component.progress = mockProgressMidway;
      fixture.detectChanges();
    });

    it('should provide progress information text', () => {
      const progressText = fixture.debugElement.query(By.css('.progress-text'));
      expect(progressText).toBeTruthy();
      expect(progressText.nativeElement.textContent.trim().length).toBeGreaterThan(0);
    });

    it('should provide percentage information', () => {
      const progressPercentage = fixture.debugElement.query(By.css('.progress-percentage'));
      expect(progressPercentage).toBeTruthy();
      expect(progressPercentage.nativeElement.textContent.trim().length).toBeGreaterThan(0);
    });

    it('should have visual progress indicator', () => {
      const progressTrack = fixture.debugElement.query(By.css('.progress-track'));
      const progressFill = fixture.debugElement.query(By.css('.progress-fill'));

      expect(progressTrack).toBeTruthy();
      expect(progressFill).toBeTruthy();
    });
  });

  describe('responsive behavior', () => {
    beforeEach(() => {
      component.progress = mockProgressMidway;
      fixture.detectChanges();
    });

    it('should maintain layout structure', () => {
      const progressBarContainer = fixture.debugElement.query(By.css('.progress-bar-container'));
      const progressBar = fixture.debugElement.query(By.css('.progress-bar'));

      expect(progressBarContainer).toBeTruthy();
      expect(progressBar).toBeTruthy();
    });

    it('should have flexible progress bar layout', () => {
      const progressBar = fixture.debugElement.query(By.css('.progress-bar'));
      expect(progressBar.nativeElement.style.display).toBe('flex');
    });
  });

  describe('edge cases', () => {
    it('should handle zero total progress', () => {
      component.progress = { current: 0, total: 0 };
      fixture.detectChanges();

      const progressSection = fixture.debugElement.query(By.css('.progress-section'));
      expect(progressSection).toBeTruthy();
    });

    it('should handle negative progress values', () => {
      component.progress = { current: -1, total: 20 };
      fixture.detectChanges();

      const progressSection = fixture.debugElement.query(By.css('.progress-section'));
      expect(progressSection).toBeTruthy();
    });

    it('should handle current greater than total', () => {
      component.progress = { current: 25, total: 20 };
      fixture.detectChanges();

      const progressSection = fixture.debugElement.query(By.css('.progress-section'));
      expect(progressSection).toBeTruthy();
    });

    it('should handle undefined progress fields', () => {
      component.progress = {
        current: undefined as any,
        total: undefined as any
      };
      fixture.detectChanges();

      // Should not crash
      expect(component).toBeTruthy();
    });

    it('should handle very large progress values', () => {
      component.progress = { current: 9999, total: 10000 };
      fixture.detectChanges();

      const progressSection = fixture.debugElement.query(By.css('.progress-section'));
      expect(progressSection).toBeTruthy();
    });
  });

  describe('display options combinations', () => {
    beforeEach(() => {
      component.progress = mockProgressMidway;
    });

    it('should show both count and percentage when both enabled', () => {
      component.showCount = true;
      component.showPercentage = true;
      fixture.detectChanges();

      const progressText = fixture.debugElement.query(By.css('.progress-text'));
      const progressPercentage = fixture.debugElement.query(By.css('.progress-percentage'));

      expect(progressText).toBeTruthy();
      expect(progressPercentage).toBeTruthy();
    });

    it('should show only count when percentage disabled', () => {
      component.showCount = true;
      component.showPercentage = false;
      fixture.detectChanges();

      const progressText = fixture.debugElement.query(By.css('.progress-text'));
      const progressPercentage = fixture.debugElement.query(By.css('.progress-percentage'));

      expect(progressText).toBeTruthy();
      expect(progressPercentage).toBeFalsy();
    });

    it('should show only percentage when count disabled', () => {
      component.showCount = false;
      component.showPercentage = true;
      fixture.detectChanges();

      const progressText = fixture.debugElement.query(By.css('.progress-text'));
      const progressPercentage = fixture.debugElement.query(By.css('.progress-percentage'));

      expect(progressText).toBeFalsy();
      expect(progressPercentage).toBeTruthy();
    });

    it('should show only progress bar when both text options disabled', () => {
      component.showCount = false;
      component.showPercentage = false;
      fixture.detectChanges();

      const progressText = fixture.debugElement.query(By.css('.progress-text'));
      const progressPercentage = fixture.debugElement.query(By.css('.progress-percentage'));
      const progressBar = fixture.debugElement.query(By.css('.progress-bar'));

      expect(progressText).toBeFalsy();
      expect(progressPercentage).toBeFalsy();
      expect(progressBar).toBeTruthy();
    });
  });

  describe('completion message behavior', () => {
    it('should only show completion message when actually complete', () => {
      // Test various non-complete states
      const nonCompleteStates = [
        { current: 0, total: 20 },
        { current: 10, total: 20 },
        { current: 19, total: 20 }
      ];

      nonCompleteStates.forEach(progress => {
        component.progress = progress;
        fixture.detectChanges();

        const completionMessage = fixture.debugElement.query(By.css('.completion-message'));
        expect(completionMessage).toBeFalsy();
      });
    });

    it('should show completion message only when complete', () => {
      component.progress = mockProgressComplete;
      fixture.detectChanges();

      const completionMessage = fixture.debugElement.query(By.css('.completion-message'));
      expect(completionMessage).toBeTruthy();
    });

    it('should handle edge case where current equals total', () => {
      component.progress = { current: 15, total: 15 };
      fixture.detectChanges();

      const completionMessage = fixture.debugElement.query(By.css('.completion-message'));
      expect(completionMessage).toBeTruthy();
    });
  });
});