import { Routes } from '@angular/router';

/**
 * Routes for the Game Picker feature module.
 * 
 * Currently includes only the main game picker page, but could be extended
 * with additional routes for settings, results, or other sub-features.
 */
export const gamePickerRoutes: Routes = [
  {
    path: '',
    loadComponent: () => 
      import('./components/game-picker-page/game-picker-page.component')
        .then(m => m.GamePickerPageComponent)
  }
];