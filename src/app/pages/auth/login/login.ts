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
  loginForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly messageService: MessageService,
    private readonly router: Router,
    private readonly auth: AuthService,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, this.notOnlySpacesValidator]],
      password: ['', [Validators.required, this.notOnlySpacesValidator]],
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  login(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.value;

    this.auth.login(email, password).subscribe(user => {
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

  private notOnlySpacesValidator(control: AbstractControl) {
    const value = control.value;
    if (value === null || value === undefined) {
      return null;
    }

    return typeof value === 'string' && value.trim().length === 0 ? { onlySpaces: true } : null;
  }
}
