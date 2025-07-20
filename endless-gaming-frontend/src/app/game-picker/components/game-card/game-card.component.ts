import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
  imports: [CommonModule, MatCardModule, MatChipsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss'
})
export class GameCardComponent {
  
  @Input() game: GameRecord | null = null;
  @Input() showScore = false;
  @Input() score?: number;
  @Input() rank?: number;
  @Input() highlightOnHover = false;
  
  imageLoading = true;
  imageError = false;

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
    // If we have a valid coverUrl, use it
    if (this.game?.coverUrl && this.game.coverUrl !== null) {
      return this.game.coverUrl;
    }
    
    // Otherwise, generate a Steam store image URL from appId
    if (this.game?.appId) {
      return `https://cdn.akamai.steamstatic.com/steam/apps/${this.game.appId}/header.jpg`;
    }
    
    // Final fallback to a solid color placeholder
    return this.generatePlaceholderImage();
  }

  /**
   * Generate a placeholder image data URL.
   */
  private generatePlaceholderImage(): string {
    // Create a canvas-based placeholder with the game name
    const canvas = document.createElement('canvas');
    canvas.width = 460;
    canvas.height = 215;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Gradient background
      const gradient = ctx.createLinearGradient(0, 0, 460, 215);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 460, 215);
      
      // Game name text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px "Roboto", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const text = this.game?.name || 'Game';
      const maxWidth = 420;
      
      // Simple text wrapping
      const words = text.split(' ');
      let line = '';
      let lines = [];
      
      for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && line !== '') {
          lines.push(line.trim());
          line = word + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());
      
      // Draw text lines
      const lineHeight = 24;
      const startY = 107.5 - ((lines.length - 1) * lineHeight) / 2;
      
      lines.forEach((line, index) => {
        ctx.fillText(line, 230, startY + (index * lineHeight));
      });
    }
    
    return canvas.toDataURL('image/png');
  }

  /**
   * Handle image load errors.
   */
  onImageError(event: any): void {
    console.warn('Failed to load image for game:', this.game?.name);
    this.imageError = true;
    this.imageLoading = false;
    
    // Try Steam's alternative image URLs
    if (this.game?.appId && !event.target.src.includes('library_600x900')) {
      this.imageError = false;
      event.target.src = `https://cdn.akamai.steamstatic.com/steam/apps/${this.game.appId}/library_600x900.jpg`;
      return;
    }
    
    // Final fallback to generated placeholder
    event.target.src = this.generatePlaceholderImage();
  }

  /**
   * Handle successful image load.
   */
  onImageLoad(): void {
    this.imageLoading = false;
    this.imageError = false;
  }
}