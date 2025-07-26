import { Component, EventEmitter, Output, inject, OnInit, OnChanges, SimpleChanges, signal, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { PreferenceSummaryComponent } from '../preference-summary/preference-summary.component';
import { FilterPanelComponent } from '../filter-panel/filter-panel.component';
import { GameRecord, GamePair, TagRarityAnalysis, EnhancedTag, GameChoice } from '../../../types/game.types';
import { PairService } from '../../services/pair.service';
import { AnimationService } from '../../services/animation.service';
import { GameFilterService } from '../../services/game-filter.service';
import { EnhancedTagService } from '../../services/enhanced-tag.service';
import { TagRarityService } from '../../services/tag-rarity.service';
import { RadialTagMenuService } from '../../services/radial-tag-menu.service';

/**
 * Slide-out drawer component for continuous voting with live recommendation updates.
 * 
 * Provides a vertical stacked layout that allows users to see recommendations
 * updating in real-time while making voting decisions.
 */
@Component({
  selector: 'app-voting-drawer',
  standalone: true,
  imports: [
    CommonModule, 
    MatSidenavModule,
    MatButtonModule, 
    MatIconModule, 
    MatCardModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatTabsModule,
    PreferenceSummaryComponent,
    FilterPanelComponent
  ],
  templateUrl: './voting-drawer.component.html',
  styleUrl: './voting-drawer.component.scss'
})
export class VotingDrawerComponent implements OnInit, OnChanges {
  private pairService = inject(PairService);
  private animationService = inject(AnimationService);
  public gameFilterService = inject(GameFilterService);
  private enhancedTagService = inject(EnhancedTagService);
  private tagRarityService = inject(TagRarityService);
  private radialTagMenuService = inject(RadialTagMenuService);
  
  @Input() isOpen = false;
  @Input() games: GameRecord[] = [];
  @Input() tagRarityAnalysis?: TagRarityAnalysis | null = null;
  
  // Tab management
  public readonly activeTabIndex = signal(0);
  
  @Output() voteCast = new EventEmitter<{
    leftGame: GameRecord;
    rightGame: GameRecord;
    pick: GameChoice;
  }>();
  
  @Output() drawerClosed = new EventEmitter<void>();

  public readonly currentPair = signal<GamePair | null>(null);
  public readonly isVoting = signal(false);
  public readonly votingStats = signal({ totalVotes: 0, sessionVotes: 0 });

  // Optimized tag computation using signals
  public readonly leftGameTags = computed(() => {
    const game = this.getLeftGame();
    return game ? this.getEnhancedTags(game, 1, 2) : [];
  });

  public readonly rightGameTags = computed(() => {
    const game = this.getRightGame();
    return game ? this.getEnhancedTags(game, 1, 2) : [];
  });

  ngOnInit(): void {
    console.log('🗳️ VotingDrawer: ngOnInit called');
    this.loadNextPair();
    this.updateVotingStats();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue === true) {
      console.log('🗳️ VotingDrawer: Drawer opened, reloading pairs');
      this.loadNextPair();
      this.updateVotingStats();
      this.initializeFilters();
    }
    
    if (changes['games'] && changes['games'].currentValue) {
      this.initializeFilters();
    }
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
   * Load the next pair for voting.
   */
  private loadNextPair(): void {
    console.log('🗳️ VotingDrawer: Loading next pair...');
    const pair = this.pairService.getNextPair();
    console.log('🗳️ VotingDrawer: Got pair:', pair ? `${pair.left.name} vs ${pair.right.name}` : 'null');
    this.currentPair.set(pair);
    
    if (!pair) {
      console.log('🗳️ VotingDrawer: No more pairs available');
      // Don't close automatically in infinite mode - let user close manually
    }
  }

  /**
   * Handle vote for left game.
   */
  voteLeft(): void {
    this.castVote('left');
  }

  /**
   * Handle vote for right game.
   */
  voteRight(): void {
    this.castVote('right');
  }

  /**
   * Handle skip action.
   */
  skip(): void {
    this.castVote('skip');
  }

  /**
   * Handle like both games action.
   */
  likeBoth(): void {
    this.castVote('like_both');
  }

  /**
   * Handle dislike both games action.
   */
  dislikeBoth(): void {
    this.castVote('dislike_both');
  }

  /**
   * Process a vote and load next pair.
   */
  private async castVote(pick: GameChoice): Promise<void> {
    const pair = this.currentPair();
    if (!pair || this.isVoting()) return;

    this.isVoting.set(true);

    // Record the choice immediately
    this.pairService.recordChoice(pair.left, pair.right, pick);

    // Emit vote event for parent components (triggers recommendation refresh)
    this.voteCast.emit({
      leftGame: pair.left,
      rightGame: pair.right,
      pick
    });

    // Update stats
    this.updateVotingStats();

    // Fire and forget button animation (non-blocking)
    this.animateVoteFeedback(pick);

    // Load next pair immediately
    this.loadNextPair();
    this.isVoting.set(false);
  }

  /**
   * Animate vote feedback on buttons (fire and forget).
   */
  private animateVoteFeedback(pick: GameChoice): void {
    try {
      let buttonElement: HTMLElement | null = null;
      
      if (pick === 'left') {
        buttonElement = document.querySelector('.vote-left-btn') as HTMLElement;
      } else if (pick === 'right') {
        buttonElement = document.querySelector('.vote-right-btn') as HTMLElement;
      } else if (pick === 'skip') {
        buttonElement = document.querySelector('.vote-skip-btn') as HTMLElement;
      } else if (pick === 'like_both') {
        buttonElement = document.querySelector('.vote-like-both-btn') as HTMLElement;
      } else if (pick === 'dislike_both') {
        buttonElement = document.querySelector('.vote-dislike-both-btn') as HTMLElement;
      }

      if (buttonElement) {
        let feedbackType: 'success' | 'skip';
        if (pick === 'skip') {
          feedbackType = 'skip';
        } else {
          // Use 'success' for all other choices (left, right, like_both, dislike_both)
          feedbackType = 'success';
        }
        
        // Fire and forget - don't await the animation
        this.animationService.animateVoteFeedback(buttonElement, feedbackType);
      }
    } catch (error) {
      console.warn('Vote feedback animation failed:', error);
    }
  }

  /**
   * Update voting statistics.
   */
  private updateVotingStats(): void {
    const totalVotes = this.pairService.getComparisonCount();
    const sessionVotes = totalVotes; // Could track session-specific votes if needed
    
    this.votingStats.set({ totalVotes, sessionVotes });
  }

  /**
   * Handle drawer close.
   */
  onDrawerClose(): void {
    this.drawerClosed.emit();
  }

  /**
   * Check if there's a valid pair to vote on.
   */
  hasValidPair(): boolean {
    return this.currentPair() !== null;
  }

  /**
   * Get the left game from current pair.
   */
  getLeftGame(): GameRecord | null {
    return this.currentPair()?.left || null;
  }

  /**
   * Get the right game from current pair.
   */
  getRightGame(): GameRecord | null {
    return this.currentPair()?.right || null;
  }

  /**
   * Get formatted voting progress.
   */
  getVotingProgress(): string {
    const stats = this.votingStats();
    return `${stats.totalVotes} comparisons made`;
  }

  /**
   * Get game thumbnail URL with fallbacks.
   */
  getGameThumbnail(game: GameRecord): string {
    if (game.coverUrl) {
      return game.coverUrl;
    }
    
    // Steam header image fallback
    return `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/header.jpg`;
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
    
    console.log(`🏷️ Tag clicked in voting drawer: ${tagName} at position (${position.x}, ${position.y})`);
    
    // Open radial menu at click location
    this.radialTagMenuService.openMenu(tagName, position);
  }

  /**
   * Get game tags for display (top 3) - legacy method for backward compatibility.
   */
  getGameTags(game: GameRecord): string[] {
    if (!game.tags) return [];
    
    return Object.entries(game.tags)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([tag]) => tag);
  }

  /**
   * Get game price for display.
   */
  getGamePrice(game: GameRecord): string {
    return game.price || 'Free';
  }

  /**
   * Get formatted game description with tags and price.
   */
  getGameDescription(game: GameRecord): string {
    const tags = this.getGameTags(game).join(', ');
    const price = this.getGamePrice(game);
    return tags ? `${tags} • ${price}` : price;
  }
}