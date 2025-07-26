import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { Screenshot, Movie } from '../../../types/game.types';

export interface MediaGalleryEvent {
  type: 'mediaClicked' | 'lightboxOpened' | 'lightboxClosed';
  item: Screenshot | Movie;
  itemType: 'screenshot' | 'video';
  index: number;
}

/**
 * Modern visual gallery component for screenshots and videos.
 * 
 * Features:
 * - Hero featured media display
 * - Responsive CSS Grid gallery layout
 * - Lightbox functionality for fullscreen viewing
 * - Dark gaming theme with hover animations
 * - Touch-friendly mobile experience
 */
@Component({
  selector: 'app-media-gallery',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './media-gallery.component.html',
  styleUrl: './media-gallery.component.scss',
  animations: [
    // Hover scale animation for gallery items
    trigger('hoverScale', [
      state('default', style({ transform: 'scale(1)' })),
      state('hovered', style({ transform: 'scale(1.05)' })),
      transition('default <=> hovered', animate('200ms ease-out'))
    ]),
    
    // Lightbox fade animation
    trigger('lightboxFade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    
    // Gallery item entrance animation
    trigger('itemEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class MediaGalleryComponent implements OnInit {
  @Input() screenshots: Screenshot[] = [];
  @Input() videos: Movie[] = [];
  @Output() galleryEvent = new EventEmitter<MediaGalleryEvent>();

  // Gallery state
  public featuredItems: Array<{item: Screenshot | Movie, type: 'screenshot' | 'video', index: number}> = [];
  public galleryItems: Array<{item: Screenshot | Movie, type: 'screenshot' | 'video', index: number}> = [];
  
  // Lightbox state
  public isLightboxOpen: boolean = false;
  public lightboxItem: Screenshot | Movie | null = null;
  public lightboxItemType: 'screenshot' | 'video' = 'screenshot';
  public lightboxIndex: number = 0;

  ngOnInit(): void {
    this.initializeGallery();
  }

  /**
   * Initialize gallery with 2x2 featured grid and remaining items.
   * Videos are prioritized for featured display and shown first in gallery.
   */
  private initializeGallery(): void {
    this.galleryItems = [];
    this.featuredItems = [];
    
    // Add videos to gallery first (prioritized)
    this.videos.forEach((video, index) => {
      this.galleryItems.push({
        item: video,
        type: 'video', 
        index
      });
    });
    
    // Add screenshots to gallery after videos
    this.screenshots.forEach((screenshot, index) => {
      this.galleryItems.push({
        item: screenshot,
        type: 'screenshot',
        index
      });
    });
    
    // Set featured items (first 4 items for 2x2 grid)
    this.featuredItems = this.galleryItems.slice(0, 4);
  }

  /**
   * Get total media count.
   */
  public getMediaCount(): number {
    return this.screenshots.length + this.videos.length;
  }

  /**
   * Check if gallery has any media.
   */
  public hasMedia(): boolean {
    return this.getMediaCount() > 0;
  }

  /**
   * Handle gallery item click.
   */
  public onGalleryItemClick(galleryItem: {item: Screenshot | Movie, type: 'screenshot' | 'video', index: number}): void {
    this.openLightbox(galleryItem.item, galleryItem.type, galleryItem.index);
    
    this.galleryEvent.emit({
      type: 'mediaClicked',
      item: galleryItem.item,
      itemType: galleryItem.type,
      index: galleryItem.index
    });
  }

  /**
   * Handle featured item click.
   */
  public onFeaturedItemClick(featuredItem: {item: Screenshot | Movie, type: 'screenshot' | 'video', index: number}): void {
    this.openLightbox(featuredItem.item, featuredItem.type, featuredItem.index);
  }

  /**
   * Open lightbox with selected media.
   */
  public openLightbox(item: Screenshot | Movie, itemType: 'screenshot' | 'video', index: number): void {
    this.lightboxItem = item;
    this.lightboxItemType = itemType;
    this.lightboxIndex = index;
    this.isLightboxOpen = true;
    
    // Prevent body scrolling when lightbox is open
    document.body.style.overflow = 'hidden';
    
    this.galleryEvent.emit({
      type: 'lightboxOpened',
      item,
      itemType,
      index
    });
  }

  /**
   * Close lightbox.
   */
  public closeLightbox(): void {
    this.isLightboxOpen = false;
    this.lightboxItem = null;
    
    // Restore body scrolling
    document.body.style.overflow = '';
    
    if (this.lightboxItem) {
      this.galleryEvent.emit({
        type: 'lightboxClosed',
        item: this.lightboxItem,
        itemType: this.lightboxItemType,
        index: this.lightboxIndex
      });
    }
  }

  /**
   * Navigate to previous item in lightbox.
   */
  public lightboxPrevious(): void {
    if (this.lightboxIndex > 0) {
      const prevItem = this.galleryItems[this.lightboxIndex - 1];
      this.lightboxItem = prevItem.item;
      this.lightboxItemType = prevItem.type;
      this.lightboxIndex = prevItem.index;
    }
  }

  /**
   * Navigate to next item in lightbox.
   */
  public lightboxNext(): void {
    if (this.lightboxIndex < this.galleryItems.length - 1) {
      const nextItem = this.galleryItems[this.lightboxIndex + 1];
      this.lightboxItem = nextItem.item;
      this.lightboxItemType = nextItem.type;  
      this.lightboxIndex = nextItem.index;
    }
  }

  /**
   * Handle keyboard navigation in lightbox.
   */
  public onLightboxKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        this.closeLightbox();
        break;
      case 'ArrowLeft':
        this.lightboxPrevious();
        break;
      case 'ArrowRight':
        this.lightboxNext();
        break;
    }
  }

  /**
   * Get screenshot display URL.
   */
  public getScreenshotUrl(screenshot: Screenshot, fullSize: boolean = false): string {
    return fullSize ? screenshot.path_full : screenshot.path_thumbnail;
  }

  /**
   * Get video thumbnail URL.
   */
  public getVideoThumbnail(video: Movie): string {
    return video.thumbnail;
  }

  /**
   * Get video source URL with fallbacks.
   */
  public getVideoSource(video: Movie): string {
    return video.webm?.max || video.mp4?.max || video.webm?.['480'] || video.mp4?.['480'] || '';
  }

  /**
   * Get video title for display.
   */
  public getVideoTitle(video: Movie): string {
    return video.name || 'Untitled Video';
  }

  /**
   * Check if item is a screenshot.
   */
  public isScreenshot(item: Screenshot | Movie): item is Screenshot {
    return 'path_full' in item;
  }

  /**
   * Check if item is a video.
   */
  public isVideo(item: Screenshot | Movie): item is Movie {
    return 'thumbnail' in item && 'webm' in item;
  }
}