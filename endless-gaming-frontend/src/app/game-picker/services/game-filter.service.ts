import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { GameRecord, GameRecommendation } from '../../types/game.types';
import Dexie, { Table } from 'dexie';

/**
 * Game filtering interfaces and types
 */
export interface PriceRange {
  min: number;
  max: number;
}

export interface GameFilters {
  // Price filters
  priceRange: PriceRange;
  isFreeOnly: boolean;
  priceTiers: string[];  // ['free', 'under5', '5to15', '15to30', 'over30']
  
  // Tag filters (most important)
  requiredTags: string[];
  excludedTags: string[];
  
  // Review filters
  minReviewScore: number;  // 0-100 percentage
  minReviewCount: number;
  
  // Developer/Publisher filters
  includedDevelopers: string[];
  excludedPublishers: string[];
  
  // Advanced filters
  scoreRange: PriceRange;  // ML preference score range
  topNOnly: number | null;  // Limit to top N results
  
  // Search
  searchText: string;
}

export interface FilterStats {
  totalGames: number;
  filteredGames: number;
  filterCount: number;
}

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: Partial<GameFilters>;
}

/**
 * Stored filter state for persistence
 */
export interface StoredFilterState {
  id: string;
  name: string;
  filters: GameFilters;
  createdAt: Date;
  lastUsed: Date;
}

/**
 * IndexedDB database for filter persistence
 */
class FilterDatabase extends Dexie {
  filterStates!: Table<StoredFilterState>;

  constructor() {
    super('GameFilterDatabase');
    this.version(1).stores({
      filterStates: 'id, name, createdAt, lastUsed'
    });
  }
}

/**
 * Default filter state
 */
const DEFAULT_FILTERS: GameFilters = {
  priceRange: { min: 0, max: 100 },
  isFreeOnly: false,
  priceTiers: [],
  requiredTags: [],
  excludedTags: [],
  minReviewScore: 0,
  minReviewCount: 0,
  includedDevelopers: [],
  excludedPublishers: [],
  scoreRange: { min: -10, max: 10 },
  topNOnly: null,
  searchText: ''
};

/**
 * Predefined filter presets for common use cases
 */
const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'popular-free',
    name: 'Popular Free Games',
    description: 'Well-reviewed free games',
    filters: {
      isFreeOnly: true,
      minReviewScore: 80,
      minReviewCount: 1000
    }
  },
  {
    id: 'high-rated-indies',
    name: 'High-Rated Indies',
    description: 'Indie games with excellent reviews',
    filters: {
      priceRange: { min: 5, max: 25 },
      minReviewScore: 85,
      excludedPublishers: ['Valve', 'Electronic Arts', 'Ubisoft', 'Activision']
    }
  },
  {
    id: 'multiplayer-focused',
    name: 'Multiplayer Games',
    description: 'Games built for playing with others',
    filters: {
      requiredTags: ['Multiplayer'],
      minReviewScore: 70
    }
  }
];

/**
 * Service for managing game filtering state and logic.
 * 
 * Provides reactive filter state, filtering algorithms, and preset management.
 * Uses Angular signals for optimal performance and RxJS for complex state interactions.
 */
@Injectable({
  providedIn: 'root'
})
export class GameFilterService {
  private db = new FilterDatabase();
  
  // Reactive filter state using BehaviorSubject for external subscription compatibility
  private filtersSubject = new BehaviorSubject<GameFilters>(DEFAULT_FILTERS);
  
  // Signal-based reactive state for components
  public readonly filters = signal<GameFilters>(DEFAULT_FILTERS);
  public readonly isFiltering = computed(() => this.hasActiveFilters(this.filters()));
  public readonly activeFilterCount = computed(() => this.countActiveFilters(this.filters()));
  
  // Available options for autocompletes (computed from available games)
  private availableTags = signal<string[]>([]);
  private availableTagsWithFrequency = signal<Array<{tag: string, count: number}>>([]);
  private tagCaseMap = signal<Map<string, string>>(new Map()); // lowercase -> correct case
  private availableDevelopers = signal<string[]>([]);
  private availablePublishers = signal<string[]>([]);
  
  // Filter stats
  private filterStats = signal<FilterStats>({
    totalGames: 0,
    filteredGames: 0,
    filterCount: 0
  });
  
  constructor() {
    // Sync signals with BehaviorSubject
    this.filtersSubject.subscribe(filters => {
      this.filters.set(filters);
    });
    
    // Load persisted filter state on startup
    this.loadPersistedFilterState();
  }
  
  /**
   * Get current filters as Observable for reactive programming
   */
  getFilters(): Observable<GameFilters> {
    return this.filtersSubject.asObservable();
  }
  
  /**
   * Update filters (partial update supported)
   */
  updateFilters(partialFilters: Partial<GameFilters>): void {
    const currentFilters = this.filtersSubject.value;
    const newFilters = { ...currentFilters, ...partialFilters };
    this.filtersSubject.next(newFilters);
    
    // Auto-save the updated filter state
    this.autoSaveFilterState();
  }
  
  /**
   * Reset all filters to default state
   */
  resetFilters(): void {
    console.log('🔄 GameFilterService: Resetting filters to defaults');
    this.filtersSubject.next({ ...DEFAULT_FILTERS });
    
    // Also clear auto-saved filter state
    this.clearAutoSavedState();
  }

  /**
   * Clear auto-saved filter state from IndexedDB
   */
  private async clearAutoSavedState(): Promise<void> {
    try {
      const AUTO_SAVE_KEY = 'auto_save_current';
      await this.db.filterStates.delete(AUTO_SAVE_KEY);
      console.log('🔄 GameFilterService: Cleared auto-saved filter state');
    } catch (error) {
      console.warn('Failed to clear auto-saved filter state:', error);
    }
  }
  
  /**
   * Apply preset filters
   */
  applyPreset(presetId: string): void {
    const preset = FILTER_PRESETS.find(p => p.id === presetId);
    if (preset) {
      this.updateFilters(preset.filters);
    }
  }
  
  /**
   * Get available filter presets
   */
  getPresets(): FilterPreset[] {
    return [...FILTER_PRESETS];
  }
  
  /**
   * Initialize available options from game data
   */
  initializeOptions(games: GameRecord[]): void {
    // Extract unique tags with counts and case mapping
    const tagCounts = new Map<string, number>();
    const caseMap = new Map<string, string>(); // lowercase -> correct case
    
    games.forEach(game => {
      Object.entries(game.tags || {}).forEach(([tag, votes]) => {
        const lowerTag = tag.toLowerCase();
        
        // Accumulate votes for case-insensitive tag
        tagCounts.set(lowerTag, (tagCounts.get(lowerTag) || 0) + votes);
        
        // Keep the most common case variant (or first one encountered)
        if (!caseMap.has(lowerTag) || votes > (tagCounts.get(lowerTag) || 0)) {
          caseMap.set(lowerTag, tag);
        }
      });
    });
    
    // Build sorted arrays with frequency data
    const sortedTagsWithFrequency = Array.from(tagCounts.entries())
      .map(([lowerTag, count]) => ({
        tag: caseMap.get(lowerTag) || lowerTag,
        count
      }))
      .sort((a, b) => b.count - a.count);
    
    const sortedTags = sortedTagsWithFrequency.map(item => item.tag);
    
    this.availableTags.set(sortedTags);
    this.availableTagsWithFrequency.set(sortedTagsWithFrequency);
    this.tagCaseMap.set(caseMap);
    
    console.log('🏷️ GameFilterService: Initialized', sortedTags.length, 'unique tags with case mapping');
    
    // Extract unique developers and publishers
    const developers = new Set<string>();
    const publishers = new Set<string>();
    
    games.forEach(game => {
      if (game.developer) developers.add(game.developer);
      if (game.publisher) publishers.add(game.publisher);
    });
    
    this.availableDevelopers.set(Array.from(developers).sort());
    this.availablePublishers.set(Array.from(publishers).sort());
    
    // Update total games count
    this.updateFilterStats(games.length, games.length);
  }
  
  /**
   * Get available tags for autocomplete
   */
  getAvailableTags(): string[] {
    return this.availableTags();
  }

  /**
   * Get available tags with frequency information
   */
  getAvailableTagsWithFrequency(): Array<{tag: string, count: number}> {
    return this.availableTagsWithFrequency();
  }

  /**
   * Normalize tag to correct case (case-insensitive lookup)
   */
  normalizeTag(inputTag: string): string | null {
    const lowerInput = inputTag.toLowerCase().trim();
    const correctCase = this.tagCaseMap().get(lowerInput);
    return correctCase || null;
  }

  /**
   * Search tags with case-insensitive matching and frequency info
   */
  searchTags(searchTerm: string, limit: number = 10): Array<{tag: string, count: number}> {
    if (!searchTerm.trim()) {
      return this.availableTagsWithFrequency().slice(0, limit);
    }
    
    const lowerSearch = searchTerm.toLowerCase();
    return this.availableTagsWithFrequency()
      .filter(item => item.tag.toLowerCase().includes(lowerSearch))
      .slice(0, limit);
  }
  
  /**
   * Get available developers for autocomplete
   */
  getAvailableDevelopers(): string[] {
    return this.availableDevelopers();
  }
  
  /**
   * Get available publishers for autocomplete
   */
  getAvailablePublishers(): string[] {
    return this.availablePublishers();
  }
  
  /**
   * Get current filter statistics
   */
  getFilterStats(): FilterStats {
    return this.filterStats();
  }
  
  /**
   * Update filter statistics
   */
  updateFilterStats(total: number, filtered: number): void {
    this.filterStats.set({
      totalGames: total,
      filteredGames: filtered,
      filterCount: this.activeFilterCount()
    });
  }
  
  /**
   * Apply all filters to a list of games
   */
  applyFilters(games: GameRecord[], currentFilters?: GameFilters): GameRecord[] {
    const filters = currentFilters || this.filters();
    
    let filteredGames = games.filter(game => {
      // Search text filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        if (!game.name.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      
      // Price filters
      if (filters.isFreeOnly && game.price !== "Free") {
        return false;
      }
      
      if (!filters.isFreeOnly && filters.priceRange) {
        const price = this.parsePrice(game.price);
        if (price < filters.priceRange.min || price > filters.priceRange.max) {
          return false;
        }
      }
      
      // Price tiers filter
      if (filters.priceTiers.length > 0) {
        const priceTier = this.getPriceTier(game.price);
        if (!filters.priceTiers.includes(priceTier)) {
          return false;
        }
      }
      
      // Required tags filter
      if (filters.requiredTags.length > 0) {
        const hasAllRequired = filters.requiredTags.every(tag => 
          game.tags && game.tags[tag] && game.tags[tag] > 0
        );
        if (!hasAllRequired) {
          return false;
        }
      }
      
      // Excluded tags filter
      if (filters.excludedTags.length > 0) {
        const hasExcluded = filters.excludedTags.some(tag => 
          game.tags && game.tags[tag] && game.tags[tag] > 0
        );
        if (hasExcluded) {
          return false;
        }
      }
      
      // Review filters
      const totalReviews = (game.reviewPos || 0) + (game.reviewNeg || 0);
      if (totalReviews < filters.minReviewCount) {
        return false;
      }
      
      if (totalReviews > 0) {
        const reviewScore = ((game.reviewPos || 0) / totalReviews) * 100;
        if (reviewScore < filters.minReviewScore) {
          return false;
        }
      }
      
      // Developer/Publisher filters
      if (filters.includedDevelopers.length > 0) {
        if (!game.developer || !filters.includedDevelopers.includes(game.developer)) {
          return false;
        }
      }
      
      if (filters.excludedPublishers.length > 0) {
        if (game.publisher && filters.excludedPublishers.includes(game.publisher)) {
          return false;
        }
      }
      
      return true;
    });
    
    // Apply top N limit if specified
    if (filters.topNOnly && filters.topNOnly > 0) {
      filteredGames = filteredGames.slice(0, filters.topNOnly);
    }
    
    // Update stats
    this.updateFilterStats(games.length, filteredGames.length);
    
    return filteredGames;
  }
  
  /**
   * Apply filters to game recommendations (preserves ranking)
   */
  applyFiltersToRecommendations(recommendations: GameRecommendation[], currentFilters?: GameFilters): GameRecommendation[] {
    const filters = currentFilters || this.filters();
    
    let filteredRecs = recommendations.filter(rec => {
      // Apply same filtering logic but to the game within the recommendation
      const gameArray = [rec.game];
      const filtered = this.applyFilters(gameArray, filters);
      return filtered.length > 0;
    });
    
    // Apply score range filter to recommendations
    if (filters.scoreRange) {
      filteredRecs = filteredRecs.filter(rec => 
        rec.score >= filters.scoreRange.min && rec.score <= filters.scoreRange.max
      );
    }
    
    // Apply top N limit
    if (filters.topNOnly && filters.topNOnly > 0) {
      filteredRecs = filteredRecs.slice(0, filters.topNOnly);
    }
    
    return filteredRecs;
  }
  
  /**
   * Check if any filters are currently active
   */
  private hasActiveFilters(filters: GameFilters): boolean {
    return (
      filters.searchText !== '' ||
      filters.isFreeOnly ||
      filters.priceTiers.length > 0 ||
      filters.requiredTags.length > 0 ||
      filters.excludedTags.length > 0 ||
      filters.minReviewScore > 0 ||
      filters.minReviewCount > 0 ||
      filters.includedDevelopers.length > 0 ||
      filters.excludedPublishers.length > 0 ||
      filters.topNOnly !== null ||
      filters.priceRange.min > DEFAULT_FILTERS.priceRange.min ||
      filters.priceRange.max < DEFAULT_FILTERS.priceRange.max ||
      filters.scoreRange.min > DEFAULT_FILTERS.scoreRange.min ||
      filters.scoreRange.max < DEFAULT_FILTERS.scoreRange.max
    );
  }
  
  /**
   * Count active filters for badge display
   */
  private countActiveFilters(filters: GameFilters): number {
    let count = 0;
    
    if (filters.searchText !== '') count++;
    if (filters.isFreeOnly) count++;
    if (filters.priceTiers.length > 0) count++;
    if (filters.requiredTags.length > 0) count++;
    if (filters.excludedTags.length > 0) count++;
    if (filters.minReviewScore > 0) count++;
    if (filters.minReviewCount > 0) count++;
    if (filters.includedDevelopers.length > 0) count++;
    if (filters.excludedPublishers.length > 0) count++;
    if (filters.topNOnly !== null) count++;
    
    // Price/score range filters
    if (filters.priceRange.min > DEFAULT_FILTERS.priceRange.min || 
        filters.priceRange.max < DEFAULT_FILTERS.priceRange.max) count++;
    if (filters.scoreRange.min > DEFAULT_FILTERS.scoreRange.min || 
        filters.scoreRange.max < DEFAULT_FILTERS.scoreRange.max) count++;
    
    return count;
  }
  
  /**
   * Parse price string to number
   */
  private parsePrice(price: string | null): number {
    if (!price || price === "Free") return 0;
    return parseFloat(price) || 0;
  }
  
  /**
   * Get price tier category for a game
   */
  private getPriceTier(price: string | null): string {
    const numPrice = this.parsePrice(price);
    
    if (numPrice === 0) return 'free';
    if (numPrice < 5) return 'under5';
    if (numPrice <= 15) return '5to15';
    if (numPrice <= 30) return '15to30';
    return 'over30';
  }
  
  /**
   * Get active filters summary for display
   */
  getActiveFiltersSummary(): Array<{label: string, value: string, type: string}> {
    const filters = this.filters();
    const summary: Array<{label: string, value: string, type: string}> = [];
    
    if (filters.searchText) {
      summary.push({ label: 'Search', value: filters.searchText, type: 'search' });
    }
    
    if (filters.isFreeOnly) {
      summary.push({ label: 'Price', value: 'Free Only', type: 'price' });
    }
    
    filters.requiredTags.forEach(tag => {
      summary.push({ label: 'Must Include', value: tag, type: 'required-tag' });
    });
    
    filters.excludedTags.forEach(tag => {
      summary.push({ label: 'Exclude', value: tag, type: 'excluded-tag' });
    });
    
    if (filters.minReviewScore > 0) {
      summary.push({ 
        label: 'Min Rating', 
        value: `${filters.minReviewScore}%+`, 
        type: 'review' 
      });
    }
    
    if (filters.topNOnly) {
      summary.push({ 
        label: 'Limit', 
        value: `Top ${filters.topNOnly}`, 
        type: 'limit' 
      });
    }
    
    return summary;
  }
  
  /**
   * Remove specific filter by type and value
   */
  removeFilter(type: string, value?: string): void {
    const current = { ...this.filters() };
    
    switch (type) {
      case 'search':
        current.searchText = '';
        break;
      case 'price':
        current.isFreeOnly = false;
        current.priceTiers = [];
        break;
      case 'required-tag':
        if (value) {
          current.requiredTags = current.requiredTags.filter(tag => tag !== value);
        }
        break;
      case 'excluded-tag':
        if (value) {
          current.excludedTags = current.excludedTags.filter(tag => tag !== value);
        }
        break;
      case 'review':
        current.minReviewScore = 0;
        current.minReviewCount = 0;
        break;
      case 'limit':
        current.topNOnly = null;
        break;
    }
    
    this.updateFilters(current);
  }

  // Filter State Persistence Methods

  /**
   * Save current filter state to IndexedDB
   */
  async saveFilterState(name: string): Promise<string> {
    try {
      const id = `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();
      
      const state: StoredFilterState = {
        id,
        name,
        filters: { ...this.filters() },
        createdAt: now,
        lastUsed: now
      };
      
      await this.db.filterStates.add(state);
      return id;
    } catch (error) {
      console.error('Failed to save filter state:', error);
      throw error;
    }
  }

  /**
   * Load filter state from IndexedDB
   */
  async loadFilterState(id: string): Promise<void> {
    try {
      const state = await this.db.filterStates.get(id);
      if (state) {
        this.updateFilters(state.filters);
        
        // Update last used timestamp
        await this.db.filterStates.update(id, { lastUsed: new Date() });
      }
    } catch (error) {
      console.error('Failed to load filter state:', error);
    }
  }

  /**
   * Get all saved filter states
   */
  async getSavedFilterStates(): Promise<StoredFilterState[]> {
    try {
      return await this.db.filterStates
        .orderBy('lastUsed')
        .reverse()
        .toArray();
    } catch (error) {
      console.error('Failed to get saved filter states:', error);
      return [];
    }
  }

  /**
   * Delete saved filter state
   */
  async deleteFilterState(id: string): Promise<void> {
    try {
      await this.db.filterStates.delete(id);
    } catch (error) {
      console.error('Failed to delete filter state:', error);
    }
  }

  /**
   * Auto-save current filter state (called when filters change)
   */
  private async autoSaveFilterState(): Promise<void> {
    try {
      const AUTO_SAVE_KEY = 'auto_save_current';
      
      // Check if auto-save entry exists
      const existing = await this.db.filterStates.get(AUTO_SAVE_KEY);
      
      if (existing) {
        // Update existing auto-save
        await this.db.filterStates.update(AUTO_SAVE_KEY, {
          filters: { ...this.filters() },
          lastUsed: new Date()
        });
      } else {
        // Create new auto-save entry
        const state: StoredFilterState = {
          id: AUTO_SAVE_KEY,
          name: 'Auto-save (Current Session)',
          filters: { ...this.filters() },
          createdAt: new Date(),
          lastUsed: new Date()
        };
        
        await this.db.filterStates.add(state);
      }
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  }

  /**
   * Load persisted filter state on service initialization
   */
  async loadPersistedFilterState(): Promise<void> {
    try {
      const AUTO_SAVE_KEY = 'auto_save_current';
      const state = await this.db.filterStates.get(AUTO_SAVE_KEY);
      
      if (state) {
        // Check if auto-saved state is recent (within 24 hours)
        const hoursSinceLastUsed = (Date.now() - state.lastUsed.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastUsed < 24) {
          this.updateFilters(state.filters);
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted filter state:', error);
    }
  }
}