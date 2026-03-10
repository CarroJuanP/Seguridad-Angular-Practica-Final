import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PermissionsService } from '../../services/permissions.service';
import { PERMISSIONS_CATALOG } from '../../models/permissions.model';
import { CommonModule } from '@angular/common';
import { IfHasPermissionDirective } from '../../directives/has-permission';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [ButtonModule, RouterModule, CommonModule, IfHasPermissionDirective],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class Sidebar {
  permissions = PERMISSIONS_CATALOG;

  constructor(
    private auth: AuthService,
    private router: Router,
    private permissionsService: PermissionsService
  ) {}

  logout() {
    this.auth.logout();
    this.permissionsService.clearPermissions();
    this.router.navigate(['/']);
  }
  loginAsAdmin() { this.permissionsService.loginAsAdmin(); }
  loginAsUser() { this.permissionsService.loginAsUser(); }
  loginAsViewer() { this.permissionsService.loginAsViewer(); }
  loginAsEditor() { this.permissionsService.loginAsEditor(); }
}
