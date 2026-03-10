import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { TextareaModule } from 'primeng/textarea';
import { IfHasPermissionDirective } from '../../directives/has-permission';
import { AuthService } from '../../services/auth.service';
import { PermissionsService } from '../../services/permissions.service';
import { Permissions } from '../../services/permissions';
import { AppGroup, AppUser, PERMISSIONS_CATALOG } from '../../models/permissions.model';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    ToastModule,
    CardModule,
    TextareaModule,
    IfHasPermissionDirective,
  ],
  templateUrl: './groups.html',
  styleUrls: ['./groups.css'],
  providers: [MessageService],
})
export class Groups implements OnInit {
  groups: AppGroup[] = [];
  selectedGroupId: string | null = null;
  displayDialog = false;
  isNew = false;
  showMembersDialog = false;
  permissions = PERMISSIONS_CATALOG;
  usersInSelectedGroup: AppUser[] = [];
  memberEmail = '';
  membersTargetGroup: AppGroup | null = null;

  formData: AppGroup = {
    id: '',
    name: '',
    description: '',
    llmModel: '',
    llmColor: '#0d3b66',
  };

  constructor(
    private readonly messageService: MessageService,
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
    private readonly dataService: Permissions,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadGroups();
    this.selectedGroupId = this.authService.getSession()?.selectedGroupId ?? null;
  }

  loadGroups(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.groups = [];
      return;
    }

    const allGroups = this.dataService.getGroups();
    this.groups = allGroups.filter(group => currentUser.groupIds.includes(group.id));
  }

  selectGroup(group: AppGroup): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return;
    }

    const permissions = this.dataService.getCurrentGroupPermissions(currentUser, group.id);
    this.authService.updateSession({ selectedGroupId: group.id, permissions });
    this.permissionsService.setSessionPermissions(permissions);
    this.selectedGroupId = group.id;

    this.messageService.add({
      severity: 'success',
      summary: 'Grupo activo',
      detail: `Trabajando en ${group.name}.`,
    });

    setTimeout(() => this.router.navigate(['/home']), 300);
  }

  openNew(): void {
    this.formData = {
      id: '',
      name: '',
      description: '',
      llmModel: '',
      llmColor: '#0d3b66',
    };
    this.isNew = true;
    this.displayDialog = true;
  }

  editGroup(group: AppGroup): void {
    this.formData = { ...group };
    this.isNew = false;
    this.displayDialog = true;
  }

  deleteGroup(group: AppGroup): void {
    const groups = this.dataService.getGroups().filter(current => current.id !== group.id);
    this.dataService.saveGroups(groups);
    this.loadGroups();

    this.messageService.add({
      severity: 'success',
      summary: 'Grupo eliminado',
      detail: `${group.name} fue eliminado.`,
    });
  }

  manageMembers(group: AppGroup): void {
    this.membersTargetGroup = group;
    this.memberEmail = '';
    this.usersInSelectedGroup = this.authService
      .getUsers()
      .filter(user => user.groupIds.includes(group.id));
    this.showMembersDialog = true;
  }

  addMemberByEmail(): void {
    const group = this.membersTargetGroup;
    const email = this.memberEmail.trim().toLowerCase();
    if (!group || !email) {
      return;
    }

    const users = this.authService.getUsers();
    const userIndex = users.findIndex(user => user.email.toLowerCase() === email);
    if (userIndex < 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Usuario no encontrado',
        detail: 'No existe un usuario con ese correo.',
      });
      return;
    }

    const targetUser = users[userIndex];
    if (!targetUser.groupIds.includes(group.id)) {
      targetUser.groupIds = [...targetUser.groupIds, group.id];
    }

    if (!targetUser.permissionsByGroup[group.id]) {
      targetUser.permissionsByGroup[group.id] = [PERMISSIONS_CATALOG.GROUP_VIEW, PERMISSIONS_CATALOG.TICKET_READ];
    }

    users[userIndex] = targetUser;
    this.authService.saveUsers(users);
    this.usersInSelectedGroup = users.filter(user => user.groupIds.includes(group.id));
    this.memberEmail = '';

    this.messageService.add({
      severity: 'success',
      summary: 'Usuario agregado',
      detail: `${targetUser.name} ahora pertenece a ${group.name}.`,
    });
  }

  removeMember(user: AppUser): void {
    const group = this.membersTargetGroup;
    if (!group) {
      return;
    }

    const users = this.authService.getUsers();
    const index = users.findIndex(item => item.id === user.id);
    if (index < 0) {
      return;
    }

    users[index] = {
      ...users[index],
      groupIds: users[index].groupIds.filter(groupId => groupId !== group.id),
      permissionsByGroup: Object.fromEntries(
        Object.entries(users[index].permissionsByGroup).filter(([groupId]) => groupId !== group.id),
      ),
    };

    this.authService.saveUsers(users);
    this.usersInSelectedGroup = users.filter(item => item.groupIds.includes(group.id));

    this.messageService.add({
      severity: 'success',
      summary: 'Usuario removido',
      detail: `${user.name} fue removido del grupo ${group.name}.`,
    });
  }

  saveGroup(): void {
    const groups = this.dataService.getGroups();

    if (this.isNew) {
      const id = `g-${Math.random().toString(36).slice(2, 8)}`;
      groups.push({ ...this.formData, id });
    } else {
      const index = groups.findIndex(group => group.id === this.formData.id);
      if (index >= 0) {
        groups[index] = { ...this.formData };
      }
    }

    this.dataService.saveGroups(groups);
    this.loadGroups();
    this.displayDialog = false;

    this.messageService.add({
      severity: 'success',
      summary: 'Grupo guardado',
      detail: 'Los cambios se aplicaron correctamente.',
    });
  }
}
