import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

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

  constructor(private messageService: MessageService) {}

  ngOnInit() {
    this.loadUserProfile();
  }

  loadUserProfile() {
    // In a real app, this would fetch from AuthService or UserService
    // For now, using mock data from registration
    this.profileData = {
      nombreCompleto: localStorage.getItem('nombreCompleto') || 'Juan Pérez',
      usuario: localStorage.getItem('usuario') || 'juanperez',
      email: localStorage.getItem('email') || 'juan@example.com',
      telefono: localStorage.getItem('telefono') || '1234567890',
      fechaNacimiento: localStorage.getItem('fechaNacimiento') || '1990-05-15',
      direccion: localStorage.getItem('direccion') || 'Calle Principal 123'
    };
    this.editData = { ...this.profileData };
  }

  toggleEditMode() {
    this.isEditMode = !this.isEditMode;
    if (!this.isEditMode) {
      this.editData = { ...this.profileData };
    }
  }

  saveProfile() {
    this.profileData = { ...this.editData };
    // Save to localStorage for now
    localStorage.setItem('nombreCompleto', this.profileData.nombreCompleto);
    localStorage.setItem('usuario', this.profileData.usuario);
    localStorage.setItem('email', this.profileData.email);
    localStorage.setItem('telefono', this.profileData.telefono);
    localStorage.setItem('fechaNacimiento', this.profileData.fechaNacimiento);
    localStorage.setItem('direccion', this.profileData.direccion);

    this.isEditMode = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Perfil actualizado correctamente'
    });
  }

  cancel() {
    this.editData = { ...this.profileData };
    this.isEditMode = false;
  }
}
