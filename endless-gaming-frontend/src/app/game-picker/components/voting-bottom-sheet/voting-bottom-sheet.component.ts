import { Component, EventEmitter, Output, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GameRecord, GamePair } from '../../../types/game.types';
import { PairService } from '../../services/pair.service';
import { AnimationService } from '../../services/animation.service';

/**
 * Bottom sheet component for continuous voting from recommendations page.
 * 
 * Provides a compact horizontal layout for pairwise game comparison
 * with quick vote buttons and seamless integration.
 */
@Component({
  selector: 'app-voting-bottom-sheet',
  standalone: true,
  imports: [
    CommonModule, 
    MatBottomSheetModule,
    MatButtonModule, 
    MatIconModule, 
    MatCardModule,
    MatProgressBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './voting-bottom-sheet.component.html',
  styleUrl: './voting-bottom-sheet.component.scss'
})
export class VotingBottomSheetComponent implements OnInit {
  private pairService = inject(PairService);
  private animationService = inject(AnimationService);
  
  @Output() voteCast = new EventEmitter<{
    leftGame: GameRecord;
    rightGame: GameRecord;
    pick: 'left' | 'right' | 'skip';
  }>();
  
  @Output() votingComplete = new EventEmitter<void>();

  public readonly currentPair = signal<GamePair | null>(null);
  public readonly isVoting = signal(false);
  public readonly votingStats = signal({ totalVotes: 0, sessionVotes: 0 });

  ngOnInit(): void {
    this.loadNextPair();
    this.updateVotingStats();
  }

  /**
   * Load the next pair for voting.
   */
  private loadNextPair(): void {
    const pair = this.pairService.getNextPair();
    this.currentPair.set(pair);
    
    if (!pair) {
      console.log('🗳️ VotingBottomSheet: No more pairs available');
      this.votingComplete.emit();
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
   * Process a vote and load next pair.
   */
  private async castVote(pick: 'left' | 'right' | 'skip'): Promise<void> {
    const pair = this.currentPair();
    if (!pair || this.isVoting()) return;

    this.isVoting.set(true);

    // Animate vote feedback on the appropriate button
    await this.animateVoteFeedback(pick);

    // Record the choice
    this.pairService.recordChoice(pair.left, pair.right, pick);

    // Emit vote event for parent components
    this.voteCast.emit({
      leftGame: pair.left,
      rightGame: pair.right,
      pick
    });

    // Update stats
    this.updateVotingStats();

    // Animate transition to next pair
    await this.animateTransition();

    // Load next pair
    this.loadNextPair();
    this.isVoting.set(false);
  }

  /**
   * Animate vote feedback on buttons.
   */
  private async animateVoteFeedback(pick: 'left' | 'right' | 'skip'): Promise<void> {
    try {
      let buttonElement: HTMLElement | null = null;
      
      if (pick === 'left') {
        buttonElement = document.querySelector('.vote-button.left-vote') as HTMLElement;
      } else if (pick === 'right') {
        buttonElement = document.querySelector('.vote-button.right-vote') as HTMLElement;
      } else {
        buttonElement = document.querySelector('.skip-button') as HTMLElement;
      }

      if (buttonElement) {
        const feedbackType = pick === 'skip' ? 'skip' : 'success';
        await this.animationService.animateVoteFeedback(buttonElement, feedbackType);
      }
    } catch (error) {
      console.warn('Vote feedback animation failed:', error);
    }
  }

  /**
   * Animate transition between pairs.
   */
  private async animateTransition(): Promise<void> {
    try {
      const gameCards = document.querySelectorAll('.game-card') as NodeListOf<HTMLElement>;
      if (gameCards.length > 0) {
        await this.animationService.animateLeave(Array.from(gameCards));
      }
    } catch (error) {
      console.warn('Transition animation failed:', error);
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
   * Get game tags for display (top 3).
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
}