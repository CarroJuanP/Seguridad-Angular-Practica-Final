import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { IfHasPermissionDirective } from '../../directives/has-permission';
import { AuthService } from '../../services/auth.service';
import { Permissions } from '../../services/permissions';
import {
  ALL_PERMISSIONS,
  AppUser,
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
    ToastModule,
    IfHasPermissionDirective,
  ],
  templateUrl: './user.html',
  styleUrls: ['./user.css'],
  providers: [MessageService],
})
export class UserPage implements OnInit {
  private readonly passwordPolicy = /^(?=.*[!@#$%^&*])\S+$/;

  permissions = { USER_ADD: 'user:add', USER_EDIT: 'user:edit', USER_DELETE: 'user:delete' };
  allPermissions = ALL_PERMISSIONS;
  users: AppUser[] = [];
  groupNameMap: Record<string, string> = {};
  availableGroups: Array<{ label: string; value: string; description: string }> = [];
  isLoading = false;
  selectedGroupId: string | null = null;
  isCurrentUserSuperAdmin = false;
  permissionGroupId: string | null = null;
  expandedUsers: Record<string, boolean> = {};

  dialogVisible = false;
  isNew = false;
  formData: AppUser = this.emptyUser();
  private originalPassword = '';

  constructor(
    private readonly authService: AuthService,
    private readonly dataService: Permissions,
    private readonly messageService: MessageService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    this.isCurrentUserSuperAdmin = currentUser?.isSuperAdmin ?? false;
    const session = this.authService.getSession();
    this.selectedGroupId = session?.selectedGroupId ?? currentUser?.groupIds[0] ?? null;

    if (!(session?.permissions ?? []).includes('user:view')) {
      this.router.navigate(['/home']);
      return;
    }
    if (!this.selectedGroupId) {
      this.router.navigate(['/groups']);
      return;
    }

    // Build group name map for display
    this.dataService.getGroups$().subscribe(groups => {
      this.groupNameMap = Object.fromEntries(groups.map(g => [g.id, g.name]));
      const allowedGroups = this.isCurrentUserSuperAdmin
        ? groups
        : groups.filter(group => currentUser?.groupIds.includes(group.id));
      this.availableGroups = allowedGroups.map(group => ({
        label: group.name,
        value: group.id,
        description: group.description,
      }));
    });

    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.authService.getUsers$().subscribe(users => {
      this.isLoading = false;
      const groupId = this.selectedGroupId;
      this.users = this.isCurrentUserSuperAdmin
        ? users
        : groupId ? users.filter(u => u.groupIds.includes(groupId)) : users;
    });
  }

  openNew(): void {
    const groupId = this.selectedGroupId;
    this.formData = this.emptyUser();
    this.originalPassword = '';
    if (groupId) {
      this.formData.groupIds = [groupId];
      this.formData.permissionsByGroup[groupId] = ['ticket:view'];
      this.permissionGroupId = groupId;
    } else {
      this.permissionGroupId = null;
    }

    this.isNew = true;
    this.dialogVisible = true;
  }

  editUser(user: AppUser): void {
    this.formData = structuredClone(user);
    this.originalPassword = user.password ?? '';
    // Avoid showing the current password/hash in UI; only set when user wants to change it.
    this.formData.password = '';
    const permissionGroupIds = Object.keys(this.formData.permissionsByGroup ?? {});
    this.formData.groupIds = [...new Set([...(this.formData.groupIds ?? []), ...permissionGroupIds])];

    const candidateGroup =
      this.selectedGroupId && this.formData.groupIds.includes(this.selectedGroupId)
        ? this.selectedGroupId
        : this.formData.groupIds[0] ?? this.selectedGroupId;

    this.permissionGroupId = candidateGroup ?? null;

    if (this.permissionGroupId && !this.formData.permissionsByGroup[this.permissionGroupId]) {
      this.formData.permissionsByGroup[this.permissionGroupId] = [];
    }

    this.isNew = false;
    this.dialogVisible = true;
  }

  saveUser(): void {
    if (!this.formData.name.trim() || !this.formData.username.trim() || !this.formData.email.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Datos incompletos',
        detail: 'Nombre, usuario y email son obligatorios.',
      });
      return;
    }

    if (!this.formData.groupIds.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin grupos',
        detail: 'Selecciona al menos un grupo para el usuario.',
      });
      return;
    }

    if (this.isNew && !this.formData.password.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Password requerida',
        detail: 'Captura una password para el usuario nuevo.',
      });
      return;
    }

    const hasNewPassword = Boolean(this.formData.password.trim());
    if (hasNewPassword) {
      const newPassword = this.formData.password.trim();
      const isValid = newPassword.length >= 10 && this.passwordPolicy.test(newPassword);
      if (!isValid) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Password invalida',
          detail: 'Usa minimo 10 caracteres, al menos un simbolo (!@#$%^&*) y sin espacios.',
        });
        return;
      }
    }

    const userToSave: AppUser = {
      ...this.formData,
      password: this.isNew
        ? this.formData.password.trim()
        : (this.formData.password.trim() || this.originalPassword),
    };

    this.isLoading = true;
    this.authService.upsertUserInDB$(userToSave, this.isNew).subscribe(result => {
      this.isLoading = false;
      if (result.ok) {
        this.dialogVisible = false;
        this.messageService.add({
          severity: 'success',
          summary: this.isNew ? 'Usuario creado' : 'Usuario actualizado',
          detail: this.formData.name,
        });
        this.loadUsers();
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: result.message ?? 'No se pudo guardar el usuario',
        });
      }
    });
  }

  deleteUser(user: AppUser): void {
    this.authService.deleteUserFromDB$(user.id).subscribe(result => {
      if (result.ok) {
        this.messageService.add({ severity: 'success', summary: 'Usuario eliminado', detail: user.name });
        this.loadUsers();
      } else {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el usuario' });
      }
    });
  }

  togglePermission(permission: PermissionKey): void {
    const groupId = this.permissionGroupId;
    if (!groupId) {
      return;
    }

    if (!this.formData.groupIds.includes(groupId)) {
      this.formData.groupIds = [...this.formData.groupIds, groupId];
    }

    const current = this.formData.permissionsByGroup[groupId] ?? [];
    const exists = current.includes(permission);
    this.formData.permissionsByGroup[groupId] = exists
      ? current.filter(item => item !== permission)
      : [...current, permission];
  }

  hasPermissionChecked(permission: PermissionKey): boolean {
    const groupId = this.permissionGroupId;
    if (!groupId) {
      return false;
    }

    return (this.formData.permissionsByGroup[groupId] ?? []).includes(permission);
  }

  onGroupCheckedChange(groupId: string, checked: boolean): void {
    const nextGroupIds = checked
      ? [...this.formData.groupIds, groupId]
      : this.formData.groupIds.filter(currentGroupId => currentGroupId !== groupId);

    this.onGroupsSelectionChange(nextGroupIds);
  }

  onGroupsSelectionChange(groupIds: string[]): void {
    const uniqueGroupIds = [...new Set(groupIds)];
    const nextPermissions: Record<string, PermissionKey[]> = {};

    for (const groupId of uniqueGroupIds) {
      nextPermissions[groupId] = this.formData.permissionsByGroup[groupId] ?? ['ticket:view'];
    }

    this.formData.groupIds = uniqueGroupIds;
    this.formData.permissionsByGroup = nextPermissions;

    if (!this.permissionGroupId || !uniqueGroupIds.includes(this.permissionGroupId)) {
      this.permissionGroupId = uniqueGroupIds[0] ?? null;
    }
  }

  selectedGroupLabels(): string {
    if (!this.formData.groupIds.length) {
      return 'Sin grupos asignados';
    }

    return this.formData.groupIds
      .map(groupId => this.groupNameMap[groupId] ?? groupId)
      .join(', ');
  }

  userPermissionsByGroup(user: AppUser): Array<{ groupName: string; permissions: PermissionKey[] }> {
    return this.displayGroupIds(user).map(groupId => ({
      groupName: this.groupNameMap[groupId] ?? groupId,
      permissions: user.permissionsByGroup[groupId] ?? [],
    }));
  }

  userGroupLabels(user: AppUser): string {
    return this.displayGroupIds(user)
      .map(groupId => this.groupNameMap[groupId] ?? groupId)
      .join(', ');
  }

  permissionGroupOptions(): { label: string; value: string }[] {
    return this.formData.groupIds.map(id => ({
      label: this.groupNameMap[id] ?? id,
      value: id,
    }));
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

  private displayGroupIds(user: AppUser): string[] {
    const membershipGroupIds = user.groupIds ?? [];
    const permissionGroupIds = Object.keys(user.permissionsByGroup ?? {});
    return [...new Set([...membershipGroupIds, ...permissionGroupIds])];
  }
}
