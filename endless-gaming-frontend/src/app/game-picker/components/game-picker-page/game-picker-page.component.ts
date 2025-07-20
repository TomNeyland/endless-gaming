import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GamePickerState, GameRecord } from '../../../types/game.types';
import { GameDataService } from '../../services/game-data.service';
import { VectorService } from '../../services/vector.service';
import { PreferenceService } from '../../services/preference.service';
import { PairService } from '../../services/pair.service';
import { GameComparisonComponent } from '../game-comparison/game-comparison.component';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { PreferenceSummaryComponent } from '../preference-summary/preference-summary.component';
import { RecommendationListComponent } from '../recommendation-list/recommendation-list.component';

/**
 * Main container component for the game picker feature.
 * 
 * Manages the overall flow between loading, comparison, and recommendation phases.
 * Coordinates between child components and services.
 */
@Component({
  selector: 'app-game-picker-page',
  standalone: true,
  imports: [
    CommonModule,
    GameComparisonComponent,
    ProgressBarComponent,
    PreferenceSummaryComponent,
    RecommendationListComponent
  ],
  templateUrl: './game-picker-page.component.html',
  styleUrl: './game-picker-page.component.scss'
})
export class GamePickerPageComponent implements OnInit {
  private gameDataService = inject(GameDataService);
  private vectorService = inject(VectorService);
  private preferenceService = inject(PreferenceService);
  private pairService = inject(PairService);
  
  public readonly state = signal<GamePickerState>('loading');
  private games: GameRecord[] = [];
  private errorMessage = '';
  
  ngOnInit(): void {
    this.startGamePicker();
  }

  /**
   * Start the game picker flow.
   * Loads data and initializes services.
   */
  startGamePicker(): void {
    this.state.set('loading');
    
    this.gameDataService.getGames().subscribe({
      next: (games) => {
        this.games = games;
        this.initializeServices(games);
        this.state.set('comparing');
      },
      error: (error) => {
        console.error('Failed to load games:', error);
        this.onError(error);
      }
    });
  }

  /**
   * Initialize all services with game data.
   */
  private initializeServices(games: GameRecord[]): void {
    // Build tag dictionary and initialize preference model
    const tagDict = this.vectorService.buildTagDictionary(games);
    this.preferenceService.initializeModel(tagDict);
    
    // Initialize pair service with games
    this.pairService.initializeWithGames(games);
  }

  /**
   * Handle transition to comparison phase.
   */
  onStartComparisons(): void {
    this.state.set('comparing');
  }

  /**
   * Handle completion of comparison phase.
   */
  onComparisonsComplete(): void {
    this.state.set('recommendations');
  }

  /**
   * Reset and start over.
   */
  resetGamePicker(): void {
    this.pairService.resetProgress();
    this.preferenceService.resetPreferences();
    this.state.set('comparing');
  }

  /**
   * Handle error states.
   */
  onError(error: Error): void {
    this.errorMessage = error.message || 'An unexpected error occurred';
    this.state.set('error');
  }

  /**
   * Get current games for child components.
   */
  getGames(): GameRecord[] {
    return this.games;
  }

  /**
   * Get current error message.
   */
  getErrorMessage(): string {
    return this.errorMessage;
  }

  /**
   * Handle choice made event from game comparison component.
   */
  onChoiceMade(event: any): void {
    // The PairService handles the choice internally
    // This is just for potential UI updates
  }
}