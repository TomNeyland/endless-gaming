import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { trigger, state, style, transition, animate } from '@angular/animations';

/**
 * Collapsible section component for organizing content with expand/collapse functionality.
 * 
 * Features:
 * - Smooth expand/collapse animations
 * - Customizable section icons and titles
 * - Default expanded/collapsed state
 * - Event emission for state changes
 * - Dark gaming theme styling
 */
@Component({
  selector: 'app-collapsible-section',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './collapsible-section.component.html',
  styleUrl: './collapsible-section.component.scss',
  animations: [
    // Content expand/collapse animation
    trigger('expandCollapse', [
      state('expanded', style({
        height: '*',
        opacity: 1,
        overflow: 'visible'
      })),
      state('collapsed', style({
        height: '0',
        opacity: 0,
        overflow: 'hidden'
      })),
      transition('expanded <=> collapsed', [
        animate('300ms ease-in-out')
      ])
    ]),
    
    // Header icon rotation animation
    trigger('iconRotation', [
      state('expanded', style({ transform: 'rotate(180deg)' })),
      state('collapsed', style({ transform: 'rotate(0deg)' })),
      transition('expanded <=> collapsed', [
        animate('200ms ease-in-out')
      ])
    ])
  ]
})
export class CollapsibleSectionComponent {
  @Input() title: string = '';
  @Input() icon: string = 'info';
  @Input() isExpanded: boolean = false;
  @Input() disabled: boolean = false;
  @Output() toggledEvent = new EventEmitter<boolean>();

  /**
   * Toggle the expanded/collapsed state.
   */
  public toggle(): void {
    if (this.disabled) return;
    
    this.isExpanded = !this.isExpanded;
    this.toggledEvent.emit(this.isExpanded);
  }

  /**
   * Get the current animation state.
   */
  public getAnimationState(): string {
    return this.isExpanded ? 'expanded' : 'collapsed';
  }
}