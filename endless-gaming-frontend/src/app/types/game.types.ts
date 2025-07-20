/**
 * Type definitions for the Game Picker feature.
 * 
 * These interfaces match the backend API structure and define
 * the data types used throughout the application.
 */

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
}

/**
 * User choice event for analytics tracking.
 * Represents a single pairwise comparison decision.
 */
export interface ChoiceEvent {
  leftId: number;   // App ID of left game
  rightId: number;  // App ID of right game
  pick: 'left' | 'right' | 'skip';  // User's choice
  ts: number;       // Timestamp in epoch milliseconds (backend contract)
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
  comparisonCount: number;     // Number of comparisons made
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