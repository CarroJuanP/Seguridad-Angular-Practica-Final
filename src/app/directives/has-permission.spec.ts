// Instancia la directiva con dependencias simuladas para validar su construccion basica.
import { TemplateRef, ViewContainerRef } from '@angular/core';
import { of } from 'rxjs';
import { PermissionsService } from '../services/permissions.service';
import { IfHasPermissionDirective } from './has-permission';


describe('IfHasPermissionDirective', () => {
  it('should create an instance', () => {
    // Mock the dependencies required by the directive's constructor
    const mockTemplateRef = {} as TemplateRef<any>;
    const mockViewContainerRef = {
      createEmbeddedView: () => ({} as any),
      clear: () => {},
    } as unknown as ViewContainerRef;
    const mockPermissionsService = {
      getPermissions: () => of([]),
      hasPermission: () => true,
    } as unknown as PermissionsService;

    const directive = new IfHasPermissionDirective(mockTemplateRef, mockViewContainerRef, mockPermissionsService);
    expect(directive).toBeTruthy();
  });
});
