import { Component, Input, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProgressInfo } from '../../../types/game.types';
import { PairService } from '../../services/pair.service';
import { Subscription } from 'rxjs';

/**
 * Component for displaying comparison progress.
 * 
 * Shows current progress through the comparison phase with visual progress bar
 * and numerical indicators (e.g., "5 / 20 comparisons").
 */
@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule, MatProgressBarModule],
  templateUrl: './progress-bar.component.html',
  styleUrl: './progress-bar.component.scss'
})
export class ProgressBarComponent implements OnInit, OnDestroy {
  private pairService = inject(PairService);
  private subscription?: Subscription;
  
  @Input() showPercentage = true;
  @Input() showCount = true;
  
  progress: ProgressInfo | null = null;

  ngOnInit(): void {
    // Update progress from pair service
    this.updateProgress();
    
    // Set up interval to update progress (since PairService doesn't have observables)
    this.subscription = new Subscription();
    const interval = setInterval(() => {
      this.updateProgress();
    }, 100);
    
    this.subscription.add(() => clearInterval(interval));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private updateProgress(): void {
    this.progress = this.pairService.getProgress() || { current: 0, total: 20 };
  }

  /**
   * Check if progress data is available.
   */
  hasProgress(): boolean {
    return this.progress !== null && this.progress.total > 0;
  }

  /**
   * Calculate progress percentage.
   */
  getProgressPercentage(): number {
    if (!this.hasProgress() || !this.progress) {
      return 0;
    }
    
    return Math.round((this.progress.current / this.progress.total) * 100);
  }

  /**
   * Get progress display text.
   */
  getProgressText(): string {
    if (!this.hasProgress() || !this.progress) {
      return 'No progress data';
    }
    
    return `${this.progress.current} / ${this.progress.total} comparisons`;
  }

  /**
   * Get percentage display text.
   */
  getPercentageText(): string {
    return `${this.getProgressPercentage()}%`;
  }

  /**
   * Check if progress is complete.
   */
  isComplete(): boolean {
    if (!this.hasProgress() || !this.progress) {
      return false;
    }
    
    return this.progress.current >= this.progress.total;
  }

  /**
   * Get progress bar width as CSS value.
   */
  getProgressWidth(): string {
    return `${this.getProgressPercentage()}%`;
  }

  /**
   * Get progress bar CSS class based on completion.
   */
  getProgressClass(): string {
    const percentage = this.getProgressPercentage();
    
    if (percentage < 25) {
      return 'progress-early';
    } else if (percentage < 50) {
      return 'progress-quarter';
    } else if (percentage < 75) {
      return 'progress-half';
    } else if (percentage < 100) {
      return 'progress-near-complete';
    } else {
      return 'progress-complete';
    }
  }

  /**
   * Get remaining comparisons.
   */
  getRemainingCount(): number {
    if (!this.hasProgress() || !this.progress) {
      return 0;
    }
    
    return Math.max(0, this.progress.total - this.progress.current);
  }
}