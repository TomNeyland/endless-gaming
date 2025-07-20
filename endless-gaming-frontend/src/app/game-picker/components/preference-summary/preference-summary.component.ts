import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { PreferenceSummary } from '../../../types/game.types';
import { PreferenceService } from '../../services/preference.service';
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
  imports: [CommonModule, MatCardModule, MatProgressBarModule, MatIconModule, MatExpansionModule],
  templateUrl: './preference-summary.component.html',
  styleUrl: './preference-summary.component.scss'
})
export class PreferenceSummaryComponent implements OnInit, OnDestroy {
  private preferenceService = inject(PreferenceService);
  private subscription?: Subscription;
  
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
}