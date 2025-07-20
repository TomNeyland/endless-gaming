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
    console.log('🎮 GamePickerPage: Starting game picker...');
    this.state.set('loading');
    
    this.gameDataService.getGames().subscribe({
      next: (games) => {
        console.log('🎮 GamePickerPage: Received games from service:', games.length, 'games');
        this.games = games;
        this.initializeServices(games);
        console.log('🎮 GamePickerPage: Services initialized, transitioning to comparing state');
        this.state.set('comparing');
      },
      error: (error) => {
        console.error('🎮 GamePickerPage: Failed to load games:', error);
        this.onError(error);
      }
    });
  }

  /**
   * Initialize all services with game data.
   */
  private initializeServices(games: GameRecord[]): void {
    console.log('🎮 GamePickerPage: Initializing services with', games.length, 'games');
    
    // Build tag dictionary and initialize preference model
    console.log('🎮 GamePickerPage: Building tag dictionary...');
    const tagDict = this.vectorService.buildTagDictionary(games);
    console.log('🎮 GamePickerPage: Tag dictionary built:', tagDict.size, 'unique tags');
    
    console.log('🎮 GamePickerPage: Initializing preference model...');
    this.preferenceService.initializeModel(tagDict);
    
    // Initialize pair service with games
    console.log('🎮 GamePickerPage: Initializing pair service...');
    this.pairService.initializeWithGames(games);
    
    // Check if pair service has pairs available
    const firstPair = this.pairService.getNextPair();
    console.log('🎮 GamePickerPage: First pair from PairService:', firstPair ? `${firstPair.left.name} vs ${firstPair.right.name}` : 'null');
    
    console.log('🎮 GamePickerPage: Service initialization complete');
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
    console.log('🎮 GamePickerPage: Comparisons completed - transitioning to recommendations');
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