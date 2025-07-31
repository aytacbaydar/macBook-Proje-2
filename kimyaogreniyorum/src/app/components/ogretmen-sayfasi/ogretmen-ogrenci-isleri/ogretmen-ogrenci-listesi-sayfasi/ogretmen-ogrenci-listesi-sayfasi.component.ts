import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

interface User {
  id: number;
  adi_soyadi: string;
  email: string;
  cep_telefonu: string;
  okulu: string;
  sinifi: string;
  grubu: string;
  aktif: boolean;
  avatar?: string;
  ucret?: number;
  ders_adi?: string;
  rutbe: string;
  created_at?: string;
  // Öğretmen alanları
  brans?: string;
  ogretmeni?: string;
  ders_gunu?: string;
  ders_saati?: string;
}

@Component({
  selector: 'app-ogretmen-ogrenci-listesi-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-ogrenci-listesi-sayfasi.component.html',
  styleUrl: './ogretmen-ogrenci-listesi-sayfasi.component.scss',
})
export class OgretmenOgrenciListesiSayfasiComponent implements OnInit {

  students: User[] = [];
  newUsers: User[] = [];
  isLoading = true;
  error: string | null = null;
  searchQuery = '';

  // Aktif sekme
  activeTab: 'ogrenci' | 'yeni' = 'ogrenci';

  // Pagination
  currentStudentPage = 1;
  currentTeacherPage = 1;
  currentNewUserPage = 1;
  itemsPerPage = 5;

  // Math property for template
  Math = Math;

  // Avatar modal properties
  showAvatarModal = false;
  selectedStudent: User | null = null;

  // Filtreleme ve görünüm properties
  searchTerm = '';
  selectedGroup = '';
  selectedSchool = '';
  selectedStatus = '';
  viewMode: 'grid' | 'list' = 'grid';

  // Statistics properties
  get totalStudents(): number {
    return this.students.length;
  }

  get activeStudentsCount(): number {
    return this.students.filter(student => student.aktif).length;
  }

  get inactiveStudentsCount(): number {
    return this.students.filter(student => !student.aktif).length;
  }

  // Unique values for filters
  get uniqueGroups(): string[] {
    const groups = this.students.map(student => student.grubu).filter(Boolean);
    return [...new Set(groups)];
  }

  get uniqueSchools(): string[] {
    const schools = this.students.map(student => student.okulu).filter(Boolean);
    return [...new Set(schools)];
  }

  // Advanced filtering
  get filteredStudents(): User[] {
    let filtered = this.students;

    // Text search
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(student =>
        student.adi_soyadi.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term) ||
        (student.cep_telefonu && student.cep_telefonu.toLowerCase().includes(term)) ||
        (student.okulu && student.okulu.toLowerCase().includes(term)) ||
        (student.sinifi && student.sinifi.toLowerCase().includes(term)) ||
        (student.grubu && student.grubu.toLowerCase().includes(term))
      );
    }

    // Group filter
    if (this.selectedGroup) {
      filtered = filtered.filter(student => student.grubu === this.selectedGroup);
    }

    // School filter
    if (this.selectedSchool) {
      filtered = filtered.filter(student => student.okulu === this.selectedSchool);
    }

    // Status filter
    if (this.selectedStatus) {
      if (this.selectedStatus === 'active') {
        filtered = filtered.filter(student => student.aktif);
      } else if (this.selectedStatus === 'inactive') {
        filtered = filtered.filter(student => !student.aktif);
      }
    }

    return filtered;
  }

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  // Tab değiştirme
  setActiveTab(tab: 'ogrenci' | 'yeni'): void {
    this.activeTab = tab;
    // Tab değiştiğinde sayfayı sıfırla
    if (tab === 'ogrenci') this.currentStudentPage = 1;
    if (tab === 'yeni') this.currentNewUserPage = 1;
  }

  // Verileri yükleme
  loadUsers(): void {
    this.isLoading = true;
    // LocalStorage veya sessionStorage'dan token'ı ve giriş yapan kullanıcı bilgilerini al
    let token = '';
    let loggedInUser: any = null;
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      loggedInUser = JSON.parse(userStr);
      token = loggedInUser.token || '';
    }

    // API'ye istek gönder - tüm kullanıcıları getirir
    this.http
      .get<any>('./server/api/ogrenciler_listesi.php', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            // API yanıtından gelen veriyi al
            const users = Array.isArray(response.data) ? response.data : [];

            // Giriş yapan öğretmenin adi_soyadi'sını al
            const loggedInTeacherName = loggedInUser?.adi_soyadi || '';

            // Kullanıcıları rütbelerine göre filtrele - sadece giriş yapan öğretmenin öğrencilerini getir
            this.students = users.filter(
              (user: User) =>
                user.rutbe === 'ogrenci' &&
                user.ogretmeni === loggedInTeacherName
            );

            // Sadece yeni (daha önce onaylanmamış) kullanıcıları filtrele
            this.newUsers = users.filter((user: User) => user.rutbe === 'yeni');

            // console.log('Yüklenen kullanıcılar:', {
            //   students: this.students.length,
            //   newUsers: this.newUsers.length,
            // });
          } else {
            console.error('API yanıtı başarısız:', response.error);
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('API hatası:', error);
          this.isLoading = false;
        },
      });
  }

  // Arama işlemi
  onSearch(): void {
    // Sayfalamayı ilk sayfaya sıfırla
    this.currentStudentPage = 1;
    this.currentTeacherPage = 1;
    this.currentNewUserPage = 1;
    console.log('Arama yapılıyor:', this.searchQuery);
  }

  // Arama kutusunu temizle
  clearSearch(): void {
    this.searchQuery = '';
    this.onSearch();
  }

  // Filtreleme fonksiyonları
  filterItems(items: User[], query: string): User[] {
    if (!query || query.trim() === '') return items;

    const lowerCaseQuery = query.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.adi_soyadi.toLowerCase().includes(lowerCaseQuery) ||
        item.email.toLowerCase().includes(lowerCaseQuery) ||
        (item.cep_telefonu &&
          item.cep_telefonu.toLowerCase().includes(lowerCaseQuery)) ||
        (item.okulu && item.okulu.toLowerCase().includes(lowerCaseQuery)) ||
        (item.sinifi && item.sinifi.toLowerCase().includes(lowerCaseQuery)) ||
        (item.grubu && item.grubu.toLowerCase().includes(lowerCaseQuery)) ||
        (item.brans && item.brans.toLowerCase().includes(lowerCaseQuery))
    );
  }

  // Öğrenci Pagination metotları
  get filteredStudents(): User[] {
    return this.filterItems(this.students, this.searchQuery);
  }

  get totalStudentCount(): number {
    return this.filteredStudents.length;
  }

  get totalStudentPages(): number {
    return Math.ceil(this.totalStudentCount / this.itemsPerPage);
  }

  get paginatedStudents(): User[] {
    const startIndex = (this.currentStudentPage - 1) * this.itemsPerPage;
    return this.filteredStudents.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  setStudentPage(page: number): void {
    if (page < 1 || page > this.totalStudentPages) return;
    this.currentStudentPage = page;
  }

  getStudentPageArray(): number[] {
    return this.generatePageArray(
      this.currentStudentPage,
      this.totalStudentPages
    );
  }

  // Yeni Kullanıcı Pagination metotları
  get filteredNewUsers(): User[] {
    return this.filterItems(this.newUsers, this.searchQuery);
  }

  get totalNewUserCount(): number {
    return this.filteredNewUsers.length;
  }

  get totalNewUserPages(): number {
    return Math.ceil(this.totalNewUserCount / this.itemsPerPage);
  }

  get paginatedNewUsers(): User[] {
    const startIndex = (this.currentNewUserPage - 1) * this.itemsPerPage;
    return this.filteredNewUsers.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );
  }

  setNewUserPage(page: number): void {
    if (page < 1 || page > this.totalNewUserPages) return;
    this.currentNewUserPage = page;
  }

  getNewUserPageArray(): number[] {
    return this.generatePageArray(
      this.currentNewUserPage,
      this.totalNewUserPages
    );
  }

  // Sayfa numaralarını oluşturmak için yardımcı fonksiyon
  private generatePageArray(currentPage: number, totalPages: number): number[] {
    const pages: number[] = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) pages.push(i);
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
      }
    }

    return pages;
  }





  // Yeni kullanıcıyı onaylama
  approveUser(userId: number) {
    if (!confirm('Bu kullanıcıyı onaylamak istediğinizden emin misiniz?')) {
      return;
    }

    // LocalStorage veya sessionStorage'dan token'ı al
    let token = '';
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }

    // Kullanıcı verilerini hazırla
    const userData = {
      id: userId,
      rutbe: 'ogrenci', // Onaylandığında öğrenci olarak ayarla
      aktif: 1, // Aktif hesap olarak ayarla
    };

    this.http
      .post<any>('./server/api/kullanici_guncelle.php', userData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            alert('Kullanıcı başarıyla onaylandı!');
            this.loadUsers(); // Kullanıcı listesini yeniden yükle
          } else {
            alert('Kullanıcı onaylanamadı: ' + response.error);
          }
        },
        error: (error) => {
          console.error('Onaylama hatası:', error);
          alert(
            'Onaylama işlemi sırasında bir hata oluştu: ' +
              (error.message || 'Bilinmeyen bir hata')
          );
        },
      });
  }

  // Yeni kullanıcıyı reddetme
  rejectUser(userId: number) {
    if (
      !confirm(
        'Bu kullanıcıyı reddetmek istediğinizden emin misiniz? Bu işlem kullanıcıyı silecektir.'
      )
    ) {
      return;
    }

    // LocalStorage veya sessionStorage'dan token'ı al
    let token = '';
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }

    this.http
      .post<any>(
        './server/api/ogrenci_sil.php',
        { id: userId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            alert('Kullanıcı başarıyla reddedildi ve silindi!');
            this.loadUsers(); // Kullanıcı listesini yeniden yükle
          } else {
            alert('Kullanıcı reddedilemedi: ' + response.error);
          }
        },
        error: (error) => {
          console.error('Reddetme hatası:', error);
          alert(
            'Reddetme işlemi sırasında bir hata oluştu: ' +
              (error.message || 'Bilinmeyen bir hata')
          );
        },
      });
  }

  // Tüm kullanıcıları onaylama metodu
  approveAllUsers() {
    if (
      !confirm(
        'Tüm bekleyen kullanıcıları onaylamak istediğinizden emin misiniz?'
      )
    ) {
      return;
    }

    // LocalStorage veya sessionStorage'dan token'ı al
    let token = '';
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }

    // API isteği
    this.http
      .post<any>(
        './server/api/tum_ogrencileri_onayla.php',
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            alert('Tüm kullanıcılar başarıyla onaylandı!');
            this.loadUsers(); // Kullanıcı listesini yeniden yükle
          } else {
            alert('Kullanıcılar onaylanamadı: ' + response.error);
          }
        },
        error: (error) => {
          console.error('Onaylama hatası:', error);
          alert(
            'Onaylama işlemi sırasında bir hata oluştu: ' +
              (error.message || 'Bilinmeyen bir hata')
          );
        },
      });
  }

  // Tarih formatı için yardımcı fonksiyon
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // İstatistik fonksiyonları
  getActiveStudents(): number {
    return this.students.filter((student) => student.aktif).length;
  }

  getInactiveStudents(): number {
    return this.students.filter((student) => !student.aktif).length;
  }

  getStudentsWaiting(): number {
    return this.newUsers.filter(
      (user) => user.rutbe === 'ogrenci' || user.rutbe === ''
    ).length;
  }

  getTeachersWaiting(): number {
    return this.newUsers.filter((user) => user.rutbe === 'ogretmen').length;
  }

  loadStudents(): void {
    this.isLoading = true;
    this.error = null;

    let token = '';
    let loggedInUser: any = null;
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      loggedInUser = JSON.parse(userStr);
      token = loggedInUser.token || '';
      // console.log('Öğretmen bilgileri:', {
      //   id: loggedInUser.id,
      //   name: loggedInUser.adi_soyadi,
      //   rutbe: loggedInUser.rutbe
      // });
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<any>('./server/api/ogrenciler_listesi.php', { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Sadece öğrencileri filtrele ve giriş yapan öğretmene ait olanları göster
            const loggedInTeacherName = loggedInUser?.adi_soyadi || '';

            // console.log('Tüm öğrenciler:', response.data);

            this.students = response.data.filter((student: any) => {
              const isStudent = student.rutbe === 'ogrenci';
              const belongsToTeacher = student.ogretmeni === loggedInTeacherName;

              // console.log('Öğrenci kontrolü:', {
              //   name: student.adi_soyadi,
              //   ogretmeni: student.ogretmeni,
              //   loggedInTeacher: loggedInTeacherName,
              //   isStudent: isStudent,
              //   belongsToTeacher: belongsToTeacher
              // });

              return isStudent && belongsToTeacher;
            });

            // console.log('Filtrelenmiş öğrenciler:', this.students);
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

  deleteStudent(studentId: number): void {
    if (confirm('Bu öğrenciyi silmek istediğinizden emin misiniz?')) {
      let token = '';
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        token = user.token || '';
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });

      this.http.post('./server/api/ogrenci_sil.php', { id: studentId }, { headers })
        .subscribe({
          next: (response: any) => {
            if (response.success) {
              alert('Öğrenci başarıyla silindi.');
              this.loadStudents(); // Listeyi yenile
            } else {
              alert('Öğrenci silinirken hata oluştu: ' + (response.error || response.message));
            }
          },
          error: (error) => {
            console.error('API hatası:', error);
            let errorMessage = 'Silme işlemi sırasında bir hata oluştu: ';

            if (error.error && error.error.error) {
              errorMessage += error.error.error;
            } else if (error.message) {
              errorMessage += error.message;
            } else {
              errorMessage += 'Bilinmeyen bir hata';
            }

            alert(errorMessage);
          },
        });
    }
  }

  // Avatar modal methods
  openAvatarModal(student: User): void {
    this.selectedStudent = student;
    this.showAvatarModal = true;
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeAvatarModal(): void {
    this.showAvatarModal = false;
    this.selectedStudent = null;
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  viewStudentDetails(studentId?: number): void {
    if (studentId) {
      this.router.navigate([
        '/ogretmen-sayfasi/ogretmen-ogrenci-bilgi-sayfasi',
        studentId,
      ]);
      this.closeAvatarModal();
    }
  }

  // Filter methods
  filterStudents(): void {
    // Filtreleme otomatik olarak get filteredStudents() ile yapılıyor
    this.currentStudentPage = 1; // Filtreleme sonrası ilk sayfaya dön
  }

  clearAllFilters(): void {
    this.searchTerm = '';
    this.selectedGroup = '';
    this.selectedSchool = '';
    this.selectedStatus = '';
    this.currentStudentPage = 1;
  }

  // Tracking function for ngFor performance
  trackByStudentId(index: number, student: User): number {
    return student.id;
  }

  // Default avatar generator
  getDefaultAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name || 'Student'
    )}&background=007bff&color=fff&size=128`;
  }

  // Currency formatter
  formatCurrency(amount: number | string | undefined | null): string {
    if (!amount || isNaN(Number(amount))) return '₺0';
    const numAmount = Number(amount);
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
  }

  // Message modal (placeholder for future implementation)
  openMessageModal(student: User): void {
    console.log('Opening message modal for:', student.adi_soyadi);
    // TODO: Implement message modal functionality
    alert(`Mesaj gönderme özelliği yakında eklenecek: ${student.adi_soyadi}`);
  }

  // Toggle student status
  toggleStudentStatus(student: User): void {
    const newStatus = !student.aktif;
    const actionText = newStatus ? 'aktif' : 'pasif';
    
    if (!confirm(`${student.adi_soyadi} adlı öğrenciyi ${actionText} yapmak istediğinizden emin misiniz?`)) {
      return;
    }

    let token = '';
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }

    const updateData = {
      id: student.id,
      aktif: newStatus ? 1 : 0
    };

    this.http.post<any>('./server/api/kullanici_guncelle.php', updateData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response) => {
        if (response.success) {
          student.aktif = newStatus;
          alert(`Öğrenci durumu başarıyla ${actionText} yapıldı.`);
        } else {
          alert('Durum değiştirilemedi: ' + (response.error || response.message));
        }
      },
      error: (error) => {
        console.error('Durum değiştirme hatası:', error);
        alert('Durum değiştirme sırasında bir hata oluştu: ' + (error.error?.message || error.message));
      }
    });
  }
}