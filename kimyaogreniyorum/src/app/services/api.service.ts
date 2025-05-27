import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiResponse, PaginationParams } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://0.0.0.0:8000/server/api';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private handleError(error: any): Observable<never> {
    console.error('API Hatası:', error);
    return throwError(() => error);
  }

  protected get<T>(endpoint: string, params?: any): Observable<ApiResponse<T>> {
    let httpParams = new HttpParams();

    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }

    return this.http.get<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, {
      headers: this.getHeaders(),
      params: httpParams
    }).pipe(
      catchError(this.handleError)
    );
  }

  protected post<T>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, data, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  protected put<T>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, data, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  protected delete<T>(endpoint: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }
}