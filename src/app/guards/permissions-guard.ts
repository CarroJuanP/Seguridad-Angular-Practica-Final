// Guard funcional de permisos finos.
// Se usa directamente en app.routes.ts para proteger pantallas por capability concreta.
import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';
import { AuthService } from '../services/auth.service';
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
    const authService = inject(AuthService);
    const router = inject(Router);

    // Siempre se trabaja como arreglo para soportar uno o varios permisos con la misma logica.
    const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasPermission = permissions.some(permission => permissionsService.hasPermission(permission));
    const currentUser = authService.getCurrentUser();
    const allUserPermissions = currentUser
      ? [...new Set(Object.values(currentUser.permissionsByGroup).flat())]
      : [];
    const hasPermissionInAnyGroup = permissions.some(permission => allUserPermissions.includes(permission));
    const isGroupsRoute = route.routeConfig?.path === 'groups';
    const canOpenGroupsForMembership = Boolean(isGroupsRoute && currentUser?.groupIds.length);

    if (hasPermission || hasPermissionInAnyGroup || canOpenGroupsForMembership) {
      return true;
    } else {
      console.warn(`❌ Acceso denegado: permisos requeridos ${permissions.join(', ')}`);
      router.navigate(['/home']); // Redirige a home si no tiene permisos
      return false;
    }
  };
};
