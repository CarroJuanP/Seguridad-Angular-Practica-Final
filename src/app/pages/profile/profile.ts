// Pantalla de perfil del usuario autenticado.
// Permite editar datos propios y consultar tickets creados o asignados.
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AppUser, Ticket } from '../../models/permissions.model';
import { Permissions } from '../../services/permissions';

interface UserProfile {
  // DTO local pensado para la UI; separa nombres legibles del modelo AppUser.
  nombreCompleto: string;
  usuario: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  direccion: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, InputTextModule, PasswordModule, ToastModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
  providers: [MessageService]
})
export class Profile implements OnInit {
  // Misma politica de password que en la pagina administrativa para no divergir reglas.
  private readonly passwordPolicy = /^(?=.*[!@#$%^&*])\S+$/;

  // Valores de ejemplo que se sustituyen al cargar la sesion real.
  profileData: UserProfile = {
    nombreCompleto: 'Juan Pérez',
    usuario: 'juanperez',
    email: 'juan@example.com',
    telefono: '1234567890',
    fechaNacimiento: '1990-05-15',
    direccion: 'Calle Principal 123, Apto 4B'
  };

  isEditMode = false;
  isSaving = false;
  editData: UserProfile = { ...this.profileData };
  assignedTickets: Ticket[] = [];
  changePasswordEnabled = false;
  newPassword = '';
  confirmNewPassword = '';

  constructor(
    private readonly messageService: MessageService,
    private readonly authService: AuthService,
    private readonly dataService: Permissions,
  ) {}

  ngOnInit() {
    this.authService.hydrateCurrentUser$().subscribe(() => {
      this.loadUserProfile();
    });
  }

  loadUserProfile(): void {
    // Hidrata los campos visibles desde el usuario actual y luego carga tickets relacionados.
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return;
    }

    this.profileData = {
      nombreCompleto: currentUser.name,
      usuario: currentUser.username,
      email: currentUser.email,
      telefono: currentUser.phone,
      fechaNacimiento: currentUser.birthDate,
      direccion: currentUser.address,
    };
    this.editData = { ...this.profileData };
    this.changePasswordEnabled = false;
    this.newPassword = '';
    this.confirmNewPassword = '';

    const groupId = this.authService.getSession()?.selectedGroupId;
    if (groupId) {
      this.dataService.getTicketsByGroup$(groupId).subscribe(tickets => {
        this.assignedTickets = tickets.filter(
          ticket => ticket.assigneeId === currentUser.id || ticket.createdById === currentUser.id,
        );
      });
      return;
    }

    if (!currentUser.groupIds.length) {
      this.assignedTickets = [];
      return;
    }

    forkJoin(currentUser.groupIds.map((id: string) => this.dataService.getTicketsByGroup$(id))).subscribe((ticketGroups: unknown) => {
      const allTickets = (Array.isArray(ticketGroups) ? ticketGroups : []).flat() as Ticket[];
      this.assignedTickets = allTickets.filter(
        (ticket: Ticket) => ticket.assigneeId === currentUser.id || ticket.createdById === currentUser.id,
      );
    });
  }

  toggleEditMode(): void {
    // Al salir del modo edicion se desechan cambios temporales y passwords capturadas.
    this.isEditMode = !this.isEditMode;
    if (!this.isEditMode) {
      this.editData = { ...this.profileData };
      this.changePasswordEnabled = false;
      this.newPassword = '';
      this.confirmNewPassword = '';
    }
  }

  onPhoneInput(rawValue: string): void {
    this.editData.telefono = String(rawValue ?? '').replaceAll(/\D/g, '').slice(0, 10);
  }

  onPhoneKeydown(event: KeyboardEvent): void {
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowedKeys.includes(event.key) || event.ctrlKey || event.metaKey) {
      return;
    }

    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  onPhonePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') ?? '';
    this.onPhoneInput(`${this.editData.telefono}${pastedText}`);
  }

  onChangePasswordToggle(enabled: boolean): void {
    this.changePasswordEnabled = enabled;
    if (!enabled) {
      this.newPassword = '';
      this.confirmNewPassword = '';
    }
  }

  saveProfile(): void {
    // Genera un AppUser actualizado y delega la persistencia al mismo flujo usado por UserPage.
    const current = this.authService.getCurrentUser();
    if (!current) {
      return;
    }

    const hasPasswordChange = this.changePasswordEnabled;
    if (hasPasswordChange) {
      const candidatePassword = this.newPassword.trim();
      if (!candidatePassword || !this.confirmNewPassword.trim()) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Password incompleta',
          detail: 'Captura y confirma la nueva password para aplicarla.',
        });
        return;
      }
      const isValid = candidatePassword.length >= 10 && this.passwordPolicy.test(candidatePassword);
      if (!isValid) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Password invalida',
          detail: 'Usa minimo 10 caracteres, al menos un simbolo (!@#$%^&*) y sin espacios.',
        });
        return;
      }
      if (this.newPassword !== this.confirmNewPassword) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Password no coincide',
          detail: 'Confirma la misma password en ambos campos.',
        });
        return;
      }
    }

    if (!/^\d{10}$/.test(this.editData.telefono)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Telefono invalido',
        detail: 'Captura exactamente 10 digitos numericos.',
      });
      return;
    }

    this.isSaving = true;

    const updated: AppUser = {
      ...current,
      name: this.editData.nombreCompleto,
      username: this.editData.usuario,
      email: this.editData.email,
      phone: this.editData.telefono,
      birthDate: this.editData.fechaNacimiento,
      address: this.editData.direccion,
      password: hasPasswordChange ? this.newPassword.trim() : current.password,
    };

    this.authService.updateOwnProfile$(updated).subscribe((result: { ok: boolean; message?: string }) => {
      this.isSaving = false;
      if (!result.ok) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: result.message ?? 'No se pudo actualizar el perfil',
        });
        return;
      }

      this.profileData = { ...this.editData };
      this.isEditMode = false;
      this.changePasswordEnabled = false;
      this.newPassword = '';
      this.confirmNewPassword = '';
      this.loadUserProfile();
      this.messageService.add({
        severity: 'success',
        summary: 'Exito',
        detail: 'Perfil actualizado correctamente'
      });
    });
  }

  countByStatus(status: Ticket['status']): number {
    // Resumen rapido para la tarjeta de carga de trabajo.
    return this.assignedTickets.filter(ticket => ticket.status === status).length;
  }

  cancel(): void {
    this.editData = { ...this.profileData };
    this.changePasswordEnabled = false;
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.isEditMode = false;
  }
}
