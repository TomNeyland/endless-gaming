import { Component, EventEmitter, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GameRecord, GamePair, GameChoice } from '../../../types/game.types';
import { PairService } from '../../services/pair.service';
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
  imports: [CommonModule, MatButtonModule, MatIconModule, MatCardModule, MatTooltipModule, GameCardComponent],
  templateUrl: './game-comparison.component.html',
  styleUrl: './game-comparison.component.scss'
})
export class GameComparisonComponent implements OnInit {
  private pairService = inject(PairService);
  
  @Output() choiceMade = new EventEmitter<{
    leftGame: GameRecord;
    rightGame: GameRecord;
    pick: GameChoice;
  }>();
  
  @Output() comparisonsComplete = new EventEmitter<void>();

  currentPair: GamePair | null = null;
  isLoading = false;

  ngOnInit(): void {
    console.log('🎯 GameComparison: Component initializing...');
    this.loadNextPair();
  }


  /**
   * Load the next pair of games for comparison.
   */
  private loadNextPair(): void {
    console.log('🎯 GameComparison: Loading next pair...');
    this.currentPair = this.pairService.getNextPair();
    
    if (!this.currentPair) {
      console.log('🎯 GameComparison: No pair available - emitting comparisonsComplete');
      // No more pairs available - comparisons are complete
      this.comparisonsComplete.emit();
    } else {
      console.log('🎯 GameComparison: Loaded pair:', this.currentPair.left.name, 'vs', this.currentPair.right.name);
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
   * Handle like both games action.
   */
  likeBoth(): void {
    if (!this.currentPair) return;
    
    this.makeChoice('like_both');
  }

  /**
   * Handle dislike both games action.
   */
  dislikeBoth(): void {
    if (!this.currentPair) return;
    
    this.makeChoice('dislike_both');
  }

  /**
   * Process a user choice and load the next pair.
   */
  private makeChoice(pick: GameChoice): void {
    if (!this.currentPair) return;

    const leftGame = this.currentPair.left;
    const rightGame = this.currentPair.right;

    // Record choice in pair service
    this.pairService.recordChoice(leftGame, rightGame, pick);

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