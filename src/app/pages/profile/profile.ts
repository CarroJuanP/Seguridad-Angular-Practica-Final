import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { Permissions } from '../../services/permissions';
import { AppUser, Ticket } from '../../models/permissions.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, InputTextModule, ToastModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
  providers: [MessageService],
})
export class Profile implements OnInit {
  profileData: AppUser | null = null;
  editData: AppUser | null = null;
  isEditMode = false;
  assignedTickets: Ticket[] = [];

  constructor(
    private authService: AuthService,
    private dataService: Permissions,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();
  }

  loadUserProfile(): void {
    const user = this.authService.getCurrentUser();
    const groupId = this.authService.getSession()?.selectedGroupId;
    if (!user || !groupId) {
      return;
    }

    this.profileData = { ...user };
    this.editData = { ...user };
    this.assignedTickets = this.dataService
      .getTicketsByGroup(groupId)
      .filter(ticket => ticket.assigneeId === user.id || ticket.createdById === user.id);
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    if (!this.isEditMode && this.profileData) {
      this.editData = { ...this.profileData };
    }
  }

  saveProfile(): void {
    if (!this.editData) {
      return;
    }

    const users = this.authService.getUsers();
    const index = users.findIndex(user => user.id === this.editData?.id);
    if (index < 0) {
      return;
    }

    users[index] = { ...this.editData };
    this.authService.saveUsers(users);

    this.profileData = { ...this.editData };
    this.isEditMode = false;

    this.messageService.add({ severity: 'success', summary: 'Perfil actualizado', detail: 'Cambios guardados.' });
  }

  countByStatus(status: Ticket['status']): number {
    return this.assignedTickets.filter(ticket => ticket.status === status).length;
  }
}
