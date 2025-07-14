
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

interface Student {
  id: number;
  adi_soyadi: string;
  email: string;
  cep_telefonu?: string;
  okulu?: string;
  sinifi?: string;
  grubu?: string;
  ders_gunu?: string;
  ders_saati?: string;
  ucret?: string;
  aktif: boolean;
  avatar?: string;
  veli_adi?: string;
  veli_cep?: string;
  rutbe?: string;
  // Öğretmen alanları
  brans?: string;
  ogretmeni?: string;
}

interface Group {
  name: string;
  students: Student[];
  studentCount: number;
  color: string;
}

@Component({
  selector: 'app-ogretmen-gruplar-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-gruplar-sayfasi.component.html',
  styleUrl: './ogretmen-gruplar-sayfasi.component.scss',
})
export class OgretmenGruplarSayfasiComponent implements OnInit {
  groups: Group[] = [];
  isLoading: boolean = true;
  error: string | null = null;
  searchQuery: string = '';
  
  // Math object for template
  Math = Math;
  
  // Grup renkleri
  groupColors = [
    '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', 
    '#ef4444', '#8b5cf6', '#ec4899', '#84cc16',
    '#f97316', '#6366f1', '#14b8a6', '#eab308'
  ];

  constructor(private http: HttpClient, private router: Router) { }

  ngOnInit(): void {
    this.loadStudents();
  }

  loadStudents(): void {
    this.isLoading = true;
    this.error = null;

    // Token'ı al
    let token = '';
    let loggedInUser: any = null;
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      loggedInUser = JSON.parse(userStr);
      token = loggedInUser.token || '';
      console.log('Gruplar sayfası - User bilgileri:', {
        id: loggedInUser.id,
        name: loggedInUser.adi_soyadi,
        userRole: loggedInUser.rutbe
      });
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<any>('./server/api/ogrenciler_listesi.php', { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.organizeStudentsByGroups(response.data);
          } else {
            this.error = response.message || 'Öğrenci verileri yüklenirken hata oluştu.';
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.error = 'Sunucu hatası: ' + (error.error?.message || error.message);
          this.isLoading = false;
        }
      });
  }

  organizeStudentsByGroups(students: Student[]): void {
    // Token'ı al
    let token = '';
    let loggedInUser: any = null;
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      loggedInUser = JSON.parse(userStr);
      token = loggedInUser.token || '';
    }

    const groupMap = new Map<string, Student[]>();

    // Giriş yapan öğretmenin adi_soyadi'sını al
    const loggedInTeacherName = loggedInUser?.adi_soyadi || '';
    
    // Debug bilgisi
    console.log('Öğretmen adı:', loggedInTeacherName);
    console.log('Toplam öğrenci sayısı:', students.length);
    
    // Sadece öğrencileri filtrele (admin ve öğretmenleri hariç tut)
    const actualStudents = students.filter(
      (student) => student.rutbe === 'ogrenci'
    );
    
    console.log('Filtreli öğrenci sayısı:', actualStudents.length);
    console.log('İlk 3 öğrencinin öğretmeni:', actualStudents.slice(0, 3).map(s => s.ogretmeni));

    // Öğrencileri gruplara ayır
    actualStudents.forEach((student) => {
      const groupName = student.grubu || 'Grup Atanmamış';
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(student);
    });

    // Grup objelerini oluştur
    this.groups = Array.from(groupMap.entries()).map(
      ([name, students], index) => ({
        name,
        students,
        studentCount: students.length,
        color: this.groupColors[index % this.groupColors.length],
      })
    );

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
          error: (error) => {
            alert('Sunucu hatası: ' + error.message);
          }
        });
    }
  }

  viewGroupDetail(groupName: string): void {
    const encodedGroupName = encodeURIComponent(groupName);
    this.router.navigate([
      '/ogretmen-sayfasi/ogretmen-gruplar-detay-sayfasi',
      encodedGroupName,
    ]);
  }

  goToAttendance(groupName: string): void {
    const encodedGroupName = encodeURIComponent(groupName);
    this.router.navigate(['/ogretmen-sayfasi/devamsizlik', encodedGroupName]);
  }

  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=4f46e5&color=fff&size=32&font-size=0.6&rounded=true`;
  }

  getActiveStudentsInGroup(group: Group): number {
    return group.students.filter(student => student.aktif).length;
  }

  getInactiveStudentsInGroup(group: Group): number {
    return group.students.filter(student => !student.aktif).length;
  }

  adjustColorBrightness(hex: string, percent: number): string {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse r, g, b values
    const num = parseInt(hex, 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }
}
