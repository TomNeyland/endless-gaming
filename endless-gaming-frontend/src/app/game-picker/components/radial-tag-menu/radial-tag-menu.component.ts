import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { animate, style, transition, trigger } from '@angular/animations';

/**
 * Tag action types for the radial menu
 */
export type TagAction = 'like' | 'dislike' | 'include' | 'exclude';

/**
 * Interface for tag action events
 */
export interface TagActionEvent {
  action: TagAction;
  tag: string;
}

/**
 * Modern radial menu component for tag interactions.
 * 
 * Displays 4 circular action buttons arranged around a center point:
 * - Like Tag (top, green)
 * - Must Include (right, blue) 
 * - Dislike Tag (bottom, red)
 * - Exclude (left, orange)
 */
@Component({
  selector: 'app-radial-tag-menu',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="radial-menu-overlay" (click)="onBackdropClick($event)">
      <div class="radial-menu" [@menuAnimation] (click)="$event.stopPropagation()">
        <!-- Like Tag (Top) -->
        <button 
          mat-fab 
          class="action-button like-action"
          [matTooltip]="'Like ' + tagName"
          matTooltipPosition="above"
          (click)="onAction('like')"
          [@buttonAnimation]="{ value: 'in', params: { delay: '0ms', direction: 'top' } }">
          <mat-icon>thumb_up</mat-icon>
        </button>

        <!-- Must Include (Right) -->
        <button 
          mat-fab 
          class="action-button include-action"
          [matTooltip]="'Must Include ' + tagName"
          matTooltipPosition="right"
          (click)="onAction('include')"
          [@buttonAnimation]="{ value: 'in', params: { delay: '50ms', direction: 'right' } }">
          <mat-icon>add_circle</mat-icon>
        </button>

        <!-- Dislike Tag (Bottom) -->
        <button 
          mat-fab 
          class="action-button dislike-action"
          [matTooltip]="'Dislike ' + tagName"
          matTooltipPosition="below"
          (click)="onAction('dislike')"
          [@buttonAnimation]="{ value: 'in', params: { delay: '100ms', direction: 'bottom' } }">
          <mat-icon>thumb_down</mat-icon>
        </button>

        <!-- Exclude (Left) -->
        <button 
          mat-fab 
          class="action-button exclude-action"
          [matTooltip]="'Exclude ' + tagName"
          matTooltipPosition="left"
          (click)="onAction('exclude')"
          [@buttonAnimation]="{ value: 'in', params: { delay: '150ms', direction: 'left' } }">
          <mat-icon>block</mat-icon>
        </button>

        <!-- Center indicator -->
        <div class="center-indicator">
          <span class="tag-name">{{ tagName }}</span>
        </div>
      </div>
    </div>
  `,
  styleUrl: './radial-tag-menu.component.scss',
  animations: [
    trigger('menuAnimation', [
      transition(':enter', [
        style({ transform: 'scale(0)', opacity: 0 }),
        animate('200ms cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
                style({ transform: 'scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', 
                style({ transform: 'scale(0)', opacity: 0 }))
      ])
    ]),
    trigger('buttonAnimation', [
      transition(':enter', [
        style({ 
          transform: 'scale(0) translate({{ direction === "top" ? "0, 20px" : direction === "right" ? "-20px, 0" : direction === "bottom" ? "0, -20px" : "20px, 0" }})',
          opacity: 0 
        }),
        animate('{{ delay }} 250ms cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
                style({ transform: 'scale(1) translate(0, 0)', opacity: 1 }))
      ])
    ])
  ]
})
export class RadialTagMenuComponent {
  @Output() actionSelected = new EventEmitter<TagActionEvent>();
  @Output() closed = new EventEmitter<void>();

  tagName: string = '';

  /**
   * Set the tag name for this menu instance
   */
  setTag(tagName: string): void {
    this.tagName = tagName;
  }

  /**
   * Handle action button clicks
   */
  onAction(action: TagAction): void {
    this.actionSelected.emit({ action, tag: this.tagName });
    this.close();
  }

  /**
   * Handle backdrop clicks to close menu
   */
  onBackdropClick(event: MouseEvent): void {
    // Only close if clicking the backdrop itself, not child elements
    if (event.target === event.currentTarget) {
      event.stopPropagation();
      event.preventDefault();
      this.close();
    }
  }

  /**
   * Close the menu
   */
  close(): void {
    this.closed.emit();
  }
}