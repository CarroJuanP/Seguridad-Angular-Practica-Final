import { Routes } from '@angular/router';
import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';
import { Landing } from './pages/landing/landing';
import { Home } from './pages/home/home';
import { MainLayout } from './layout/main-layout/main-layout';
import { AuthGuard } from './guards/auth.guard';
import { permissionsGuard } from './guards/permissions-guard';
import { Groups } from './pages/groups/groups';
import { Profile } from './pages/profile/profile';
import { PERMISSIONS_CATALOG } from './models/permissions.model';
import { User } from './pages/user/user';
import { Tickets } from './pages/tickets/tickets';




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
      {
        path: 'groups',
        component: Groups,
        canActivate: [permissionsGuard(PERMISSIONS_CATALOG.GROUPS_VIEW)],
      },
      {
        path: 'users',
        component: User,
        canActivate: [permissionsGuard(PERMISSIONS_CATALOG.USERS_VIEW)],
      },
      {
        path: 'tickets',
        component: Tickets,
        canActivate: [permissionsGuard(PERMISSIONS_CATALOG.TICKETS_VIEW)],
      },
      { path: 'profile', component: Profile },
    ],
  },

  { path: '**', redirectTo: '' },
];
