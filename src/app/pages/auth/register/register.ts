// Pantalla de registro con stepper.
// Divide la captura en pasos para mezclar validaciones de datos personales y credenciales.
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, AbstractControlOptions } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';

/* PrimeNG */
import { CardModule } from 'primeng/card';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { DatePickerModule } from 'primeng/datepicker';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.html',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    StepperModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    DatePickerModule,
    DividerModule,
    ToastModule,
    RouterModule,
  ],
  providers: [MessageService]
})
export class Register {

  // Paso actual del stepper PrimeNG.
  activeStep: number = 1;
  registerForm: FormGroup;
  // Bandera visual para bloquear acciones mientras se completa el alta.
  isLoading = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly messageService: MessageService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    this.registerForm = this.fb.group({
      nombreCompleto: ['', [Validators.required, this.notOnlySpacesValidator]],
      fechaNacimiento: [null, Validators.required],
      direccion: ['', [Validators.required, this.notOnlySpacesValidator]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      usuario: ['', [Validators.required, this.noSpacesValidator]],
      email: ['', [Validators.required, Validators.email, this.noSpacesValidator]],
      password: ['', [
        Validators.required,
        Validators.minLength(10),
        Validators.pattern(/^(?=.*[!@#$%^&*])\S+$/), // al menos un símbolo especial y sin espacios
        this.noSpacesValidator
      ]],
      confirmPassword: ['', [Validators.required, this.noSpacesValidator]]
    }, { validators: this.passwordsMatchValidator } as AbstractControlOptions);
  }

  // Validador personalizado: no permite espacios
  private noSpacesValidator(control: AbstractControl) {
    const hasSpace = (control.value || '').includes(' ');
    return hasSpace ? { noSpaces: true } : null;
  }

  // Validador personalizado: no acepta sólo espacios en blanco (permite espacios dentro)
  private notOnlySpacesValidator(control: AbstractControl) {
    const val = (control.value || '');
    return typeof val === 'string' && val.trim().length === 0 ? { onlySpaces: true } : null;
  }

  esMayorDeEdad(): boolean {
    // Calcula la edad exacta para impedir registros de menores.
    const fecha = this.registerForm.get('fechaNacimiento')?.value;
    if (!fecha) return false;

    const hoy = new Date();
    const nacimiento = new Date(fecha);

    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }

    return edad >= 18;
  }

  // Validador a nivel de grupo, comprueba que password y confirmPassword coinciden
  private passwordsMatchValidator(group: FormGroup) {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass && confirm && pass === confirm ? null : { notMatching: true };
  }

  // accesores rápidos
  get f() {
    // Alias corto de controles para usar en la plantilla.
    return this.registerForm.controls;
  }

  get canAccessCredentialsStep(): boolean {
    return Boolean(
      this.f['nombreCompleto'].valid &&
      this.f['fechaNacimiento'].valid &&
      this.f['direccion'].valid &&
      this.f['telefono'].valid &&
      this.esMayorDeEdad(),
    );
  }

  get canAccessConfirmationStep(): boolean {
    return Boolean(
      this.canAccessCredentialsStep &&
      this.f['usuario'].valid &&
      this.f['email'].valid &&
      this.f['password'].valid &&
      this.f['confirmPassword'].valid &&
      !this.registerForm.hasError('notMatching'),
    );
  }

  onPhoneInput(rawValue: string): void {
    const sanitizedPhone = String(rawValue ?? '').replaceAll(/\D/g, '').slice(0, 10);
    this.registerForm.patchValue({ telefono: sanitizedPhone }, { emitEvent: false });
  }

  registrar(activateCallback: (step: number) => void): void {
    // Solo continua si el formulario esta valido y la edad minima se cumple.
    if (this.registerForm.invalid || !this.esMayorDeEdad()) {
      this.registerForm.markAllAsTouched();
      this.messageService.add({ severity: 'error', summary: 'Formulario inválido', detail: 'Revise los campos marcados' });
      return;
    }

    const {
      nombreCompleto,
      fechaNacimiento,
      direccion,
      telefono,
      usuario,
      email,
      password,
    } = this.registerForm.value;

    const birthDate = fechaNacimiento instanceof Date
      ? fechaNacimiento.toISOString().split('T')[0]
      : String(fechaNacimiento ?? '');

    this.isLoading = true;
    this.auth.registerUser({
      email,
      password,
      name: nombreCompleto,
      username: usuario,
      phone: telefono,
      birthDate,
      address: direccion,
    }).subscribe(result => {
      if (!result.ok) {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error al registrar',
          detail: result.message ?? 'No se pudo guardar el usuario mediante el API Gateway.',
        });
        return;
      }

      // Registro exitoso — hacer login automático con las mismas credenciales
      this.auth.login(email, password).subscribe(user => {
        this.isLoading = false;
        if (user) {
          this.messageService.add({
            severity: 'success',
            summary: '¡Bienvenido!',
            detail: 'Cuenta creada e ingresado correctamente.',
          });
          setTimeout(() => this.router.navigate([user.isSuperAdmin ? '/groups' : '/home']), 800);
        } else {
          // Registro OK pero login automático no quedó listo: llevar a login manualmente.
          this.messageService.add({
            severity: 'success',
            summary: 'Cuenta creada',
            detail: 'Tu usuario ya fue registrado. Inicia sesion manualmente para continuar.',
          });
          activateCallback(3);
          setTimeout(() => this.router.navigate(['/login']), 1200);
        }
      });
    });
  }
}
