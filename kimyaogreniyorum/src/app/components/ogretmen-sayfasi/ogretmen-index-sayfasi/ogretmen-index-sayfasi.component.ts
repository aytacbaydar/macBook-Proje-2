import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-ogretmen-index-sayfasi',
  templateUrl: './ogretmen-index-sayfasi.component.html',
  styleUrls: ['./ogretmen-index-sayfasi.component.scss']
})
export class OgretmenIndexSayfasiComponent implements OnInit {
  students: any[] = [];
  filteredStudents: any[] = [];
  paginatedStudents: any[] = [];
  loading = false;
  error = '';

  // Pagination
  currentStudentPage = 1;
  itemsPerPage = 10;
  totalStudentCount = 0;

  // Filtering
  searchTerm = '';
  selectedGroup = '';
  selectedStatus = '';
  selectedGrade = '';

  // Available filter options
  groups: string[] = [];
  grades: string[] = [];

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadMyStudents();
  }

  loadMyStudents() {
    this.loading = true;
    this.error = '';

    const token = localStorage.getItem('token');

    if (!token) {
      this.error = 'Oturum bulunamadı';
      this.loading = false;
      return;
    }

    this.http.get<any>('https://www.kimyaogreniyorum.com/server/api/ogretmen_ogrencileri.php', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.students = response.data.students || [];
          this.totalStudentCount = this.students.length;
          this.extractFilterOptions();
          this.applyFilters();
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

  extractFilterOptions() {
    // Extract unique groups
    this.groups = [...new Set(this.students
      .map(s => s.grubu)
      .filter(g => g && g.trim() !== '')
    )].sort();

    // Extract unique grades
    this.grades = [...new Set(this.students
      .map(s => s.sinifi)
      .filter(g => g && g.trim() !== '')
    )].sort();
  }

  applyFilters() {
    this.filteredStudents = this.students.filter(student => {
      const matchesSearch = !this.searchTerm || 
        student.adi_soyadi?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        student.cep_telefonu?.includes(this.searchTerm);

      const matchesGroup = !this.selectedGroup || student.grubu === this.selectedGroup;
      const matchesGrade = !this.selectedGrade || student.sinifi === this.selectedGrade;

      const matchesStatus = !this.selectedStatus || 
        (this.selectedStatus === 'aktif' && student.aktif) ||
        (this.selectedStatus === 'pasif' && !student.aktif);

      return matchesSearch && matchesGroup && matchesGrade && matchesStatus;
    });

    this.totalStudentCount = this.filteredStudents.length;
    this.setStudentPage(1);
  }

  setStudentPage(page: number) {
    if (page < 1 || page > this.getStudentTotalPages()) return;

    this.currentStudentPage = page;
    const startIndex = (page - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedStudents = this.filteredStudents.slice(startIndex, endIndex);
  }

  getStudentTotalPages(): number {
    return Math.ceil(this.totalStudentCount / this.itemsPerPage);
  }

  getStudentPageArray(): number[] {
    const totalPages = this.getStudentTotalPages();
    const pages: number[] = [];
    const maxPagesToShow = 5;

    let startPage = Math.max(1, this.currentStudentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  onSearchChange() {
    this.applyFilters();
  }

  onGroupChange() {
    this.applyFilters();
  }

  onGradeChange() {
    this.applyFilters();
  }

  onStatusChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedGroup = '';
    this.selectedGrade = '';
    this.selectedStatus = '';
    this.applyFilters();
  }

  getActiveStudents(): number {
    return this.students.filter(student => student.aktif).length;
  }

  getInactiveStudents(): number {
    return this.students.filter(student => !student.aktif).length;
  }

  Math = Math;
}