import { Component, Input, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import { GameFilterService, FilterStats } from '../../services/game-filter.service';
import { GameRecord, SteamPlayerLookupResponse } from '../../../types/game.types';
import { AgeCategory } from '../../../utils/game-age.utils';

/**
 * Clean, simple filter panel with instant filtering (no apply button needed).
 * Removed all accordion complexity for better UX.
 */
@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatTooltipModule
  ],
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss'
})
export class FilterPanelComponent implements OnInit, OnDestroy {
  private gameFilterService = inject(GameFilterService);
  private subscriptions: Subscription[] = [];
  
  @Input() games: GameRecord[] = [];
  @Input() steamPlayerData?: SteamPlayerLookupResponse | null = null;
  @Input() enableSteamFeatures: boolean = false;
  
  // Reactive state
  public readonly filters = this.gameFilterService.filters;
  public readonly isFiltering = this.gameFilterService.isFiltering;
  public readonly activeFilterCount = this.gameFilterService.activeFilterCount;
  
  // UI state
  public readonly filterStats = signal<FilterStats>({ totalGames: 0, filteredGames: 0, filterCount: 0 });
  
  // Available options for autocompletes
  public availableTags: string[] = [];
  public availableTagsWithFrequency: Array<{tag: string, count: number}> = [];
  
  // Form models for two-way binding - all changes are instantly applied
  public searchText = '';
  public isFreeOnly = false;
  public priceRange = { min: 0, max: 100 };
  public requiredTags: string[] = [];
  public excludedTags: string[] = [];
  public minReviewScore = 70;  // Start at 70%
  public minReviewCount = 0;   // Will be hidden from UI
  public topNOnly: number | null = null;
  
  // Age filter form models
  public ageCategories: AgeCategory[] = [];
  public releaseYearRange = { min: 1970, max: new Date().getFullYear() };
  public maxGameAge: number | null = null;
  
  // Steam filter form models
  public showOwnedOnly = false;
  public hideOwnedGames = false;
  public playtimeCategories: string[] = [];
  public playtimeRange = { min: 0, max: 1000 };
  public recentlyPlayedOnly = false;
  
  // Top N options
  public readonly topNOptions = [
    { value: null, label: 'Show All' },
    { value: 10, label: 'Top 10' },
    { value: 25, label: 'Top 25' },
    { value: 50, label: 'Top 50' },
    { value: 100, label: 'Top 100' }
  ];
  
  ngOnInit(): void {
    this.initializeComponent();
    this.subscribeToFilterChanges();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  /**
   * Initialize component with current filter state and available options
   */
  private initializeComponent(): void {
    // Initialize filter service with game data
    if (this.games.length > 0) {
      this.gameFilterService.initializeOptions(this.games);
    }
    
    // Initialize Steam data availability
    this.initializeSteamData();
    
    // Load available options
    this.availableTags = this.gameFilterService.getAvailableTags();
    this.availableTagsWithFrequency = this.gameFilterService.getAvailableTagsWithFrequency();
    
    // Sync local form models with service state
    this.syncFormModelsWithFilters();
  }
  
  /**
   * Subscribe to filter changes and update local state
   */
  private subscribeToFilterChanges(): void {
    const filterSub = this.gameFilterService.getFilters().subscribe(() => {
      this.syncFormModelsWithFilters();
    });
    
    this.subscriptions.push(filterSub);
  }
  
  /**
   * Sync local form models with current filter service state
   */
  private syncFormModelsWithFilters(): void {
    const filters = this.filters();
    
    this.searchText = filters.searchText;
    this.isFreeOnly = filters.isFreeOnly;
    this.priceRange = { ...filters.priceRange };
    this.requiredTags = [...filters.requiredTags];
    this.excludedTags = [...filters.excludedTags];
    this.minReviewScore = filters.minReviewScore;
    this.minReviewCount = filters.minReviewCount;
    this.topNOnly = filters.topNOnly;
    this.ageCategories = [...filters.ageCategories];
    this.releaseYearRange = { ...filters.releaseYearRange };
    this.maxGameAge = filters.maxGameAge;
    
    // Sync Steam filter models
    this.syncSteamFiltersFromService();
  }
  
  /**
   * Get current filter statistics
   */
  public getFilterStats(): FilterStats {
    // For now return basic stats, this will be updated as filters are applied
    const currentFilters = this.filters();
    const hasAnyFilters = this.isFiltering();
    return {
      totalGames: this.games.length,
      filteredGames: this.games.length, // This would be calculated by the service
      filterCount: hasAnyFilters ? 1 : 0
    };
  }
  
  /**
   * Reset all filters
   */
  public resetAllFilters(): void {
    this.gameFilterService.resetFilters();
  }

  /**
   * Reset only Steam-specific filters
   */
  public resetSteamFilters(): void {
    this.gameFilterService.resetSteamFilters();
    this.syncSteamFiltersFromService();
  }
  
  // Instant filter change handlers - no apply button needed
  
  /**
   * Handle search text changes (instant)
   */
  public onSearchChange(value: string): void {
    this.searchText = value;
    this.gameFilterService.updateFilters({ searchText: value });
  }
  
  /**
   * Handle free only toggle changes (instant)
   */
  public onFreeOnlyChange(value: boolean): void {
    this.isFreeOnly = value;
    this.gameFilterService.updateFilters({ isFreeOnly: value });
  }
  
  /**
   * Handle price range changes (instant)
   */
  public onPriceRangeChange(range: { min: number, max: number }): void {
    this.priceRange = range;
    this.gameFilterService.updateFilters({ priceRange: range });
  }
  
  /**
   * Handle review score changes (instant)
   */
  public onReviewScoreChange(score: number): void {
    this.minReviewScore = score;
    this.gameFilterService.updateFilters({ minReviewScore: score });
  }
  
  /**
   * Handle review count changes (instant)
   */
  public onReviewCountChange(count: number): void {
    this.minReviewCount = count;
    this.gameFilterService.updateFilters({ minReviewCount: count });
  }
  
  /**
   * Handle top N changes (instant)
   */
  public onTopNChange(value: number | null): void {
    this.topNOnly = value;
    this.gameFilterService.updateFilters({ topNOnly: value });
  }
  
  // Tag management methods
  
  /**
   * Add required tag (instant)
   */
  public addRequiredTag(tag: string): void {
    if (!tag?.trim()) return;
    
    // Normalize tag to correct case
    const normalizedTag = this.gameFilterService.normalizeTag(tag);
    if (normalizedTag && !this.requiredTags.includes(normalizedTag)) {
      this.requiredTags.push(normalizedTag);
      this.gameFilterService.updateFilters({ requiredTags: [...this.requiredTags] });
      console.log('🏷️ Added required tag:', normalizedTag);
    } else if (!normalizedTag) {
      console.warn('🏷️ Tag not found in dataset:', tag);
    }
  }
  
  /**
   * Remove required tag (instant)
   */
  public removeRequiredTag(tag: string): void {
    this.requiredTags = this.requiredTags.filter(t => t !== tag);
    this.gameFilterService.updateFilters({ requiredTags: [...this.requiredTags] });
  }
  
  /**
   * Add excluded tag (instant)
   */
  public addExcludedTag(tag: string): void {
    if (!tag?.trim()) return;
    
    // Normalize tag to correct case
    const normalizedTag = this.gameFilterService.normalizeTag(tag);
    if (normalizedTag && !this.excludedTags.includes(normalizedTag)) {
      this.excludedTags.push(normalizedTag);
      this.gameFilterService.updateFilters({ excludedTags: [...this.excludedTags] });
      console.log('🏷️ Added excluded tag:', normalizedTag);
    } else if (!normalizedTag) {
      console.warn('🏷️ Tag not found in dataset:', tag);
    }
  }
  
  /**
   * Remove excluded tag (instant)
   */
  public removeExcludedTag(tag: string): void {
    this.excludedTags = this.excludedTags.filter(t => t !== tag);
    this.gameFilterService.updateFilters({ excludedTags: [...this.excludedTags] });
  }
  
  // Age filter change handlers
  
  /**
   * Handle age categories change (instant)
   */
  public onAgeCategoriesChange(categories: AgeCategory[]): void {
    this.ageCategories = categories;
    this.gameFilterService.updateFilters({ ageCategories: [...categories] });
  }
  
  /**
   * Handle release year range change (instant)
   */
  public onReleaseYearRangeChange(range: { min: number, max: number }): void {
    this.releaseYearRange = range;
    this.gameFilterService.updateFilters({ releaseYearRange: { ...range } });
  }
  
  /**
   * Handle max age change (instant)
   */
  public onMaxAgeChange(maxAge: number | null): void {
    this.maxGameAge = maxAge;
    this.gameFilterService.updateFilters({ maxGameAge: maxAge });
  }

  // Steam filter change handlers

  /**
   * Handle show owned only toggle (instant)
   */
  public onShowOwnedOnlyChange(value: boolean): void {
    this.showOwnedOnly = value;
    if (value) {
      this.hideOwnedGames = false; // Mutually exclusive
    }
    this.gameFilterService.updateFilters({ 
      showOwnedOnly: value,
      hideOwnedGames: this.hideOwnedGames
    });
  }

  /**
   * Handle hide owned games toggle (instant)
   */
  public onHideOwnedGamesChange(value: boolean): void {
    this.hideOwnedGames = value;
    if (value) {
      this.showOwnedOnly = false; // Mutually exclusive
    }
    this.gameFilterService.updateFilters({ 
      hideOwnedGames: value,
      showOwnedOnly: this.showOwnedOnly
    });
  }

  /**
   * Handle playtime categories change (instant)
   */
  public onPlaytimeCategoriesChange(categories: string[]): void {
    this.playtimeCategories = categories;
    this.gameFilterService.updateFilters({ playtimeCategories: [...categories] });
  }

  /**
   * Handle individual playtime category toggle (instant)
   */
  public onPlaytimeCategoryToggle(categoryId: string, checked: boolean): void {
    const updatedCategories = checked 
      ? [...this.playtimeCategories, categoryId]
      : this.playtimeCategories.filter(c => c !== categoryId);
    this.onPlaytimeCategoriesChange(updatedCategories);
  }

  /**
   * Handle playtime range change (instant)
   */
  public onPlaytimeRangeChange(range: { min: number, max: number }): void {
    this.playtimeRange = range;
    this.gameFilterService.updateFilters({ playtimeRange: { ...range } });
  }

  /**
   * Handle recently played only toggle (instant)
   */
  public onRecentlyPlayedOnlyChange(value: boolean): void {
    this.recentlyPlayedOnly = value;
    this.gameFilterService.updateFilters({ recentlyPlayedOnly: value });
  }

  /**
   * Toggle owned games filter (cycles through modes)
   */
  public toggleOwnedGamesFilter(): void {
    this.gameFilterService.toggleOwnedGamesFilter();
    this.syncSteamFiltersFromService();
  }
  
  /**
   * Get filtered tags for autocomplete with frequency information
   */
  public getFilteredTags(searchTerm: string): Array<{tag: string, count: number, displayText: string}> {
    const tagsWithFreq = this.gameFilterService.searchTags(searchTerm, 15);
    
    return tagsWithFreq.map(item => ({
      tag: item.tag,
      count: item.count,
      displayText: this.formatTagWithFrequency(item.tag, item.count)
    }));
  }

  /**
   * Format tag with frequency for display
   */
  private formatTagWithFrequency(tag: string, count: number): string {
    if (count >= 1000000) {
      return `${tag} (${Math.round(count / 1000000)}M games)`;
    } else if (count >= 1000) {
      return `${tag} (${Math.round(count / 1000)}k games)`;
    } else {
      return `${tag} (${count} games)`;
    }
  }

  /**
   * Format tag frequency for template display
   */
  public formatTagFrequency(count: number): string {
    if (count >= 1000000) {
      return `${Math.round(count / 1000000)}M games`;
    } else if (count >= 1000) {
      return `${Math.round(count / 1000)}k games`;
    } else {
      return `${count} games`;
    }
  }
  
  // Utility methods
  
  /**
   * Format price for display
   */
  public formatPrice(price: number): string {
    if (price === 0) return 'Free';
    if (price >= 100) return '$100+';
    return `$${price}`;
  }
  
  /**
   * Format percentage for display
   */
  public formatPercentage(value: number): string {
    return `${value}%`;
  }
  
  /**
   * Get current year for year range slider max
   */
  public getCurrentYear(): number {
    return new Date().getFullYear();
  }

  /**
   * Get actual data year range from GameFilterService
   */
  public getDataYearRange(): { min: number, max: number } {
    return this.gameFilterService.getDataYearRange();
  }

  // Steam utility methods

  /**
   * Check if Steam features are enabled and data is available
   */
  public hasSteamData(): boolean {
    return this.enableSteamFeatures && !!this.steamPlayerData;
  }

  /**
   * Get available playtime categories for filtering
   */
  public getPlaytimeCategories(): Array<{ id: string; label: string; description: string }> {
    return this.gameFilterService.getPlaytimeCategories();
  }

  /**
   * Get Steam filter statistics
   */
  public getSteamFilterStats(): {
    totalGames: number;
    ownedGames: number;
    recentlyPlayed: number;
    neverPlayed: number;
  } {
    return this.gameFilterService.getSteamFilterStats(this.games, this.steamPlayerData || undefined);
  }

  /**
   * Format playtime hours for display
   */
  public formatPlaytimeHours(hours: number): string {
    if (hours === 0) return '0h';
    if (hours >= 1000) return `${Math.round(hours / 100) / 10}k h`;
    return `${hours}h`;
  }

  /**
   * Sync Steam filter UI state from service
   */
  private syncSteamFiltersFromService(): void {
    const currentFilters = this.filters();
    this.showOwnedOnly = currentFilters.showOwnedOnly;
    this.hideOwnedGames = currentFilters.hideOwnedGames;
    this.playtimeCategories = [...currentFilters.playtimeCategories];
    this.playtimeRange = { ...currentFilters.playtimeRange };
    this.recentlyPlayedOnly = currentFilters.recentlyPlayedOnly;
  }

  /**
   * Initialize Steam data availability
   */
  private initializeSteamData(): void {
    if (this.hasSteamData()) {
      this.gameFilterService.setSteamDataAvailable(true);
    }
  }
}