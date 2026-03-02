import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';

/* PrimeNG */
import { CardModule } from 'primeng/card';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { DatePickerModule } from 'primeng/datepicker';

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
    DatePickerModule
  ],
  providers: [MessageService]
})
export class Register {

  activeStep: number = 1; // empieza en el paso 1

  registerForm: FormGroup;

  constructor(private fb: FormBuilder, private messageService: MessageService) {
    this.registerForm = this.fb.group({
      nombreCompleto: ['', Validators.required],
      fechaNacimiento: [null, Validators.required],
      direccion: ['', Validators.required],
      telefono: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      usuario: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(10),
        // CORREGIDO: lookahead para símbolo especial
        Validators.pattern(/^(?=.*[!@#$%^&])/)
      ]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordsMatchValidator });
  }

  esMayorDeEdad(): boolean {
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
  private passwordsMatchValidator(group: FormGroup): { [key: string]: any } | null {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass && confirm && pass === confirm ? null : { notMatching: true };
  }

  // accesores rápidos
  get f() {
    return this.registerForm.controls;
  }

  registrar() {
    if (this.registerForm.valid && this.esMayorDeEdad()) {
      this.messageService.add({
        severity: 'success',
        summary: 'Registro correcto',
        detail: 'Usuario creado (sin backend)'
      });
      console.log('Formulario válido:', this.registerForm.value);
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Formulario inválido',
        detail: 'Revise los campos marcados'
      });
    }
  }
}
