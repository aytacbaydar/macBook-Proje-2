
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Teacher, TeacherResponse } from '../models/teacher.model';
import { PaginationParams, PaginatedResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class TeacherService extends ApiService {

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
    return this.get<Teacher[]>('ogretmen_bilgileri', params);
  }

  // Öğretmen detayını getir
  getTeacherById(id: number): Observable<TeacherResponse> {
    return this.get<Teacher>(`ogretmen_profil/${id}`);
  }

  // Öğretmen güncelle
  updateTeacher(id: number, teacherData: Partial<Teacher>): Observable<TeacherResponse> {
    return this.put<Teacher>(`ogretmen_guncelle/${id}`, teacherData);
  }

  // Öğretmen sil
  deleteTeacher(id: number): Observable<TeacherResponse> {
    return this.delete<Teacher>(`ogretmen_sil/${id}`);
  }

  // Branşa göre öğretmenleri getir
  getTeachersByBranch(branch: string): Observable<TeacherResponse> {
    return this.get<Teacher[]>('ogretmen_bilgileri', { brans: branch });
  }

  // Yönetici bilgilerini getir
  getAdminInfo(): Observable<TeacherResponse> {
    return this.get<Teacher>('yonetici_bilgileri');
  }
}
