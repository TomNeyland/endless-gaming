import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameRecord, GamePair } from '../../../types/game.types';

/**
 * Component for displaying two games side by side for comparison.
 * 
 * Shows two game cards with choice buttons and emits user decisions.
 * The core component of the pairwise comparison interface.
 */
@Component({
  selector: 'app-game-comparison',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-comparison.component.html',
  styleUrl: './game-comparison.component.scss'
})
export class GameComparisonComponent {
  
  @Input() gamePair: GamePair | null = null;
  @Output() choiceMade = new EventEmitter<{
    leftGame: GameRecord;
    rightGame: GameRecord;
    pick: 'left' | 'right' | 'skip';
  }>();

  constructor() {
    throw new Error('Not implemented');
  }

  /**
   * Handle left game selection.
   */
  selectLeft(): void {
    throw new Error('Not implemented');
  }

  /**
   * Handle right game selection.
   */
  selectRight(): void {
    throw new Error('Not implemented');
  }

  /**
   * Handle skip action.
   */
  skip(): void {
    throw new Error('Not implemented');
  }

  /**
   * Check if a valid game pair is available.
   */
  hasValidPair(): boolean {
    throw new Error('Not implemented');
  }
}