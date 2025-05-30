import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  cep_telefonu: string;
  rutbe: string;
  aktif: boolean;
  avatar: string;
  brans: string;
  ogretmeni: number;
  created_at: string;
  okulu: string;
  sinifi: string;
  grubu: string;
  ders_gunu: string;
  ders_saati: string;
  ucret: number;
  veli_adi: string;
  veli_cep: string;
  ogretmen_adi: string;
}

@Component({
  selector: 'app-ogretmen-index-sayfasi',
  templateUrl: './ogretmen-index-sayfasi.component.html',
  styleUrls: ['./ogretmen-index-sayfasi.component.scss']
})
export class OgretmenIndexSayfasiComponent implements OnInit {
  students: Student[] = [];
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalCount = 0;

  constructor(private router: Router, private http: HttpClient) { }

  ngOnInit(): void {
    this.loadMyStudents();
  }

  loadMyStudents(): void {
    this.loading = true;
    this.error = null;

    const token = localStorage.getItem('authToken');
    if (!token) {
      this.router.navigate(['/']);
      return;
    }

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    this.http.get<any>('https://www.kimyaogreniyorum.com/server/api/ogretmen_ogrencileri.php', { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.students = response.data;
            this.totalCount = this.students.length;
          } else {
            this.error = response.message || 'Öğrenciler yüklenirken hata oluştu';
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Öğrenciler yüklenirken hata:', error);
          this.error = 'Öğrenciler yüklenirken hata oluştu';
          this.loading = false;
        }
      });
  }

  get paginatedStudents(): Student[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.students.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount / this.itemsPerPage);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageArray(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  logout(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    this.router.navigate(['/']);
  }
}