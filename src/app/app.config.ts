// Configuracion global de la aplicacion standalone.
// Aqui se registran los providers que reemplazan al antiguo AppModule.
import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Router de toda la app.
    provideRouter(routes),
    // HttpClient queda disponible para servicios y componentes.
    provideHttpClient(),
    // PrimeNG Stepper y otros componentes necesitan soporte de animaciones.
    importProvidersFrom(BrowserAnimationsModule),
    // Tema visual compartido por los componentes PrimeNG.
    providePrimeNG({
      theme: {
        preset: Aura,
      },
    }),
  ],
};
