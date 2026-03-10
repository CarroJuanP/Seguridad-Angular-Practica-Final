import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  PermissionKey,
  ROLE_PERMISSIONS,
  UserPermissions
} from '../models/permissions.model';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private permissionsSubject = new BehaviorSubject<Set<PermissionKey>>(new Set());
  public permissions$ = this.permissionsSubject.asObservable();

  hasPermission(permission: PermissionKey): boolean {
    return this.permissionsSubject.value.has(permission);
  }

  // Método para obtener un Observable de los permisos (usado por la directiva)
  getPermissions(): Observable<Set<PermissionKey>> {
    return this.permissions$;
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(p => this.hasPermission(p as PermissionKey));
  }

  clearPermissions(): void {
    this.permissionsSubject.next(new Set());
  }

  loginAsAdmin(): void {
    this.setPermissions('admin');
  }
  loginAsUser(): void {
    this.setPermissions('user');
  }
  loginAsViewer(): void {
    this.setPermissions('viewer');
  }
  loginAsEditor(): void {
    this.setPermissions('editor');
  }

  setUserPermissions(user: UserPermissions): void {
    const newPermissions = new Set<PermissionKey>(user.permissions);
    this.permissionsSubject.next(newPermissions);
  }

  private setPermissions(role: keyof typeof ROLE_PERMISSIONS): void {
    console.log(`🔐 Cambio de rol a: ${role.toUpperCase()}`);
    const newPermissions = new Set<PermissionKey>();
    ROLE_PERMISSIONS[role].forEach(p => newPermissions.add(p));
    this.permissionsSubject.next(newPermissions);
  }
}
