import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Student, StudentResponse, StudentListResponse } from '../models/student.model';
import { PaginationParams, PaginatedResponse } from '../models/api-response.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class StudentService extends ApiService {
  protected override baseUrl = 'http://kimyaogreniyorum/server/api';

  // Öğrenci kayıt
  registerStudent(studentData: Partial<Student>): Observable<StudentResponse> {
    return this.post<Student>('ogrenci_kayit', studentData);
  }

  // Öğrenci giriş
  loginStudent(email: string, password: string): Observable<StudentResponse> {
    return this.post<Student>('ogrenci_girisi', { email, sifre: password });
  }

  // Tüm öğrencileri getir
  getAllStudents(params?: PaginationParams): Observable<PaginatedResponse<Student>> {
    return this.get<Student[]>('ogrenciler_listesi', params);
  }

  // Öğrenci detayını getir
  getStudentById(id: number): Observable<StudentResponse> {
    return this.get<Student>(`ogretmen/ogrenci_profil?id=${id}`);
  }

  // Öğrenci güncelle
  updateStudent(id: number, studentData: Partial<Student>): Observable<StudentResponse> {
    return this.put<Student>(`ogretmen/ogrenci_guncelle`, { id, ...studentData });
  }

  // Öğrenci sil
  deleteStudent(id: number): Observable<StudentResponse> {
    return this.delete<Student>(`ogretmen/ogrenci_sil?id=${id}`);
  }

  // Aktif öğrenci sayısı
  getActiveStudentsCount(): Observable<ApiResponse<{count: number}>> {
    return this.get<{count: number}>('aktif_ogrenci_sayisi');
  }

  // Bekleyen öğrenci sayısı
  getPendingStudentsCount(): Observable<ApiResponse<{count: number}>> {
    return this.get<{count: number}>('bekleyen_ogrenci_sayisi');
  }

  // Branşa göre öğrencileri filtrele
  getStudentsByBranch(branch: string, params?: PaginationParams): Observable<PaginatedResponse<Student>> {
    return this.get<Student[]>('ogrenci_bilgileri', { ...params, brans: branch });
  }

  // Gruplar için öğrencileri getir
  getStudentsByGroup(group: string): Observable<StudentListResponse> {
    return this.get<Student[]>('ogrenci_bilgileri', { grubu: group });
  }
  
    // Okula göre öğrencileri getir
  getStudentsBySchool(school: string): Observable<PaginatedResponse<Student>> {
    return this.get<Student[]>(`ogrenci_okul/${school}`);
  }

  // Öğrenci onaylama
  approveStudent(id: number): Observable<ApiResponse<Student>> {
    return this.post<Student>(`tum_ogrencileri_onayla`, { id });
  }

  // Tüm öğrencileri onaylama
  approveAllStudents(): Observable<ApiResponse<any>> {
    return this.post<any>(`tum_ogrencileri_onayla`, {});
  }
}