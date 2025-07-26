import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { GameRecord, Screenshot, Movie } from '../../../types/game.types';
import { formatGameAge, getAgeBadge } from '../../../utils/game-age.utils';
import { MediaGalleryComponent, MediaGalleryEvent } from '../../../shared/components/media-gallery/media-gallery.component';
import { CollapsibleSectionComponent } from '../../../shared/components/collapsible-section/collapsible-section.component';

export interface GameDetailsModalData {
  game: GameRecord;
}

/**
 * Modal component for displaying detailed game information.
 * 
 * Shows rich content in tabs:
 * - Overview: Description, details, system requirements
 * - Screenshots: Gallery with lightbox functionality
 * - Videos: Video player with multiple formats
 */
@Component({
  selector: 'app-game-details-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MediaGalleryComponent,
    CollapsibleSectionComponent
  ],
  templateUrl: './game-details-modal.component.html',
  styleUrl: './game-details-modal.component.scss'
})
export class GameDetailsModalComponent implements OnInit {
  public game: GameRecord;
  public selectedScreenshot: Screenshot | null = null;
  public selectedVideo: Movie | null = null;

  constructor(
    private dialogRef: MatDialogRef<GameDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: GameDetailsModalData,
    private sanitizer: DomSanitizer
  ) {
    this.game = data.game;
  }

  ngOnInit(): void {
    // Auto-select first video if available
    if (this.hasVideos()) {
      this.selectedVideo = this.game.movies![0];
    }
  }

  /**
   * Close the modal
   */
  public close(): void {
    this.dialogRef.close();
  }

  /**
   * Open Steam store page for this game
   */
  public openSteamStore(): void {
    if (this.game.appId) {
      const steamUrl = `https://store.steampowered.com/app/${this.game.appId}`;
      window.open(steamUrl, '_blank');
    }
  }

  /**
   * Open game website if available
   */
  public openWebsite(): void {
    if (this.game.website) {
      window.open(this.game.website, '_blank');
    }
  }

  /**
   * Get formatted game age
   */
  public getFormattedAge(): string {
    return formatGameAge(this.game.releaseDate);
  }

  /**
   * Get age badge text
   */
  public getAgeBadgeText(): string {
    return getAgeBadge(this.game.releaseDate);
  }

  /**
   * Get top tags for display
   */
  public getTopTags(maxTags: number = 8): Array<{tag: string, votes: number}> {
    if (!this.game.tags) return [];

    return Object.entries(this.game.tags)
      .map(([tag, votes]) => ({ tag, votes }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, maxTags);
  }

  /**
   * Get developers display text
   */
  public getDevelopersText(): string {
    if (this.game.developers && this.game.developers.length > 0) {
      return this.game.developers.join(', ');
    }
    return this.game.developer || 'Unknown';
  }

  /**
   * Get publishers display text
   */
  public getPublishersText(): string {
    if (this.game.publishers && this.game.publishers.length > 0) {
      return this.game.publishers.join(', ');
    }
    return this.game.publisher || 'Unknown';
  }

  /**
   * Get review percentage
   */
  public getReviewPercentage(): number | null {
    if (!this.game.reviewPos || !this.game.reviewNeg) return null;
    
    const total = this.game.reviewPos + this.game.reviewNeg;
    if (total === 0) return null;
    
    return Math.round((this.game.reviewPos / total) * 100);
  }

  /**
   * Get review display text
   */
  public getReviewText(): string {
    const percentage = this.getReviewPercentage();
    if (percentage === null) return 'No reviews';
    
    const total = (this.game.reviewPos || 0) + (this.game.reviewNeg || 0);
    return `${percentage}% positive (${total.toLocaleString()} reviews)`;
  }

  /**
   * Get total review count
   */
  public getTotalReviews(): number {
    return (this.game.reviewPos || 0) + (this.game.reviewNeg || 0);
  }

  /**
   * Get tag size class based on vote count for visual hierarchy
   */
  public getTagSizeClass(votes: number): string {
    const maxVotes = Math.max(...this.getTopTags().map(t => t.votes));
    const percentage = (votes / maxVotes) * 100;
    
    if (percentage >= 80) return 'tag-xl';
    if (percentage >= 60) return 'tag-lg';
    if (percentage >= 40) return 'tag-md';
    if (percentage >= 20) return 'tag-sm';
    return 'tag-xs';
  }

  /**
   * Get tag popularity percentage for progress bar
   */
  public getTagPopularityPercentage(votes: number): number {
    const maxVotes = Math.max(...this.getTopTags().map(t => t.votes));
    return Math.round((votes / maxVotes) * 100);
  }

  /**
   * Sanitize HTML content for safe display
   */
  public sanitizeHtml(html: string | null | undefined): SafeHtml {
    if (!html) return '';
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /**
   * Check if game has screenshots
   */
  public hasScreenshots(): boolean {
    return !!(this.game.screenshots && this.game.screenshots.length > 0);
  }

  /**
   * Check if game has videos
   */
  public hasVideos(): boolean {
    return !!(this.game.movies && this.game.movies.length > 0);
  }

  /**
   * Check if game has any media (screenshots or videos).
   */
  public hasMedia(): boolean {
    return this.hasScreenshots() || this.hasVideos();
  }

  /**
   * Get total media count for tab label.
   */
  public getMediaCount(): number {
    const screenshotCount = this.game.screenshots?.length || 0;
    const videoCount = this.game.movies?.length || 0;
    return screenshotCount + videoCount;
  }

  /**
   * Handle media gallery events.
   */
  public onGalleryEvent(event: MediaGalleryEvent): void {
    console.log('Media gallery event:', event);
    // Handle gallery events if needed (e.g., analytics, state management)
  }

  /**
   * Get screenshot count
   */
  public getScreenshotCount(): number {
    return this.game.screenshots?.length || 0;
  }

  /**
   * Get video count
   */
  public getVideoCount(): number {
    return this.game.movies?.length || 0;
  }

  /**
   * Open screenshot in lightbox
   */
  public openScreenshotLightbox(screenshot: Screenshot): void {
    this.selectedScreenshot = screenshot;
    // In a real implementation, this would open a proper lightbox overlay
    // For now, we'll open the full-size image in a new tab
    window.open(screenshot.path_full, '_blank');
  }

  /**
   * Select video for playback
   */
  public selectVideo(video: Movie): void {
    this.selectedVideo = video;
  }

  /**
   * Get video source URL (prefer WebM, fallback to MP4)
   */
  public getVideoSource(video: Movie): string {
    // Prefer max quality WebM, fallback to max quality MP4
    return video.webm?.max || video.mp4?.max || video.webm?.['480'] || video.mp4?.['480'] || '';
  }

  /**
   * Get video poster image
   */
  public getVideoPoster(video: Movie): string {
    return video.thumbnail;
  }

  /**
   * Format price for display
   */
  public getFormattedPrice(): string {
    if (!this.game.price) return 'Price unavailable';
    if (this.game.price === 'Free') return 'Free';
    if (this.game.price.startsWith('$')) return this.game.price;
    return `$${this.game.price}`;
  }

  /**
   * Get store genres display
   */
  public getStoreGenres(): string[] {
    if (this.game.storeGenres) {
      return this.game.storeGenres.map(genre => genre.description);
    }
    return this.game.genres || [];
  }

  /**
   * Get categories display
   */
  public getCategories(): string[] {
    if (this.game.categories) {
      return this.game.categories.map(cat => cat.description);
    }
    return [];
  }

  /**
   * Check if game has system requirements
   */
  public hasSystemRequirements(): boolean {
    return !!(this.game.pcRequirements && 
             (this.game.pcRequirements.minimum || this.game.pcRequirements.recommended));
  }

  /**
   * Get minimum system requirements
   */
  public getMinimumRequirements(): SafeHtml {
    if (this.game.pcRequirements?.minimum) {
      return this.sanitizeHtml(this.game.pcRequirements.minimum);
    }
    return '';
  }

  /**
   * Get recommended system requirements
   */
  public getRecommendedRequirements(): SafeHtml {
    if (this.game.pcRequirements?.recommended) {
      return this.sanitizeHtml(this.game.pcRequirements.recommended);
    }
    return '';
  }

  /**
   * Check if game has detailed price data
   */
  public hasPriceData(): boolean {
    return !!(this.game.priceData && this.game.priceData.final_formatted);
  }

  /**
   * Get formatted price from price data
   */
  public getPriceDataFormatted(): string {
    if (!this.game.priceData) return '';
    
    if (this.game.priceData.discount_percent && this.game.priceData.discount_percent > 0) {
      return `${this.game.priceData.final_formatted} (${this.game.priceData.discount_percent}% off)`;
    }
    
    return this.game.priceData.final_formatted || '';
  }

  /**
   * Handle keyboard events for accessibility
   */
  public onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    }
  }
}