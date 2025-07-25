import { Screenshot, Movie } from '../../../types/game.types';

/**
 * Unified interface for screenshots and videos in media carousel.
 */
export interface MediaItem {
  /** Type of media item */
  type: 'screenshot' | 'video';
  
  /** Unique identifier */
  id: number;
  
  /** Thumbnail URL for preview */
  thumbnail: string;
  
  /** Display title/name */
  title: string;
  
  /** Original data from Steam API */
  data: Screenshot | Movie;
}

/**
 * Media carousel configuration options.
 */
export interface MediaCarouselConfig {
  /** Show fullscreen button */
  showFullscreen?: boolean;
  
  /** Auto-play videos */
  autoPlayVideos?: boolean;
  
  /** Show thumbnail navigation */
  showThumbnails?: boolean;
  
  /** Enable keyboard navigation */
  enableKeyboard?: boolean;
  
  /** Enable swipe gestures */
  enableSwipe?: boolean;
}

/**
 * Media carousel events.
 */
export interface MediaCarouselEvent {
  /** Type of event */
  type: 'itemChanged' | 'fullscreenToggled' | 'videoPlayed' | 'videoPaused';
  
  /** Current media item */
  item: MediaItem;
  
  /** Current index */
  index: number;
  
  /** Total items count */
  total: number;
}