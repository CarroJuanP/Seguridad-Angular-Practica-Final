// Punto de entrada real de Angular.
// Aqui se arranca la aplicacion standalone usando el componente raiz y la configuracion global.
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app';
import { appConfig } from './app/app.config';

// bootstrapApplication crea la app en tiempo de ejecucion y monta AppComponent en <app-root>.
bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
