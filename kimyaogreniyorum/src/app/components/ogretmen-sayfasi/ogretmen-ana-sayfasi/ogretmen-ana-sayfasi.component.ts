
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
  brans?: string;
  ogretmeni?: string;
}

interface Group {
  name: string;
  students: Student[];
  studentCount: number;
  color: string;
}

interface UpcomingPayment {
  id: number;
  adi_soyadi: string;
  email: string;
  ucret: string;
  grubu: string;
  ders_sayisi: number;
  son_odeme_tarihi?: string;
}

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  totalGroups: number;
  totalTopics: number;
  completedTopics: number;
  totalExams: number;
  pendingExams: number;
}

interface Activity {
  id: number;
  type: 'student_join' | 'topic_complete' | 'lesson_start' | 'exam_create';
  title: string;
  description: string;
  time: string;
  icon: string;
  color: string;
}

interface UpcomingClass {
  id: number;
  time: string;
  duration: string;
  subject: string;
  group: string;
  studentCount: number;
  status: 'active' | 'pending' | 'completed';
}

interface StudentProgress {
  id: number;
  name: string;
  subject: string;
  progress: number;
  avatar: string;
}

@Component({
  selector: 'app-ogretmen-ana-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-ana-sayfasi.component.html',
  styleUrl: './ogretmen-ana-sayfasi.component.scss',
})
export class OgretmenAnaSayfasiComponent implements OnInit {
  // Mevcut değişkenler
  groups: Group[] = [];
  isLoading: boolean = true;
  error: string | null = null;
  searchQuery: string = '';
  upcomingPayments: UpcomingPayment[] = [];
  isLoadingPayments: boolean = false;

  // Yeni dashboard değişkenleri
  dashboardStats: DashboardStats = {
    totalStudents: 0,
    activeStudents: 0,
    inactiveStudents: 0,
    totalGroups: 0,
    totalTopics: 0,
    completedTopics: 0,
    totalExams: 0,
    pendingExams: 0
  };

  recentActivities: Activity[] = [];
  upcomingClasses: UpcomingClass[] = [];
  studentProgress: StudentProgress[] = [];
  isLoadingStats: boolean = true;
  isLoadingActivities: boolean = true;
  isLoadingClasses: boolean = true;
  isLoadingProgress: boolean = true;

  // Öğretmen bilgileri
  teacherName: string = '';
  teacherAvatar: string = '';
  teacherId: number = 0;

  // Grup renkleri
  groupColors = [
    '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#eab308',
  ];

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadTeacherInfo();
    this.loadDashboardData();
  }

  private loadTeacherInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.teacherName = user.adi_soyadi || 'Öğretmen';
        this.teacherId = user.id || 0;

        if (user.avatar && user.avatar.trim() !== '') {
          this.teacherAvatar = user.avatar;
        } else {
          this.teacherAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            this.teacherName
          )}&background=4f46e5&color=fff&size=40&font-size=0.6&rounded=true`;
        }
      } catch (error) {
        console.error('Kullanıcı bilgileri ayrıştırılırken hata:', error);
        this.setDefaultTeacherInfo();
      }
    } else {
      this.setDefaultTeacherInfo();
    }
  }

  private setDefaultTeacherInfo(): void {
    this.teacherName = 'Öğretmen';
    this.teacherAvatar = 'https://ui-avatars.com/api/?name=Öğretmen&background=6c757d&color=fff&size=40&font-size=0.6&rounded=true';
  }

  private loadDashboardData(): void {
    this.loadStudents();
    this.loadUpcomingPayments();
    this.loadRecentActivities();
    this.loadUpcomingClasses();
    this.loadStudentProgress();
    this.loadDashboardStats();
  }

  private getAuthHeaders(): HttpHeaders {
    let token = '';
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  loadStudents(): void {
    this.isLoading = true;
    this.error = null;

    this.http.get<any>('./server/api/ogrenciler_listesi.php', { headers: this.getAuthHeaders() })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.organizeStudentsByGroups(response.data);
            this.updateStatsFromStudents(response.data);
          } else {
            this.error = response.message || 'Öğrenci verileri yüklenirken hata oluştu.';
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.error = 'Sunucu hatası: ' + (error.error?.message || error.message);
          this.isLoading = false;
        },
      });
  }

  private updateStatsFromStudents(students: Student[]): void {
    const teacherStudents = students.filter(
      student => student.rutbe === 'ogrenci' && student.ogretmeni === this.teacherName
    );

    this.dashboardStats.totalStudents = teacherStudents.length;
    this.dashboardStats.activeStudents = teacherStudents.filter(s => s.aktif).length;
    this.dashboardStats.inactiveStudents = teacherStudents.filter(s => !s.aktif).length;
    this.dashboardStats.totalGroups = [...new Set(teacherStudents.map(s => s.grubu))].filter(Boolean).length;
    
    // Toplam ücret hesapla
    this.dashboardStats.completedTopics = this.calculateTotalRevenue(teacherStudents);
  }

  private calculateTotalRevenue(students: Student[]): number {
    return students
      .filter(student => student.aktif && student.ucret)
      .reduce((total, student) => {
        const fee = parseFloat(student.ucret || '0');
        return total + fee;
      }, 0);
  }

  organizeStudentsByGroups(students: Student[]): void {
    const groupMap = new Map<string, Student[]>();
    const teacherStudents = students.filter(
      student => student.rutbe === 'ogrenci' && student.ogretmeni === this.teacherName
    );

    teacherStudents.forEach((student) => {
      const groupName = student.grubu || 'Grup Atanmamış';
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(student);
    });

    this.groups = Array.from(groupMap.entries()).map(
      ([name, students], index) => ({
        name,
        students,
        studentCount: students.length,
        color: this.groupColors[index % this.groupColors.length],
      })
    );

    this.groups.sort((a, b) => {
      if (a.name === 'Grup Atanmamış') return 1;
      if (b.name === 'Grup Atanmamış') return -1;
      return a.name.localeCompare(b.name);
    });
  }

  loadUpcomingPayments(): void {
    this.isLoadingPayments = true;
    
    this.http.get<any>('./server/api/yaklasan_odemeler.php', { headers: this.getAuthHeaders() })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.upcomingPayments = response.data || [];
          } else {
            console.error('Yaklaşan ödemeler yüklenirken hata:', response.message);
          }
          this.isLoadingPayments = false;
        },
        error: (error) => {
          console.error('Yaklaşan ödemeler API hatası:', error);
          this.isLoadingPayments = false;
        }
      });
  }

  private loadDashboardStats(): void {
    this.isLoadingStats = true;
    
    // Konu istatistikleri için API çağrısı
    this.http.get<any>('./server/api/islenen_konular.php', { headers: this.getAuthHeaders() })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.dashboardStats.totalTopics = response.data.length;
            this.dashboardStats.completedTopics = response.data.filter((k: any) => k.completed).length;
          }
          this.isLoadingStats = false;
        },
        error: (error) => {
          console.error('Konu istatistikleri yüklenirken hata:', error);
          this.isLoadingStats = false;
        }
      });

    // Sınav istatistikleri için API çağrısı
    this.http.get<any>('./server/api/cevap-anahtarlari-listele.php', { headers: this.getAuthHeaders() })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.dashboardStats.totalExams = response.data.length;
            this.dashboardStats.pendingExams = response.data.filter((s: any) => s.status === 'pending').length;
          }
        },
        error: (error) => {
          console.error('Sınav istatistikleri yüklenirken hata:', error);
        }
      });
  }

  private loadRecentActivities(): void {
    this.isLoadingActivities = true;
    
    // Son aktiviteler için simulated data - gerçek API'ye bağlanabilir
    setTimeout(() => {
      this.recentActivities = [
        {
          id: 1,
          type: 'student_join',
          title: 'Yeni Öğrenci',
          description: 'Ahmet Yılmaz gruba katıldı',
          time: '2 saat önce',
          icon: 'fas fa-user-plus',
          color: 'primary'
        },
        {
          id: 2,
          type: 'topic_complete',
          title: 'Konu Tamamlandı',
          description: 'Asit-Baz konusu işlendi',
          time: '4 saat önce',
          icon: 'fas fa-check-circle',
          color: 'success'
        },
        {
          id: 3,
          type: 'lesson_start',
          title: 'Ders Başladı',
          description: 'Grup B dersi başladı',
          time: '6 saat önce',
          icon: 'fas fa-play-circle',
          color: 'warning'
        },
        {
          id: 4,
          type: 'exam_create',
          title: 'Yeni Sınav',
          description: 'Organik Kimya sınavı oluşturuldu',
          time: '1 gün önce',
          icon: 'fas fa-file-alt',
          color: 'info'
        }
      ];
      this.isLoadingActivities = false;
    }, 1000);
  }

  private loadUpcomingClasses(): void {
    this.isLoadingClasses = true;
    
    // Yaklaşan dersler için simulated data - gerçek API'ye bağlanabilir
    setTimeout(() => {
      this.upcomingClasses = [
        {
          id: 1,
          time: '14:00',
          duration: '1.5 saat',
          subject: 'Asit ve Bazlar',
          group: 'Grup A',
          studentCount: 12,
          status: 'pending'
        },
        {
          id: 2,
          time: '16:30',
          duration: '2 saat',
          subject: 'Organik Kimya',
          group: 'Grup C',
          studentCount: 8,
          status: 'pending'
        },
        {
          id: 3,
          time: '19:00',
          duration: '1 saat',
          subject: 'Kimyasal Denge',
          group: 'Grup B',
          studentCount: 15,
          status: 'pending'
        }
      ];
      this.isLoadingClasses = false;
    }, 800);
  }

  private loadStudentProgress(): void {
    this.isLoadingProgress = true;
    
    // Öğrenci ilerlemesi için simulated data - gerçek API'ye bağlanabilir
    setTimeout(() => {
      this.studentProgress = [
        {
          id: 1,
          name: 'Ahmet Yılmaz',
          subject: 'Organik Kimya',
          progress: 85,
          avatar: 'https://ui-avatars.com/api/?name=Ahmet+Yilmaz&background=6366f1&color=fff'
        },
        {
          id: 2,
          name: 'Fatma Kaya',
          subject: 'Asit-Baz',
          progress: 92,
          avatar: 'https://ui-avatars.com/api/?name=Fatma+Kaya&background=10b981&color=fff'
        },
        {
          id: 3,
          name: 'Mehmet Demir',
          subject: 'Kimyasal Denge',
          progress: 78,
          avatar: 'https://ui-avatars.com/api/?name=Mehmet+Demir&background=f59e0b&color=fff'
        }
      ];
      this.isLoadingProgress = false;
    }, 600);
  }

  // Utility methods
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
    return this.dashboardStats.totalStudents;
  }

  getActiveStudents(): number {
    return this.dashboardStats.activeStudents;
  }

  getInactiveStudents(): number {
    return this.dashboardStats.inactiveStudents;
  }

  formatCurrency(amount: string | number): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(numAmount || 0);
  }

  // Navigation methods
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

  deleteStudent(studentId: number): void {
    if (confirm('Bu öğrenciyi silmek istediğinizden emin misiniz?')) {
      this.http.delete(`./server/api/ogrenci_sil.php?id=${studentId}`, { headers: this.getAuthHeaders() })
        .subscribe({
          next: (response: any) => {
            if (response.success) {
              this.loadStudents();
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

  // Quick action navigation methods
  navigateToTeaching(): void {
    this.router.navigate(['/ogretmen-sayfasi/ogretmen-ders-anlatma-tahtasi-sayfasi']);
  }

  navigateToGroups(): void {
    this.router.navigate(['/ogretmen-sayfasi/ogretmen-gruplar-sayfasi']);
  }

  navigateToStudents(): void {
    this.router.navigate(['/ogretmen-sayfasi/ogretmen-ogrenci-listesi-sayfasi']);
  }

  navigateToReports(): void {
    this.router.navigate(['/ogretmen-sayfasi/ogretmen-ucret-sayfasi']);
  }

  // Activity icon methods
  getActivityIcon(type: string): string {
    switch (type) {
      case 'student_join': return 'fas fa-user-plus';
      case 'topic_complete': return 'fas fa-check-circle';
      case 'lesson_start': return 'fas fa-play-circle';
      case 'exam_create': return 'fas fa-file-alt';
      default: return 'fas fa-info-circle';
    }
  }

  getActivityColor(color: string): string {
    return color;
  }
}
