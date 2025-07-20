import { Component, Input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { GameRecommendation, GameRecord } from '../../../types/game.types';
import { PreferenceService } from '../../services/preference.service';
import { GameCardComponent } from '../game-card/game-card.component';

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
    GameCardComponent
  ],
  templateUrl: './recommendation-list.component.html',
  styleUrl: './recommendation-list.component.scss'
})
export class RecommendationListComponent implements OnInit {
  private preferenceService = inject(PreferenceService);
  
  @Input() games: GameRecord[] = [];
  @Input() maxRecommendations: number = 100;
  
  recommendations: GameRecommendation[] = [];

  ngOnInit(): void {
    this.generateRecommendations();
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
}