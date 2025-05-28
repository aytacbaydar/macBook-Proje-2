import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { StudentService } from '../../../../services';
import { Student } from '../../../../models/student.model';

interface Group {
  name: string;
  students: Student[];
  studentCount: number;
  color: string;
}

@Component({
  selector: 'app-ogrenci-gruplar',
  templateUrl: './ogrenci-gruplar.component.html',
  styleUrls: ['./ogrenci-gruplar.component.scss'],
  standalone: false
})
export class OgrenciGruplarComponent implements OnInit {
  groups: Group[] = [];
  isLoading: boolean = true;
  error: string | null = null;
  searchQuery: string = '';

  // Grup renkleri
  groupColors = [
    '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', 
    '#ef4444', '#8b5cf6', '#ec4899', '#84cc16',
    '#f97316', '#6366f1', '#14b8a6', '#eab308'
  ];
  http: any;

  constructor(
    private studentService: StudentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadStudents();
  }

  loadStudents(): void {
    this.isLoading = true;
    this.error = null;

    this.studentService.getAllStudents().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const students: Student[] = Array.isArray(response.data) ? response.data : [response.data];
          this.organizeStudentsByGroups(students);
        } else {
          this.error = 'Öğrenci verileri yüklenemedi';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Öğrenciler yüklenirken hata:', error);
        this.error = 'Öğrenciler yüklenirken bir hata oluştu';
        this.isLoading = false;
      }
    });
  }

  organizeStudentsByGroups(students: Student[]): void {
    const groupMap = new Map<string, Student[]>();

    // Öğrencileri gruplara ayır
    students.forEach(student => {
      const groupName = student.grubu || 'Grup Atanmamış';
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(student);
    });

    // Grup objelerini oluştur
    this.groups = Array.from(groupMap.entries()).map(([name, students], index) => ({
      name,
      students,
      studentCount: students.length,
      color: this.groupColors[index % this.groupColors.length]
    }));

    // Grupları sırala (önce atanmış gruplar, sonra atanmamış)
    this.groups.sort((a, b) => {
      if (a.name === 'Grup Atanmamış') return 1;
      if (b.name === 'Grup Atanmamış') return -1;
      return a.name.localeCompare(b.name);
    });
  }

  get filteredGroups(): Group[] {
    if (!this.searchQuery.trim()) {
      return this.groups;
    }

    const query = this.searchQuery.toLowerCase().trim();
    return this.groups.map(group => ({
      ...group,
      students: group.students.filter(student =>
        student.adi_soyadi.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        group.name.toLowerCase().includes(query)
      )
    })).filter(group => group.students.length > 0);
  }

  getTotalStudents(): number {
    return this.groups.reduce((total, group) => total + group.studentCount, 0);
  }

  getActiveStudents(): number {
    return this.groups.reduce((total, group) => 
      total + group.students.filter(student => student.aktif).length, 0);
  }

  deleteStudent(studentId: number): void {
    if (confirm('Bu öğrenciyi silmek istediğinizden emin misiniz?')) {
      let token = '';
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        token = user.token || '';
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
      });

      this.http.delete(`./server/api/ogrenci_sil.php?id=${studentId}`, { headers })
        .subscribe({
          next: (response: any) => {
            if (response.success) {
              this.loadStudents(); // Listeyi yenile
            } else {
              alert('Öğrenci silinirken hata oluştu: ' + response.message);
            }
          },
          error: (error: { message: string; }) => {
            alert('Sunucu hatası: ' + error.message);
          }
        });
    }
  }

  viewGroupDetail(groupName: string): void {
    const encodedGroupName = encodeURIComponent(groupName);
    this.router.navigate(['/yonetici-sayfasi/grup-detay', encodedGroupName]);
  }
}