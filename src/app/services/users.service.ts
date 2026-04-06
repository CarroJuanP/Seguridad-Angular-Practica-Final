import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

import {
  ApiAddUserRequest,
  ApiLoginResponseEnvelope,
  ApiRegisterRequest,
  ApiResponseEnvelope,
  ApiUserResult,
  PermissionKey,
} from '../models/permissions.model';

const USERS_API_BASE_URL = 'https://spatial-delcine-devemma-edfc3f92.koyeb.app';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly http: HttpClient) {}

  /**
   * POST /login
   * Autentica al usuario y devuelve un JWT con sus permisos.
   */
  login(email: string, password: string): Observable<ApiLoginResponseEnvelope> {
    return this.http
      .post<ApiLoginResponseEnvelope>(`${USERS_API_BASE_URL}/login`, {
        email: email.trim().toLowerCase(),
        password,
      })
      .pipe(
        catchError(err =>
          of<ApiLoginResponseEnvelope>({
            statusCode: err.status ?? 500,
            intOpCode: 0,
            data: null,
          }),
        ),
      );
  }

  /**
   * POST /register
   * Registra un nuevo usuario en el sistema.
   */
  register(data: ApiRegisterRequest): Observable<ApiResponseEnvelope<ApiUserResult>> {
    return this.http
      .post<ApiResponseEnvelope<ApiUserResult>>(`${USERS_API_BASE_URL}/register`, data)
      .pipe(
        catchError(err =>
          of<ApiResponseEnvelope<ApiUserResult>>({
            statusCode: err.status ?? 500,
            intOpCode: 0,
            data: null,
            message: err.error?.message ?? 'Error en el registro',
          }),
        ),
      );
  }

  /**
   * POST /users
   * Agrega un usuario (operación administrativa con permisos opcionales).
   */
  addUser(data: ApiAddUserRequest): Observable<ApiResponseEnvelope<ApiUserResult>> {
    return this.http
      .post<ApiResponseEnvelope<ApiUserResult>>(`${USERS_API_BASE_URL}/users`, data)
      .pipe(
        catchError(err =>
          of<ApiResponseEnvelope<ApiUserResult>>({
            statusCode: err.status ?? 500,
            intOpCode: 0,
            data: null,
            message: err.error?.message ?? 'Error al agregar usuario',
          }),
        ),
      );
  }

  /**
   * GET /permissions
   * Obtiene el listado de permisos disponibles en el sistema.
   */
  getPermissions(): Observable<ApiResponseEnvelope<PermissionKey[]>> {
    return this.http
      .get<ApiResponseEnvelope<PermissionKey[]>>(`${USERS_API_BASE_URL}/permissions`)
      .pipe(
        catchError(err =>
          of<ApiResponseEnvelope<PermissionKey[]>>({
            statusCode: err.status ?? 500,
            intOpCode: 0,
            data: null,
            message: err.error?.message ?? 'Error al obtener permisos',
          }),
        ),
      );
  }
}
