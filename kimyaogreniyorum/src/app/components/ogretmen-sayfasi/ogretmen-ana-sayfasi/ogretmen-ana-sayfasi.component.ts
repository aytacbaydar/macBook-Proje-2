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
  selector: 'app-ogretmen-ana-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-ana-sayfasi.component.html',
  styleUrl: './ogretmen-ana-sayfasi.component.scss',
})
export class OgretmenAnaSayfasiComponent implements OnInit {
  groups: Group[] = [];
  isLoading: boolean = true;
  error: string | null = null;
  searchQuery: string = '';

  // Grup renkleri
  groupColors = [
    '#4f46e5',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#84cc16',
    '#f97316',
    '#6366f1',
    '#14b8a6',
    '#eab308',
  ];

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadStudents();
  }

  loadStudents(): void {
    this.isLoading = true;
    this.error = null;

    // Token'ı al
    let token = '';
    let loggedInUser: any = null;
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      loggedInUser = JSON.parse(userStr);
      token = loggedInUser.token || '';
      console.log('Gruplar sayfası - User bilgileri:', {
        id: loggedInUser.id,
        name: loggedInUser.adi_soyadi,
        userRole: loggedInUser.rutbe,
      });
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    this.http
      .get<any>('./server/api/ogrenciler_listesi.php', { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.organizeStudentsByGroups(response.data);
          } else {
            this.error =
              response.message || 'Öğrenci verileri yüklenirken hata oluştu.';
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.error =
            'Sunucu hatası: ' + (error.error?.message || error.message);
          this.isLoading = false;
        },
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
    // Sadece öğrencileri filtrele (admin ve öğretmenleri hariç tut)
    const actualStudents = students.filter(
      (student) =>
        student.rutbe === 'ogrenci' && student.ogretmeni === loggedInTeacherName
    );

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
    return this.groups
      .map((group) => ({
        ...group,
        students: group.students.filter(
          (student) =>
            student.adi_soyadi.toLowerCase().includes(query) ||
            student.email.toLowerCase().includes(query) ||
            group.name.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.students.length > 0);
  }

  getTotalStudents(): number {
    return this.groups.reduce((total, group) => total + group.studentCount, 0);
  }

  getActiveStudents(): number {
    return this.groups.reduce(
      (total, group) =>
        total + group.students.filter((student) => student.aktif).length,
      0
    );
  }

  deleteStudent(studentId: number): void {
    if (confirm('Bu öğrenciyi silmek istediğinizden emin misiniz?')) {
      let token = '';
      const userStr =
        localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        token = user.token || '';
      }

      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
      });

      this.http
        .delete(`./server/api/ogrenci_sil.php?id=${studentId}`, { headers })
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
          },
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

  //Eski Öğretmenler Ana Sayfası Değişkenleri ve Fonksiyonları
  // Sidebar state
  isSidebarOpen: boolean = true;

  // Teacher information
  teacherName: string = '';
  teacherAvatar: string = '';

  // Dashboard statistics
  totalStudents: number = 127;
  activeStudents: number = 95;
  totalGroups: number = 8;
  activeGroups: number = 6;
  totalTopics: number = 24;
  completedTopics: number = 18;
  totalExams: number = 12;
  pendingExams: number = 3;

  //constructor() {}

  // ngOnInit(): void {
  //   this.loadTeacherInfo();
  //   this.checkScreenSize();
  //   window.addEventListener('resize', () => {
  //     this.checkScreenSize();
  //   });
  // }

  private loadTeacherInfo(): void {
    // localStorage veya sessionStorage'dan giriş yapan kullanıcı bilgilerini al
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');

    if (userStr) {
      try {
        const user = JSON.parse(userStr);

        // Kullanıcı bilgilerini al (API'den gelen response.data formatına uygun)
        this.teacherName = user.adi_soyadi || 'Öğretmen';

        // Avatar kontrolü - API'den gelen avatar alanını kullan
        if (user.avatar && user.avatar.trim() !== '') {
          this.teacherAvatar = user.avatar;
        } else {
          // Avatar yoksa UI Avatars ile dinamik oluştur
          this.teacherAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            this.teacherName
          )}&background=4f46e5&color=fff&size=40&font-size=0.6&rounded=true`;
        }

        console.log('Öğretmen bilgileri yüklendi:', {
          id: user.id,
          name: this.teacherName,
          avatar: this.teacherAvatar,
          userRole: user.rutbe,
        });
      } catch (error) {
        console.error('Kullanıcı bilgileri ayrıştırılırken hata:', error);
        this.setDefaultTeacherInfo();
      }
    } else {
      console.warn('Kullanıcı giriş bilgisi bulunamadı');
      this.setDefaultTeacherInfo();
    }
  }

  private setDefaultTeacherInfo(): void {
    this.teacherName = 'Öğretmen';
    this.teacherAvatar =
      'https://ui-avatars.com/api/?name=Öğretmen&background=6c757d&color=fff&size=40&font-size=0.6&rounded=true';
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    // Kullanıcının tercihini kaydet
    localStorage.setItem('sidebarOpen', JSON.stringify(this.isSidebarOpen));
  }

  private checkScreenSize(): void {
    if (window.innerWidth < 768) {
      this.isSidebarOpen = false;
    } else {
      // Desktop'ta kullanıcının son tercihini localStorage'dan al
      const savedState = localStorage.getItem('sidebarOpen');
      this.isSidebarOpen = savedState ? JSON.parse(savedState) : true;
    }
  }
}
