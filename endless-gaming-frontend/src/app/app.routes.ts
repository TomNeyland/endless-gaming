import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'game-picker',
    loadComponent: () => 
      import('./game-picker/components/game-picker-page/game-picker-page.component')
        .then(m => m.GamePickerPageComponent)
  },
  {
    path: 'recommendations',
    loadComponent: () => 
      import('./game-picker/components/game-picker-page/game-picker-page.component')
        .then(m => m.GamePickerPageComponent)
  },
  {
    path: '',
    redirectTo: '/game-picker',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/game-picker'
  }
];
