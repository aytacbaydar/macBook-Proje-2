
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

interface StudentStats {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  ucret: number;
  presentCount: number;
  absentCount: number;
  totalLessons: number;
  attendancePercentage: number;
  expectedPaymentCycles: number;
  expectedTotalAmount: number;
  lessonsUntilNextPayment: number;
}

@Component({
  selector: 'app-ogrenci-ucret-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-ucret-sayfasi.component.html',
  styleUrl: './ogrenci-ucret-sayfasi.component.scss'
})
export class OgrenciUcretSayfasiComponent implements OnInit {
  // Öğrenci bilgileri
  selectedStudentStats: any = null;
  showStudentStatsModal = false;
  selectedStudentId: number | null = null;
  isLoading = false;
  studentAnalysis: StudentStats[] = [];
  
  // Kullanıcı bilgileri
  currentUser: any = null;
  
  // Öğrenci istatistik kartları
  studentStats: any[] = [];

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadUserData();
    this.loadStudentStats();
  }

  private loadUserData() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.currentUser = {
          id: payload.user_id,
          name: payload.adi_soyadi,
          rutbe: payload.rutbe
        };
      } catch (error) {
        console.error('Token parsing error:', error);
      }
    }
  }

  // Öğrenci istatistiklerini yükle (kendi bilgilerini görmek için)
  async loadStudentStats() {
    if (!this.currentUser || !this.currentUser.id) {
      return;
    }

    this.isLoading = true;

    try {
      // Öğrencinin kendi istatistiklerini getir
      const response = await this.http.get<any>(`server/api/ogrenci_detay_istatistik.php?ogrenci_id=${this.currentUser.id}&grup=`, {
        headers: this.getAuthHeaders()
      }).toPromise();

      if (response && response.success) {
        // Öğrenci bilgilerini student stats formatına çevir
        const stats = response.data;
        this.studentStats = [{
          id: stats.student_info.id,
          name: stats.student_info.name,
          email: stats.student_info.email,
          avatar: this.getDefaultAvatar(stats.student_info.name),
          ucret: stats.student_info.ucret,
          presentCount: stats.attendance_stats.present_count,
          absentCount: stats.attendance_stats.absent_count,
          totalLessons: stats.attendance_stats.total_lessons,
          attendancePercentage: stats.attendance_stats.attendance_percentage,
          expectedPaymentCycles: stats.payment_stats.expected_payment_cycles,
          expectedTotalAmount: stats.payment_stats.expected_total_amount,
          lessonsUntilNextPayment: stats.payment_stats.lessons_until_next_payment
        }];
      }
    } catch (error: any) {
      console.error('Öğrenci istatistikleri yüklenirken hata:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Detaylı öğrenci istatistiklerini getir (kendi bilgilerini görmek için)
  async loadStudentDetailedStats(studentId?: number) {
    this.isLoading = true;

    // Öğrenci kendi bilgilerini görüyor, kendi ID'sini kullan
    const targetStudentId = this.currentUser?.id || studentId;

    if (!targetStudentId) {
      this.toastr.error('Öğrenci bilgisi bulunamadı', 'Hata');
      this.isLoading = false;
      return;
    }

    try {
      const response = await this.http.get<any>(`server/api/ogrenci_detay_istatistik.php?ogrenci_id=${targetStudentId}&grup=`, {
        headers: this.getAuthHeaders()
      }).toPromise();

      if (response.success) {
        this.selectedStudentStats = response.data;
        this.selectedStudentId = targetStudentId;
        this.showStudentStatsModal = true;
      } else {
        this.toastr.error(response.message || 'İstatistik yüklenemedi', 'Hata');
      }
    } catch (error: any) {
      console.error('İstatistik yükleme hatası:', error);
      this.toastr.error('İstatistik yüklenirken bir hata oluştu', 'Hata');
    } finally {
      this.isLoading = false;
    }
  }

  closeStudentStatsModal() {
    this.showStudentStatsModal = false;
    this.selectedStudentStats = null;
    this.selectedStudentId = null;
  }

  // Yardımcı fonksiyonlar
  getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  }

  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d6efd&color=fff&size=40`;
  }

  getAttendanceColor(percentage: number): string {
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'danger';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatTime(timeString: string): string {
    return timeString.substring(0, 5);
  }
}
