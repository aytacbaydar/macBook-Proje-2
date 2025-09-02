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

interface NewStudent extends Student {
  kayit_tarihi: string;
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

interface TeacherInfo {
  id: number;
  adi_soyadi: string;
  email: string;
  avatar?: string;
  mukemmel_ogrenciler?: any[]; // Ensure this is handled as an array
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
  upcomingPayments: UpcomingPayment[] = [];
  upcomingClasses: UpcomingClass[] = [];
  newStudents: NewStudent[] = [];
  lastExamResults: any[] = [];

  isLoading: boolean = false;
  error: string | null = null;
  searchQuery: string = '';
  isLoadingPayments: boolean = false;
  isLoadingLastExam: boolean = true;
  isLoadingClasses: boolean = true;
  isLoadingProgress: boolean = true;
  isLoadingNewStudents: boolean = true;

  // Yeni dashboard değişkenleri
  dashboardStats: DashboardStats = {
    totalStudents: 0,
    activeStudents: 0,
    inactiveStudents: 0,
    totalGroups: 0,
    totalTopics: 0,
    completedTopics: 0,
    totalExams: 0,
    pendingExams: 0,
  };

  studentProgress: StudentProgress[] = [];
  isLoadingStats: boolean = true;

  // Günlük ders programı
  dailySchedule: any[] = [];
  todayName: string = '';

  // Öğretmen bilgileri
  teacherName: string = '';
  teacherAvatar: string = '';
  teacherId: number = 0;
  teacherInfo: TeacherInfo | null = null; // Changed to TeacherInfo interface
  isLoadingInfo: boolean = false; // Added loading state for teacher info

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

  weeklyPerformance = {
    completedLessons: 0,
    totalHours: 0,
    averageAttendance: 0,
  };

  // API URL'sini buraya ekleyebilirsiniz veya bir servis kullanabilirsiniz
  private apiUrl = './server/api';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadTeacherInfo();
    this.loadDashboardData();
    this.setTodayName();
    this.loadTodaySchedule();
  }

  private loadTeacherInfo(): void {
    this.isLoadingInfo = true;
    
    // Önce localStorage'dan öğretmen bilgilerini yükle
    this.setTeacherInfoFromStorage();
    
    // Sonra API'den güncel bilgileri al
    this.http.get<any>(`${this.apiUrl}/ogretmen_bilgileri.php`, {
      headers: this.getAuthHeaders(),
      responseType: 'json'
    }).subscribe({
      next: (response) => {
        console.log('API yanıtı:', response);
        if (response && response.success && response.data) {
          this.teacherInfo = response.data;
          
          // teacherName ve teacherAvatar'ı güncelle
          this.teacherName = this.teacherInfo.adi_soyadi || this.teacherName;
          this.teacherAvatar = this.teacherInfo.avatar || this.generateAvatarUrl(this.teacherName);
          
          // mukemmel_ogrenciler alanını güvenli hale getir
          if (!this.teacherInfo.mukemmel_ogrenciler) {
            this.teacherInfo.mukemmel_ogrenciler = [];
          } else if (typeof this.teacherInfo.mukemmel_ogrenciler === 'string') {
            try {
              this.teacherInfo.mukemmel_ogrenciler = JSON.parse(this.teacherInfo.mukemmel_ogrenciler);
            } catch (e) {
              console.warn('mukemmel_ogrenciler JSON parse hatası:', e);
              this.teacherInfo.mukemmel_ogrenciler = [];
            }
          } else if (!Array.isArray(this.teacherInfo.mukemmel_ogrenciler)) {
            this.teacherInfo.mukemmel_ogrenciler = [];
          }
          
          console.log('Öğretmen bilgileri başarıyla yüklendi:', this.teacherInfo);
        } else {
          console.warn('API yanıtı başarısız veya data yok:', response);
          // localStorage'dan yüklenen bilgileri kullan
        }
        this.isLoadingInfo = false;
      },
      error: (error) => {
        console.error('Öğretmen bilgileri yüklenirken hata:', error);
        
        // Hata detaylarını logla
        if (error.error && typeof error.error === 'string' && error.error.includes('<!doctype')) {
          console.error('API HTML döndürüyor, muhtemelen routing hatası veya dosya bulunamadı');
        }
        
        // localStorage'dan yüklenen bilgileri kullan, API hatası olsa da devam et
        this.isLoadingInfo = false;
      }
    });
  }

  private setTeacherInfoFromStorage(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.teacherName = user.adi_soyadi || 'Öğretmen';
        this.teacherId = user.id || 0;
        
        if (user.avatar && user.avatar.trim() !== '') {
          this.teacherAvatar = user.avatar;
        } else {
          this.teacherAvatar = this.generateAvatarUrl(this.teacherName);
        }
        
        // Temel teacher info oluştur
        this.teacherInfo = {
          id: user.id,
          adi_soyadi: this.teacherName,
          email: user.email || '',
          avatar: this.teacherAvatar,
          mukemmel_ogrenciler: []
        };
        
        console.log('Öğretmen bilgileri localStorage\'dan yüklendi:', {
          id: user.id,
          name: this.teacherName,
          avatar: this.teacherAvatar
        });
      } catch (error) {
        console.error('localStorage parse hatası:', error);
        this.setDefaultTeacherInfo();
      }
    } else {
      this.setDefaultTeacherInfo();
    }
  }

  private generateAvatarUrl(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff&size=40&font-size=0.6&rounded=true`;
  }


  private setDefaultTeacherInfo(): void {
    this.teacherName = 'Öğretmen';
    this.teacherAvatar =
      'https://ui-avatars.com/api/?name=Öğretmen&background=6c757d&color=fff&size=40&font-size=0.6&rounded=true';
  }

  private loadDashboardData(): void {
    this.loadStudents();
    this.loadUpcomingPayments();
    this.loadLastExamResults();
    this.loadUpcomingClasses();
    this.loadStudentProgress();
    this.loadDashboardStats();
    this.loadNewStudents();
  }

  private getAuthHeaders(): HttpHeaders {
    let token = '';
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
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

    this.http
      .get<any>('./server/api/ogrenciler_listesi.php', {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.organizeStudentsByGroups(response.data);
            this.updateStatsFromStudents(response.data);
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

  private updateStatsFromStudents(students: Student[]): void {
    const teacherStudents = students.filter(
      (student) =>
        student.rutbe === 'ogrenci' && student.ogretmeni === this.teacherName
    );

    this.dashboardStats.totalStudents = teacherStudents.length;
    this.dashboardStats.activeStudents = teacherStudents.filter(
      (s) => s.aktif
    ).length;
    this.dashboardStats.inactiveStudents = teacherStudents.filter(
      (s) => !s.aktif
    ).length;
    this.dashboardStats.totalGroups = [
      ...new Set(teacherStudents.map((s) => s.grubu)),
    ].filter(Boolean).length;

    // Toplam ücret hesapla
    this.dashboardStats.completedTopics =
      this.calculateTotalRevenue(teacherStudents);
  }

  private calculateTotalRevenue(students: Student[]): number {
    return students
      .filter((student) => student.aktif && student.ucret)
      .reduce((total, student) => {
        const fee = parseFloat(student.ucret || '0');
        return total + fee;
      }, 0);
  }

  organizeStudentsByGroups(students: Student[]): void {
    const groupMap = new Map<string, Student[]>();
    const teacherStudents = students.filter(
      (student) =>
        student.rutbe === 'ogrenci' && student.ogretmeni === this.teacherName
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

    this.http
      .get<any>('./server/api/yaklasan_odemeler.php', {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.upcomingPayments = response.data || [];
          } else {
            console.error(
              'Yaklaşan ödemeler yüklenirken hata:',
              response.message
            );
          }
          this.isLoadingPayments = false;
        },
        error: (error) => {
          console.error('Yaklaşan ödemeler API hatası:', error);
          this.isLoadingPayments = false;
        },
      });
  }

  private loadDashboardStats(): void {
    this.isLoadingStats = true;

    // Konu istatistikleri için API çağrısı
    this.http
      .get<any>('./server/api/islenen_konular.php', {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.dashboardStats.totalTopics = response.data.length;
            this.dashboardStats.completedTopics = response.data.filter(
              (k: any) => k.completed
            ).length;
          }
          this.isLoadingStats = false;
        },
        error: (error) => {
          console.error('Konu istatistikleri yüklenirken hata:', error);
          this.isLoadingStats = false;
        },
      });

    // Sınav istatistikleri için API çağrısı
    this.http
      .get<any>('./server/api/cevap-anahtarlari-listele.php', {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.dashboardStats.totalExams = response.data.length;
            this.dashboardStats.pendingExams = response.data.filter(
              (s: any) => s.status === 'pending'
            ).length;
          }
        },
        error: (error) => {
          console.error('Sınav istatistikleri yüklenirken hata:', error);
        },
      });
  }

  private loadLastExamResults(): void {
    this.isLoadingLastExam = true;

    this.http
      .get<any>('./server/api/ogretmen_sinav_sonuclari.php', {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // En son yapılan sınavın sonuçlarını al (son 5 sonuç)
            this.lastExamResults = response.data.slice(-5);
          } else {
            this.lastExamResults = [];
          }
          this.isLoadingLastExam = false;
        },
        error: (error) => {
          console.error('Son sınav sonuçları yüklenirken hata:', error);
          this.lastExamResults = [];
          this.isLoadingLastExam = false;
        },
      });
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
          status: 'pending',
        },
        {
          id: 2,
          time: '16:30',
          duration: '2 saat',
          subject: 'Organik Kimya',
          group: 'Grup C',
          studentCount: 8,
          status: 'pending',
        },
        {
          id: 3,
          time: '19:00',
          duration: '1 saat',
          subject: 'Kimyasal Denge',
          group: 'Grup B',
          studentCount: 15,
          status: 'pending',
        },
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
          avatar:
            'https://ui-avatars.com/api/?name=Ahmet+Yilmaz&background=6366f1&color=fff',
        },
        {
          id: 2,
          name: 'Fatma Kaya',
          subject: 'Asit-Baz',
          progress: 92,
          avatar:
            'https://ui-avatars.com/api/?name=Fatma+Kaya&background=10b981&color=fff',
        },
        {
          id: 3,
          name: 'Mehmet Demir',
          subject: 'Kimyasal Denge',
          progress: 78,
          avatar:
            'https://ui-avatars.com/api/?name=Mehmet+Demir&background=f59e0b&color=fff',
        },
      ];
      this.isLoadingProgress = false;
    }, 600);
  }

  private loadNewStudents(): void {
    this.isLoadingNewStudents = true;
    this.error = null;

    this.http
      .get<any>('./server/api/yeni_kayit_olan_ogrenciler.php', {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.newStudents = response.data || [];
          } else {
            this.error =
              response.message ||
              'Yeni öğrenci verileri yüklenirken hata oluştu.';
          }
          this.isLoadingNewStudents = false;
        },
        error: (error) => {
          this.error =
            'Sunucu hatası: ' + (error.error?.message || error.message);
          this.isLoadingNewStudents = false;
        },
      });
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

  formatCurrency(amount: number | string): string {
    const numAmount =
      typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    if (isNaN(numAmount) || numAmount === null || numAmount === undefined)
      return '₺0';
    if (numAmount === 0) return '₺0';

    return (
      new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numAmount) + ' TL'
    );
  }

  approveNewStudent(studentId: number): void {
    if (!confirm('Bu öğrenciyi onaylamak istediğinizden emin misiniz?')) {
      return;
    }

    const updateData = {
      id: studentId,
      rutbe: 'ogrenci',
      aktif: 1,
      ogretmeni: this.teacherName,
    };

    this.http
      .post<any>('./server/api/kullanici_guncelle.php', updateData, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            alert('Öğrenci başarıyla onaylandı!');
            this.loadNewStudents();
            this.loadStudents();
          } else {
            alert(
              'Onaylama işlemi başarısız: ' +
                (response.error || response.message)
            );
          }
        },
        error: (error) => {
          console.error('Onaylama hatası:', error);
          alert(
            'Onaylama sırasında bir hata oluştu: ' +
              (error.error?.message || error.message)
          );
        },
      });
  }

  rejectNewStudent(studentId: number): void {
    if (
      !confirm(
        'Bu öğrenciyi reddetmek istediğinizden emin misiniz? Bu işlem öğrenciyi silecektir.'
      )
    ) {
      return;
    }

    this.http
      .post<any>(
        './server/api/ogrenci_sil.php',
        { id: studentId },
        {
          headers: this.getAuthHeaders(),
        }
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            alert('Öğrenci başarıyla reddedildi!');
            this.loadNewStudents();
          } else {
            alert(
              'Reddetme işlemi başarısız: ' +
                (response.error || response.message)
            );
          }
        },
        error: (error) => {
          console.error('Reddetme hatası:', error);
          alert(
            'Reddetme sırasında bir hata oluştu: ' +
              (error.error?.message || error.message)
          );
        },
      });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('tr-TR');
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
      this.http
        .delete(`./server/api/ogrenci_sil.php?id=${studentId}`, {
          headers: this.getAuthHeaders(),
        })
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
    this.router.navigate([
      '/ogretmen-sayfasi/ogretmen-ders-anlatma-tahtasi-sayfasi',
    ]);
  }

  navigateToGroups(): void {
    this.router.navigate(['/ogretmen-sayfasi/ogretmen-gruplar-sayfasi']);
  }

  navigateToStudents(): void {
    this.router.navigate([
      '/ogretmen-sayfasi/ogretmen-ogrenci-listesi-sayfasi',
    ]);
  }

  navigateToReports(): void {
    this.router.navigate(['/ogretmen-sayfasi/ogretmen-ucret-sayfasi']);
  }

  // Exam result methods
  calculateNet(result: any): number {
    const dogru = parseFloat(result.dogru_sayisi || '0');
    const yanlis = parseFloat(result.yanlis_sayisi || '0');
    return dogru - yanlis / 4;
  }

  getPerformanceClass(percentage: number): string {
    if (percentage >= 80) return 'excellent';
    if (percentage >= 60) return 'good';
    if (percentage >= 40) return 'average';
    return 'poor';
  }

  navigateToExamResults(): void {
    this.router.navigate([
      '/ogretmen-sayfasi/ogretmen-ogrenci-sinav-sonuclari-sayfasi',
    ]);
  }

  haftalikdersprogrami(): void {
    this.router.navigate([
      '/ogretmen-sayfasi/ogretmen-haftalik-program-sayfasi',
    ]);
  }

  yaklasanodemeler(): void {
    this.router.navigate(['/ogretmen-sayfasi/ogretmen-ucret-sayfasi']);
  }

  konuanalizi(): void {
    this.router.navigate(['/ogretmen-sayfasi/ogretmen-konu-analizi-sayfasi']);
  }

  setTodayName(): void {
    const today = new Date();
    const dayNames = [
      'Pazar',
      'Pazartesi',
      'Salı',
      'Çarşamba',
      'Perşembe',
      'Cuma',
      'Cumartesi',
    ];
    this.todayName = dayNames[today.getDay()];
  }

  loadTodaySchedule(): void {
    const headers = this.getAuthHeaders();

    this.http
      .get<any>('./server/api/ogretmen_haftalik_program.php', { headers })
      .subscribe({
        next: (response) => {
          console.log('Günlük program API yanıtı:', response);

          if (response.success) {
            // Bugünün derslerini filtrele
            const todayLessons = (response.data || []).filter(
              (ders: any) => ders.ders_gunu === this.todayName
            );

            console.log('Bugünkü dersler:', todayLessons);
            console.log('Bugünün adı:', this.todayName);

            // Dersleri saate göre sırala ve grup bilgilerini organize et
            const groupedLessons = new Map();

            todayLessons.forEach((ders: any) => {
              const key = `${ders.ders_saati}-${ders.grup_adi || ders.grubu}`;

              if (!groupedLessons.has(key)) {
                groupedLessons.set(key, {
                  ders_saati: ders.ders_saati,
                  grup_adi: ders.grup_adi || ders.grubu || 'Grup Tanımsız',
                  ucret: ders.ucret || '0',
                  ogrenciler: [],
                });
              }

              // Öğrenci ismini ekle
              if (ders.ogrenci_adi && ders.ogrenci_adi.trim() !== '') {
                const grupData = groupedLessons.get(key);
                if (!grupData.ogrenciler.includes(ders.ogrenci_adi)) {
                  grupData.ogrenciler.push(ders.ogrenci_adi);
                }
              }
            });

            // Map'i array'e çevir ve saate göre sırala
            this.dailySchedule = Array.from(groupedLessons.values()).sort(
              (a: any, b: any) => a.ders_saati.localeCompare(b.ders_saati)
            );

            console.log('İşlenmiş günlük program:', this.dailySchedule);
          }
        },
        error: (error) => {
          console.error('Günlük ders programı yüklenirken hata:', error);
        },
      });
  }

  // This method was added to fix the "mukemmel_ogrenciler is not iterable" error
  getIyiOgrenciler() {
    try {
      const mukemmelOgrenciler = this.teacherInfo?.mukemmel_ogrenciler;
      
      // Eğer mukemmelOgrenciler yoksa veya dizi değilse boş dizi döndür
      if (!mukemmelOgrenciler) {
        return [];
      }
      
      // String ise JSON parse etmeye çalış
      let ogrencilerArray;
      if (typeof mukemmelOgrenciler === 'string') {
        try {
          ogrencilerArray = JSON.parse(mukemmelOgrenciler);
        } catch (e) {
          console.warn('mukemmel_ogrenciler JSON parse hatası:', e);
          return [];
        }
      } else {
        ogrencilerArray = mukemmelOgrenciler;
      }
      
      // Dizi kontrolü yap
      if (!Array.isArray(ogrencilerArray)) {
        console.warn('mukemmel_ogrenciler dizi değil:', typeof ogrencilerArray);
        return [];
      }
      
      // Başarı yüzdesi 90 ve üzeri olanları filtrele
      return ogrencilerArray.filter((student: any) => {
        const basariYuzdesi = parseFloat(student?.basari_yuzdesi || '0');
        return basariYuzdesi >= 90;
      });
    } catch (error) {
      console.error('getIyiOgrenciler metodunda hata:', error);
      return [];
    }
  }
}