// Componente lateral de navegacion interna.
// No solo pinta enlaces: tambien decide visibilidad de modulos segun la union de permisos del usuario y sesion.
import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PermissionsService } from '../../services/permissions.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [ButtonModule, RouterModule, CommonModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class Sidebar {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly permissionsService: PermissionsService,
  ) {}

  get currentUserName(): string {
    // Muestra nombre amigable del usuario autenticado.
    return this.auth.getCurrentUser()?.name ?? 'Usuario';
  }

  get currentUserEmail(): string {
    return this.auth.getCurrentUser()?.email ?? 'Sin sesion';
  }

  get currentWorkspaceLabel(): string {
    return this.auth.getSession()?.hasEnteredGroup
      ? 'Espacio activo listo'
      : 'Selecciona un grupo para comenzar';
  }

  get currentRoleLabel(): string {
    return this.auth.getCurrentUser()?.isSuperAdmin ? 'Superadministrador' : 'Colaborador';
  }

  get canSeeGroups(): boolean {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser?.isSuperAdmin) return true;
    if ((currentUser?.groupIds?.length ?? 0) > 0) return true;

    return this.permissionsService.hasAnyPermission([
      'group:view',
      'group:add',
      'group:edit',
      'group:delete',
      'group:manage',
    ]);
  }

  get canSeeUsers(): boolean {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser?.isSuperAdmin) return true;

    return this.permissionsService.hasAnyPermission([
      'user:view',
      'user:view:all',
      'user:add',
      'user:edit',
      'user:delete',
      'user:manage',
    ]);
  }

  get canSeeAdminSection(): boolean {
    return this.canSeeGroups || this.canSeeUsers;
  }

  isRouteActive(route: string): boolean {
    return this.router.url === route;
  }

  logout(): void {
    // Ademas del AuthService, limpia el Set reactivo de permisos para que la UI se actualice al instante.
    this.auth.logout();
    this.permissionsService.clearPermissions();
    this.router.navigate(['/']);
  }
}
