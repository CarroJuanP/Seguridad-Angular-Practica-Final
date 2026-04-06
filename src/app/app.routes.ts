import { Routes } from '@angular/router';
import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';
import { Landing } from './pages/landing/landing';
import { Home } from './pages/home/home';
import { MainLayout } from './layout/main-layout/main-layout';
import { AuthGuard } from './guards/auth.guard';
import { permissionsGuard } from './guards/permissions-guard';
import { Groups } from './pages/groups/groups';
import { UserPage } from './pages/user/user';
import { Tickets } from './pages/tickets/tickets';
import { Profile } from './pages/profile/profile';


export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'login', component: Login },
  { path: 'register', component: Register },

  {
    path: '',
    component: MainLayout,
    canActivate: [AuthGuard],
    children: [
      { path: 'home', component: Home },
      { path: 'groups', component: Groups },
      {
        path: 'users',
        component: UserPage,
        canActivate: [permissionsGuard('user:view')],
      },
      {
        path: 'tickets',
        component: Tickets,
        canActivate: [permissionsGuard('ticket:view')],
      },
      { path: 'profile', component: Profile },
    ],
  },

  { path: '**', redirectTo: '' },
];
