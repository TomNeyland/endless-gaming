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
  @Input() highlightOnHover = false;

  /**
   * Get formatted price display.
   */
  getFormattedPrice(): string {
    if (!this.game?.price) {
      return 'Price unavailable';
    }
    
    if (this.game.price === 'Free') {
      return 'Free';
    }
    
    // Price might already include $ symbol or be just the number
    if (this.game.price.startsWith('$')) {
      return this.game.price;
    }
    
    return `$${this.game.price}`;
  }

  /**
   * Get top tags for display.
   */
  getTopTags(maxTags: number = 5): Array<{tag: string, votes: number}> {
    if (!this.game?.tags) {
      return [];
    }

    return Object.entries(this.game.tags)
      .map(([tag, votes]) => ({ tag, votes }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, maxTags);
  }

  /**
   * Calculate review percentage.
   */
  getReviewPercentage(): number | null {
    if (!this.game?.reviewPos || !this.game?.reviewNeg) {
      return null;
    }

    const total = this.game.reviewPos + this.game.reviewNeg;
    if (total === 0) {
      return null;
    }

    return Math.round((this.game.reviewPos / total) * 100);
  }

  /**
   * Get review display text.
   */
  getReviewText(): string {
    const percentage = this.getReviewPercentage();
    
    if (percentage === null) {
      return 'No reviews';
    }

    const total = (this.game?.reviewPos || 0) + (this.game?.reviewNeg || 0);
    return `${percentage}% positive (${total.toLocaleString()} reviews)`;
  }

  /**
   * Check if game data is valid.
   */
  hasValidGame(): boolean {
    return this.game !== null && !!this.game.name;
  }

  /**
   * Get developer/publisher display text.
   */
  getDeveloperText(): string {
    if (!this.game) {
      return 'Unknown';
    }

    const dev = this.game.developer;
    const pub = this.game.publisher;

    if (dev && pub && dev !== pub) {
      return `${dev} / ${pub}`;
    }
    
    return dev || pub || 'Unknown';
  }

  /**
   * Get formatted score for display.
   */
  getFormattedScore(): string {
    if (this.score === undefined) {
      return '';
    }
    
    return this.score.toFixed(2);
  }

  /**
   * Get the primary genre.
   */
  getPrimaryGenre(): string {
    if (!this.game?.genres || this.game.genres.length === 0) {
      return 'Unclassified';
    }
    
    return this.game.genres[0];
  }

  /**
   * Get cover image URL with fallback.
   */
  getCoverImage(): string {
    return this.game?.coverUrl || '/assets/images/game-placeholder.png';
  }

  /**
   * Handle image load errors.
   */
  onImageError(event: any): void {
    event.target.src = '/assets/images/game-placeholder.png';
  }
}