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
    return this.auth.getCurrentUser()?.name ?? 'Usuario';
  }

  get currentUserEmail(): string {
    return this.auth.getCurrentUser()?.email ?? 'Sin sesion';
  }

  get canSeeGroups(): boolean {
    return this.hasModuleAccess('group:');
  }

  get canSeeUsers(): boolean {
    return this.hasModuleAccess('user:');
  }

  get canSeeTickets(): boolean {
    return this.hasModuleAccess('ticket:');
  }

  private hasModuleAccess(prefix: 'group:' | 'user:' | 'ticket:'): boolean {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser?.isSuperAdmin) return true;

    const userPermissions = currentUser
      ? Object.values(currentUser.permissionsByGroup).flat()
      : [];
    const sessionPermissions = this.auth.getSession()?.permissions ?? [];
    const allPermissions = [...new Set([...userPermissions, ...sessionPermissions])];

    return allPermissions.some(permission => permission.startsWith(prefix));
  }

  logout(): void {
    this.auth.logout();
    this.permissionsService.clearPermissions();
    this.router.navigate(['/']);
  }
}
