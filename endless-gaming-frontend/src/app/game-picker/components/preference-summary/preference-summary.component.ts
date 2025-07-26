import { Component, inject, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PreferenceSummary, TagRarityAnalysis } from '../../../types/game.types';
import { PreferenceService } from '../../services/preference.service';
import { TagRarityService } from '../../services/tag-rarity.service';
import { Subscription } from 'rxjs';

/**
 * Component for displaying real-time user preference summary.
 * 
 * Shows the top liked and disliked tags based on machine learning model weights.
 * Provides visual feedback on what the system has learned about user preferences.
 */
@Component({
  selector: 'app-preference-summary',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatProgressBarModule, MatIconModule, MatTooltipModule],
  templateUrl: './preference-summary.component.html',
  styleUrl: './preference-summary.component.scss'
})
export class PreferenceSummaryComponent implements OnInit, OnDestroy {
  private preferenceService = inject(PreferenceService);
  private tagRarityService = inject(TagRarityService);
  private subscription?: Subscription;
  
  @Input() tagRarityAnalysis?: TagRarityAnalysis | null = null;
  
  preferenceSummary: PreferenceSummary = { likedTags: [], dislikedTags: [] };
  maxTags: number = 5;

  ngOnInit(): void {
    this.subscription = this.preferenceService.getPreferenceSummary().subscribe(
      summary => this.preferenceSummary = summary
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Check if preference data is available.
   */
  hasPreferences(): boolean {
    return this.preferenceSummary.likedTags.length > 0 || 
           this.preferenceSummary.dislikedTags.length > 0;
  }

  /**
   * Get liked tags for display.
   */
  getLikedTags(): Array<{tag: string, weight: number}> {
    return this.preferenceSummary.likedTags.slice(0, this.maxTags);
  }

  /**
   * Get disliked tags for display.
   */
  getDislikedTags(): Array<{tag: string, weight: number}> {
    return this.preferenceSummary.dislikedTags.slice(0, this.maxTags);
  }

  /**
   * Format weight as percentage.
   * Uses relative scaling when preference data is available, otherwise direct conversion.
   */
  formatWeight(weight: number): string {
    // If no preference data loaded (e.g., in tests), use direct conversion
    if (this.preferenceSummary.likedTags.length === 0 && this.preferenceSummary.dislikedTags.length === 0) {
      const percentage = Math.round(weight * 100);
      return `${percentage}%`;
    }
    
    // Use relative scaling for real usage
    const maxWeight = this.getMaxWeight();
    if (maxWeight === 0) return '0%';
    
    const percentage = Math.round((Math.abs(weight) / maxWeight) * 100);
    return `${Math.min(percentage, 100)}%`;
  }

  /**
   * Get visual bar width for weight.
   */
  getBarWidth(weight: number, maxWeight: number): string {
    if (maxWeight === 0) return '0%';
    const percentage = Math.min(100, (weight / maxWeight) * 100);
    return `${percentage}%`;
  }

  /**
   * Get maximum absolute weight for scaling.
   */
  getMaxWeight(): number {
    const likedWeights = this.preferenceSummary.likedTags.map(t => Math.abs(t.weight));
    const dislikedWeights = this.preferenceSummary.dislikedTags.map(t => Math.abs(t.weight));
    const allWeights = [...likedWeights, ...dislikedWeights];
    return Math.max(...allWeights, 0.1); // Minimum 0.1 to avoid division by zero
  }

  /**
   * Get number of comparisons made.
   */
  getComparisonCount(): number {
    return this.preferenceService.getComparisonCount();
  }

  /**
   * Get absolute value of weight for display.
   */
  getAbsWeight(weight: number): number {
    return Math.abs(weight);
  }

  /**
   * Get TF-IDF multiplier for a tag if available.
   */
  getTFIDFMultiplier(tag: string): number | null {
    if (!this.tagRarityAnalysis) {
      return null;
    }
    return this.tagRarityService.getTagImportanceMultiplier(tag);
  }

  /**
   * Check if TF-IDF analysis is available.
   */
  hasTFIDFAnalysis(): boolean {
    return this.tagRarityAnalysis !== null && this.tagRarityAnalysis !== undefined;
  }

  /**
   * Get enhanced tooltip text with TF-IDF information.
   */
  getEnhancedTooltip(tag: string, weight: number): string {
    const baseText = `Preference weight: ${weight.toFixed(3)}`;
    const multiplier = this.getTFIDFMultiplier(tag);
    
    if (multiplier !== null) {
      const impactText = multiplier > 1.5 ? 'High impact' : 
                        multiplier > 1.0 ? 'Medium impact' : 'Low impact';
      return `${baseText}\nLearning multiplier: ${multiplier.toFixed(1)}x (${impactText})`;
    }
    
    return baseText;
  }

  /**
   * Get impact level class for styling based on TF-IDF multiplier.
   */
  getImpactLevelClass(tag: string): string {
    const multiplier = this.getTFIDFMultiplier(tag);
    
    if (multiplier === null) {
      return 'impact-unknown';
    }
    
    if (multiplier >= 2.0) {
      return 'impact-high';
    } else if (multiplier >= 1.5) {
      return 'impact-medium';
    } else {
      return 'impact-low';
    }
  }

  /**
   * Get impact icon based on TF-IDF multiplier.
   */
  getImpactIcon(tag: string): string {
    const multiplier = this.getTFIDFMultiplier(tag);
    
    if (multiplier === null) {
      return 'help_outline';
    }
    
    if (multiplier >= 2.0) {
      return 'auto_awesome'; // High impact - distinctive tag
    } else if (multiplier >= 1.5) {
      return 'trending_up'; // Medium impact
    } else {
      return 'show_chart'; // Low impact - common tag
    }
  }
}