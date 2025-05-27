import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { Student, Teacher } from '../../../../models';
import { StudentService, TeacherService } from '../../../../services';

@Component({
  selector: 'app-ogrenci-listesi-sayfasi',
  templateUrl: './ogrenci-listesi-sayfasi.component.html',
  styleUrls: ['./ogrenci-listesi-sayfasi.component.scss'],
  
})
export class OgrenciListesiSayfasiComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Veri listeleri
  students: Student[] = [];
  teachers: Teacher[] = [];
  newUsers: (Student | Teacher)[] = [];

  // Filtrelenmiş veriler
  filteredStudents: Student[] = [];
  filteredTeachers: Teacher[] = [];
  filteredNewUsers: (Student | Teacher)[] = [];

  // Sayfalama
  currentStudentPage = 1;
  currentTeacherPage = 1;
  currentNewUsersPage = 1;
  itemsPerPage = 10;
  totalStudentCount = 0;
  totalTeacherCount = 0;
  totalNewUsersCount: number = 0;

  // Pagination için eksik property'ler
  get totalStudentPages(): number {
    return Math.ceil(this.filteredStudents.length / this.itemsPerPage);
  }

  get totalTeacherPages(): number {
    return Math.ceil(this.filteredTeachers.length / this.itemsPerPage);
  }

  get totalNewUsersPages(): number {
    return Math.ceil(this.filteredNewUsers.length / this.itemsPerPage);
  }

  // UI durumları
  activeTab = 'students';
  searchQuery = '';
  isLoading = false;
  error: string | null = null;

  // Branş listesi
  branches = [
    'Kimya',
    'Matematik',
    'Fizik', 
    'Biyoloji',
    'Türkçe',
    'İngilizce',
    'Tarih',
    'Coğrafya'
  ];

  constructor(
    private studentService: StudentService,
    private teacherService: TeacherService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.error = null;

    forkJoin({
      students: this.studentService.getAllStudents(),
      teachers: this.teacherService.getAllTeachers()
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response.students.success && response.students.data) {
          this.students = Array.isArray(response.students.data) 
            ? response.students.data 
            : [response.students.data];
          this.totalStudentCount = this.students.length;
        }

        if (response.teachers.success && response.teachers.data) {
          this.teachers = Array.isArray(response.teachers.data) 
            ? response.teachers.data 
            : [response.teachers.data];
          this.totalTeacherCount = this.teachers.length;
        }

        this.separateNewUsers();
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Kullanıcılar yüklenirken hata:', error);
        this.error = 'Kullanıcılar yüklenirken bir hata oluştu. Lütfen tekrar deneyin.';
        this.isLoading = false;
      }
    });
  }

  private separateNewUsers(): void {
    // Yeni kullanıcılar: aktif olmayan ve rutbe = 'yeni' olanlar
    const newStudents = this.students.filter(student => 
      !student.aktif && student.rutbe === 'yeni'
    );

    const newTeachers = this.teachers.filter(teacher => 
      !teacher.aktif && teacher.rutbe === 'yeni'
    );

    this.newUsers = [...newStudents, ...newTeachers];
    this.totalNewUsersCount = this.newUsers.length;

    // Aktif kullanıcıları filtrele
    this.students = this.students.filter(student => 
      student.aktif && student.rutbe !== 'yeni'
    );

    this.teachers = this.teachers.filter(teacher => 
      teacher.aktif && teacher.rutbe !== 'yeni'
    );
  }

  // Tab yönetimi
  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.searchQuery = '';
    this.applyFilters();
  }

  // Arama ve filtreleme
  onSearch(): void {
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  applyFilters(): void {
    const query = this.searchQuery.toLowerCase().trim();

    if (this.activeTab === 'students') {
      this.filteredStudents = this.students.filter(student =>
        student.adi_soyadi.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        (student.okulu && student.okulu.toLowerCase().includes(query)) ||
        (student.brans && student.brans.toLowerCase().includes(query))
      );
      this.currentStudentPage = 1;
    } else if (this.activeTab === 'teachers') {
      this.filteredTeachers = this.teachers.filter(teacher =>
        teacher.adi_soyadi.toLowerCase().includes(query) ||
        teacher.email.toLowerCase().includes(query) ||
        (teacher.brans && teacher.brans.toLowerCase().includes(query))
      );
      this.currentTeacherPage = 1;
    } else if (this.activeTab === 'new') {
      this.filteredNewUsers = this.newUsers.filter(user =>
        user.adi_soyadi.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.brans && user.brans.toLowerCase().includes(query))
      );
      this.currentNewUsersPage = 1;
    }
  }

  // Sayfalama işlemleri
  get paginatedStudents(): Student[] {
    const start = (this.currentStudentPage - 1) * this.itemsPerPage;
    return this.filteredStudents.slice(start, start + this.itemsPerPage);
  }

  get paginatedTeachers(): Teacher[] {
    const start = (this.currentTeacherPage - 1) * this.itemsPerPage;
    return this.filteredTeachers.slice(start, start + this.itemsPerPage);
  }

  get paginatedNewUsers(): (Student | Teacher)[] {
    const start = (this.currentNewUsersPage - 1) * this.itemsPerPage;
    return this.filteredNewUsers.slice(start, start + this.itemsPerPage);
  }

  setStudentPage(page: number): void {
    this.currentStudentPage = page;
  }

  setTeacherPage(page: number): void {
    this.currentTeacherPage = page;
  }

  setNewUsersPage(page: number): void {
    this.currentNewUsersPage = page;
  }

  getStudentPageArray(): number[] {
    const totalPages = Math.ceil(this.filteredStudents.length / this.itemsPerPage);
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  getTeacherPageArray(): number[] {
    const totalPages = Math.ceil(this.filteredTeachers.length / this.itemsPerPage);
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  getNewUsersPageArray(): number[] {
    const totalPages = Math.ceil(this.filteredNewUsers.length / this.itemsPerPage);
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // İstatistikler
  getActiveStudents(): number {
    return this.students.filter(student => student.aktif).length;
  }

  getInactiveStudents(): number {
    return this.students.filter(student => !student.aktif).length;
  }

  getActiveTeachers(): number {
    return this.teachers.filter(teacher => teacher.aktif).length;
  }

  getInactiveTeachers(): number {
    return this.teachers.filter(teacher => !teacher.aktif).length;
  }

  getStudentsWaiting(): number {
    return this.newUsers.filter(user => 
      'sinifi' in user || 'okulu' in user // Student tipinde olup olmadığını kontrol et
    ).length;
  }

  getTeachersWaiting(): number {
    return this.newUsers.filter(user => 
      !('sinifi' in user || 'okulu' in user) // Teacher tipinde olup olmadığını kontrol et
    ).length;
  }

  getPendingUsers(): number {
    return this.newUsers.length;
  }

  // Delete Functions
  deleteStudent(id: number): void {
    if (confirm('Bu öğrenciyi silmek istediğinizden emin misiniz?')) {
      this.studentService.deleteStudent(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadUsers(); // Listeyi yenile
          }
        },
        error: (error) => {
          console.error('Öğrenci silinirken hata:', error);
          this.error = 'Öğrenci silinirken hata oluştu.';
        }
      });
    }
  }

  deleteTeacher(id: number): void {
    if (confirm('Bu öğretmeni silmek istediğinizden emin misiniz?')) {
      this.teacherService.deleteTeacher(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadUsers(); // Listeyi yenile
          }
        },
        error: (error) => {
          console.error('Öğretmen silinirken hata:', error);
          this.error = 'Öğretmen silinirken hata oluştu.';
        }
      });
    }
  }

  // CRUD işlemleri
  deleteStudent(id: number): void {
    if (confirm('Bu öğrenciyi silmek istediğinizden emin misiniz?')) {
      this.studentService.deleteStudent(id).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadUsers(); // Verileri yenile
          }
        },
        error: (error) => {
          console.error('Öğrenci silinirken hata:', error);
          alert('Öğrenci silinirken bir hata oluştu.');
        }
      });
    }
  }

  deleteTeacher(id: number): void {
    if (confirm('Bu öğretmeni silmek istediğinizden emin misiniz?')) {
      this.teacherService.deleteTeacher(id).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadUsers(); // Verileri yenile
          }
        },
        error: (error) => {
          console.error('Öğretmen silinirken hata:', error);
          alert('Öğretmen silinirken bir hata oluştu.');
        }
      });
    }
  }

  approveUser(user: Student | Teacher): void {
    const isStudent = 'sinifi' in user || 'okulu' in user;

    if (isStudent) {
      this.studentService.approveStudent(user.id!).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadUsers();
          }
        },
        error: (error) => {
          console.error('Öğrenci onaylanırken hata:', error);
        }
      });
    } else {
      // Öğretmen onaylama işlemi burada yapılacak
      // teacherService.approveTeacher() metodunu ekleyebilirsiniz
    }
  }

  approveAllStudents(): void {
    if (confirm('Tüm bekleyen öğrencileri onaylamak istediğinizden emin misiniz?')) {
      this.studentService.approveAllStudents().pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadUsers();
          }
        },
        error: (error) => {
          console.error('Öğrenciler onaylanırken hata:', error);
        }
      });
    }
  }

  // Yardımcı fonksiyonlar
  isStudent(user: Student | Teacher): user is Student {
    return 'sinifi' in user || 'okulu' in user;
  }

  isTeacher(user: Student | Teacher): user is Teacher {
    return !this.isStudent(user);
  }

  getBranchDisplayName(branch: string | undefined): string {
    return branch || 'Belirtilmemiş';
  }

  // Math fonksiyonu template'de kullanmak için
  Math = Math;
}