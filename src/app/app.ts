import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PermissionsService } from './services/permissions.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ButtonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent implements OnInit {
  title = 'practica2';
  private readonly permissionsService = inject(PermissionsService);

  ngOnInit() {
    // 🔐 Los permisos se inicializan automáticamente en PermissionsService
    // Si hay un usuario en localStorage, se carga.
    // Si no, se asignan permisos por defecto (rol 'user')
    console.log('✅ App inicializada con permisos');
  }
}
