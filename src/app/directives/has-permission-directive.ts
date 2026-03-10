// import { Component } from '@angular/core';
// import { ButtonModule } from 'primeng/button';
// import { Router, RouterModule } from '@angular/router';
// import { AuthService } from '../../services/auth.service';
// import { PermissionsService } from '../../services/permissions.service';
// import { PERMISSIONS_CATALOG } from '../../models/permissions.model';
// import { CommonModule } from '@angular/common';
// import {
//   Directive,
//   Input,
//   TemplateRef,
//   ViewContainerRef,
//   OnInit
// } from '@angular/core';
//
// @Component({
//   selector: 'app-sidebar',
//   standalone: true,
//   imports: [ButtonModule, RouterModule, HasPermissionDirective, CommonModule],
//   templateUrl: './sidebar.html',
//   styleUrl: './sidebar.css',
// })
// export class Sidebar {
//   permissions = PERMISSIONS_CATALOG;
//
//   constructor(
//     private auth: AuthService,
//     private router: Router,
//     private permissionsService: PermissionsService
//   ) {}
//
//   logout() {
//     this.auth.logout();
//     this.permissionsService.clearPermissions();
//     this.router.navigate(['/']);
//   }
//
//   loginAsAdmin() {
//     this.permissionsService.loginAsAdmin();
//   }
//
//   loginAsUser() {
//     this.permissionsService.loginAsUser();
//   }
//
//   loginAsViewer() {
//     this.permissionsService.loginAsViewer();
//   }
//
//   loginAsEditor() {
//     this.permissionsService.loginAsEditor();
//   }
// }
//
// @Directive({
//   selector: '[hasPermission]'
// })
// export class HasPermissionDirective {
//   @Input() hasPermission: string;
//
//   constructor(
//     private templateRef: TemplateRef<any>,
//     private viewContainerRef: ViewContainerRef,
//     private permissionsService: PermissionsService
//   ) {}
//
//   ngOnInit() {
//     // Lógica para verificar permisos y mostrar/ocultar el elemento
//     if (this.permissionsService.hasPermission(this.hasPermission)) {
//       this.viewContainerRef.createEmbeddedView(this.templateRef);
//     } else {
//       this.viewContainerRef.clear();
//     }
//   }
// }
//
// @Directive({ selector: '[ifHasPermission]' })
// export class IfHasPermissionDirective implements OnInit {
//   @Input('ifHasPermission') permission!: string;
//
//   constructor(
//     private templateRef: TemplateRef<any>,
//     private viewContainer: ViewContainerRef,
//     private permissionsService: PermissionsService
//   ) {}
//
//   ngOnInit() {
//     if (this.permissionsService.hasPermission(this.permission)) {
//       this.viewContainer.createEmbeddedView(this.templateRef);
//     } else {
//       this.viewContainer.clear();
//     }
//   }
// }
