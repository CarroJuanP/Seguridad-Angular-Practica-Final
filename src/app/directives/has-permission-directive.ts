// This legacy file is intentionally left blank.
// The active directive is implemented in: has-permission.ts
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
