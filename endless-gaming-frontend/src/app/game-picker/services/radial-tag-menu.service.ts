import { Injectable, inject, ComponentRef } from '@angular/core';
import { Overlay, OverlayRef, OverlayConfig, PositionStrategy } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { RadialTagMenuComponent, TagActionEvent } from '../components/radial-tag-menu/radial-tag-menu.component';
import { PreferenceService } from './preference.service';
import { GameFilterService } from './game-filter.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Interface for menu position coordinates
 */
export interface MenuPosition {
  x: number;
  y: number;
}

/**
 * Service for managing radial tag menus with Angular CDK Overlay.
 * 
 * Provides functionality to:
 * - Open radial menus at specific screen coordinates
 * - Handle tag actions (like, dislike, include, exclude)
 * - Integrate with preference learning and filtering systems
 */
@Injectable({
  providedIn: 'root'
})
export class RadialTagMenuService {
  private overlay = inject(Overlay);
  private preferenceService = inject(PreferenceService);
  private gameFilterService = inject(GameFilterService);
  
  private currentOverlayRef: OverlayRef | null = null;
  private currentMenuRef: ComponentRef<RadialTagMenuComponent> | null = null;
  private destroy$ = new Subject<void>();

  /**
   * Open a radial tag menu at the specified position
   */
  openMenu(tagName: string, position: MenuPosition): void {
    // Close any existing menu first
    this.closeMenu();

    // Create overlay configuration
    const overlayConfig = new OverlayConfig({
      hasBackdrop: false, // We handle backdrop ourselves for better control
      positionStrategy: this.createPositionStrategy(position),
      panelClass: 'radial-tag-menu-panel'
    });

    // Create overlay
    this.currentOverlayRef = this.overlay.create(overlayConfig);
    
    // Create component portal
    const portal = new ComponentPortal(RadialTagMenuComponent);
    this.currentMenuRef = this.currentOverlayRef.attach(portal);
    
    // Configure the menu component
    this.currentMenuRef.instance.setTag(tagName);
    
    // Subscribe to menu events
    this.currentMenuRef.instance.actionSelected
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: TagActionEvent) => {
        this.handleTagAction(event);
      });
      
    this.currentMenuRef.instance.closed
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.closeMenu();
      });
  }

  /**
   * Close the current menu if open
   */
  closeMenu(): void {
    if (this.currentOverlayRef) {
      this.currentOverlayRef.dispose();
      this.currentOverlayRef = null;
      this.currentMenuRef = null;
      this.destroy$.next();
    }
  }

  /**
   * Handle tag actions from the radial menu
   */
  private handleTagAction(event: TagActionEvent): void {
    const { action, tag } = event;
    
    console.log(`🏷️ RadialTagMenu: ${action} action for tag "${tag}"`);
    
    switch (action) {
      case 'like':
        this.handleLikeTag(tag);
        break;
      case 'dislike':
        this.handleDislikeTag(tag);
        break;
      case 'include':
        this.handleIncludeTag(tag);
        break;
      case 'exclude':
        this.handleExcludeTag(tag);
        break;
    }
  }

  /**
   * Handle "Like Tag" action - increase preference weight
   */
  private handleLikeTag(tag: string): void {
    // Create a mock game record with just this tag for preference learning
    const mockGame = {
      appId: 0, // Dummy ID
      name: `Tag: ${tag}`,
      tags: { [tag]: 100 } // High vote count for this tag
    };
    
    // Apply positive preference update
    this.preferenceService.updatePositivePreferences(mockGame as any, mockGame as any);
    
    console.log(`👍 Increased preference for tag: ${tag}`);
    
    // TODO: Show toast notification
    this.showActionFeedback(`Liked ${tag}`, 'success');
  }

  /**
   * Handle "Dislike Tag" action - decrease preference weight
   */
  private handleDislikeTag(tag: string): void {
    // Create a mock game record with just this tag
    const mockGame = {
      appId: 0, // Dummy ID
      name: `Tag: ${tag}`,
      tags: { [tag]: 100 } // High vote count for this tag
    };
    
    // Apply negative preference update
    this.preferenceService.updateNegativePreferences(mockGame as any, mockGame as any);
    
    console.log(`👎 Decreased preference for tag: ${tag}`);
    
    // TODO: Show toast notification
    this.showActionFeedback(`Disliked ${tag}`, 'error');
  }

  /**
   * Handle "Must Include" action - add to required filters
   */
  private handleIncludeTag(tag: string): void {
    const currentFilters = this.gameFilterService.filters();
    const requiredTags = [...currentFilters.requiredTags];
    
    // Add tag if not already included
    if (!requiredTags.includes(tag)) {
      requiredTags.push(tag);
      this.gameFilterService.updateFilters({ requiredTags });
      
      console.log(`➕ Added ${tag} to required filters`);
      this.showActionFeedback(`Must include ${tag}`, 'info');
    } else {
      console.log(`ℹ️ Tag ${tag} already in required filters`);
      this.showActionFeedback(`${tag} already required`, 'warning');
    }
  }

  /**
   * Handle "Exclude" action - add to excluded filters
   */
  private handleExcludeTag(tag: string): void {
    const currentFilters = this.gameFilterService.filters();
    const excludedTags = [...currentFilters.excludedTags];
    
    // Add tag if not already excluded
    if (!excludedTags.includes(tag)) {
      excludedTags.push(tag);
      this.gameFilterService.updateFilters({ excludedTags });
      
      console.log(`❌ Added ${tag} to excluded filters`);
      this.showActionFeedback(`Excluded ${tag}`, 'warning');
    } else {
      console.log(`ℹ️ Tag ${tag} already in excluded filters`);
      this.showActionFeedback(`${tag} already excluded`, 'warning');
    }
  }

  /**
   * Create position strategy for the overlay
   */
  private createPositionStrategy(position: MenuPosition): PositionStrategy {
    return this.overlay.position()
      .global()
      .left(`${position.x}px`)
      .top(`${position.y}px`);
  }

  /**
   * Show action feedback (placeholder for toast notifications)
   */
  private showActionFeedback(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
    // TODO: Implement toast notifications
    // For now, just log the feedback
    console.log(`🔔 ${type.toUpperCase()}: ${message}`);
  }

  /**
   * Cleanup resources
   */
  ngOnDestroy(): void {
    this.closeMenu();
    this.destroy$.next();
    this.destroy$.complete();
  }
}