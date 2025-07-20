import { Component, EventEmitter, Output, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameRecord, GamePair, ChoiceEvent } from '../../../types/game.types';
import { PairService } from '../../services/pair.service';
import { ChoiceApiService } from '../../services/choice-api.service';
import { GameCardComponent } from '../game-card/game-card.component';

/**
 * Component for displaying two games side by side for comparison.
 * 
 * Shows two game cards with choice buttons and emits user decisions.
 * The core component of the pairwise comparison interface.
 */
@Component({
  selector: 'app-game-comparison',
  standalone: true,
  imports: [CommonModule, GameCardComponent],
  templateUrl: './game-comparison.component.html',
  styleUrl: './game-comparison.component.scss'
})
export class GameComparisonComponent implements OnInit, OnDestroy {
  private pairService = inject(PairService);
  private choiceApiService = inject(ChoiceApiService);
  
  @Output() choiceMade = new EventEmitter<{
    leftGame: GameRecord;
    rightGame: GameRecord;
    pick: 'left' | 'right' | 'skip';
  }>();
  
  @Output() comparisonsComplete = new EventEmitter<void>();

  currentPair: GamePair | null = null;
  isLoading = false;

  ngOnInit(): void {
    this.loadNextPair();
  }

  ngOnDestroy(): void {
    // Stop analytics auto-flush when component is destroyed
    this.choiceApiService.stopAutoFlush();
  }

  /**
   * Load the next pair of games for comparison.
   */
  private loadNextPair(): void {
    this.currentPair = this.pairService.getNextPair();
    
    if (!this.currentPair) {
      // No more pairs available - comparisons are complete
      this.comparisonsComplete.emit();
    }
  }

  /**
   * Handle left game selection.
   */
  selectLeft(): void {
    if (!this.currentPair) return;
    
    this.makeChoice('left');
  }

  /**
   * Handle right game selection.
   */
  selectRight(): void {
    if (!this.currentPair) return;
    
    this.makeChoice('right');
  }

  /**
   * Handle skip action.
   */
  skip(): void {
    if (!this.currentPair) return;
    
    this.makeChoice('skip');
  }

  /**
   * Process a user choice and load the next pair.
   */
  private makeChoice(pick: 'left' | 'right' | 'skip'): void {
    if (!this.currentPair) return;

    const leftGame = this.currentPair.left;
    const rightGame = this.currentPair.right;

    // Record choice in pair service
    this.pairService.recordChoice(leftGame, rightGame, pick);

    // Queue choice for analytics
    const choiceEvent: ChoiceEvent = {
      leftId: leftGame.appId,
      rightId: rightGame.appId,
      pick,
      ts: Date.now()
    };
    this.choiceApiService.queueChoice(choiceEvent);

    // Emit choice event for parent component
    this.choiceMade.emit({
      leftGame,
      rightGame,
      pick
    });

    // Load next pair
    this.loadNextPair();
  }

  /**
   * Check if a valid game pair is available.
   */
  hasValidPair(): boolean {
    return this.currentPair !== null;
  }

  /**
   * Get the left game from current pair.
   */
  getLeftGame(): GameRecord | null {
    return this.currentPair?.left || null;
  }

  /**
   * Get the right game from current pair.
   */
  getRightGame(): GameRecord | null {
    return this.currentPair?.right || null;
  }
}