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
import { AppGroup, AppUser } from '../../models/permissions.model';

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
  isLoading = false;
  selectedGroupId: string | null = null;
  displayDialog = false;
  isNew = false;
  showMembersDialog = false;
  usersInSelectedGroup: AppUser[] = [];
  memberEmail = '';
  membersTargetGroup: AppGroup | null = null;

  formData: AppGroup = { id: '', name: '', description: '', llmModel: '', llmColor: '#0d3b66' };

  constructor(
    private readonly messageService: MessageService,
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
    private readonly dataService: Permissions,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.selectedGroupId = this.authService.getSession()?.selectedGroupId ?? null;
    this.loadGroups();
  }

  loadGroups(): void {
    this.isLoading = true;
    const currentUser = this.authService.getCurrentUser();
    this.dataService.getGroups$().subscribe(allGroups => {
      this.isLoading = false;
      if (!currentUser) { this.groups = []; return; }
      this.groups = currentUser.isSuperAdmin
        ? allGroups
        : allGroups.filter(g => currentUser.groupIds.includes(g.id));
    });
  }

  selectGroup(group: AppGroup): void {
    const session = this.authService.getSession();
    const localUser = this.authService.getCurrentUser();
    if (!localUser && !session?.userId && !session?.email) return;

    // Always resolve permissions from fresh DB user to avoid stale local session state.
    this.authService.getUsers$().subscribe(users => {
      this.authService.saveUsers(users);

      const freshUser =
        users.find(user => user.id === (session?.userId ?? '')) ??
        users.find(user => user.email.toLowerCase() === (session?.email ?? '').toLowerCase()) ??
        localUser;

      if (!freshUser) {
        this.messageService.add({
          severity: 'error',
          summary: 'Sesion invalida',
          detail: 'No se pudo resolver el usuario actual para cargar permisos.',
        });
        return;
      }

      const permissions = this.dataService.getCurrentGroupPermissions(freshUser, group.id);
      this.authService.updateSession({ selectedGroupId: group.id, permissions, hasEnteredGroup: true });
      this.permissionsService.setSessionPermissions(permissions);
      this.selectedGroupId = group.id;

      this.messageService.add({ severity: 'success', summary: 'Grupo activo', detail: `Trabajando en ${group.name}.` });
      setTimeout(() => this.router.navigate(['/home']), 300);
    });
  }

  openNew(): void {
    this.formData = { id: '', name: '', description: '', llmModel: '', llmColor: '#0d3b66' };
    this.isNew = true;
    this.displayDialog = true;
  }

  editGroup(group: AppGroup): void {
    this.formData = { ...group };
    this.isNew = false;
    this.displayDialog = true;
  }

  deleteGroup(group: AppGroup): void {
    this.dataService.deleteGroup$(group.id).subscribe(() => {
      this.loadGroups();
      this.messageService.add({ severity: 'success', summary: 'Grupo eliminado', detail: `${group.name} fue eliminado.` });
    });
  }

  saveGroup(): void {
    const currentUser = this.authService.getCurrentUser();
    const createdBy = currentUser?.id ?? null;

    const op$ = this.isNew
      ? this.dataService.createGroup$(this.formData, createdBy)
      : this.dataService.updateGroup$(this.formData.id, this.formData);

    op$.subscribe(() => {
      this.loadGroups();
      this.displayDialog = false;
      this.messageService.add({ severity: 'success', summary: 'Grupo guardado', detail: 'Los cambios se aplicaron correctamente.' });
    });
  }

  manageMembers(group: AppGroup): void {
    this.membersTargetGroup = group;
    this.memberEmail = '';
    this.dataService.getUsersInGroup$(group.id).subscribe(users => {
      this.usersInSelectedGroup = users;
      this.showMembersDialog = true;
    });
  }

  addMemberByEmail(): void {
    const group = this.membersTargetGroup;
    const email = this.memberEmail.trim().toLowerCase();
    if (!group || !email) return;

    this.authService.getUsers$().subscribe(users => {
      const target = users.find(u => u.email.toLowerCase() === email);
      if (!target) {
        this.messageService.add({ severity: 'warn', summary: 'No encontrado', detail: 'No existe usuario con ese correo en la base de datos.' });
        return;
      }
      this.dataService.addMemberToGroup$(group.id, target.id).subscribe(() => {
        this.memberEmail = '';
        this.dataService.getUsersInGroup$(group.id).subscribe(u => { this.usersInSelectedGroup = u; });
        this.messageService.add({ severity: 'success', summary: 'Usuario agregado', detail: `${target.name} ahora pertenece a ${group.name}.` });
      });
    });
  }

  removeMember(user: AppUser): void {
    const group = this.membersTargetGroup;
    if (!group) return;

    this.dataService.removeMemberFromGroup$(group.id, user.id).subscribe(() => {
      this.usersInSelectedGroup = this.usersInSelectedGroup.filter(u => u.id !== user.id);
      this.messageService.add({ severity: 'success', summary: 'Usuario removido', detail: `${user.name} fue removido del grupo.` });
    });
  }
}
