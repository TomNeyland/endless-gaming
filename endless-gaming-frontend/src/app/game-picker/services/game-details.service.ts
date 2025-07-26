import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { GameRecord } from '../../types/game.types';
import { PreferenceService } from './preference.service';
import { 
  GameDetailsModalComponent, 
  GameDetailsModalData 
} from '../components/game-details-modal/game-details-modal.component';

/**
 * Service for managing game details modal functionality.
 * 
 * Provides centralized methods for opening game details with
 * proper modal configuration and responsive behavior.
 */
@Injectable({
  providedIn: 'root'
})
export class GameDetailsService {
  private dialog = inject(MatDialog);
  private preferenceService = inject(PreferenceService);

  /**
   * Open game details modal for the specified game.
   * 
   * @param game Game record to display
   * @returns MatDialogRef for the opened modal
   */
  public openGameDetails(game: GameRecord) {
    const config: MatDialogConfig<GameDetailsModalData> = {
      data: { 
        game,
        tagRarityAnalysis: this.preferenceService.getTagRarityAnalysis()
      },
      panelClass: 'game-details-dialog',
      maxWidth: '95vw',
      maxHeight: '95vh',
      width: '1200px',
      height: 'auto',
      autoFocus: true,
      restoreFocus: true,
      hasBackdrop: true,
      disableClose: false
    };

    return this.dialog.open(GameDetailsModalComponent, config);
  }

  /**
   * Check if any game details modal is currently open.
   * 
   * @returns True if modal is open
   */
  public isModalOpen(): boolean {
    return this.dialog.openDialogs.length > 0;
  }

  /**
   * Close all open game details modals.
   */
  public closeAllModals(): void {
    this.dialog.closeAll();
  }
}