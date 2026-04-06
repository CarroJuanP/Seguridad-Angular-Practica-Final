import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AppUser, Ticket } from '../../models/permissions.model';
import { Permissions } from '../../services/permissions';

interface UserProfile {
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
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, InputTextModule, ToastModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
  providers: [MessageService]
})
export class Profile implements OnInit {
  private readonly passwordPolicy = /^(?=.*[!@#$%^&*])\S+$/;

  profileData: UserProfile = {
    nombreCompleto: 'Juan Pérez',
    usuario: 'juanperez',
    email: 'juan@example.com',
    telefono: '1234567890',
    fechaNacimiento: '1990-05-15',
    direccion: 'Calle Principal 123, Apto 4B'
  };

  isEditMode = false;
  editData: UserProfile = { ...this.profileData };
  assignedTickets: Ticket[] = [];
  newPassword = '';
  confirmNewPassword = '';

  constructor(
    private readonly messageService: MessageService,
    private readonly authService: AuthService,
    private readonly dataService: Permissions,
  ) {}

  ngOnInit() {
    this.loadUserProfile();
  }

  loadUserProfile(): void {
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

    forkJoin(currentUser.groupIds.map(id => this.dataService.getTicketsByGroup$(id))).subscribe(ticketGroups => {
      const allTickets = ticketGroups.flat();
      this.assignedTickets = allTickets.filter(
        ticket => ticket.assigneeId === currentUser.id || ticket.createdById === currentUser.id,
      );
    });
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    if (!this.isEditMode) {
      this.editData = { ...this.profileData };
      this.newPassword = '';
      this.confirmNewPassword = '';
    }
  }

  saveProfile(): void {
    const current = this.authService.getCurrentUser();
    if (!current) {
      return;
    }

    const hasPasswordChange = Boolean(this.newPassword.trim() || this.confirmNewPassword.trim());
    if (hasPasswordChange) {
      const candidatePassword = this.newPassword.trim();
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

    this.profileData = { ...this.editData };

    const updated: AppUser = {
      ...current,
      name: this.profileData.nombreCompleto,
      username: this.profileData.usuario,
      email: this.profileData.email,
      phone: this.profileData.telefono,
      birthDate: this.profileData.fechaNacimiento,
      address: this.profileData.direccion,
      password: hasPasswordChange ? this.newPassword.trim() : current.password,
    };

    this.authService.upsertUserInDB$(updated, false).subscribe(result => {
      if (!result.ok) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: result.message ?? 'No se pudo actualizar el perfil',
        });
        return;
      }

      this.isEditMode = false;
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
    return this.assignedTickets.filter(ticket => ticket.status === status).length;
  }

  cancel(): void {
    this.editData = { ...this.profileData };
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.isEditMode = false;
  }
}
