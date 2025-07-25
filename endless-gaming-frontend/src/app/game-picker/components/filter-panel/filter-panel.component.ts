import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { Subscription } from 'rxjs';

import { GameFilterService, GameFilters, FilterStats, FilterPreset } from '../../services/game-filter.service';
import { GameRecord } from '../../../types/game.types';

/**
 * Main filter panel component that provides comprehensive game filtering UI.
 * 
 * Features:
 * - Collapsible side panel (desktop) and bottom sheet (mobile)
 * - Organized filter sections with expansion panels
 * - Real-time filter application with live results counter
 * - Quick preset buttons for common filtering scenarios
 * - Active filter chips with easy removal
 * - Search functionality
 */
@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatExpansionModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatBadgeModule,
    MatTooltipModule,
    MatDividerModule,
    MatBottomSheetModule
  ],
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss'
})
export class FilterPanelComponent implements OnInit, OnDestroy {
  private gameFilterService = inject(GameFilterService);
  private subscriptions: Subscription[] = [];
  
  @Input() games: GameRecord[] = [];
  @Input() isOpen = false;
  @Output() openChange = new EventEmitter<boolean>();
  @Output() filtersApplied = new EventEmitter<GameFilters>();
  
  // Reactive state
  public readonly filters = this.gameFilterService.filters;
  public readonly isFiltering = this.gameFilterService.isFiltering;
  public readonly activeFilterCount = this.gameFilterService.activeFilterCount;
  
  // Panel expansion state
  public readonly expandedPanels = signal(new Set<string>(['search', 'price'])); // Start with basic panels open
  
  // UI state
  public readonly isMobile = signal(false);
  public readonly filterStats = signal<FilterStats>({ totalGames: 0, filteredGames: 0, filterCount: 0 });
  
  // Available options for autocompletes
  public availableTags: string[] = [];
  public availableDevelopers: string[] = [];
  public availablePublishers: string[] = [];
  public filterPresets: FilterPreset[] = [];
  
  // Form models for two-way binding
  public searchText = '';
  public isFreeOnly = false;
  public selectedPriceTiers: string[] = [];
  public priceRange = { min: 0, max: 100 };
  public requiredTags: string[] = [];
  public excludedTags: string[] = [];
  public minReviewScore = 0;
  public minReviewCount = 0;
  public scoreRange = { min: -10, max: 10 };
  public includedDevelopers: string[] = [];
  public excludedPublishers: string[] = [];
  public topNOnly: number | null = null;
  
  // Price tier options
  public readonly priceTierOptions = [
    { value: 'free', label: 'Free', icon: 'money_off' },
    { value: 'under5', label: 'Under $5', icon: 'attach_money' },
    { value: '5to15', label: '$5 - $15', icon: 'attach_money' },
    { value: '15to30', label: '$15 - $30', icon: 'attach_money' },
    { value: 'over30', label: '$30+', icon: 'attach_money' }
  ];
  
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
    this.checkMobileStatus();
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
    
    // Load available options
    this.availableTags = this.gameFilterService.getAvailableTags();
    this.availableDevelopers = this.gameFilterService.getAvailableDevelopers();
    this.availablePublishers = this.gameFilterService.getAvailablePublishers();
    this.filterPresets = this.gameFilterService.getPresets();
    
    // Sync local form models with service state
    this.syncFormModelsWithFilters();
  }
  
  /**
   * Subscribe to filter changes and update local state
   */
  private subscribeToFilterChanges(): void {
    const filterSub = this.gameFilterService.getFilters().subscribe(filters => {
      this.syncFormModelsWithFilters();
      this.filtersApplied.emit(filters);
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
    this.selectedPriceTiers = [...filters.priceTiers];
    this.priceRange = { ...filters.priceRange };
    this.requiredTags = [...filters.requiredTags];
    this.excludedTags = [...filters.excludedTags];
    this.minReviewScore = filters.minReviewScore;
    this.minReviewCount = filters.minReviewCount;
    this.scoreRange = { ...filters.scoreRange };
    this.includedDevelopers = [...filters.includedDevelopers];
    this.excludedPublishers = [...filters.excludedPublishers];
    this.topNOnly = filters.topNOnly;
  }
  
  /**
   * Check if we're on mobile for responsive behavior
   */
  private checkMobileStatus(): void {
    const checkMobile = () => {
      this.isMobile.set(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
  }
  
  /**
   * Toggle panel open/closed state
   */
  public togglePanel(): void {
    this.isOpen = !this.isOpen;
    this.openChange.emit(this.isOpen);
  }
  
  /**
   * Close the filter panel
   */
  public closePanel(): void {
    this.isOpen = false;
    this.openChange.emit(false);
  }
  
  /**
   * Toggle expansion panel state
   */
  public toggleExpansionPanel(panelId: string): void {
    const expanded = this.expandedPanels();
    if (expanded.has(panelId)) {
      expanded.delete(panelId);
    } else {
      expanded.add(panelId);
    }
    this.expandedPanels.set(new Set(expanded));
  }
  
  /**
   * Check if expansion panel is open
   */
  public isPanelExpanded(panelId: string): boolean {
    return this.expandedPanels().has(panelId);
  }
  
  /**
   * Apply search filter
   */
  public onSearchChange(searchText: string): void {
    this.gameFilterService.updateFilters({ searchText });
  }
  
  /**
   * Toggle free-only filter
   */
  public onFreeOnlyChange(isFreeOnly: boolean): void {
    this.gameFilterService.updateFilters({ 
      isFreeOnly,
      // Clear price tiers when toggling free only
      priceTiers: isFreeOnly ? [] : this.selectedPriceTiers
    });
  }
  
  /**
   * Update price tier selection
   */
  public onPriceTierChange(tiers: string[]): void {
    this.gameFilterService.updateFilters({ 
      priceTiers: tiers,
      // Clear free only when selecting price tiers
      isFreeOnly: tiers.includes('free') ? true : this.isFreeOnly
    });
  }
  
  /**
   * Update price range
   */
  public onPriceRangeChange(priceRange: { min: number, max: number }): void {
    this.gameFilterService.updateFilters({ priceRange });
  }
  
  /**
   * Add required tag
   */
  public addRequiredTag(tag: string): void {
    if (tag && !this.requiredTags.includes(tag)) {
      const updatedTags = [...this.requiredTags, tag];
      this.gameFilterService.updateFilters({ requiredTags: updatedTags });
    }
  }
  
  /**
   * Remove required tag
   */
  public removeRequiredTag(tag: string): void {
    const updatedTags = this.requiredTags.filter(t => t !== tag);
    this.gameFilterService.updateFilters({ requiredTags: updatedTags });
  }
  
  /**
   * Add excluded tag
   */
  public addExcludedTag(tag: string): void {
    if (tag && !this.excludedTags.includes(tag)) {
      const updatedTags = [...this.excludedTags, tag];
      this.gameFilterService.updateFilters({ excludedTags: updatedTags });
    }
  }
  
  /**
   * Remove excluded tag
   */
  public removeExcludedTag(tag: string): void {
    const updatedTags = this.excludedTags.filter(t => t !== tag);
    this.gameFilterService.updateFilters({ excludedTags: updatedTags });
  }
  
  /**
   * Update review score filter
   */
  public onReviewScoreChange(minReviewScore: number): void {
    this.gameFilterService.updateFilters({ minReviewScore });
  }
  
  /**
   * Update review count filter
   */
  public onReviewCountChange(minReviewCount: number): void {
    this.gameFilterService.updateFilters({ minReviewCount });
  }
  
  /**
   * Update ML score range filter
   */
  public onScoreRangeChange(scoreRange: { min: number, max: number }): void {
    this.gameFilterService.updateFilters({ scoreRange });
  }
  
  /**
   * Update top N limit
   */
  public onTopNChange(topNOnly: number | null): void {
    this.gameFilterService.updateFilters({ topNOnly });
  }
  
  /**
   * Add included developer
   */
  public addIncludedDeveloper(developer: string): void {
    if (developer && !this.includedDevelopers.includes(developer)) {
      const updated = [...this.includedDevelopers, developer];
      this.gameFilterService.updateFilters({ includedDevelopers: updated });
    }
  }
  
  /**
   * Remove included developer
   */
  public removeIncludedDeveloper(developer: string): void {
    const updated = this.includedDevelopers.filter(d => d !== developer);
    this.gameFilterService.updateFilters({ includedDevelopers: updated });
  }
  
  /**
   * Add excluded publisher
   */
  public addExcludedPublisher(publisher: string): void {
    if (publisher && !this.excludedPublishers.includes(publisher)) {
      const updated = [...this.excludedPublishers, publisher];
      this.gameFilterService.updateFilters({ excludedPublishers: updated });
    }
  }
  
  /**
   * Remove excluded publisher
   */
  public removeExcludedPublisher(publisher: string): void {
    const updated = this.excludedPublishers.filter(p => p !== publisher);
    this.gameFilterService.updateFilters({ excludedPublishers: updated });
  }
  
  /**
   * Apply preset filters
   */
  public applyPreset(presetId: string): void {
    this.gameFilterService.applyPreset(presetId);
  }
  
  /**
   * Reset all filters
   */
  public resetAllFilters(): void {
    this.gameFilterService.resetFilters();
  }
  
  /**
   * Get active filters summary for chip bar
   */
  public getActiveFiltersSummary(): Array<{label: string, value: string, type: string}> {
    return this.gameFilterService.getActiveFiltersSummary();
  }
  
  /**
   * Remove specific filter
   */
  public removeFilter(type: string, value?: string): void {
    this.gameFilterService.removeFilter(type, value);
  }
  
  /**
   * Get current filter statistics
   */
  public getFilterStats(): FilterStats {
    return this.gameFilterService.getFilterStats();
  }
  
  /**
   * Format price for display
   */
  public formatPrice(price: number): string {
    return price === 0 ? 'Free' : `$${price}`;
  }
  
  /**
   * Format percentage for display
   */
  public formatPercentage(value: number): string {
    return `${Math.round(value)}%`;
  }
  
  /**
   * Get filter section icon
   */
  public getSectionIcon(section: string): string {
    const icons: { [key: string]: string } = {
      search: 'search',
      price: 'attach_money',
      tags: 'local_offer',
      reviews: 'star_rate',
      advanced: 'tune',
      developers: 'business'
    };
    return icons[section] || 'settings';
  }
  
  /**
   * Check if price tier is selected
   */
  public isPriceTierSelected(tier: string): boolean {
    return this.selectedPriceTiers.includes(tier);
  }
  
  /**
   * Toggle price tier selection
   */
  public togglePriceTier(tier: string): void {
    const currentTiers = [...this.selectedPriceTiers];
    const index = currentTiers.indexOf(tier);
    
    if (index > -1) {
      currentTiers.splice(index, 1);
    } else {
      currentTiers.push(tier);
    }
    
    this.onPriceTierChange(currentTiers);
  }
  
  /**
   * Get available tags filtered by current search
   */
  public getFilteredTags(searchText: string): string[] {
    if (!searchText) return this.availableTags.slice(0, 20); // Limit for performance
    
    const search = searchText.toLowerCase();
    return this.availableTags
      .filter(tag => tag.toLowerCase().includes(search))
      .slice(0, 10); // Limit autocomplete results
  }
  
  /**
   * Get available developers filtered by current search
   */
  public getFilteredDevelopers(searchText: string): string[] {
    if (!searchText) return this.availableDevelopers.slice(0, 20);
    
    const search = searchText.toLowerCase();
    return this.availableDevelopers
      .filter(dev => dev.toLowerCase().includes(search))
      .slice(0, 10);
  }
  
  /**
   * Get available publishers filtered by current search
   */
  public getFilteredPublishers(searchText: string): string[] {
    if (!searchText) return this.availablePublishers.slice(0, 20);
    
    const search = searchText.toLowerCase();
    return this.availablePublishers
      .filter(pub => pub.toLowerCase().includes(search))
      .slice(0, 10);
  }
}