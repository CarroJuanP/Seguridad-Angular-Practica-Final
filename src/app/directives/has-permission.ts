// Directiva estructural tipo *ngIf, pero gobernada por permisos.
// Su responsabilidad es agregar o quitar fragmentos del DOM segun el estado actual del PermissionsService.
import { Directive, Input, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionsService } from '../services/permissions.service';
import { Subject, takeUntil } from 'rxjs';
import { PermissionKey } from '../models/permissions.model';

@Directive({
  selector: '[ifHasPermission],[appHasPermission]',
  standalone: true,
})
export class IfHasPermissionDirective implements OnInit, OnDestroy {
  // Guarda el permiso requerido para reevaluarlo cada vez que cambia la sesion/permisos.
  private requiredPermission: PermissionKey | null = null;
  private readonly destroy$ = new Subject<void>();
  private hasView = false;

  constructor(
    private readonly templateRef: TemplateRef<unknown>,
    private readonly viewContainer: ViewContainerRef,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Input()
  set ifHasPermission(permission: string) {
    // Cada cambio de input dispara una reevaluacion inmediata del bloque asociado.
    this.requiredPermission = permission as PermissionKey;
    this.updateView();
  }

  @Input()
  set appHasPermission(permission: string) {
    this.requiredPermission = permission as PermissionKey;
    this.updateView();
  }

  ngOnInit() {
    // Primero, intenta mostrar basado en el estado actual
    this.updateView();

    // Luego, escucha cambios futuros en los permisos
    this.permissionsService.getPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Usa setTimeout para permitir que Angular termine su ciclo de detección
        setTimeout(() => this.updateView(), 0);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateView() {
    // Solo renderiza la vista embebida cuando corresponde y evita recrearla si ya existe.
    const hasPermission = this.requiredPermission &&
                         this.permissionsService.hasPermission(this.requiredPermission);

    if (hasPermission) {
      if (!this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      }
    } else {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
