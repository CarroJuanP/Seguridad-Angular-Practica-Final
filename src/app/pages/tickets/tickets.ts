import { Component, OnInit } from '@angular/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { CommonModule } from '@angular/common';
import { IfHasPermissionDirective } from '../../directives/has-permission';
import { PERMISSIONS_CATALOG } from '../../models/permissions.model';

interface TicketData {
  id: string;
  subject: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Closed';
  assignedTo: string;
}

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [
    TableModule,
    ButtonModule,
    TagModule,
    IfHasPermissionDirective,
    CommonModule
  ],
  templateUrl: './tickets.html',
  styleUrls: ['./tickets.css']
})
export class Tickets implements OnInit {
  permissions = PERMISSIONS_CATALOG;
  tickets: TicketData[] = [];

  ngOnInit() {
    this.tickets = [
      { id: 'T-101', subject: 'Error en login', priority: 'High', status: 'Open', assignedTo: 'Dev Team' },
      { id: 'T-102', subject: 'Solicitud de acceso', priority: 'Low', status: 'Closed', assignedTo: 'Admin' },
      { id: 'T-103', subject: 'Pantalla blanca en dashboard', priority: 'Medium', status: 'In Progress', assignedTo: 'Frontend' },
    ];
  }

  getSeverity(priority: string) {
    switch (priority) {
      case 'High': return 'danger';
      case 'Medium': return 'warn';
      case 'Low': return 'info';
      default: return 'info';
    }
  }
}
