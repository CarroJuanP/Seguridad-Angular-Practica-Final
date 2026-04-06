import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';
import { PermissionKey } from '../models/permissions.model';

/**
 * 🛡️ PERMISSIONS GUARD (Functional)
 * Protege rutas que requieren permisos específicos
 * Uso en routes:
 *   { path: 'groups', component: Groups, canActivate: [permissionsGuard('GROUP_VIEW')] }
 */
export const permissionsGuard = (requiredPermission: PermissionKey | PermissionKey[]): CanActivateFn => {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const permissionsService = inject(PermissionsService);
    const router = inject(Router);

    const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasPermission = permissions.some(permission => permissionsService.hasPermission(permission));

    if (hasPermission) {
      return true;
    } else {
      console.warn(`❌ Acceso denegado: permisos requeridos ${permissions.join(', ')}`);
      router.navigate(['/home']); // Redirige a home si no tiene permisos
      return false;
    }
  };
};
