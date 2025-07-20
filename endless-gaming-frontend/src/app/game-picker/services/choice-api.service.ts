import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, EMPTY, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ChoiceEvent } from '../../types/game.types';

/**
 * Service for managing choice analytics and backend communication.
 * 
 * Implements offline queueing for choice events and batched synchronization
 * with the backend analytics endpoint.
 */
@Injectable({
  providedIn: 'root'
})
export class ChoiceApiService {
  private http = inject(HttpClient);
  
  private readonly QUEUE_STORAGE_KEY = 'choice_queue';
  private readonly USER_ID_STORAGE_KEY = 'user_id';
  private readonly API_URL = '/api/discovery/choices';
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds
  
  private choiceQueue: ChoiceEvent[] = [];
  private autoFlushSubscription: any = null;
  private userId: string | null = null;

  constructor() {
    this.loadQueueFromStorage();
    this.userId = this.getUserId();
  }

  /**
   * Queue a choice event for analytics.
   * Stores in local queue for offline support.
   */
  queueChoice(choice: ChoiceEvent): void {
    // Add user ID and ensure timestamp
    const enrichedChoice: ChoiceEvent = {
      ...choice,
      userId: this.getUserId(),
      timestamp: choice.timestamp || Date.now()
    };
    
    this.choiceQueue.push(enrichedChoice);
    this.saveQueueToStorage();
    
    // Try to flush if online
    if (this.isOnline() && this.choiceQueue.length >= 5) {
      this.flushChoices().subscribe({
        error: (error) => console.warn('Failed to flush choices:', error)
      });
    }
  }

  /**
   * Flush all queued choices to the backend.
   * Sends POST requests to /discovery/choices endpoint.
   */
  flushChoices(): Observable<void> {
    if (this.choiceQueue.length === 0) {
      return EMPTY;
    }
    
    const choicesToSend = [...this.choiceQueue];
    
    return this.http.post<void>(this.API_URL, { choices: choicesToSend }).pipe(
      map(() => {
        // Clear the queue on successful send
        this.choiceQueue = [];
        this.saveQueueToStorage();
      }),
      catchError(error => {
        console.error('Failed to send choices to backend:', error);
        // Don't clear queue on error - keep for retry
        return EMPTY;
      })
    );
  }

  /**
   * Get count of queued choices waiting to be sent.
   */
  getQueuedCount(): number {
    return this.choiceQueue.length;
  }

  /**
   * Check if the service is currently online.
   * Used to determine when to attempt flushing.
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Start automatic flushing when online.
   * Sets up periodic sync with backend.
   */
  startAutoFlush(): void {
    if (this.autoFlushSubscription) {
      return; // Already running
    }
    
    this.autoFlushSubscription = timer(0, this.FLUSH_INTERVAL).pipe(
      switchMap(() => {
        if (this.isOnline() && this.choiceQueue.length > 0) {
          return this.flushChoices();
        }
        return EMPTY;
      })
    ).subscribe({
      error: (error) => console.warn('Auto-flush error:', error)
    });
  }

  /**
   * Stop automatic flushing.
   * Cancels periodic sync operations.
   */
  stopAutoFlush(): void {
    if (this.autoFlushSubscription) {
      this.autoFlushSubscription.unsubscribe();
      this.autoFlushSubscription = null;
    }
  }

  /**
   * Clear all queued choices without sending.
   * Used for testing or privacy reset.
   */
  clearQueue(): void {
    this.choiceQueue = [];
    this.saveQueueToStorage();
  }

  /**
   * Get the current user ID for analytics.
   * Generates and persists UUID if not exists.
   */
  getUserId(): string {
    if (this.userId) {
      return this.userId;
    }
    
    // Try to load from localStorage
    const stored = localStorage.getItem(this.USER_ID_STORAGE_KEY);
    if (stored) {
      this.userId = stored;
      return stored;
    }
    
    // Generate new UUID
    const newUserId = this.generateUUID();
    localStorage.setItem(this.USER_ID_STORAGE_KEY, newUserId);
    this.userId = newUserId;
    return newUserId;
  }
  
  /**
   * Load choice queue from localStorage.
   */
  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.QUEUE_STORAGE_KEY);
      if (stored) {
        this.choiceQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load choice queue from storage:', error);
      this.choiceQueue = [];
    }
  }
  
  /**
   * Save choice queue to localStorage.
   */
  private saveQueueToStorage(): void {
    try {
      localStorage.setItem(this.QUEUE_STORAGE_KEY, JSON.stringify(this.choiceQueue));
    } catch (error) {
      console.warn('Failed to save choice queue to storage:', error);
    }
  }
  
  /**
   * Generate a simple UUID for user identification.
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}