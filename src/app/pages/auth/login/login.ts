import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../services/auth.service';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { StepperModule } from 'primeng/stepper';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ToastModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    StepperModule,
    DividerModule
  ],
  providers: [MessageService],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {

  activeStep: number = 1;
  loginForm: FormGroup;

  private notOnlySpacesValidator(control: AbstractControl) {
    const v = control.value;
    if (v === null || v === undefined) return null;
    return typeof v === 'string' && v.trim().length === 0 ? { onlySpaces: true } : null;
  }

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private router: Router,
    private auth: AuthService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, this.notOnlySpacesValidator]],
      password: ['', [Validators.required, this.notOnlySpacesValidator]]
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  login() {
    if (this.loginForm.invalid) {
      return;
    }

    const { email, password } = this.loginForm.value;
    const validEmail = '2023371057@uteq.edu.mx';
    const validPassword = 'Admin@12345';

    if (email === validEmail && password === validPassword) {
      this.messageService.add({
        severity: 'success',
        summary: 'Acceso correcto',
        detail: 'Bienvenida al sistema'
      });

      this.auth.login();
      // redirigir al home después de mostrar el toast
      setTimeout(() => this.router.navigate(['/home']), 800);
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Credenciales incorrectas'
      });
    }
  }
}
