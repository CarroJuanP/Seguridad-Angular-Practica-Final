import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';
import { PermissionKey } from '../models/permissions.model';

export const permissionsGuard = (requiredPermission: PermissionKey | PermissionKey[]): CanActivateFn => {
  return () => {
    const permissionsService = inject(PermissionsService);
    const router = inject(Router);

    const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasPermission = permissions.some(permission => permissionsService.hasPermission(permission));

    if (hasPermission) {
      return true;
    }

    return router.createUrlTree(['/home']);
  };
};
