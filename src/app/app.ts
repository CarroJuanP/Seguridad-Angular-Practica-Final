// Componente raiz de la aplicacion.
// Su trabajo es minimo: exponer el router outlet y disparar la inicializacion temprana de permisos.
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
  // Titulo interno generado por Angular CLI. Aqui no gobierna el titulo visible de la UI.
  title = 'practica2';
  // La simple inyeccion del servicio ya fuerza la creacion del singleton y su sincronizacion inicial.
  private readonly permissionsService = inject(PermissionsService);

  ngOnInit() {
    // 🔐 Los permisos se inicializan automáticamente en PermissionsService
    // Si hay un usuario en localStorage, se carga.
    // Si no, se asignan permisos por defecto (rol 'user')
    console.log('✅ App inicializada con permisos');
  }
}
