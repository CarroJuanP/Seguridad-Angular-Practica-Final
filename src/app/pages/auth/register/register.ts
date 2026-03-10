import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, AbstractControlOptions } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';

/* PrimeNG */
import { CardModule } from 'primeng/card';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { DatePickerModule } from 'primeng/datepicker';
import { DividerModule } from 'primeng/divider';

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
    DividerModule
  ],
  providers: [MessageService]
})
export class Register {

  activeStep: number = 0;
  registerForm: FormGroup;

  constructor(private readonly fb: FormBuilder, private readonly messageService: MessageService) {
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
