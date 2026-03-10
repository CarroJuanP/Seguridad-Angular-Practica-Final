import { Directive, Input, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionsService } from '../services/permissions.service';
import { Subject, takeUntil } from 'rxjs';
import { PermissionKey } from '../models/permissions.model';

@Directive({
  selector: '[ifHasPermission]',
  standalone: true,
})
export class IfHasPermissionDirective implements OnInit, OnDestroy {
  private requiredPermission: PermissionKey | null = null;
  private destroy$ = new Subject<void>();
  private hasView = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionsService: PermissionsService
  ) {}

  @Input('ifHasPermission')
  set ifHasPermission(permission: PermissionKey) {
    this.requiredPermission = permission;
    this.updateView();
  }

  ngOnInit() {
    this.permissionsService.getPermissions().pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.updateView());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateView() {
    if (this.requiredPermission && this.permissionsService.hasPermission(this.requiredPermission)) {
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
