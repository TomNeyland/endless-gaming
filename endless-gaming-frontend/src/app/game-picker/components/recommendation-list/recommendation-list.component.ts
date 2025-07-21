import { Component, Input, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GameRecommendation, GameRecord } from '../../../types/game.types';
import { PreferenceService } from '../../services/preference.service';
import { PairService } from '../../services/pair.service';
import { AnimationService } from '../../services/animation.service';
import { VotingDrawerService } from '../../services/voting-drawer.service';
import { Subscription } from 'rxjs';

/**
 * Component for displaying the final ranked list of game recommendations.
 * 
 * Shows games in order of preference score with virtual scrolling for performance.
 * Each game displays its score and ranking position.
 */
@Component({
  selector: 'app-recommendation-list',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './recommendation-list.component.html',
  styleUrl: './recommendation-list.component.scss'
})
export class RecommendationListComponent implements OnInit, OnDestroy {
  private preferenceService = inject(PreferenceService);
  private pairService = inject(PairService);
  private animationService = inject(AnimationService);
  private votingDrawerService = inject(VotingDrawerService);
  private preferenceSummarySubscription?: Subscription;
  
  @Input() games: GameRecord[] = [];
  @Input() maxRecommendations: number = 100;
  
  recommendations: GameRecommendation[] = [];
  
  // Reactive state for live updates
  public readonly isRefreshing = signal(false);
  public readonly lastUpdateTime = signal<Date | null>(null);

  ngOnInit(): void {
    this.generateRecommendations();
    this.subscribeToPreferenceUpdates();
    
    // Auto-open voting drawer when user reaches recommendations page
    setTimeout(() => {
      this.votingDrawerService.openDrawer();
    }, 500); // Small delay for better UX
  }

  ngOnDestroy(): void {
    this.preferenceSummarySubscription?.unsubscribe();
  }

  /**
   * Subscribe to preference changes to trigger automatic recommendation updates.
   */
  private subscribeToPreferenceUpdates(): void {
    // Subscribe to preference summary changes as a proxy for preference updates
    this.preferenceSummarySubscription = this.preferenceService.getPreferenceSummary().subscribe(() => {
      // Debounce updates to avoid excessive recalculation
      if (!this.isRefreshing()) {
        this.refreshRecommendations();
      }
    });
  }

  /**
   * Generate recommendations from input games using ML model.
   */
  private generateRecommendations(): void {
    if (this.games.length === 0) {
      this.recommendations = [];
      return;
    }

    this.recommendations = this.preferenceService.rankGames(this.games)
      .slice(0, this.maxRecommendations);
  }

  /**
   * Refresh recommendations with loading state and animation support.
   * Called when preferences are updated from voting.
   */
  public async refreshRecommendations(): Promise<void> {
    if (this.games.length === 0 || this.isRefreshing()) {
      return;
    }

    this.isRefreshing.set(true);
    
    // Capture current state for animations
    const previousRecommendations = [...this.recommendations];
    const containerElement = document.querySelector('.recommendation-list') as HTMLElement;
    
    // Generate new recommendations immediately
    this.recommendations = this.preferenceService.rankGames(this.games)
      .slice(0, this.maxRecommendations);
    
    // Update timestamps
    this.lastUpdateTime.set(new Date());
    
    // Calculate changes for animation feedback
    const changes = this.calculateRankingChanges(previousRecommendations, this.recommendations);
    
    // Perform FLIP animations if there are changes (fire and forget)
    if (changes.length > 0 && containerElement) {
      // Don't block the UI - run animations in the background
      setTimeout(async () => {
        try {
          // Animate reordering
          await this.animationService.animateReorder(containerElement);
          
          // Highlight changed cards
          await this.highlightChangedCards(changes);
          
        } catch (error) {
          console.warn('Animation failed:', error);
        }
      }, 0);
    }
    
    this.isRefreshing.set(false);
    
    // Emit change event for potential parent components
    this.onRecommendationsUpdated(previousRecommendations, this.recommendations);
  }

  /**
   * Highlight cards that changed position.
   */
  private async highlightChangedCards(changes: Array<{appId: number, oldRank: number, newRank: number}>): Promise<void> {
    if (changes.length === 0) return;
    
    try {
      const changedElements: HTMLElement[] = [];
      
      changes.forEach(change => {
        // Find elements with data attributes or by content
        const cardSelectors = [
          `[data-app-id="${change.appId}"]`,
          `.premium-card:nth-child(${change.newRank})`,
          `.compact-item:nth-child(${change.newRank - 3})` // Offset for premium cards
        ];
        
        for (const selector of cardSelectors) {
          const element = document.querySelector(selector) as HTMLElement;
          if (element) {
            changedElements.push(element);
            break;
          }
        }
      });
      
      if (changedElements.length > 0) {
        await this.animationService.animateHighlight(changedElements);
      }
    } catch (error) {
      console.warn('Highlight animation failed:', error);
    }
  }

  /**
   * Handle recommendation updates for potential animation coordination.
   */
  private onRecommendationsUpdated(
    previous: GameRecommendation[], 
    current: GameRecommendation[]
  ): void {
    // This method can be extended to coordinate animations
    // or notify parent components of ranking changes
    console.log('🎯 Recommendations updated:', {
      previousCount: previous.length,
      currentCount: current.length,
      changedRankings: this.calculateRankingChanges(previous, current)
    });
  }

  /**
   * Calculate which games changed positions for animation purposes.
   */
  private calculateRankingChanges(
    previous: GameRecommendation[], 
    current: GameRecommendation[]
  ): Array<{appId: number, oldRank: number, newRank: number}> {
    const changes: Array<{appId: number, oldRank: number, newRank: number}> = [];
    
    const previousMap = new Map(previous.map(r => [r.game.appId, r.rank]));
    
    current.forEach(currentRec => {
      const previousRank = previousMap.get(currentRec.game.appId);
      if (previousRank && previousRank !== currentRec.rank) {
        changes.push({
          appId: currentRec.game.appId,
          oldRank: previousRank,
          newRank: currentRec.rank
        });
      }
    });
    
    return changes;
  }

  /**
   * Check if recommendations are available.
   */
  hasRecommendations(): boolean {
    return this.recommendations.length > 0;
  }

  /**
   * Get recommendations for display (limited by maxRecommendations).
   */
  getDisplayRecommendations(): GameRecommendation[] {
    return this.recommendations;
  }

  /**
   * Get top 3 premium recommendations for featured display.
   */
  getTopRecommendations(): GameRecommendation[] {
    return this.recommendations.slice(0, 3);
  }

  /**
   * Get remaining recommendations for compact list display.
   */
  getCompactRecommendations(): GameRecommendation[] {
    return this.recommendations.slice(3);
  }

  /**
   * Format score for display.
   */
  formatScore(score: number): string {
    return score.toFixed(2);
  }

  /**
   * Get score color based on value.
   */
  getScoreColor(score: number): string {
    // Normalize score to 0-1 range for color mapping
    // Positive scores = green tones, negative = red tones
    if (score > 2) {
      return '#27ae60'; // Strong positive - bright green
    } else if (score > 1) {
      return '#2ecc71'; // Positive - green
    } else if (score > 0) {
      return '#f39c12'; // Mild positive - orange
    } else if (score > -1) {
      return '#e67e22'; // Mild negative - dark orange
    } else if (score > -2) {
      return '#e74c3c'; // Negative - red
    } else {
      return '#c0392b'; // Strong negative - dark red
    }
  }

  /**
   * Get rank display text.
   */
  getRankText(rank: number): string {
    return `#${rank}`;
  }

  /**
   * Get rank icon for top 3 positions.
   */
  getRankIcon(rank: number): string {
    switch (rank) {
      case 1: return 'military_tech'; // Gold medal
      case 2: return 'military_tech'; // Silver medal  
      case 3: return 'military_tech'; // Bronze medal
      default: return 'star';
    }
  }

  /**
   * Get rank icon color for top 3 positions.
   */
  getRankIconColor(rank: number): string {
    switch (rank) {
      case 1: return '#FFD700'; // Gold
      case 2: return '#C0C0C0'; // Silver
      case 3: return '#CD7F32'; // Bronze
      default: return 'var(--gaming-accent)';
    }
  }

  /**
   * Get top tags for display in compact view.
   */
  getTopTags(game: GameRecord, maxTags: number = 3): Array<{tag: string, votes: number}> {
    if (!game?.tags) {
      return [];
    }

    return Object.entries(game.tags)
      .map(([tag, votes]) => ({ tag, votes }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, maxTags);
  }

  /**
   * Handle recommendation item click.
   */
  onRecommendationClick(recommendation: GameRecommendation): void {
    // Could navigate to game details or open Steam store page
    console.log('Clicked recommendation:', recommendation.game.name);
    
    // Example: Open Steam store page (if we want to add this feature)
    // window.open(`https://store.steampowered.com/app/${recommendation.game.appId}`, '_blank');
  }

  /**
   * Track function for ngFor performance.
   */
  trackByAppId(index: number, recommendation: GameRecommendation): number {
    return recommendation.game.appId;
  }

  /**
   * Get total number of games evaluated.
   */
  getTotalGamesCount(): number {
    return this.games.length;
  }

  /**
   * Get recommendation percentage (what percentage of all games are shown).
   */
  getRecommendationPercentage(): number {
    if (this.games.length === 0) return 0;
    return Math.round((this.recommendations.length / this.games.length) * 100);
  }

  /**
   * Encode URI component for safe URL usage in templates.
   */
  encodeURIComponent(str: string): string {
    return encodeURIComponent(str);
  }

  /**
   * Get score range for display.
   */
  getScoreRange(): { min: number, max: number } {
    if (this.recommendations.length === 0) {
      return { min: 0, max: 0 };
    }

    const scores = this.recommendations.map(r => r.score);
    return {
      min: Math.min(...scores),
      max: Math.max(...scores)
    };
  }

  /**
   * Get bar width for score visualization.
   */
  getBarWidth(score: number): string {
    const range = this.getScoreRange();
    const maxAbsScore = Math.max(Math.abs(range.min), Math.abs(range.max));
    
    if (maxAbsScore === 0) return '0%';
    
    const percentage = Math.min(100, (Math.abs(score) / maxAbsScore) * 100);
    return `${percentage}%`;
  }

  /**
   * Open the voting drawer for continuous preference refinement.
   */
  openVotingDrawer(): void {
    this.votingDrawerService.openDrawer();
  }

  /**
   * Check if voting is available (enough games for meaningful pairs).
   */
  canStartVoting(): boolean {
    return this.games.length >= 2 && !this.isRefreshing();
  }

  /**
   * Get voting session statistics.
   */
  getVotingStats(): { totalComparisons: number, canContinue: boolean } {
    return {
      totalComparisons: this.pairService.getComparisonCount(),
      canContinue: this.canStartVoting()
    };
  }
}