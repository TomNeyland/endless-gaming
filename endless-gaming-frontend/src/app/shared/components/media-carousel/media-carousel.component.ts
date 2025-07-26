import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';

import { MediaItem, MediaCarouselConfig, MediaCarouselEvent } from './media-item.interface';
import { Screenshot, Movie } from '../../../types/game.types';

/**
 * Unified media carousel component for screenshots and videos.
 * 
 * Features:
 * - Seamless browsing between screenshots and videos
 * - Thumbnail navigation strip
 * - Keyboard and swipe navigation
 * - Fullscreen overlay support
 * - Material Design styling
 */
@Component({
  selector: 'app-media-carousel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './media-carousel.component.html',
  styleUrl: './media-carousel.component.scss',
  animations: [
    // Slide transition for main display
    trigger('slideTransition', [
      transition(':increment', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':decrement', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ]),
    
    // Fade in animation for media items
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),
    
    // Thumbnail highlight animation
    trigger('thumbnailHighlight', [
      state('active', style({ transform: 'scale(1.1)', boxShadow: '0 0 0 3px var(--gaming-accent)' })),
      state('inactive', style({ transform: 'scale(1)', boxShadow: 'none' })),
      transition('inactive => active', animate('200ms ease-out')),
      transition('active => inactive', animate('200ms ease-out'))
    ]),
    
    // Control button animations
    trigger('buttonPulse', [
      transition(':enter', [
        animate('0.3s ease-out', keyframes([
          style({ transform: 'scale(0.8)', opacity: 0, offset: 0 }),
          style({ transform: 'scale(1.1)', opacity: 0.8, offset: 0.7 }),
          style({ transform: 'scale(1)', opacity: 1, offset: 1 })
        ]))
      ])
    ])
  ]
})
export class MediaCarouselComponent implements OnInit, OnDestroy {
  @Input() screenshots: Screenshot[] = [];
  @Input() videos: Movie[] = [];
  @Input() config: MediaCarouselConfig = {};
  @Output() carouselEvent = new EventEmitter<MediaCarouselEvent>();

  @ViewChild('mainDisplay') mainDisplay!: ElementRef<HTMLDivElement>;
  @ViewChild('thumbnailStrip') thumbnailStrip!: ElementRef<HTMLDivElement>;

  mediaItems: MediaItem[] = [];
  currentIndex: number = 0;
  isLoading: boolean = false;
  isFullscreen: boolean = false;

  // Default configuration
  private defaultConfig: MediaCarouselConfig = {
    showFullscreen: true,
    autoPlayVideos: false,
    showThumbnails: true,
    enableKeyboard: true,
    enableSwipe: true
  };

  ngOnInit(): void {
    this.config = { ...this.defaultConfig, ...this.config };
    this.buildMediaItems();
    
    if (this.mediaItems.length > 0) {
      this.selectItem(0);
    }
  }

  ngOnDestroy(): void {
    // Cleanup any active video playback
    this.pauseAllVideos();
  }

  /**
   * Build unified media items array from screenshots and videos.
   */
  private buildMediaItems(): void {
    this.mediaItems = [];

    // Add screenshots
    this.screenshots.forEach(screenshot => {
      this.mediaItems.push({
        type: 'screenshot',
        id: screenshot.id,
        thumbnail: screenshot.path_thumbnail,
        title: `Screenshot ${screenshot.id}`,
        data: screenshot
      });
    });

    // Add videos
    this.videos.forEach(video => {
      this.mediaItems.push({
        type: 'video',
        id: video.id,
        thumbnail: video.thumbnail,
        title: video.name,
        data: video
      });
    });
  }

  /**
   * Get current media item.
   */
  getCurrentItem(): MediaItem | null {
    return this.mediaItems[this.currentIndex] || null;
  }

  /**
   * Select media item by index.
   */
  selectItem(index: number): void {
    if (index < 0 || index >= this.mediaItems.length) return;

    const previousIndex = this.currentIndex;
    this.currentIndex = index;
    
    // Pause any playing videos when switching
    if (previousIndex !== index) {
      this.pauseAllVideos();
    }

    // Scroll thumbnail into view
    this.scrollThumbnailIntoView(index);

    // Emit event
    const currentItem = this.getCurrentItem();
    if (currentItem) {
      this.carouselEvent.emit({
        type: 'itemChanged',
        item: currentItem,
        index: this.currentIndex,
        total: this.mediaItems.length
      });
    }
  }

  /**
   * Navigate to previous item.
   */
  goToPrevious(): void {
    const newIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.mediaItems.length - 1;
    this.selectItem(newIndex);
  }

  /**
   * Navigate to next item.
   */
  goToNext(): void {
    const newIndex = this.currentIndex < this.mediaItems.length - 1 ? this.currentIndex + 1 : 0;
    this.selectItem(newIndex);
  }

  /**
   * Toggle fullscreen mode.
   */
  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    
    const currentItem = this.getCurrentItem();
    if (currentItem) {
      this.carouselEvent.emit({
        type: 'fullscreenToggled',
        item: currentItem,
        index: this.currentIndex,
        total: this.mediaItems.length
      });
    }
  }

  /**
   * Handle keyboard navigation.
   */
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.config.enableKeyboard) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.goToPrevious();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.goToNext();
        break;
      case 'Escape':
        if (this.isFullscreen) {
          event.preventDefault();
          this.toggleFullscreen();
        }
        break;
      case ' ':
        event.preventDefault();
        this.toggleVideoPlayback();
        break;
    }
  }

  /**
   * Get screenshot data for current item (if screenshot).
   */
  getCurrentScreenshot(): Screenshot | null {
    const item = this.getCurrentItem();
    return item?.type === 'screenshot' ? item.data as Screenshot : null;
  }

  /**
   * Get video data for current item (if video).
   */
  getCurrentVideo(): Movie | null {
    const item = this.getCurrentItem();
    return item?.type === 'video' ? item.data as Movie : null;
  }

  /**
   * Get video source URL with format fallbacks.
   */
  getVideoSource(video: Movie): string {
    return video.webm?.max || video.mp4?.max || video.webm?.['480'] || video.mp4?.['480'] || '';
  }

  /**
   * Get current video WebM max source.
   */
  getCurrentVideoWebMMax(): string {
    const video = this.getCurrentVideo();
    return video?.webm?.max || '';
  }

  /**
   * Get current video MP4 max source.
   */
  getCurrentVideoMP4Max(): string {
    const video = this.getCurrentVideo();
    return video?.mp4?.max || '';
  }

  /**
   * Get current video WebM 480p source.
   */
  getCurrentVideoWebM480(): string {
    const video = this.getCurrentVideo();
    return video?.webm?.['480'] || '';
  }

  /**
   * Get current video MP4 480p source.
   */
  getCurrentVideoMP4480(): string {
    const video = this.getCurrentVideo();
    return video?.mp4?.['480'] || '';
  }

  /**
   * Toggle video playback (play/pause).
   */
  toggleVideoPlayback(): void {
    const video = this.getCurrentVideo();
    if (!video) return;

    const videoElement = this.mainDisplay?.nativeElement.querySelector('video') as HTMLVideoElement;
    if (!videoElement) return;

    if (videoElement.paused) {
      videoElement.play();
      const currentItem = this.getCurrentItem()!;
      this.carouselEvent.emit({
        type: 'videoPlayed',
        item: currentItem,
        index: this.currentIndex,
        total: this.mediaItems.length
      });
    } else {
      videoElement.pause();
      const currentItem = this.getCurrentItem()!;
      this.carouselEvent.emit({
        type: 'videoPaused',
        item: currentItem,
        index: this.currentIndex,
        total: this.mediaItems.length
      });
    }
  }

  /**
   * Pause all video elements.
   */
  private pauseAllVideos(): void {
    const videoElements = document.querySelectorAll('app-media-carousel video');
    videoElements.forEach(video => {
      (video as HTMLVideoElement).pause();
    });
  }

  /**
   * Scroll thumbnail into view.
   */
  private scrollThumbnailIntoView(index: number): void {
    if (!this.config.showThumbnails || !this.thumbnailStrip) return;

    const thumbnailElements = this.thumbnailStrip.nativeElement.querySelectorAll('.thumbnail-item');
    const targetThumbnail = thumbnailElements[index] as HTMLElement;
    
    if (targetThumbnail) {
      targetThumbnail.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  /**
   * Check if there are any media items.
   */
  hasMediaItems(): boolean {
    return this.mediaItems.length > 0;
  }

  /**
   * Get total media count.
   */
  getMediaCount(): number {
    return this.mediaItems.length;
  }

  /**
   * Check if current item is a video.
   */
  isCurrentItemVideo(): boolean {
    return this.getCurrentItem()?.type === 'video';
  }

  /**
   * Check if current item is a screenshot.
   */
  isCurrentItemScreenshot(): boolean {
    return this.getCurrentItem()?.type === 'screenshot';
  }

  /**
   * Handle image load events.
   */
  onImageLoad(): void {
    this.isLoading = false;
  }

  /**
   * Handle image error events.
   */
  onImageError(): void {
    this.isLoading = false;
  }

  /**
   * Handle video load events.
   */
  onVideoLoad(): void {
    this.isLoading = false;
  }

  /**
   * Start loading state.
   */
  private startLoading(): void {
    this.isLoading = true;
  }
}