import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { GamePickerState, GameRecord } from '../../../types/game.types';
import { GameDataService } from '../../services/game-data.service';
import { VectorService } from '../../services/vector.service';
import { PreferenceService } from '../../services/preference.service';
import { PairService } from '../../services/pair.service';
import { VotingDrawerService } from '../../services/voting-drawer.service';
import { GameComparisonComponent } from '../game-comparison/game-comparison.component';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { PreferenceSummaryComponent } from '../preference-summary/preference-summary.component';
import { RecommendationListComponent } from '../recommendation-list/recommendation-list.component';
import { VotingDrawerComponent } from '../voting-drawer/voting-drawer.component';

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
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
    GameComparisonComponent,
    ProgressBarComponent,
    PreferenceSummaryComponent,
    RecommendationListComponent,
    VotingDrawerComponent
  ],
  templateUrl: './game-picker-page.component.html',
  styleUrl: './game-picker-page.component.scss'
})
export class GamePickerPageComponent implements OnInit {
  private gameDataService = inject(GameDataService);
  private vectorService = inject(VectorService);
  private preferenceService = inject(PreferenceService);
  private pairService = inject(PairService);
  private votingDrawerService = inject(VotingDrawerService);
  
  public readonly state = signal<GamePickerState>('loading');
  public readonly isDrawerOpen = signal(false);
  private games: GameRecord[] = [];
  private errorMessage = '';
  
  ngOnInit(): void {
    this.startGamePicker();
    
    // Subscribe to drawer service
    this.votingDrawerService.drawerOpen$.subscribe(isOpen => {
      this.isDrawerOpen.set(isOpen);
      if (isOpen) {
        this.setupVotingSession();
      } else {
        this.teardownVotingSession();
      }
    });
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
    
    // Initialize pair service with games and tag dictionary for performance caching
    console.log('🎮 GamePickerPage: Initializing pair service...');
    this.pairService.initializeWithGames(games, tagDict);
    
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

  /**
   * Setup voting session when drawer opens.
   */
  private setupVotingSession(): void {
    console.log('🗳️ Setting up voting session');
    // Enable infinite mode for continuous voting
    this.pairService.enableInfiniteMode();
    
    // Initialize the pair service with current games if needed
    if (this.games.length > 0) {
      // We need the tag dictionary for caching - rebuild it
      const tagDict = this.vectorService.buildTagDictionary(this.games);
      this.pairService.initializeWithGames(this.games, tagDict);
    }
  }

  /**
   * Teardown voting session when drawer closes.
   */
  private teardownVotingSession(): void {
    console.log('🗳️ Tearing down voting session');
    this.pairService.disableInfiniteMode();
  }

  /**
   * Handle drawer close event.
   */
  onDrawerClosed(): void {
    this.votingDrawerService.closeDrawer();
  }

  /**
   * Handle vote cast events from the drawer.
   */
  onVoteCast(voteEvent: {
    leftGame: GameRecord;
    rightGame: GameRecord;
    pick: 'left' | 'right' | 'skip';
  }): void {
    console.log('🗳️ Processing vote:', voteEvent.pick, 'between', voteEvent.leftGame.name, 'and', voteEvent.rightGame.name);
    // The refreshRecommendations() will be called automatically via the subscription
    // to preference summary changes in the RecommendationListComponent
  }
}