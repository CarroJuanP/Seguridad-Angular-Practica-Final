// Pantalla de inicio de sesion.
// Usa Reactive Forms para validar credenciales antes de delegar el flujo real a AuthService.
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    DividerModule,
  ],
  providers: [MessageService],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class Login {
  // Formulario reactivo con reglas minimas para evitar envios vacios o llenos de espacios.
  loginForm: FormGroup;
  isSubmitting = false;
  private logoClickCount = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly messageService: MessageService,
    private readonly router: Router,
    private readonly auth: AuthService,
  ) {
    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required, this.notOnlySpacesValidator]],
      password: ['', [Validators.required, this.notOnlySpacesValidator]],
    });
  }

  get f() {
    // Alias corto para simplificar las expresiones del template.
    return this.loginForm.controls;
  }

  login(): void {
    // Si el formulario no pasa validaciones locales, ni siquiera intenta autenticarse.
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.loginForm.value;
    this.isSubmitting = true;

    this.auth.login(identifier, password).subscribe(user => {
      this.isSubmitting = false;
      if (!user) {
        this.messageService.add({
          severity: 'error',
          summary: 'Acceso denegado',
          detail: 'Credenciales invalidas.',
        });
        return;
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Sesion iniciada',
        detail: `Bienvenido ${user.name}.`,
      });

      // Superadmin va a grupos; el resto a la página de bienvenida.
      setTimeout(() => this.router.navigate([user.isSuperAdmin ? '/groups' : '/home']), 500);
    });
  }

  onLogoClick(): void {
    this.logoClickCount += 1;
    if (this.logoClickCount >= 5) {
      this.logoClickCount = 0;
      this.messageService.add({
        severity: 'info',
        summary: 'catch u',
        detail: 'Te cachamos explorando el login.',
      });
    }
  }

  private notOnlySpacesValidator(control: AbstractControl) {
    // Permite texto con espacios internos, pero no cadenas vacias disfrazadas de espacios.
    const value = control.value;
    if (value === null || value === undefined) {
      return null;
    }

    return typeof value === 'string' && value.trim().length === 0 ? { onlySpaces: true } : null;
  }
}
