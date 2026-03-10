import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { Router } from '@angular/router';
import { IfHasPermissionDirective } from '../../directives/has-permission';
import { AuthService } from '../../services/auth.service';
import {
  ALL_PERMISSIONS,
  AppUser,
  PERMISSIONS_CATALOG,
  PermissionKey,
} from '../../models/permissions.model';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TagModule,
    IfHasPermissionDirective,
  ],
  templateUrl: './user.html',
  styleUrls: ['./user.css'],
})
export class UserPage implements OnInit {
  permissions = PERMISSIONS_CATALOG;
  allPermissions = ALL_PERMISSIONS;
  users: AppUser[] = [];
  selectedGroupId: string | null = null;

  dialogVisible = false;
  isNew = false;
  formData: AppUser = this.emptyUser();

  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    this.selectedGroupId = this.authService.getSession()?.selectedGroupId ?? null;

    if (!currentUser?.isSuperAdmin) {
      this.router.navigate(['/home']);
      return;
    }

    if (!this.selectedGroupId) {
      this.router.navigate(['/groups']);
      return;
    }

    this.loadUsers();
  }

  loadUsers(): void {
    const groupId = this.selectedGroupId;
    const all = this.authService.getUsers();
    this.users = groupId ? all.filter(user => user.groupIds.includes(groupId)) : all;
  }

  openNew(): void {
    const groupId = this.selectedGroupId;
    this.formData = this.emptyUser();

    if (groupId) {
      this.formData.groupIds = [groupId];
      this.formData.permissionsByGroup[groupId] = [PERMISSIONS_CATALOG.TICKET_READ];
    }

    this.isNew = true;
    this.dialogVisible = true;
  }

  editUser(user: AppUser): void {
    this.formData = structuredClone(user);
    this.isNew = false;
    this.dialogVisible = true;
  }

  saveUser(): void {
    const users = this.authService.getUsers();

    if (this.isNew) {
      this.formData.id = `u-${Math.random().toString(36).slice(2, 8)}`;
      users.push({ ...this.formData });
    } else {
      const index = users.findIndex(user => user.id === this.formData.id);
      if (index >= 0) {
        users[index] = { ...this.formData };
      }
    }

    this.authService.saveUsers(users);
    this.dialogVisible = false;
    this.loadUsers();
  }

  deleteUser(user: AppUser): void {
    const users = this.authService.getUsers().filter(current => current.id !== user.id);
    this.authService.saveUsers(users);
    this.loadUsers();
  }

  togglePermission(permission: PermissionKey): void {
    const groupId = this.selectedGroupId;
    if (!groupId) {
      return;
    }

    const current = this.formData.permissionsByGroup[groupId] ?? [];
    const exists = current.includes(permission);
    this.formData.permissionsByGroup[groupId] = exists
      ? current.filter(item => item !== permission)
      : [...current, permission];
  }

  hasPermissionChecked(permission: PermissionKey): boolean {
    const groupId = this.selectedGroupId;
    if (!groupId) {
      return false;
    }

    return (this.formData.permissionsByGroup[groupId] ?? []).includes(permission);
  }

  private emptyUser(): AppUser {
    return {
      id: '',
      name: '',
      username: '',
      email: '',
      password: '',
      phone: '',
      birthDate: '2000-01-01',
      address: '',
      isSuperAdmin: false,
      groupIds: [],
      permissionsByGroup: {},
    };
  }
}
