import { Component, OnInit } from '@angular/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { CommonModule } from '@angular/common';
import { IfHasPermissionDirective } from '../../directives/has-permission';
import { PERMISSIONS_CATALOG } from '../../models/permissions.model';

interface AppUser {
  id: number;
  username: string;
  email: string;
  role: string;
  status: 'Activo' | 'Inactivo';
}

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [
    TableModule,
    ButtonModule,
    TagModule,
    IfHasPermissionDirective,
    CommonModule
  ],
  templateUrl: './user.html',
  styleUrls: ['./user.css']
})
export class User implements OnInit {
  permissions = PERMISSIONS_CATALOG;
  users: AppUser[] = [];

  ngOnInit() {
    this.users = [
      { id: 1, username: 'admin_demo', email: 'admin@empresa.com', role: 'Admin', status: 'Activo' },
      { id: 2, username: 'user_demo', email: 'user@empresa.com', role: 'User', status: 'Activo' },
      { id: 3, username: 'viewer_demo', email: 'viewer@empresa.com', role: 'Viewer', status: 'Inactivo' },
      { id: 4, username: 'editor_demo', email: 'editor@empresa.com', role: 'Editor', status: 'Activo' },
    ];
  }

  addUser() {
    console.log('🆕 Click en Nuevo Usuario: Aquí deberías abrir un modal o navegar a un formulario.');
    alert('Funcionalidad de crear usuario (Pendiente de implementar formulario)');
  }
}
