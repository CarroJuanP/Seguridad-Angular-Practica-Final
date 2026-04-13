// Pantalla de seleccion y administracion de grupos.
// Mezcla dos roles: entrar a un espacio de trabajo y, si hay permisos, mantener catalogo y miembros.
import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
import { SelectModule } from 'primeng/select';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PermissionsService } from '../../services/permissions.service';
import { Permissions } from '../../services/permissions';
import { ALL_PERMISSIONS, AppGroup, AppUser, PermissionKey } from '../../models/permissions.model';

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
    SelectModule,
  ],
  templateUrl: './groups.html',
  styleUrls: ['./groups.css'],
  providers: [MessageService],
})
export class Groups implements OnInit {
  // Lista visible de grupos segun el rol actual.
  groups: AppGroup[] = [];
  isLoading = false;
  isSaving = false;
  isUpdatingMembers = false;
  selectedGroupId: string | null = null;
  displayDialog = false;
  isNew = false;
  showMembersDialog = false;
  showPermissionsDialog = false;
  usersInSelectedGroup: AppUser[] = [];
  allRegisteredUsers: AppUser[] = [];
  selectedMemberUserId: string | null = null;
  availableProfileOptions: Array<{ label: string; value: string; color: string }> = [];
  membersTargetGroup: AppGroup | null = null;
  permissionTargetUser: AppUser | null = null;
  permissionDraft: PermissionKey[] = [];
  readonly allPermissions = ALL_PERMISSIONS;

  formData: AppGroup = { id: '', name: '', description: '', llmModel: '', llmColor: '#0d3b66' };

  constructor(
    private readonly messageService: MessageService,
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
    private readonly dataService: Permissions,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    // La seleccion visual siempre inicia vacia; entrar al grupo sigue actualizando la sesion real.
    this.selectedGroupId = null;
    this.authService.hydrateCurrentUser$().subscribe(() => {
      this.loadGroups();
    });
  }

  get hasGroups(): boolean {
    return this.groups.length > 0;
  }

  get canSaveGroup(): boolean {
    return this.formData.name.trim().length > 0 && this.formData.llmModel.trim().length > 0 && !this.isSaving;
  }

  get memberUserOptions(): Array<{ label: string; value: string; disabled: boolean }> {
    return this.allRegisteredUsers.map(user => ({
      label: `${user.name} (${user.email})${this.isUserInMembersGroup(user) ? ' • En el grupo' : ''}`,
      value: user.id,
      disabled: this.isUserInMembersGroup(user),
    }));
  }

  get memberDirectoryRows(): AppUser[] {
    return [...this.allRegisteredUsers].sort((left, right) => {
      const leftWeight = this.isUserInMembersGroup(left) ? 0 : 1;
      const rightWeight = this.isUserInMembersGroup(right) ? 0 : 1;
      if (leftWeight !== rightWeight) {
        return leftWeight - rightWeight;
      }

      return left.name.localeCompare(right.name);
    });
  }

  get canCreateGroups(): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (currentUser.isSuperAdmin) {
      return true;
    }

    return Object.values(currentUser.permissionsByGroup ?? {}).some(groupPermissions =>
      groupPermissions.includes('group:add') || groupPermissions.includes('group:manage'),
    );
  }

  loadGroups(): void {
    // Superadmin ve la lista completa; el resto solo sus memberships.
    this.isLoading = true;
    const currentUser = this.authService.getCurrentUser();
    this.dataService.getGroups$().subscribe(allGroups => {
      this.isLoading = false;
      this.availableProfileOptions = this.buildProfileOptions(allGroups);
      if (!currentUser) { this.groups = []; return; }
      this.groups = currentUser.isSuperAdmin
        ? allGroups
        : allGroups.filter(g => currentUser.groupIds.includes(g.id));
    });
  }

  selectGroup(group: AppGroup): void {
    // Al entrar a un grupo, refresca usuario desde BD para evitar permisos obsoletos en cache local.
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
      // selectedGroupId + permissions + hasEnteredGroup habilitan Home, Tickets y el resto de la app privada.
      this.authService.updateSession({ selectedGroupId: group.id, permissions, hasEnteredGroup: true });
      this.permissionsService.setSessionPermissions(permissions);
      this.selectedGroupId = group.id;

      this.messageService.add({ severity: 'success', summary: 'Grupo activo', detail: `Trabajando en ${group.name}.` });
      setTimeout(() => this.router.navigate(['/home']), 300);
    });
  }

  openNew(): void {
    // Reinicia el formulario para alta de un grupo nuevo.
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
    this.isLoading = true;
    this.dataService.deleteGroup$(group.id).subscribe({
      next: () => {
        this.isLoading = false;
        this.loadGroups();
        this.messageService.add({ severity: 'success', summary: 'Grupo eliminado', detail: `${group.name} fue eliminado.` });
      },
      error: error => {
        this.isLoading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.readErrorMessage(error, 'No se pudo eliminar el grupo.') });
      },
    });
  }

  saveGroup(): void {
    // El mismo dialogo soporta alta o edicion segun la bandera isNew.
    if (!this.formData.name.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Nombre requerido', detail: 'Captura un nombre para el grupo.' });
      return;
    }

    if (!this.formData.llmModel.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Perfil requerido', detail: 'Selecciona un perfil para el grupo.' });
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    const createdBy = currentUser?.id ?? null;

    const op$ = this.isNew
      ? this.dataService.createGroup$(this.formData, createdBy)
      : this.dataService.updateGroup$(this.formData.id, this.formData);

    this.isSaving = true;
    op$.subscribe({
      next: () => {
        this.isSaving = false;
        this.loadGroups();
        this.displayDialog = false;
        this.messageService.add({ severity: 'success', summary: 'Grupo guardado', detail: 'Los cambios se aplicaron correctamente.' });
      },
      error: error => {
        this.isSaving = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.readErrorMessage(error, 'No se pudo guardar el grupo.') });
      },
    });
  }

  manageMembers(group: AppGroup): void {
    // Abre un segundo dialogo dedicado a membresias del grupo elegido.
    this.membersTargetGroup = group;
    this.selectedMemberUserId = null;
    this.loadMembersDialogData(group.id, true);
  }

  addSelectedMember(): void {
    // Agrega el usuario seleccionado en la lista plegable al grupo actual.
    const group = this.membersTargetGroup;
    const userId = this.selectedMemberUserId;
    if (!group || !userId) return;

    const target = this.allRegisteredUsers.find(user => user.id === userId);
    if (!target) {
      this.messageService.add({ severity: 'warn', summary: 'No encontrado', detail: 'No se pudo resolver el usuario seleccionado.' });
      return;
    }

    if (this.isUserInMembersGroup(target)) {
      this.messageService.add({ severity: 'info', summary: 'Usuario existente', detail: `${target.name} ya pertenece a ${group.name}.` });
      return;
    }

    this.isUpdatingMembers = true;
    this.dataService.addMemberToGroup$(group.id, target.id).subscribe({
      next: () => {
        this.selectedMemberUserId = null;
        this.loadMembersDialogData(group.id);
        this.messageService.add({ severity: 'success', summary: 'Usuario agregado', detail: `${target.name} ahora pertenece a ${group.name}.` });
      },
      error: error => {
        this.isUpdatingMembers = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.readErrorMessage(error, 'No se pudo agregar el usuario al grupo.') });
      },
    });
  }

  removeMember(user: AppUser): void {
    // Elimina la relacion usuario-grupo, no el usuario del sistema.
    const group = this.membersTargetGroup;
    if (!group) return;

    this.isUpdatingMembers = true;
    this.dataService.removeMemberFromGroup$(group.id, user.id).subscribe({
      next: () => {
        this.loadMembersDialogData(group.id);
        this.messageService.add({ severity: 'success', summary: 'Usuario removido', detail: `${user.name} fue removido del grupo.` });
      },
      error: error => {
        this.isUpdatingMembers = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.readErrorMessage(error, 'No se pudo remover el usuario del grupo.') });
      },
    });
  }

  openPermissions(user: AppUser): void {
    const groupId = this.membersTargetGroup?.id;
    if (!groupId) {
      return;
    }

    this.permissionTargetUser = structuredClone(user);
    this.permissionDraft = [...(user.permissionsByGroup[groupId] ?? [])];
    this.showPermissionsDialog = true;
  }

  togglePermission(permission: PermissionKey): void {
    this.permissionDraft = this.permissionDraft.includes(permission)
      ? this.permissionDraft.filter(item => item !== permission)
      : [...this.permissionDraft, permission];
  }

  savePermissions(): void {
    const group = this.membersTargetGroup;
    const target = this.permissionTargetUser;
    if (!group || !target) {
      return;
    }

    const updatedUser: AppUser = {
      ...target,
      groupIds: target.groupIds.includes(group.id) ? target.groupIds : [...target.groupIds, group.id],
      permissionsByGroup: {
        ...target.permissionsByGroup,
        [group.id]: [...this.permissionDraft],
      },
    };

    this.isUpdatingMembers = true;
    this.authService.upsertUserInDB$(updatedUser, false).subscribe(result => {
      this.isUpdatingMembers = false;
      if (!result.ok) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: result.message ?? 'No se pudieron guardar los permisos del usuario.',
        });
        return;
      }

      this.usersInSelectedGroup = this.usersInSelectedGroup.map(user =>
        user.id === updatedUser.id ? updatedUser : user,
      );
      this.showPermissionsDialog = false;
      this.messageService.add({
        severity: 'success',
        summary: 'Permisos actualizados',
        detail: `Se actualizaron los permisos de ${updatedUser.name} en ${group.name}.`,
      });
      this.loadMembersDialogData(group.id);
    });
  }

  onProfileChange(profileName: string | null): void {
    const selectedProfile = this.availableProfileOptions.find(option => option.value === profileName);
    this.formData.llmModel = profileName ?? '';
    if (selectedProfile) {
      this.formData.llmColor = selectedProfile.color;
    }
  }

  isUserInMembersGroup(user: AppUser): boolean {
    const groupId = this.membersTargetGroup?.id;
    if (!groupId) {
      return false;
    }

    return this.usersInSelectedGroup.some(groupUser => groupUser.id === user.id)
      || user.groupIds.includes(groupId)
      || Object.hasOwn(user.permissionsByGroup ?? {}, groupId);
  }

  groupPermissionsForUser(user: AppUser): PermissionKey[] {
    const groupId = this.membersTargetGroup?.id;
    if (!groupId) {
      return [];
    }

    return user.permissionsByGroup[groupId] ?? [];
  }

  memberStatusLabel(user: AppUser): string {
    return this.isUserInMembersGroup(user) ? 'En el grupo' : 'Disponible';
  }

  addMember(user: AppUser): void {
    this.selectedMemberUserId = user.id;
    this.addSelectedMember();
  }

  profileColorForCurrentGroup(): string {
    return this.availableProfileOptions.find(option => option.value === this.formData.llmModel)?.color
      ?? this.formData.llmColor
      ?? '#0d3b66';
  }

  private readErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const directMessage = this.extractObjectMessage(error.error);
      if (directMessage) {
        return directMessage;
      }

      if (typeof error.message === 'string' && error.message.trim().length > 0) {
        return error.message;
      }
    }

    const objectMessage = this.extractObjectMessage(error);
    if (objectMessage) {
      return objectMessage;
    }

    return error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallback;
  }

  private extractObjectMessage(value: unknown): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return '';
      }

      try {
        const parsed = JSON.parse(trimmed) as { message?: unknown };
        return typeof parsed.message === 'string' ? parsed.message : trimmed;
      } catch {
        return trimmed;
      }
    }

    if (value !== null && typeof value === 'object' && 'message' in value) {
      const candidate = (value as { message?: unknown }).message;
      return typeof candidate === 'string' ? candidate : '';
    }

    return '';
  }

  private loadMembersDialogData(groupId: string, openDialog = false): void {
    this.isUpdatingMembers = true;
    forkJoin([
      this.dataService.getUsersInGroup$(groupId),
      this.authService.getUsers$(),
    ]).subscribe({
      next: ([groupUsers, allUsers]) => {
        this.isUpdatingMembers = false;
        this.usersInSelectedGroup = groupUsers;
        this.allRegisteredUsers = allUsers;
        if (openDialog) {
          this.showMembersDialog = true;
        }
      },
      error: error => {
        this.isUpdatingMembers = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.readErrorMessage(error, 'No se pudo cargar el directorio de usuarios.') });
      },
    });
  }

  private buildProfileOptions(groups: AppGroup[]): Array<{ label: string; value: string; color: string }> {
    const profileMap = new Map<string, { label: string; value: string; color: string }>();

    for (const group of groups) {
      const profileName = group.llmModel.trim();
      if (!profileName || profileMap.has(profileName)) {
        continue;
      }

      profileMap.set(profileName, {
        label: profileName,
        value: profileName,
        color: group.llmColor,
      });
    }

    return [...profileMap.values()].sort((left, right) => left.label.localeCompare(right.label));
  }

  canManageMembers(group: AppGroup): boolean {
    return this.hasGroupCapability(group.id, ['group:edit', 'group:add:member', 'group:remove:member', 'group:manage']);
  }

  canEditGroup(group: AppGroup): boolean {
    return this.hasGroupCapability(group.id, ['group:edit', 'group:manage']);
  }

  canDeleteGroup(group: AppGroup): boolean {
    return this.hasGroupCapability(group.id, ['group:delete', 'group:manage']);
  }

  private hasGroupCapability(groupId: string, requiredPermissions: PermissionKey[]): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (currentUser.isSuperAdmin) {
      return true;
    }

    const groupPermissions = currentUser.permissionsByGroup[groupId] ?? [];
    return requiredPermissions.some(permission => groupPermissions.includes(permission));
  }
}
