import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameRecord } from '../../../types/game.types';

/**
 * Component for displaying individual game information.
 * 
 * Shows game details including name, price, developer, tags, and reviews.
 * Used in both comparison and recommendation list contexts.
 */
@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss'
})
export class GameCardComponent {
  
  @Input() game: GameRecord | null = null;
  @Input() showScore = false;
  @Input() score?: number;
  @Input() rank?: number;

  constructor() {
    throw new Error('Not implemented');
  }

  /**
   * Get formatted price display.
   */
  getFormattedPrice(): string {
    throw new Error('Not implemented');
  }

  /**
   * Get top tags for display.
   */
  getTopTags(maxTags: number = 5): Array<{tag: string, votes: number}> {
    throw new Error('Not implemented');
  }

  /**
   * Calculate review percentage.
   */
  getReviewPercentage(): number | null {
    throw new Error('Not implemented');
  }

  /**
   * Get review display text.
   */
  getReviewText(): string {
    throw new Error('Not implemented');
  }

  /**
   * Check if game data is valid.
   */
  hasValidGame(): boolean {
    throw new Error('Not implemented');
  }

  /**
   * Get developer/publisher display text.
   */
  getDeveloperText(): string {
    throw new Error('Not implemented');
  }
}