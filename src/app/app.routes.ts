// Tabla central de rutas.
// Se separan las rutas publicas de autenticacion y las rutas internas protegidas por layout + guards.
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
  // Pantallas publicas.
  { path: '', component: Landing },
  { path: 'login', component: Login },
  { path: 'register', component: Register },

  {
    // Las pantallas privadas reutilizan un layout comun con sidebar.
    path: '',
    component: MainLayout,
    canActivate: [AuthGuard],
    children: [
      // Home solo requiere sesion valida.
      { path: 'home', component: Home },
      {
        path: 'groups',
        component: Groups,
        canActivate: [permissionsGuard(['group:view', 'group:add', 'group:edit', 'group:delete', 'group:manage'])],
      },
      {
        // La gestion de usuarios ademas requiere permiso puntual.
        path: 'users',
        component: UserPage,
        canActivate: [permissionsGuard(['user:view', 'user:view:all', 'user:add', 'user:edit', 'user:delete', 'user:manage'])],
      },
      {
        // Tickets se protege con permiso puntual para evitar acceso por URL directa.
        path: 'tickets',
        component: Tickets,
        canActivate: [permissionsGuard(['ticket:view', 'ticket:manage'])],
      },
      { path: 'profile', component: Profile },
    ],
  },

  // Cualquier URL desconocida vuelve a la landing.
  { path: '**', redirectTo: '' },
];
