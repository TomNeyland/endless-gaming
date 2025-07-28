import { Component, Input, inject, OnInit, OnDestroy, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GameRecommendation, GameRecord, TagRarityAnalysis, EnhancedTag, SteamPlayerLookupResponse } from '../../../types/game.types';
import { PreferenceService } from '../../services/preference.service';
import { PairService } from '../../services/pair.service';
import { AnimationService } from '../../services/animation.service';
import { VotingDrawerService } from '../../services/voting-drawer.service';
import { GameFilterService } from '../../services/game-filter.service';
import { GameDetailsService } from '../../services/game-details.service';
import { EnhancedTagService } from '../../services/enhanced-tag.service';
import { TagRarityService } from '../../services/tag-rarity.service';
import { RadialTagMenuService } from '../../services/radial-tag-menu.service';
import { SteamIntegrationService } from '../../services/steam-integration.service';
import { getAgeBadge } from '../../../utils/game-age.utils';
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
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './recommendation-list.component.html',
  styleUrl: './recommendation-list.component.scss'
})
export class RecommendationListComponent implements OnInit, OnDestroy, OnChanges {
  private preferenceService = inject(PreferenceService);
  private pairService = inject(PairService);
  private animationService = inject(AnimationService);
  private votingDrawerService = inject(VotingDrawerService);
  private gameDetailsService = inject(GameDetailsService);
  private enhancedTagService = inject(EnhancedTagService);
  private tagRarityService = inject(TagRarityService);
  private radialTagMenuService = inject(RadialTagMenuService);
  private steamIntegrationService = inject(SteamIntegrationService);
  private preferenceSummarySubscription?: Subscription;
  private filterSubscription?: Subscription;
  
  // Make gameFilterService public for template access
  public gameFilterService = inject(GameFilterService);
  
  @Input() games: GameRecord[] = [];
  @Input() maxRecommendations: number = 100;
  @Input() tagRarityAnalysis?: TagRarityAnalysis | null = null;
  @Input() steamPlayerData?: SteamPlayerLookupResponse | null = null;
  @Input() enableSteamFeatures: boolean = false;
  
  recommendations: GameRecommendation[] = [];
  
  // Reactive state for live updates
  public readonly isRefreshing = signal(false);
  public readonly lastUpdateTime = signal<Date | null>(null);
  
  // Filter state
  public readonly isFiltering = this.gameFilterService.isFiltering;
  
  // Track which games have expanded tags
  public expandedTags = new Set<number>();

  ngOnInit(): void {
    this.initializeFilters();
    this.generateRecommendations();
    this.subscribeToPreferenceUpdates();
    this.subscribeToFilterUpdates();
    
    // Auto-open voting drawer when user reaches recommendations page
    setTimeout(() => {
      this.votingDrawerService.openDrawer();
    }, 500); // Small delay for better UX
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Refresh recommendations when Steam data or features change
    if (changes['steamPlayerData'] || changes['enableSteamFeatures'] || changes['games']) {
      console.log('🎮 RecommendationList: Input changed, refreshing recommendations', {
        steamPlayerData: !!changes['steamPlayerData'],
        enableSteamFeatures: !!changes['enableSteamFeatures'],
        games: !!changes['games']
      });
      
      // Use setTimeout to ensure change detection cycle is complete
      setTimeout(() => {
        this.generateRecommendations();
      }, 0);
    }
  }

  ngOnDestroy(): void {
    this.preferenceSummarySubscription?.unsubscribe();
    this.filterSubscription?.unsubscribe();
  }

  /**
   * Initialize filter service with game data
   */
  private initializeFilters(): void {
    if (this.games.length > 0) {
      this.gameFilterService.initializeOptions(this.games);
    }
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
   * Subscribe to filter changes to regenerate recommendations
   */
  private subscribeToFilterUpdates(): void {
    this.filterSubscription = this.gameFilterService.getFilters().subscribe(() => {
      // Regenerate recommendations when filters change
      this.generateRecommendations();
    });
  }

  /**
   * Generate recommendations from input games using ML model.
   * Enhanced with Steam integration when available.
   */
  private generateRecommendations(): void {
    if (this.games.length === 0) {
      this.recommendations = [];
      return;
    }

    // STEP 1: Apply filters to the full game dataset first (with Steam data if available)
    const filteredGames = this.enableSteamFeatures && this.steamPlayerData 
      ? this.gameFilterService.applyFilters(this.games, undefined, this.steamPlayerData)
      : this.gameFilterService.applyFilters(this.games);
    
    // STEP 2: Generate recommendations from the filtered games (with Steam enhancement if available)
    this.recommendations = this.enableSteamFeatures && this.steamPlayerData
      ? this.preferenceService.rankGamesWithSteamData(filteredGames, this.steamPlayerData, this.games)
      : this.preferenceService.rankGames(filteredGames);
    
    // STEP 3: Apply final limit
    this.recommendations = this.recommendations.slice(0, this.maxRecommendations);
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
    
    // Generate new recommendations from filtered games (with Steam enhancement if available)
    const filteredGames = this.enableSteamFeatures && this.steamPlayerData 
      ? this.gameFilterService.applyFilters(this.games, undefined, this.steamPlayerData)
      : this.gameFilterService.applyFilters(this.games);
    
    this.recommendations = (this.enableSteamFeatures && this.steamPlayerData
      ? this.preferenceService.rankGamesWithSteamData(filteredGames, this.steamPlayerData, this.games)
      : this.preferenceService.rankGames(filteredGames))
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
   * Get recommendations for display.
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
   * Get top tags for display in compact view (legacy method for backward compatibility).
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
   * Get enhanced tags with both popular and unique insights.
   * Falls back to popular tags if TF-IDF analysis is not available.
   */
  getEnhancedTags(game: GameRecord, popularCount: number = 2, uniqueCount: number = 1): EnhancedTag[] {
    if (!game) {
      return [];
    }

    // If TF-IDF analysis is available, show enhanced display
    if (this.tagRarityAnalysis) {
      const display = this.enhancedTagService.getEnhancedTagDisplay(
        game,
        this.tagRarityAnalysis,
        popularCount,
        uniqueCount,
        this.tagRarityService
      );
      return display.allTags;
    }

    // Fallback to popular tags only
    return this.enhancedTagService.getPopularTags(game, popularCount + uniqueCount);
  }


  /**
   * Handle recommendation item click - open game details modal.
   */
  onRecommendationClick(recommendation: GameRecommendation): void {
    if (recommendation.game) {
      this.gameDetailsService.openGameDetails(recommendation.game);
    }
  }

  /**
   * Open Steam store page for a game.
   */
  openSteamStore(recommendation: GameRecommendation, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (recommendation.game?.appId) {
      const steamUrl = `https://store.steampowered.com/app/${recommendation.game.appId}`;
      window.open(steamUrl, '_blank');
    }
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

  /**
   * Toggle tag expansion for a specific game.
   */
  toggleTagExpansion(appId: number, event: Event): void {
    event.stopPropagation(); // Prevent triggering parent click events
    
    if (this.expandedTags.has(appId)) {
      this.expandedTags.delete(appId);
    } else {
      this.expandedTags.add(appId);
    }
  }

  /**
   * Calculate rating percentage from positive/negative reviews.
   */
  getRatingPercentage(game: GameRecord): number {
    if (!game.reviewPos && !game.reviewNeg) return 0;
    
    const positive = game.reviewPos || 0;
    const negative = game.reviewNeg || 0;
    const total = positive + negative;
    
    if (total === 0) return 0;
    
    return Math.round((positive / total) * 100);
  }

  /**
   * Get age badge text for display.
   */
  getAgeBadgeText(game: GameRecord): string {
    return getAgeBadge(game?.releaseDate);
  }

  /**
   * Check if game has screenshots.
   */
  hasScreenshots(game: GameRecord): boolean {
    return !!(game?.screenshots && game.screenshots.length > 0);
  }

  /**
   * Check if game has videos.
   */
  hasVideos(game: GameRecord): boolean {
    return !!(game?.movies && game.movies.length > 0);
  }

  /**
   * Check if game has rich content (screenshots or videos).
   */
  hasRichContent(game: GameRecord): boolean {
    return this.hasScreenshots(game) || this.hasVideos(game);
  }

  /**
   * Get truncated description for display.
   */
  getTruncatedDescription(game: GameRecord, maxLength: number = 100): string {
    if (!game?.shortDescription) return '';
    
    if (game.shortDescription.length <= maxLength) {
      return game.shortDescription;
    }
    
    const truncated = game.shortDescription.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Handle tag click events to open radial menu
   */
  onTagClick(event: MouseEvent, tagName: string): void {
    // Prevent all event propagation and default behavior
    event.stopPropagation();
    event.stopImmediatePropagation();
    event.preventDefault();
    
    // Get click coordinates for menu positioning
    const position = {
      x: event.clientX,
      y: event.clientY
    };
    
    console.log(`🏷️ Tag clicked in recommendations: ${tagName} at position (${position.x}, ${position.y})`);
    
    // Open radial menu at click location
    this.radialTagMenuService.openMenu(tagName, position);
  }

  // Steam Integration Methods

  /**
   * Check if Steam features are enabled and data is available.
   */
  hasSteamData(): boolean {
    return this.enableSteamFeatures && !!this.steamPlayerData;
  }

  /**
   * Check if a game is owned by the Steam user.
   */
  isGameOwned(game: GameRecord): boolean {
    if (!this.hasSteamData()) return false;
    return this.steamIntegrationService.isGameOwned(game, this.steamPlayerData!);
  }

  /**
   * Get Steam insights for a game.
   */
  getSteamInsights(game: GameRecord): {
    isOwned: boolean;
    playtime?: any;
    category?: any;
    recommendation?: string;
  } {
    if (!this.hasSteamData()) {
      return { isOwned: false };
    }
    return this.steamIntegrationService.getSteamInsights(game, this.steamPlayerData!);
  }

  /**
   * Format playtime for display.
   */
  formatPlaytime(playtimeMinutes: number): string {
    return this.steamIntegrationService.formatPlaytime(playtimeMinutes);
  }

  /**
   * Format recent playtime for display.
   */
  formatRecentPlaytime(recentMinutes?: number): string {
    return this.steamIntegrationService.formatRecentPlaytime(recentMinutes);
  }

  /**
   * Get playtime category badge color.
   */
  getPlaytimeCategoryColor(category: string): string {
    switch (category) {
      case 'unplayed': return '#9e9e9e';
      case 'light': return '#ff9800';
      case 'moderate': return '#2196f3';
      case 'heavy': return '#4caf50';
      case 'obsessed': return '#9c27b0';
      default: return '#9e9e9e';
    }
  }

  /**
   * Get owned game badge text.
   */
  getOwnedBadgeText(insights: any): string {
    if (!insights.isOwned) return '';
    
    if (insights.playtime?.playtime_forever === 0) {
      return 'OWNED • Never played';
    }
    
    const totalTime = this.formatPlaytime(insights.playtime?.playtime_forever || 0);
    const recentTime = this.formatRecentPlaytime(insights.playtime?.playtime_2weeks);
    
    if (recentTime) {
      return `OWNED • ${totalTime} (${recentTime})`;
    }
    
    return `OWNED • ${totalTime}`;
  }

  /**
   * Get recommendation reason for owned games.
   */
  getRecommendationReason(insights: any): string {
    return insights.recommendation || '';
  }

  /**
   * Show Steam recommendation tooltip.
   */
  showSteamTooltip(insights: any): boolean {
    return insights.isOwned && (insights.recommendation || insights.category);
  }
}