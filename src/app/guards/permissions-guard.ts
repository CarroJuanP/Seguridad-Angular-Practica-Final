import { Injectable, inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';
import { PermissionKey } from '../models/permissions.model';

/**
 * 🛡️ PERMISSIONS GUARD (Functional)
 * Protege rutas que requieren permisos específicos
 * Uso en routes:
 *   { path: 'groups', component: Groups, canActivate: [permissionsGuard(PERMISSIONS_CATALOG.GROUPS_VIEW)] }
 */
export const permissionsGuard = (requiredPermission: string | string[]): CanActivateFn => {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const permissionsService = inject(PermissionsService);
    const router = inject(Router);

    const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasPermission = permissions.some(permission => permissionsService.hasPermission(permission as PermissionKey));

    if (hasPermission) {
      return true;
    } else {
      console.warn(`❌ Acceso denegado: permisos requeridos ${permissions.join(', ')}`);
      router.navigate(['/login']); // Redirige a login
      return false;
    }
  };
};
