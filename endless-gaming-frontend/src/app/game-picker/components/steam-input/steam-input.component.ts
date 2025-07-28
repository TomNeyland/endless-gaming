import { Component, EventEmitter, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SteamPlayerService } from '../../../shared/services/steam-player.service';
import { SteamPlayerLookupResponse } from '../../../types/game.types';

/**
 * Component for Steam ID input and library fetching.
 * 
 * Allows users to enter their Steam ID and fetch their library data
 * for enhanced game recommendations.
 */

interface SteamInputState {
  type: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}

@Component({
  selector: 'app-steam-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './steam-input.component.html',
  styleUrl: './steam-input.component.scss'
})
export class SteamInputComponent {
  private steamPlayerService = inject(SteamPlayerService);
  private snackBar = inject(MatSnackBar);
  private readonly STORAGE_KEY = 'endless-gaming-steam-data';
  private isClearing = false; // Flag to prevent emission during clearing

  @Output() steamDataLoaded = new EventEmitter<SteamPlayerLookupResponse>();
  @Output() steamDataCleared = new EventEmitter<void>();

  public readonly steamId = signal<string>('');
  public readonly state = signal<SteamInputState>({ type: 'idle' });
  public readonly steamData = signal<SteamPlayerLookupResponse | null>(null);

  constructor() {
    // Load persisted Steam data on component initialization
    this.loadPersistedData();
  }

  /**
   * Fetch Steam library data for the entered Steam ID.
   */
  async fetchSteamData(): Promise<void> {
    const steamIdValue = this.steamId().trim();
    
    if (!steamIdValue) {
      this.showError('Please enter a Steam ID');
      return;
    }

    // Extract Steam ID from URL if provided
    const extractedId = this.extractSteamId(steamIdValue);
    if (!extractedId) {
      this.showError('Please enter a valid Steam ID (17-digit number or custom URL)');
      return;
    }

    this.state.set({ type: 'loading', message: 'Fetching Steam library...' });

    try {
      this.steamPlayerService.lookupPlayer(extractedId, false).subscribe({
        next: (data) => {
          this.steamData.set(data);
          this.state.set({ 
            type: 'success', 
            message: `Loaded ${data.game_count} games from Steam library` 
          });
          
          // Persist to localStorage
          this.persistSteamData(extractedId, data);
          
          this.steamDataLoaded.emit(data);
          
          this.snackBar.open(
            `✅ Steam library loaded: ${data.game_count} games found`, 
            'Close', 
            { duration: 5000 }
          );
        },
        error: (error) => {
          console.error('Steam lookup failed:', error);
          this.showError(error.message || 'Failed to fetch Steam data');
        }
      });
    } catch (error: any) {
      console.error('Steam lookup failed:', error);
      this.showError(error.message || 'Failed to fetch Steam data');
    }
  }

  /**
   * Clear Steam data and reset component.
   */
  clearSteamData(): void {
    this.isClearing = true;
    
    this.steamData.set(null);
    this.steamId.set('');
    this.state.set({ type: 'idle' });
    
    // Clear from localStorage
    this.clearPersistedData();
    
    this.steamDataCleared.emit();
    
    this.snackBar.open('Steam data cleared', 'Close', { duration: 3000 });
    
    this.isClearing = false;
  }

  /**
   * Refresh Steam data using existing Steam ID.
   */
  async refreshSteamData(): Promise<void> {
    if (this.steamData() && this.steamId()) {
      await this.fetchSteamData();
    }
  }

  /**
   * Handle Steam ID input changes.
   */
  onSteamIdChange(value: string): void {
    this.steamId.set(value);
    
    // Clear error state when user starts typing
    if (this.state().type === 'error') {
      this.state.set({ type: 'idle' });
    }
  }

  /**
   * Handle Enter key press in input field.
   */
  onEnterPressed(): void {
    if (this.steamId().trim() && this.state().type !== 'loading') {
      this.fetchSteamData();
    }
  }

  /**
   * Extract Steam ID from input (handles URLs and direct IDs).
   */
  private extractSteamId(input: string): string | null {
    const trimmedInput = input.trim();
    
    // Check if it's a Steam Community URL
    const profileMatch = trimmedInput.match(/(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/profiles\/(\d+)/);
    if (profileMatch) {
      return profileMatch[1];
    }
    
    const idMatch = trimmedInput.match(/(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/id\/([^\/\?]+)/);
    if (idMatch) {
      return idMatch[1];
    }
    
    // Check if it's a direct Steam64 ID or custom URL
    if (this.isValidSteamId(trimmedInput)) {
      return trimmedInput;
    }
    
    return null;
  }

  /**
   * Validate Steam ID format.
   */
  private isValidSteamId(steamId: string): boolean {
    // Steam64 ID (17 digits starting with 765)
    const steam64Pattern = /^765\d{14}$/;
    
    // Custom URL (alphanumeric, underscore, hyphen, 2-32 chars)
    const customUrlPattern = /^[a-zA-Z0-9_-]{2,32}$/;
    
    return steam64Pattern.test(steamId) || customUrlPattern.test(steamId);
  }

  /**
   * Show error state with message.
   */
  private showError(message: string): void {
    this.state.set({ type: 'error', message });
    this.snackBar.open(`❌ ${message}`, 'Close', { duration: 5000 });
  }

  /**
   * Get current Steam library statistics.
   */
  getLibraryStats(): {
    totalGames: number;
    recentlyPlayed: number;
    neverPlayed: number;
  } | null {
    const data = this.steamData();
    if (!data) return null;

    const recentlyPlayed = data.games.filter(game => 
      game.playtime_2weeks && game.playtime_2weeks > 0
    ).length;

    const neverPlayed = data.games.filter(game => 
      game.playtime_forever === 0
    ).length;

    return {
      totalGames: data.game_count,
      recentlyPlayed,
      neverPlayed
    };
  }

  /**
   * Get top played games for display.
   */
  getTopPlayedGames(limit: number = 3): Array<{
    name: string;
    playtime: string;
  }> {
    const data = this.steamData();
    if (!data) return [];

    return data.games
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, limit)
      .map(game => ({
        name: game.name,
        playtime: this.formatPlaytime(game.playtime_forever)
      }));
  }

  /**
   * Format playtime for display.
   */
  private formatPlaytime(playtimeMinutes: number): string {
    if (playtimeMinutes === 0) return 'Never played';
    
    const hours = Math.floor(playtimeMinutes / 60);
    if (hours === 0) {
      return `${playtimeMinutes}m`;
    } else if (hours < 10) {
      const minutes = playtimeMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      return `${hours}h`;
    }
  }

  /**
   * Check if Steam data is currently loaded.
   */
  hasSteamData(): boolean {
    return !!this.steamData();
  }

  /**
   * Check if component is currently loading.
   */
  isLoading(): boolean {
    return this.state().type === 'loading';
  }

  /**
   * Check if component has an error.
   */
  hasError(): boolean {
    return this.state().type === 'error';
  }

  /**
   * Get current state message.
   */
  getStateMessage(): string {
    return this.state().message || '';
  }

  /**
   * Load persisted Steam data from localStorage.
   */
  private loadPersistedData(): void {
    // Don't load if we're in the middle of clearing
    if (this.isClearing) {
      return;
    }
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored && !this.isClearing) {
        const persistedData = JSON.parse(stored);
        console.log('🔄 Loading persisted Steam data:', persistedData.steamId);
        
        this.steamId.set(persistedData.steamId);
        this.steamData.set(persistedData.steamData);
        this.state.set({ 
          type: 'success', 
          message: `Loaded ${persistedData.steamData.game_count} games from Steam library` 
        });
        
        // Emit the loaded data to parent component (but not if clearing)
        setTimeout(() => {
          if (!this.isClearing) {
            this.steamDataLoaded.emit(persistedData.steamData);
          }
        }, 0);
      }
    } catch (error) {
      console.warn('Failed to load persisted Steam data:', error);
      this.clearPersistedData();
    }
  }

  /**
   * Persist Steam data to localStorage.
   */
  private persistSteamData(steamId: string, steamData: SteamPlayerLookupResponse): void {
    try {
      const dataToStore = {
        steamId,
        steamData,
        timestamp: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
      console.log('💾 Steam data persisted to localStorage');
    } catch (error) {
      console.warn('Failed to persist Steam data:', error);
    }
  }

  /**
   * Clear persisted Steam data from localStorage.
   */
  private clearPersistedData(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('🗑️ Steam data cleared from localStorage');
    } catch (error) {
      console.warn('Failed to clear persisted Steam data:', error);
    }
  }

  /**
   * Clear persisted data (called from parent on restart).
   */
  public clearPersistedSteamData(): void {
    this.isClearing = true;
    this.clearPersistedData();
    
    // Clear UI state but don't emit events during restart
    this.steamData.set(null);
    this.steamId.set('');
    this.state.set({ type: 'idle' });
    
    this.isClearing = false;
  }
}