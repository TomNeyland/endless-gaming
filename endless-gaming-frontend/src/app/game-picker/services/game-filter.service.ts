import { Injectable, signal, computed, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { GameRecord, GameRecommendation, SteamPlayerLookupResponse } from '../../types/game.types';
import Dexie, { Table } from 'dexie';
import { AgeCategory, matchesAgeFilter } from '../../utils/game-age.utils';
import { SteamIntegrationService } from './steam-integration.service';

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
  
  // Age-based filters
  ageCategories: AgeCategory[];  // ['new', 'recent', 'established', 'classic']
  releaseYearRange: PriceRange;  // Min/max release year
  maxGameAge: number | null;     // Maximum age in years
  
  // Steam integration filters
  showOwnedOnly: boolean;        // Only show games user owns
  hideOwnedGames: boolean;       // Hide games user already owns
  playtimeCategories: string[];  // ['unplayed', 'light', 'moderate', 'heavy', 'obsessed']
  playtimeRange: PriceRange;     // Min/max playtime in hours
  recentlyPlayedOnly: boolean;   // Only show games played in last 2 weeks
  steamDataAvailable: boolean;   // Internal flag to track if Steam data is available
  
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
  minReviewScore: 70,  // Start at 70%
  minReviewCount: 0,   // Will be removed from UI
  includedDevelopers: [],
  excludedPublishers: [],
  scoreRange: { min: -10, max: 10 },
  topNOnly: null,
  ageCategories: [],
  releaseYearRange: { min: 1970, max: new Date().getFullYear() }, // Will be updated dynamically
  maxGameAge: null,
  // Steam filters
  showOwnedOnly: false,
  hideOwnedGames: false,
  playtimeCategories: [],
  playtimeRange: { min: 0, max: 1000 },  // 0 to 1000 hours
  recentlyPlayedOnly: false,
  steamDataAvailable: false,
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
  private steamIntegrationService = inject(SteamIntegrationService);
  
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
  
  // Data ranges from actual dataset
  private dataYearRange = signal<{ min: number, max: number }>({ min: 1970, max: new Date().getFullYear() });
  private dataPriceRange = signal<{ min: number, max: number }>({ min: 0, max: 100 });
  
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
    // Extract unique tags with game counts (not vote counts) and case mapping
    const tagGameCounts = new Map<string, Set<number>>(); // track unique game IDs per tag
    const caseMap = new Map<string, string>(); // lowercase -> correct case
    
    games.forEach(game => {
      Object.entries(game.tags || {}).forEach(([tag, votes]) => {
        const lowerTag = tag.toLowerCase();
        
        // Track this game for this tag (unique games count)
        if (!tagGameCounts.has(lowerTag)) {
          tagGameCounts.set(lowerTag, new Set());
        }
        tagGameCounts.get(lowerTag)!.add(game.appId);
        
        // Keep the most common case variant (first one encountered with most votes)
        if (!caseMap.has(lowerTag)) {
          caseMap.set(lowerTag, tag);
        }
      });
    });
    
    // Analyze actual price and year ranges from the dataset
    const prices: number[] = [];
    const years: number[] = [];
    
    games.forEach(game => {
      // Extract prices
      if (game.price && game.price !== 'Free') {
        const price = parseFloat(game.price.replace('$', ''));
        if (!isNaN(price)) {
          prices.push(price);
        }
      }
      
      // Extract years from release date (assuming formats like "Aug 21, 2012")
      if (game.releaseDate) {
        const yearMatch = game.releaseDate.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          const year = parseInt(yearMatch[0]);
          if (year >= 1970 && year <= new Date().getFullYear()) {
            years.push(year);
          }
        }
      }
    });
    
    // Store data ranges for slider min/max values (don't update filter values)
    if (prices.length > 0) {
      const maxPrice = Math.max(...prices);
      const roundedMaxPrice = Math.ceil(maxPrice / 10) * 10;
      this.dataPriceRange.set({
        min: 0,
        max: Math.min(roundedMaxPrice, 100) // Cap at $100 for UI
      });
    }
    
    if (years.length > 0) {
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      this.dataYearRange.set({
        min: minYear,
        max: maxYear
      });
    }
    
    // Build sorted arrays with unique game counts
    const sortedTagsWithFrequency = Array.from(tagGameCounts.entries())
      .map(([lowerTag, gameIds]) => ({
        tag: caseMap.get(lowerTag) || lowerTag,
        count: gameIds.size // Number of unique games with this tag
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
    
    console.log('🏷️ GameFilterService: Initialized with', sortedTags.length, 'unique tags');
    console.log('💰 Price range:', prices.length > 0 ? `$0-$${Math.min(Math.ceil(Math.max(...prices) / 10) * 10, 100)}` : 'No price data');
    console.log('📅 Year range:', years.length > 0 ? `${Math.min(...years)}-${Math.max(...years)}` : 'No year data');
  }
  
  /**
   * Update tag counts based on currently filtered games.
   * This method should be called whenever filters change to show "remaining" game counts.
   */
  updateTagCountsForFilteredGames(filteredGames: GameRecord[]): void {
    const tagGameCounts = new Map<string, Set<number>>();
    const caseMap = this.tagCaseMap();
    
    // Count unique games for each tag in the filtered set
    filteredGames.forEach(game => {
      Object.entries(game.tags || {}).forEach(([tag, votes]) => {
        const lowerTag = tag.toLowerCase();
        
        if (!tagGameCounts.has(lowerTag)) {
          tagGameCounts.set(lowerTag, new Set());
        }
        tagGameCounts.get(lowerTag)!.add(game.appId);
      });
    });
    
    // Rebuild sorted arrays with updated counts
    const sortedTagsWithFrequency = Array.from(tagGameCounts.entries())
      .map(([lowerTag, gameIds]) => ({
        tag: caseMap.get(lowerTag) || lowerTag,
        count: gameIds.size
      }))
      .filter(item => item.count > 0) // Only show tags that have remaining games
      .sort((a, b) => b.count - a.count);
    
    this.availableTagsWithFrequency.set(sortedTagsWithFrequency);
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
   * Get data year range from actual dataset
   */
  getDataYearRange(): { min: number, max: number } {
    return this.dataYearRange();
  }

  /**
   * Get data price range from actual dataset
   */
  getDataPriceRange(): { min: number, max: number } {
    return this.dataPriceRange();
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
  applyFilters(games: GameRecord[], currentFilters?: GameFilters, steamData?: SteamPlayerLookupResponse): GameRecord[] {
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
      
      // Age-based filters
      if (filters.ageCategories.length > 0 || filters.maxGameAge !== null || 
          filters.releaseYearRange.min > 1970 || filters.releaseYearRange.max < new Date().getFullYear()) {
        if (!matchesAgeFilter(
          game.releaseDate,
          filters.ageCategories,
          filters.releaseYearRange,
          filters.maxGameAge
        )) {
          return false;
        }
      }
      
      // Steam-specific filters (only apply if Steam data is available)
      if (steamData && filters.steamDataAvailable) {
        const isOwned = this.steamIntegrationService.isGameOwned(game, steamData);
        const playtime = this.steamIntegrationService.getGamePlaytime(game, steamData);
        
        // Show owned only filter
        if (filters.showOwnedOnly && !isOwned) {
          return false;
        }
        
        // Hide owned games filter
        if (filters.hideOwnedGames && isOwned) {
          return false;
        }
        
        // Playtime category filters
        if (filters.playtimeCategories.length > 0 && isOwned && playtime) {
          const category = this.steamIntegrationService.getPlaytimeCategory(playtime.playtime_forever);
          if (!filters.playtimeCategories.includes(category.category)) {
            return false;
          }
        }
        
        // Playtime range filter
        if (isOwned && playtime && (filters.playtimeRange.min > 0 || filters.playtimeRange.max < 1000)) {
          const playtimeHours = playtime.playtime_forever / 60;
          if (playtimeHours < filters.playtimeRange.min || playtimeHours > filters.playtimeRange.max) {
            return false;
          }
        }
        
        // Recently played only filter
        if (filters.recentlyPlayedOnly) {
          if (!isOwned || !playtime || !playtime.playtime_2weeks || playtime.playtime_2weeks === 0) {
            return false;
          }
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
    
    // Update tag counts based on filtered games to show "remaining" counts
    this.updateTagCountsForFilteredGames(filteredGames);
    
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
      filters.scoreRange.max < DEFAULT_FILTERS.scoreRange.max ||
      filters.ageCategories.length > 0 ||
      filters.releaseYearRange.min > DEFAULT_FILTERS.releaseYearRange.min ||
      filters.releaseYearRange.max < DEFAULT_FILTERS.releaseYearRange.max ||
      filters.maxGameAge !== null ||
      // Steam filters
      filters.showOwnedOnly ||
      filters.hideOwnedGames ||
      filters.playtimeCategories.length > 0 ||
      filters.playtimeRange.min > DEFAULT_FILTERS.playtimeRange.min ||
      filters.playtimeRange.max < DEFAULT_FILTERS.playtimeRange.max ||
      filters.recentlyPlayedOnly
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
    
    // Age-based filters
    if (filters.ageCategories.length > 0) count++;
    if (filters.releaseYearRange.min > DEFAULT_FILTERS.releaseYearRange.min ||
        filters.releaseYearRange.max < DEFAULT_FILTERS.releaseYearRange.max) count++;
    if (filters.maxGameAge !== null) count++;
    
    // Steam filters
    if (filters.showOwnedOnly) count++;
    if (filters.hideOwnedGames) count++;
    if (filters.playtimeCategories.length > 0) count++;
    if (filters.playtimeRange.min > DEFAULT_FILTERS.playtimeRange.min ||
        filters.playtimeRange.max < DEFAULT_FILTERS.playtimeRange.max) count++;
    if (filters.recentlyPlayedOnly) count++;
    
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

  // Steam Integration Methods

  /**
   * Set Steam data availability and update filters accordingly.
   */
  setSteamDataAvailable(available: boolean): void {
    this.updateFilters({ steamDataAvailable: available });
  }

  /**
   * Get available playtime categories for filtering.
   */
  getPlaytimeCategories(): Array<{ id: string; label: string; description: string }> {
    return [
      { id: 'unplayed', label: 'Unplayed', description: 'Never played (0 hours)' },
      { id: 'light', label: 'Light', description: 'Briefly tried (< 2 hours)' },
      { id: 'moderate', label: 'Moderate', description: 'Casually played (2-20 hours)' },
      { id: 'heavy', label: 'Heavy', description: 'Heavily played (20-100 hours)' },
      { id: 'obsessed', label: 'Obsessed', description: 'Obsessively played (100+ hours)' }
    ];
  }

  /**
   * Apply Steam-enhanced filters to recommendations.
   */
  applyFiltersToRecommendationsWithSteam(
    recommendations: GameRecommendation[], 
    steamData?: SteamPlayerLookupResponse,
    currentFilters?: GameFilters
  ): GameRecommendation[] {
    const filters = currentFilters || this.filters();
    
    let filteredRecs = recommendations.filter(rec => {
      // Apply standard filtering logic but to the game within the recommendation
      const gameArray = [rec.game];
      const filtered = this.applyFilters(gameArray, filters, steamData);
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
   * Toggle between "show owned only" and "hide owned games" modes.
   */
  toggleOwnedGamesFilter(): void {
    const current = this.filters();
    
    if (current.showOwnedOnly) {
      // Switch to hide owned
      this.updateFilters({ showOwnedOnly: false, hideOwnedGames: true });
    } else if (current.hideOwnedGames) {
      // Clear both filters
      this.updateFilters({ showOwnedOnly: false, hideOwnedGames: false });
    } else {
      // Switch to show owned only
      this.updateFilters({ showOwnedOnly: true, hideOwnedGames: false });
    }
  }

  /**
   * Reset Steam-specific filters only.
   */
  resetSteamFilters(): void {
    this.updateFilters({
      showOwnedOnly: false,
      hideOwnedGames: false,
      playtimeCategories: [],
      playtimeRange: { min: 0, max: 1000 },
      recentlyPlayedOnly: false
    });
  }

  /**
   * Get Steam filter statistics.
   */
  getSteamFilterStats(games: GameRecord[], steamData?: SteamPlayerLookupResponse): {
    totalGames: number;
    ownedGames: number;
    recentlyPlayed: number;
    neverPlayed: number;
  } {
    if (!steamData) {
      return { totalGames: games.length, ownedGames: 0, recentlyPlayed: 0, neverPlayed: 0 };
    }

    const ownedGames = games.filter(game => 
      this.steamIntegrationService.isGameOwned(game, steamData)
    );
    
    const recentlyPlayed = ownedGames.filter(game => {
      const playtime = this.steamIntegrationService.getGamePlaytime(game, steamData);
      return playtime && playtime.playtime_2weeks && playtime.playtime_2weeks > 0;
    });
    
    const neverPlayed = ownedGames.filter(game => {
      const playtime = this.steamIntegrationService.getGamePlaytime(game, steamData);
      return playtime && playtime.playtime_forever === 0;
    });

    return {
      totalGames: games.length,
      ownedGames: ownedGames.length,
      recentlyPlayed: recentlyPlayed.length,
      neverPlayed: neverPlayed.length
    };
  }
}