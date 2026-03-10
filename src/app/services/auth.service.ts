import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { AppUser, MOCK_USERS, UserSession } from '../models/permissions.model';

const USERS_KEY = 'app-users';
const SESSION_KEY = 'app-session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sessionSubject = new BehaviorSubject<UserSession | null>(this.loadSession());
  readonly session$ = this.sessionSubject.asObservable();

  constructor() {
    this.ensureSeedUsers();
  }

  login(email: string, password: string): Observable<AppUser | null> {
    const user = this.getUsers().find(
      current => current.email.toLowerCase() === email.toLowerCase() && current.password === password,
    );

    if (!user) {
      return of(null);
    }

    const session: UserSession = {
      userId: user.id,
      name: user.name,
      email: user.email,
      selectedGroupId: null,
      permissions: [],
    };

    this.persistSession(session);
    return of(user);
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    this.sessionSubject.next(null);
  }

  getSession(): UserSession | null {
    return this.sessionSubject.value;
  }

  updateSession(partial: Partial<UserSession>): void {
    const current = this.sessionSubject.value;
    if (!current) {
      return;
    }

    const updated: UserSession = {
      ...current,
      ...partial,
    };

    this.persistSession(updated);
  }

  isAuthenticated(): boolean {
    return !!this.sessionSubject.value;
  }

  getCurrentUser(): AppUser | null {
    const session = this.sessionSubject.value;
    if (!session) {
      return null;
    }

    return this.getUsers().find(user => user.id === session.userId) ?? null;
  }

  getUsers(): AppUser[] {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as AppUser[]) : [];
  }

  saveUsers(users: AppUser[]): void {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  private ensureSeedUsers(): void {
    if (!localStorage.getItem(USERS_KEY)) {
      this.saveUsers(MOCK_USERS);
    }
  }

  private loadSession(): UserSession | null {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  }

  private persistSession(session: UserSession): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.sessionSubject.next(session);
  }
}
