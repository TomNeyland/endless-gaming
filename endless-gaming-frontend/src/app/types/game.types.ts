/**
 * Type definitions for the Game Picker feature.
 * 
 * These interfaces match the backend API structure and define
 * the data types used throughout the application.
 */

/**
 * Screenshot data from Steam Store API.
 */
export interface Screenshot {
  id: number;
  path_thumbnail: string;  // 600x338 thumbnail URL
  path_full: string;       // 1920x1080 full resolution URL
}

/**
 * Movie/video data from Steam Store API.
 */
export interface Movie {
  id: number;
  name: string;
  thumbnail: string;       // Video thumbnail URL
  webm?: {                 // WebM video formats (optional)
    480?: string;          // 480p WebM URL
    max?: string;          // Max quality WebM URL
  };
  mp4?: {                  // MP4 video formats (optional)
    480?: string;          // 480p MP4 URL
    max?: string;          // Max quality MP4 URL
  };
  highlight: boolean;      // Whether this is a featured video
}

/**
 * Game record from the backend API (/discovery/games/master.json).
 * Field names are in camelCase to match backend response format.
 */
export interface GameRecord {
  appId: number;
  name: string;
  coverUrl: string | null;
  price: string | null;  // "Free" for free games, dollar amount for paid
  developer: string | null;
  publisher: string | null;
  tags: { [tag: string]: number };  // Tag name -> vote count
  genres: string[];
  reviewPos: number | null;  // Positive review count
  reviewNeg: number | null;  // Negative review count
  
  // Steam Store API fields (rich content)
  shortDescription?: string | null;
  detailedDescription?: string | null;
  isFree?: boolean | null;
  requiredAge?: number | null;
  website?: string | null;
  releaseDate?: string | null;      // "Aug 21, 2012" format
  developers?: string[] | null;     // Array from Steam Store (vs single from SteamSpy)
  publishers?: string[] | null;     // Array from Steam Store (vs single from SteamSpy)
  storeGenres?: Array<{id: string; description: string}> | null;
  categories?: Array<{id: number; description: string}> | null;
  supportedLanguages?: string | null;
  priceData?: any | null;           // Price overview object
  pcRequirements?: any | null;      // System requirements object
  screenshots?: Screenshot[] | null; // Array of screenshot objects
  movies?: Movie[] | null;          // Array of video objects
}


/**
 * Sparse vector representation for efficient ML operations.
 * Uses typed arrays for performance.
 */
export interface SparseVector {
  indices: Uint16Array;  // Tag indices (references tag dictionary)
  values: Float32Array;  // Normalized tag values
  size: number;          // Total vector dimension
}

/**
 * Summary of learned user preferences.
 * Used for real-time feedback display.
 */
export interface PreferenceSummary {
  likedTags: Array<{
    tag: string;
    weight: number;
  }>;
  dislikedTags: Array<{
    tag: string;
    weight: number;
  }>;
}

/**
 * Progress tracking for the comparison phase.
 */
export interface ProgressInfo {
  current: number;  // Number of comparisons completed
  total: number;    // Target number of comparisons (usually 20)
}

/**
 * Game pair for comparison.
 * Selected by uncertainty sampling algorithm.
 */
export interface GamePair {
  left: GameRecord;
  right: GameRecord;
}

/**
 * User preference state that gets persisted to IndexedDB.
 */
export interface UserPreferenceState {
  weightVector: number[];      // Dense weight vector (serializable)
  comparisonCount: number;     // Number of comparisons made (for compatibility, same as actualVoteCount)
  actualVoteCount?: number;    // Number of actual votes (excludes skips) - optional for backwards compatibility
  totalComparisonCount?: number; // Total comparisons including skips - optional for backwards compatibility
  tagDict: TagDictionary | null; // Associated tag dictionary
}

/**
 * Tag dictionary mapping tag names to indices.
 * Used for sparse vector operations.
 */
export interface TagDictionary {
  tagToIndex: { [tag: string]: number };
  indexToTag: string[];
  size: number;
}

/**
 * Ranked game recommendation with confidence score.
 */
export interface GameRecommendation {
  game: GameRecord;
  score: number;      // Preference score from ML model
  rank: number;       // Position in recommendation list (1-based)
}

/**
 * Application states for the game picker flow.
 */
export type GamePickerState = 
  | 'loading'           // Loading master data from backend
  | 'comparing'         // Pairwise comparison phase
  | 'recommendations'   // Showing final ranked list
  | 'error';            // Error state

/**
 * Configuration constants for the ML algorithm.
 */
export interface MLConfig {
  readonly LEARNING_RATE: number;        // SGD learning rate
  readonly TARGET_COMPARISONS: number;   // Target number of comparisons
  readonly TOP_RECOMMENDATIONS: number;   // Number of top games to show
  readonly MIN_TAG_VOTES: number;        // Minimum votes for tag to be included
}

/**
 * TF-IDF tag rarity analysis results.
 * Used to weight tag importance based on rarity across the game catalog.
 */
export interface TagRarityAnalysis {
  tagFrequency: Map<string, number>;      // Number of games per tag
  inverseFrequency: Map<string, number>;  // IDF values per tag
  totalGames: number;                     // Total number of games analyzed
}

/**
 * Configuration for TF-IDF tag weighting system.
 */
export interface TFIDFConfig {
  readonly maxMultiplier: number;    // Maximum importance multiplier (default: 3.0)
  readonly minMultiplier: number;    // Minimum importance multiplier (default: 0.5)
  readonly smoothingEnabled: boolean; // Whether to apply smoothing to prevent extremes
}

/**
 * Enhanced tag with both popularity and TF-IDF information.
 * Used for displaying tags with rarity context in the UI.
 */
export interface EnhancedTag {
  tag: string;                    // Tag name
  votes: number;                  // Raw vote count from Steam
  type: 'popular' | 'unique';     // Whether this is a popular or unique tag
  tfidfScore?: number;            // TF-IDF importance score (0-n)
  multiplier?: number;            // TF-IDF learning multiplier (0.5-3.0)
}

/**
 * Complete enhanced tag display data for a game.
 * Separates popular tags (high votes) from unique tags (high TF-IDF).
 */
export interface EnhancedTagDisplay {
  popularTags: EnhancedTag[];     // Top tags by vote count
  uniqueTags: EnhancedTag[];      // Top tags by TF-IDF score (deduplicated)
  allTags: EnhancedTag[];         // Combined list for display
}