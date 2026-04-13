// Layout comun para todas las rutas privadas.
// Encapsula la sidebar fija y el espacio donde Angular renderiza cada pagina protegida.
import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Sidebar } from '../../components/sidebar/sidebar';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.css'],
  imports: [RouterOutlet, Sidebar]
})
export class MainLayout {
  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
  ) {}

  get currentPageTitle(): string {
    const path = this.router.url.split('?')[0];
    if (path.startsWith('/groups')) return 'Grupos';
    if (path.startsWith('/users')) return 'Usuarios';
    if (path.startsWith('/tickets')) return 'Tickets';
    if (path.startsWith('/profile')) return 'Mi perfil';
    return 'Dashboard';
  }

  get currentPageSubtitle(): string {
    const session = this.authService.getSession();
    if (session?.hasEnteredGroup && session.selectedGroupId) {
      return 'Trabajando dentro de un espacio activo.';
    }

    return 'Selecciona un grupo para desbloquear el flujo completo del sistema.';
  }

  get currentUserLabel(): string {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return 'Sin sesion';
    return currentUser.isSuperAdmin ? 'Superadministrador' : currentUser.email;
  }
}
