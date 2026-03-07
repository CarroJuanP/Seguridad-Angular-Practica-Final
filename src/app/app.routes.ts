import { Routes } from '@angular/router';

import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';
import { Landing } from './pages/landing/landing';
import { Home } from './pages/home/home';
import { MainLayout } from './layout/main-layout/main-layout';
import { AuthGuard } from './guards/auth.guard';
import { Groups } from './pages/groups/groups';
import { Profile } from './pages/profile/profile';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'login', component: Login },
  { path: 'register', component: Register },

  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'home', component: Home, canActivate: [AuthGuard] },
      { path: 'groups', component: Groups, canActivate: [AuthGuard] },
      { path: 'profile', component: Profile, canActivate: [AuthGuard] }
    ]
  },

  { path: '**', redirectTo: '' }
];
