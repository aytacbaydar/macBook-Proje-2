import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Teacher, TeacherResponse } from '../models/teacher.model';
import { PaginationParams, PaginatedResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class TeacherService extends ApiService {
  private baseUrl = 'http://0.0.0.0:8000/server/api';

  // Öğretmen kayıt
  registerTeacher(teacherData: Partial<Teacher>): Observable<TeacherResponse> {
    return this.post<Teacher>('ogretmen_kayit', teacherData);
  }

  // Öğretmen giriş
  loginTeacher(email: string, password: string): Observable<TeacherResponse> {
    return this.post<Teacher>('ogretmen_girisi', { email, sifre: password });
  }

  // Tüm öğretmenleri getir
  getAllTeachers(params?: PaginationParams): Observable<PaginatedResponse<Teacher>> {
    return this.get<Teacher[]>(`${this.baseUrl}/ogretmen_bilgileri`, params);
  }

  // Öğretmen detayını getir
  getTeacherById(id: number): Observable<TeacherResponse> {
    return this.get<Teacher>(`${this.baseUrl}/ogretmen_profil?id=${id}`);
  }

  // Öğretmen güncelle
  updateTeacher(id: number, teacherData: Partial<Teacher>): Observable<TeacherResponse> {
    return this.put<Teacher>(`${this.baseUrl}/ogretmen_guncelle`, { id, ...teacherData });
  }

  // Öğretmen sil
  deleteTeacher(id: number): Observable<TeacherResponse> {
    return this.delete<Teacher>(`${this.baseUrl}/ogretmen_sil?id=${id}`);
  }

  // Branşa göre öğretmenleri getir
  getTeachersByBranch(branch: string): Observable<TeacherResponse> {
    return this.get<Teacher[]>('ogretmen_bilgileri', { brans: branch });
  }

  // Yönetici bilgilerini getir
  getAdminInfo(): Observable<TeacherResponse> {
    return this.get<Teacher>('yonetici_bilgileri');
  }

  approveTeacher(id: number): Observable<ApiResponse<Teacher>> {
    return this.post<Teacher>(`ogretmen_onayla`, { id });
  }
}