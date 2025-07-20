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
      component.preferenceSummary = { likedTags: [], dislikedTags: [] };
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
      component.preferenceSummary = { likedTags: [], dislikedTags: [] };
      expect(component.hasPreferences()).toBe(false);
      
      component.preferenceSummary = mockPreferenceSummary;
      expect(component.hasPreferences()).toBe(true);
    });

    it('should implement getLikedTags method', () => {
      component.preferenceSummary = mockPreferenceSummary;
      component.maxTags = 3;
      
      const likedTags = component.getLikedTags();
      expect(likedTags.length).toBe(3); // Limited by maxTags
      expect(likedTags[0].tag).toBe('FPS');
    });

    it('should implement getDislikedTags method', () => {
      component.preferenceSummary = mockPreferenceSummary;
      component.maxTags = 2;
      
      const dislikedTags = component.getDislikedTags();
      expect(dislikedTags.length).toBe(2); // Limited by maxTags
      expect(dislikedTags[0].tag).toBe('Strategy');
    });

    it('should implement formatWeight method', () => {
      expect(component.formatWeight(0.5)).toBe('50%');
      expect(component.formatWeight(0.856)).toBe('86%');
      expect(component.formatWeight(-0.67)).toBe('-67%');
    });

    it('should implement getBarWidth method', () => {
      expect(component.getBarWidth(0.5, 1.0)).toBe('50%');
      expect(component.getBarWidth(0.8, 1.0)).toBe('80%');
      expect(component.getBarWidth(1.2, 1.0)).toBe('100%'); // Capped at 100%
    });

    it('should implement getMaxWeight method', () => {
      component.preferenceSummary = mockPreferenceSummary;
      const maxWeight = component.getMaxWeight();
      expect(maxWeight).toBe(0.85); // Highest weight from mock data
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
});