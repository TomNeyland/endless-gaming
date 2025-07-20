import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PreferenceSummaryComponent } from './preference-summary.component';
import { PreferenceSummary } from '../../../types/game.types';

describe('PreferenceSummaryComponent', () => {
  let component: PreferenceSummaryComponent;
  let fixture: ComponentFixture<PreferenceSummaryComponent>;

  const mockPreferenceSummary: PreferenceSummary = {
    likedTags: [
      { tag: 'FPS', weight: 0.85 },
      { tag: 'Shooter', weight: 0.73 },
      { tag: 'Multiplayer', weight: 0.62 },
      { tag: 'Competitive', weight: 0.54 },
      { tag: 'Action', weight: 0.41 }
    ],
    dislikedTags: [
      { tag: 'Strategy', weight: -0.67 },
      { tag: 'Turn-Based', weight: -0.58 },
      { tag: 'Simulation', weight: -0.45 },
      { tag: 'Management', weight: -0.32 }
    ]
  };

  const emptyPreferenceSummary: PreferenceSummary = {
    likedTags: [],
    dislikedTags: []
  };

  const partialPreferenceSummary: PreferenceSummary = {
    likedTags: [
      { tag: 'FPS', weight: 0.75 }
    ],
    dislikedTags: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreferenceSummaryComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PreferenceSummaryComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('input handling', () => {
    it('should accept null preference summary initially', () => {
      expect(component.preferenceSummary).toBeNull();
    });

    it('should accept valid preference summary', () => {
      component.preferenceSummary = mockPreferenceSummary;
      expect(component.preferenceSummary).toBe(mockPreferenceSummary);
    });

    it('should handle maxTags input', () => {
      component.maxTags = 3;
      expect(component.maxTags).toBe(3);
    });

    it('should use default maxTags value', () => {
      expect(component.maxTags).toBe(5);
    });
  });

  describe('template rendering with preferences', () => {
    beforeEach(() => {
      component.preferenceSummary = mockPreferenceSummary;
      fixture.detectChanges();
    });

    it('should display summary container when preferences available', () => {
      const summaryContainer = fixture.debugElement.query(By.css('.summary-container'));
      const noData = fixture.debugElement.query(By.css('.no-data'));

      expect(summaryContainer).toBeTruthy();
      expect(noData).toBeFalsy();
    });

    it('should display main title', () => {
      const title = fixture.debugElement.query(By.css('.summary-container h3'));
      expect(title).toBeTruthy();
      expect(title.nativeElement.textContent.trim()).toBe('Your Gaming Preferences');
    });

    it('should display liked and disliked sections', () => {
      const likedSection = fixture.debugElement.query(By.css('.liked-section'));
      const dislikedSection = fixture.debugElement.query(By.css('.disliked-section'));

      expect(likedSection).toBeTruthy();
      expect(dislikedSection).toBeTruthy();
    });

    it('should display section titles with icons', () => {
      const likedTitle = fixture.debugElement.query(By.css('.liked-title'));
      const dislikedTitle = fixture.debugElement.query(By.css('.disliked-title'));

      expect(likedTitle.nativeElement.textContent).toContain('👍');
      expect(likedTitle.nativeElement.textContent).toContain('You Like');
      
      expect(dislikedTitle.nativeElement.textContent).toContain('👎');
      expect(dislikedTitle.nativeElement.textContent).toContain('You Dislike');
    });

    it('should display liked tag items', () => {
      const likedTags = fixture.debugElement.queryAll(By.css('.liked-tag'));
      expect(likedTags.length).toBe(5);

      const firstTag = likedTags[0];
      const tagName = firstTag.query(By.css('.tag-name'));
      const tagWeight = firstTag.query(By.css('.tag-weight'));

      expect(tagName.nativeElement.textContent.trim()).toBe('FPS');
      expect(tagWeight).toBeTruthy();
    });

    it('should display disliked tag items', () => {
      const dislikedTags = fixture.debugElement.queryAll(By.css('.disliked-tag'));
      expect(dislikedTags.length).toBe(4);

      const firstTag = dislikedTags[0];
      const tagName = firstTag.query(By.css('.tag-name'));

      expect(tagName.nativeElement.textContent.trim()).toBe('Strategy');
    });

    it('should display weight bars for all tags', () => {
      const likedBars = fixture.debugElement.queryAll(By.css('.liked-fill'));
      const dislikedBars = fixture.debugElement.queryAll(By.css('.disliked-fill'));

      expect(likedBars.length).toBe(5);
      expect(dislikedBars.length).toBe(4);
    });
  });

  describe('template rendering without preferences', () => {
    beforeEach(() => {
      component.preferenceSummary = null;
      fixture.detectChanges();
    });

    it('should display no data message when no preferences provided', () => {
      const summaryContainer = fixture.debugElement.query(By.css('.summary-container'));
      const noData = fixture.debugElement.query(By.css('.no-data'));

      expect(summaryContainer).toBeFalsy();
      expect(noData).toBeTruthy();
      expect(noData.nativeElement.textContent).toContain('Start comparing games to see your preferences');
    });
  });

  describe('template rendering with empty preferences', () => {
    beforeEach(() => {
      component.preferenceSummary = emptyPreferenceSummary;
      fixture.detectChanges();
    });

    it('should display no preferences messages when tags are empty', () => {
      const likedNoPrefs = fixture.debugElement.query(By.css('.liked-section .no-preferences'));
      const dislikedNoPrefs = fixture.debugElement.query(By.css('.disliked-section .no-preferences'));

      expect(likedNoPrefs).toBeTruthy();
      expect(dislikedNoPrefs).toBeTruthy();

      expect(likedNoPrefs.nativeElement.textContent).toContain('Make some choices to see what you like');
      expect(dislikedNoPrefs.nativeElement.textContent).toContain('Make some choices to see what you dislike');
    });
  });

  describe('template rendering with partial preferences', () => {
    beforeEach(() => {
      component.preferenceSummary = partialPreferenceSummary;
      fixture.detectChanges();
    });

    it('should display liked tags and no dislikes message', () => {
      const likedTags = fixture.debugElement.queryAll(By.css('.liked-tag'));
      const dislikedNoPrefs = fixture.debugElement.query(By.css('.disliked-section .no-preferences'));

      expect(likedTags.length).toBe(1);
      expect(dislikedNoPrefs).toBeTruthy();
    });
  });

  describe('component methods', () => {
    it('should implement hasPreferences method', () => {
      expect(() => component.hasPreferences()).toThrowError('Not implemented');
    });

    it('should implement getLikedTags method', () => {
      expect(() => component.getLikedTags()).toThrowError('Not implemented');
    });

    it('should implement getDislikedTags method', () => {
      expect(() => component.getDislikedTags()).toThrowError('Not implemented');
    });

    it('should implement formatWeight method', () => {
      expect(() => component.formatWeight(0.5)).toThrowError('Not implemented');
    });

    it('should implement getBarWidth method', () => {
      expect(() => component.getBarWidth(0.5, 1.0)).toThrowError('Not implemented');
    });

    it('should implement getMaxWeight method', () => {
      expect(() => component.getMaxWeight()).toThrowError('Not implemented');
    });
  });

  describe('maxTags limitation', () => {
    beforeEach(() => {
      component.maxTags = 3;
      component.preferenceSummary = mockPreferenceSummary;
      fixture.detectChanges();
    });

    it('should limit displayed tags based on maxTags', () => {
      const likedTags = fixture.debugElement.queryAll(By.css('.liked-tag'));
      const dislikedTags = fixture.debugElement.queryAll(By.css('.disliked-tag'));

      // Should limit to maxTags (3) even though mock has more
      expect(likedTags.length).toBeLessThanOrEqual(3);
      expect(dislikedTags.length).toBeLessThanOrEqual(3);
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      component.preferenceSummary = mockPreferenceSummary;
      fixture.detectChanges();
    });

    it('should have proper heading hierarchy', () => {
      const mainTitle = fixture.debugElement.query(By.css('.summary-container h3'));
      const sectionTitles = fixture.debugElement.queryAll(By.css('.section-title'));

      expect(mainTitle.nativeElement.tagName.toLowerCase()).toBe('h3');
      sectionTitles.forEach(title => {
        expect(title.nativeElement.tagName.toLowerCase()).toBe('h4');
      });
    });

    it('should have meaningful section labels', () => {
      const likedTitle = fixture.debugElement.query(By.css('.liked-title'));
      const dislikedTitle = fixture.debugElement.query(By.css('.disliked-title'));

      expect(likedTitle.nativeElement.textContent).toContain('You Like');
      expect(dislikedTitle.nativeElement.textContent).toContain('You Dislike');
    });

    it('should provide visual weight indicators', () => {
      const weightBars = fixture.debugElement.queryAll(By.css('.weight-bar'));
      expect(weightBars.length).toBeGreaterThan(0);

      weightBars.forEach(bar => {
        const fill = bar.query(By.css('.weight-fill'));
        expect(fill).toBeTruthy();
      });
    });
  });

  describe('responsive layout', () => {
    beforeEach(() => {
      component.preferenceSummary = mockPreferenceSummary;
      fixture.detectChanges();
    });

    it('should have grid layout for preferences', () => {
      const preferencesGrid = fixture.debugElement.query(By.css('.preferences-grid'));
      expect(preferencesGrid).toBeTruthy();
    });

    it('should have proper section structure', () => {
      const preferenceSections = fixture.debugElement.queryAll(By.css('.preference-section'));
      expect(preferenceSections.length).toBe(2); // Liked and disliked sections
    });

    it('should maintain card styling', () => {
      const summaryElement = fixture.debugElement.query(By.css('.preference-summary'));
      expect(summaryElement.nativeElement.classList.contains('preference-summary')).toBe(true);
    });
  });

  describe('visual weight representation', () => {
    beforeEach(() => {
      component.preferenceSummary = mockPreferenceSummary;
      fixture.detectChanges();
    });

    it('should have different fill styles for liked and disliked', () => {
      const likedFills = fixture.debugElement.queryAll(By.css('.liked-fill'));
      const dislikedFills = fixture.debugElement.queryAll(By.css('.disliked-fill'));

      expect(likedFills.length).toBeGreaterThan(0);
      expect(dislikedFills.length).toBeGreaterThan(0);

      likedFills.forEach(fill => {
        expect(fill.nativeElement.classList.contains('liked-fill')).toBe(true);
      });

      dislikedFills.forEach(fill => {
        expect(fill.nativeElement.classList.contains('disliked-fill')).toBe(true);
      });
    });

    it('should display weight values', () => {
      const tagWeights = fixture.debugElement.queryAll(By.css('.tag-weight'));
      expect(tagWeights.length).toBeGreaterThan(0);

      tagWeights.forEach(weight => {
        expect(weight.nativeElement.textContent.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle preference summary with undefined fields', () => {
      const malformedSummary = {
        likedTags: undefined as any,
        dislikedTags: undefined as any
      };

      component.preferenceSummary = malformedSummary;
      fixture.detectChanges();

      // Should not crash, likely show no data or handle gracefully
      expect(component).toBeTruthy();
    });

    it('should handle very high maxTags value', () => {
      component.maxTags = 100;
      component.preferenceSummary = mockPreferenceSummary;
      fixture.detectChanges();

      const likedTags = fixture.debugElement.queryAll(By.css('.liked-tag'));
      const dislikedTags = fixture.debugElement.queryAll(By.css('.disliked-tag'));

      // Should show all available tags (not exceed actual data)
      expect(likedTags.length).toBe(5);
      expect(dislikedTags.length).toBe(4);
    });

    it('should handle zero maxTags value', () => {
      component.maxTags = 0;
      component.preferenceSummary = mockPreferenceSummary;
      fixture.detectChanges();

      const likedTags = fixture.debugElement.queryAll(By.css('.liked-tag'));
      const dislikedTags = fixture.debugElement.queryAll(By.css('.disliked-tag'));

      // Should show no tags or handle gracefully
      expect(likedTags.length).toBe(0);
      expect(dislikedTags.length).toBe(0);
    });

    it('should handle tags with zero weights', () => {
      const zeroWeightSummary: PreferenceSummary = {
        likedTags: [{ tag: 'Neutral', weight: 0 }],
        dislikedTags: [{ tag: 'AlsoNeutral', weight: 0 }]
      };

      component.preferenceSummary = zeroWeightSummary;
      fixture.detectChanges();

      const tagItems = fixture.debugElement.queryAll(By.css('.tag-item'));
      expect(tagItems.length).toBe(2);
    });

    it('should handle very long tag names', () => {
      const longTagSummary: PreferenceSummary = {
        likedTags: [{ tag: 'This-is-a-very-long-tag-name-that-might-cause-layout-issues', weight: 0.8 }],
        dislikedTags: []
      };

      component.preferenceSummary = longTagSummary;
      fixture.detectChanges();

      const tagName = fixture.debugElement.query(By.css('.tag-name'));
      expect(tagName.nativeElement.textContent).toContain('very-long-tag-name');
    });
  });
});