// Guard clasico basado en clase.
// Evita navegar a rutas privadas si no existe usuario autenticado en la sesion actual.
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly router: Router) {}

  canActivate(): boolean | UrlTree {
    // Si la sesion existe, la ruta continua. Si no, devuelve una redireccion declarativa.
    if (this.auth.isAuthenticated()) {
      return true;
    }

    return this.router.createUrlTree(['/login']);
  }
}
