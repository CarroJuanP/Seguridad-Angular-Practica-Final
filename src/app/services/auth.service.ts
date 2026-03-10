import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _logged = false;

  login(): void {
    this._logged = true;
  }

  logout(): void {
    this._logged = false;
    // clear tokens, etc.
    console.log('logged out');
  }

  get isAuthenticated(): boolean {
    return this._logged;
  }
}
