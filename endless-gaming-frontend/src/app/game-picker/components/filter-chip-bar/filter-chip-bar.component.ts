import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import { GameFilterService } from '../../services/game-filter.service';

/**
 * Compact horizontal bar showing active filters as removable chips.
 * 
 * Features:
 * - Shows active filters in a clean, horizontal layout
 * - Each filter chip can be individually removed
 * - Filter button with badge showing active count
 * - Responsive design that hides on mobile when panel is open
 * - Smooth animations for chip addition/removal
 */
@Component({
  selector: 'app-filter-chip-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatTooltipModule
  ],
  templateUrl: './filter-chip-bar.component.html',
  styleUrl: './filter-chip-bar.component.scss'
})
export class FilterChipBarComponent implements OnInit, OnDestroy {
  private gameFilterService = inject(GameFilterService);
  private subscriptions: Subscription[] = [];
  
  @Input() showFilterButton = true;
  @Input() maxVisibleChips = 5; // Limit chips shown before "X more..." indicator
  @Output() filterButtonClick = new EventEmitter<void>();
  @Output() clearAllClick = new EventEmitter<void>();
  
  // Reactive state from filter service
  public readonly isFiltering = this.gameFilterService.isFiltering;
  public readonly activeFilterCount = this.gameFilterService.activeFilterCount;
  
  // Local state
  public activeFilters: Array<{label: string, value: string, type: string}> = [];
  public showAllChips = false;
  
  ngOnInit(): void {
    this.subscribeToFilterChanges();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  /**
   * Subscribe to filter changes to update chip display
   */
  private subscribeToFilterChanges(): void {
    const filterSub = this.gameFilterService.getFilters().subscribe(() => {
      this.updateActiveFilters();
    });
    
    this.subscriptions.push(filterSub);
  }
  
  /**
   * Update active filters list from service
   */
  private updateActiveFilters(): void {
    this.activeFilters = this.gameFilterService.getActiveFiltersSummary();
  }
  
  /**
   * Get filters to display (respecting maxVisibleChips limit)
   */
  public getVisibleFilters(): Array<{label: string, value: string, type: string}> {
    if (this.showAllChips || this.activeFilters.length <= this.maxVisibleChips) {
      return this.activeFilters;
    }
    return this.activeFilters.slice(0, this.maxVisibleChips);
  }
  
  /**
   * Get count of hidden filters
   */
  public getHiddenFilterCount(): number {
    return Math.max(0, this.activeFilters.length - this.maxVisibleChips);
  }
  
  /**
   * Toggle showing all chips vs limited view
   */
  public toggleShowAllChips(): void {
    this.showAllChips = !this.showAllChips;
  }
  
  /**
   * Remove specific filter
   */
  public removeFilter(type: string, value?: string): void {
    this.gameFilterService.removeFilter(type, value);
  }
  
  /**
   * Clear all active filters
   */
  public clearAllFilters(): void {
    this.gameFilterService.resetFilters();
    this.clearAllClick.emit();
  }
  
  /**
   * Open filter panel
   */
  public openFilterPanel(): void {
    this.filterButtonClick.emit();
  }
  
  /**
   * Get filter chip icon based on type
   */
  public getFilterIcon(type: string): string {
    const icons: { [key: string]: string } = {
      search: 'search',
      price: 'attach_money',
      'required-tag': 'add_circle',
      'excluded-tag': 'remove_circle',
      review: 'star_rate',
      limit: 'filter_list',
      developer: 'business',
      publisher: 'business'
    };
    return icons[type] || 'filter_alt';
  }
  
  /**
   * Get filter chip class based on type
   */
  public getFilterChipClass(type: string): string {
    return `filter-chip-${type}`;
  }
  
  /**
   * Get filter button tooltip text
   */
  public getFilterButtonTooltip(): string {
    const count = this.activeFilterCount();
    if (count === 0) {
      return 'Open filters';
    } else if (count === 1) {
      return 'Open filters (1 active filter)';
    } else {
      return `Open filters (${count} active filters)`;
    }
  }
  
  /**
   * Get clear all button tooltip
   */
  public getClearAllTooltip(): string {
    const count = this.activeFilterCount();
    return `Clear all ${count} filter${count === 1 ? '' : 's'}`;
  }
  
  /**
   * Format filter value for display (truncate if too long)
   */
  public formatFilterValue(value: string, maxLength: number = 20): string {
    if (value.length <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Check if should show the component (has filters or show button is enabled)
   */
  public shouldShow(): boolean {
    return this.showFilterButton || this.isFiltering();
  }
  
  /**
   * Track by function for ngFor performance
   */
  public trackByFilter(index: number, filter: {label: string, value: string, type: string}): string {
    return `${filter.type}-${filter.label}-${filter.value}`;
  }
}