import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Student } from '../models/student.model';
import { Teacher } from '../models/teacher.model';
import { ApiResponse } from '../models/api-response.model';

export interface AuthUser {
  id: number;
  adi_soyadi: string;
  email: string;
  rutbe: string;
  aktif: boolean;
  avatar?: string;
  type: 'student' | 'teacher' | 'admin';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService extends ApiService {
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(http: HttpClient) {
    super(http);
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        this.currentUserSubject.next(user);
      } catch (error) {
        console.error('Kullanıcı verisi parse edilemedi:', error);
        this.logout();
      }
    }
  }

  login(email: string, password: string, userType: 'student' | 'teacher'): Observable<AuthUser> {
    const endpoint = userType === 'student' ? 'ogrenci_girisi' : 'ogretmen_girisi';

    return this.post<Student | Teacher>(endpoint, { email, sifre: password }).pipe(
      map(response => {
        if (response.success && response.data) {
          const user = response.data as any;
          const authUser: AuthUser = {
            id: user.id,
            adi_soyadi: user.adi_soyadi,
            email: user.email,
            rutbe: user.rutbe,
            aktif: user.aktif,
            avatar: user.avatar,
            type: userType === 'student' ? 'student' : user.rutbe === 'yonetici' ? 'admin' : 'teacher'
          };

          this.setCurrentUser(authUser);

          if (response.token) {
            localStorage.setItem('token', response.token);
          }

          return authUser;
        }
        throw new Error(response.message || 'Giriş başarısız');
      })
    );
  }

  private setCurrentUser(user: AuthUser): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.type === 'admin';
  }

  isTeacher(): boolean {
    const user = this.getCurrentUser();
    return user?.type === 'teacher';
  }

  isStudent(): boolean {
    const user = this.getCurrentUser();
    return user?.type === 'student';
  }

  hasRole(role: 'admin' | 'teacher' | 'student'): boolean {
    const user = this.getCurrentUser();
    return user?.type === role;
  }
}