import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Simple service to manage voting drawer state across components.
 */
@Injectable({
  providedIn: 'root'
})
export class VotingDrawerService {
  private drawerOpenSubject = new BehaviorSubject<boolean>(false);
  
  public drawerOpen$ = this.drawerOpenSubject.asObservable();

  openDrawer(): void {
    this.drawerOpenSubject.next(true);
  }

  closeDrawer(): void {
    this.drawerOpenSubject.next(false);
  }

  isOpen(): boolean {
    return this.drawerOpenSubject.value;
  }
}