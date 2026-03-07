import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

interface Group {
  id: number;
  nombre: string;
  nivel: string;
  autor: string;
  integrantes: number;
  tickets: number;
  descripcion: string;
}

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
    ToastModule
  ],
  templateUrl: './groups.html',
  styleUrls: ['./groups.css'],
  providers: [MessageService]
})
export class Groups implements OnInit {
  groups: Group[] = [];
  selectedGroup: Group | null = null;
  displayDialog = false;
  isNew = false;
  currentUser = 'Usuario Actual';

  formData: Group = {
    id: 0,
    nombre: '',
    nivel: '',
    autor: '',
    integrantes: 0,
    tickets: 0,
    descripcion: ''
  };

  constructor(private messageService: MessageService) {}

  ngOnInit() {
    this.loadGroups();
  }


  loadGroups() {
    this.groups = [
      {
        id: 1,
        nombre: 'Frontend Team',
        nivel: 'Intermedio',
        autor: 'Usuario Actual',
        integrantes: 5,
        tickets: 12,
        descripcion: 'Equipo de desarrollo frontend'
      },
      {
        id: 2,
        nombre: 'Backend Team',
        nivel: 'Avanzado',
        autor: 'Usuario Actual',
        integrantes: 4,
        tickets: 8,
        descripcion: 'Equipo de desarrollo backend'
      },
      {
        id: 3,
        nombre: 'DevOps',
        nivel: 'Experto',
        autor: 'Usuario Actual',
        integrantes: 3,
        tickets: 5,
        descripcion: 'Equipo de infraestructura'
      }
    ];
  }

  openNew() {
    this.formData = {
      id: 0,
      nombre: '',
      nivel: '',
      autor: this.currentUser,
      integrantes: 0,
      tickets: 0,
      descripcion: ''
    };
    this.isNew = true;
    this.displayDialog = true;
  }

  editGroup(group: Group) {
    this.formData = { ...group };
    this.isNew = false;
    this.displayDialog = true;
  }

  deleteGroup(group: Group) {
    const index = this.groups.indexOf(group);
    if (index > -1) {
      this.groups.splice(index, 1);
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Grupo eliminado correctamente'
      });
    }
  }

  saveGroup() {
    if (this.isNew) {
      this.formData.id = Math.max(...this.groups.map((g: Group) => g.id), 0) + 1;
      this.groups.push({ ...this.formData });
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Grupo creado correctamente'
      });
    } else {
      const index = this.groups.findIndex((g: Group) => g.id === this.formData.id);
      if (index > -1) {
        this.groups[index] = { ...this.formData };
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Grupo actualizado correctamente'
        });
      }
    }
    this.displayDialog = false;
  }

  hideDialog() {
    this.displayDialog = false;
  }
}
