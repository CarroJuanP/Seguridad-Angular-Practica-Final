// Pantalla publica de bienvenida.
// Su rol es simple: ofrecer entrada rapida a login o registro.
import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CardModule,
    ButtonModule,
    RouterModule
  ],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class Landing {}
