// Servicio pequeno pero critico.
// Traduce el estado de sesion actual a un Set reactivo de permisos que consumen guards y directivas.
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ALL_PERMISSIONS, PermissionKey } from '../models/permissions.model';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  // Set se usa para consultas O(1) al verificar permisos puntuales.
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

  hasPermission(permission: string): boolean {
    // Verificacion atomica usada por guards, sidebar y directivas estructurales.
    const normalizedPermission = this.normalizePermission(permission);
    return normalizedPermission ? this.permissionsSubject.value.has(normalizedPermission) : false;
  }

  hasAnyPermission(permissions: string[]): boolean {
    // Atajo para pantallas que aceptan cualquiera de varios permisos equivalentes.
    return permissions.some(permission => this.hasPermission(permission));
  }

  getPermissions(): Observable<Set<PermissionKey>> {
    return this.permissions$;
  }

  clearPermissions(): void {
    // Se usa al cerrar sesion para vaciar rapidamente el estado en memoria.
    this.permissionsSubject.next(new Set());
  }

  setSessionPermissions(permissions: PermissionKey[]): void {
    // No modifica el subject directamente: la fuente de verdad sigue siendo la sesion.
    this.authService.updateSession({ permissions });
  }

  refreshPermissionsForGroup(groupId: string): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !groupId) {
      this.clearPermissions();
      return;
    }

    const permissions = currentUser.permissionsByGroup[groupId] ?? [];
    this.authService.updateSession({ selectedGroupId: groupId, permissions });
    this.permissionsSubject.next(new Set(permissions));
  }

  getCurrentPermissions(): PermissionKey[] {
    return [...this.permissionsSubject.value.values()];
  }

  private syncFromSession(): void {
    // 1. Recupera sesion y usuario actuales.
    const session = this.authService.getSession();
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      // Sin usuario no debe quedar ningun permiso activo en memoria.
      this.permissionsSubject.next(new Set());
      return;
    }

    // Primer grupo del usuario como fallback si la sesion aun no eligio uno.
    const fallbackGroupId = currentUser.groupIds[0] ?? null;

    if (session && !session.selectedGroupId && fallbackGroupId) {
      this.authService.updateSession({ selectedGroupId: fallbackGroupId });
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

    // Mantiene la sesión alineada con los permisos actuales del grupo.
    // Esto evita que queden permisos obsoletos después de cambios en usuarios.
    if (session) {
      const sessionPermissions = session.permissions ?? [];
      const sameLength = sessionPermissions.length === groupPermissions.length;
      const sameValues =
        sameLength &&
        sessionPermissions.every(permission => groupPermissions.includes(permission));

      if (!sameValues) {
        this.authService.updateSession({ permissions: groupPermissions });
      }
    }

    this.permissionsSubject.next(new Set(groupPermissions));
  }

  private normalizePermission(permission: string): PermissionKey | null {
    const aliases: Record<string, PermissionKey> = {
      'groups:view': 'group:view',
      'groups:add': 'group:add',
      'groups:edit': 'group:edit',
      'groups:delete': 'group:delete',
      'groups:manage': 'group:manage',
      'users:view': 'user:view',
      'users:add': 'user:add',
      'users:edit': 'user:edit',
      'users:delete': 'user:delete',
      'users:manage': 'user:manage',
      'tickets:view': 'ticket:view',
      'tickets:add': 'ticket:add',
      'tickets:edit': 'ticket:edit',
      'tickets:delete': 'ticket:delete',
      'tickets:move': 'ticket:edit:state',
      'tickets:comment': 'ticket:edit:comment',
      'tickets:assign': 'ticket:edit:assign',
      'tickets:manage': 'ticket:manage',
    };

    const normalized = aliases[permission.trim()] ?? permission.trim();
    return this.isPermissionKey(normalized) ? normalized : null;
  }

  private isPermissionKey(value: string): value is PermissionKey {
    return (ALL_PERMISSIONS as readonly string[]).includes(value);
  }
}
