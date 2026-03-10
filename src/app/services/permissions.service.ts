import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ALL_PERMISSIONS, PermissionKey } from '../models/permissions.model';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly permissionsSubject = new BehaviorSubject<Set<PermissionKey>>(new Set());
  readonly permissions$ = this.permissionsSubject.asObservable();

  constructor(private readonly authService: AuthService) {
    // Inicializa inmediatamente para la sesión actual
    this.syncFromSession();

    // Sincroniza cuando la sesión cambia, y también intenta hidratar si es necesario
    this.authService.session$.subscribe(() => {
      // Usar setTimeout(0) para asegurar que syncFromSession se ejecuta después de que
      // toda la propagación de RxJS haya terminado
      setTimeout(() => this.syncFromSession(), 0);
    });
  }

  hasPermission(permission: PermissionKey): boolean {
    return this.permissionsSubject.value.has(permission);
  }

  hasAnyPermission(permissions: PermissionKey[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  getPermissions(): Observable<Set<PermissionKey>> {
    return this.permissions$;
  }

  clearPermissions(): void {
    this.permissionsSubject.next(new Set());
  }

  setSessionPermissions(permissions: PermissionKey[]): void {
    this.authService.updateSession({ permissions });
  }

  getCurrentPermissions(): PermissionKey[] {
    return [...this.permissionsSubject.value.values()];
  }

  isSuperAdmin(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.isSuperAdmin ?? false;
  }

  private syncFromSession(): void {
    const session = this.authService.getSession();
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      this.permissionsSubject.next(new Set());
      return;
    }

    const fallbackGroupId = currentUser.groupIds[0] ?? null;

    if (session && !session.selectedGroupId && fallbackGroupId) {
      this.authService.updateSession({ selectedGroupId: fallbackGroupId });
    }

    if (currentUser.isSuperAdmin) {
      this.permissionsSubject.next(new Set(ALL_PERMISSIONS));
      return;
    }

    let selectedGroupId = session?.selectedGroupId ?? fallbackGroupId;

    // Si no hay selectedGroupId en sesión, intenta usar el primer grupo del usuario
    if (!selectedGroupId && currentUser.groupIds.length > 0) {
      selectedGroupId = currentUser.groupIds[0];
      // Hidrata la sesión si le falta el selectedGroupId
      if (session && !session.selectedGroupId) {
        this.authService.updateSession({ selectedGroupId });
      }
    }

    // Obtén los permisos para el grupo seleccionado
    const groupPermissions = selectedGroupId
      ? (currentUser.permissionsByGroup[selectedGroupId] ?? [])
      : [];

    // Asegúrate de que la sesión tenga los permisos reflejados
    if (session && session.permissions?.length === 0 && groupPermissions.length > 0) {
      this.authService.updateSession({ permissions: groupPermissions });
    }

    this.permissionsSubject.next(new Set(groupPermissions));
  }
}
