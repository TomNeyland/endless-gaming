import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { GamePickerState, GameRecord, GameChoice } from '../../../types/game.types';
import { GameDataService } from '../../services/game-data.service';
import { VectorService } from '../../services/vector.service';
import { PreferenceService } from '../../services/preference.service';
import { PairService } from '../../services/pair.service';
import { VotingDrawerService } from '../../services/voting-drawer.service';
import { GameFilterService } from '../../services/game-filter.service';
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
  private gameFilterService = inject(GameFilterService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  
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
        
        // Filter out games without tags - they can't contribute to preference learning
        const gamesWithTags = games.filter(game => {
          const hasValidTags = game.tags && Object.keys(game.tags).length > 0;
          if (!hasValidTags) {
            console.log(`🎮 GamePickerPage: Filtering out "${game.name}" - no tags`);
          }
          return hasValidTags;
        });
        
        console.log('🎮 GamePickerPage: Filtered to', gamesWithTags.length, 'games with tags (removed', games.length - gamesWithTags.length, 'games without tags)');
        
        this.games = gamesWithTags;
        this.initializeServices(gamesWithTags);
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
    
    // Enable TF-IDF analysis for tag rarity insights
    console.log('🎮 GamePickerPage: Enabling TF-IDF analysis...');
    this.preferenceService.enableTFIDF(games);
    console.log('🎮 GamePickerPage: TF-IDF analysis enabled');
    
    // Initialize pair service with games and tag dictionary for performance caching
    console.log('🎮 GamePickerPage: Initializing pair service...');
    this.pairService.initializeWithGames(games, tagDict);
    
    // Check if pair service has pairs available
    const firstPair = this.pairService.getNextPair();
    console.log('🎮 GamePickerPage: First pair from PairService:', firstPair ? `${firstPair.left.name} vs ${firstPair.right.name}` : 'null');
    
    console.log('🎮 GamePickerPage: Service initialization complete');
    
    // Use setTimeout to ensure localStorage has been fully processed
    setTimeout(() => {
      this.handleAutoNavigation();
    }, 0);
  }

  /**
   * Handle auto-navigation based on votes and current route.
   */
  private handleAutoNavigation(): void {
    const currentUrl = this.router.url;
    const comparisonCount = this.preferenceService.getComparisonCount();
    const hasMinimumVotes = this.preferenceService.hasMinimumVotes(5);
    
    console.log('🎮 GamePickerPage: Auto-navigation check:');
    console.log('  - Current URL:', currentUrl);
    console.log('  - Comparison count:', comparisonCount);
    console.log('  - Has minimum votes (5+):', hasMinimumVotes);
    
    if (currentUrl === '/game-picker' && hasMinimumVotes) {
      // User accessed /game-picker but has enough votes, redirect to recommendations
      console.log('🎮 GamePickerPage: Auto-navigating to recommendations due to existing votes');
      this.router.navigate(['/recommendations']);
      this.state.set('recommendations');
    } else if (currentUrl === '/recommendations' && hasMinimumVotes) {
      // User accessed /recommendations directly and has votes, show recommendations
      console.log('🎮 GamePickerPage: Showing recommendations from direct navigation');
      this.state.set('recommendations');
    } else if (currentUrl === '/recommendations' && !hasMinimumVotes) {
      // User accessed /recommendations but doesn't have enough votes, redirect to picker
      console.log('🎮 GamePickerPage: Redirecting to game picker - insufficient votes');
      this.router.navigate(['/game-picker']);
      this.state.set('comparing');
    } else {
      // Default behavior: show comparison phase
      console.log('🎮 GamePickerPage: Showing comparison phase');
      this.state.set('comparing');
    }
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
    this.router.navigate(['/recommendations']);
    this.state.set('recommendations');
  }

  /**
   * Reset and start over.
   */
  resetGamePicker(): void {
    console.log('🔄 Resetting game picker - clearing all state');
    
    // Close voting drawer if open
    this.votingDrawerService.closeDrawer();
    
    // Clear localStorage
    localStorage.removeItem('endless-gaming-preferences');
    
    // Reset all services to their default states
    this.pairService.resetProgress();
    this.preferenceService.resetPreferences();
    this.gameFilterService.resetFilters();
    
    console.log('🔄 All services reset to defaults');
    
    // Navigate back to game picker
    this.router.navigate(['/game-picker']);
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
   * Get TF-IDF analysis for enhanced tag display.
   */
  getTagRarityAnalysis() {
    return this.preferenceService.getTagRarityAnalysis();
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
    pick: GameChoice;
  }): void {
    console.log('🗳️ Processing vote:', voteEvent.pick, 'between', voteEvent.leftGame.name, 'and', voteEvent.rightGame.name);
    // The refreshRecommendations() will be called automatically via the subscription
    // to preference summary changes in the RecommendationListComponent
  }
}