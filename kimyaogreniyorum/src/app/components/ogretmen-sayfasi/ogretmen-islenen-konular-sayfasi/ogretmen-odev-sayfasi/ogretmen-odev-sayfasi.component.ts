
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

declare var bootstrap: any;

interface Odev {
  id?: number;
  grup: string;
  konu: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  aciklama?: string;
  pdf_dosyasi?: string;
  ogretmen_id: number;
  ogretmen_adi: string;
  olusturma_tarihi?: string;
}

@Component({
  selector: 'app-ogretmen-odev-sayfasi',
  templateUrl: './ogretmen-odev-sayfasi.component.html',
  styleUrls: ['./ogretmen-odev-sayfasi.component.scss'],
  standalone: false,
})
export class OgretmenOdevSayfasiComponent implements OnInit {
  odevler: Odev[] = [];
  gruplar: string[] = [];
  teacherInfo: any = null;
  
  currentOdev: Odev = {
    grup: '',
    konu: '',
    baslangic_tarihi: '',
    bitis_tarihi: '',
    aciklama: '',
    ogretmen_id: 0,
    ogretmen_adi: ''
  };

  editingOdev: boolean = false;
  selectedFile: File | null = null;
  uploadProgress: number = 0;
  isUploading: boolean = false;

  private modal: any;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadTeacherInfo();
    this.loadGruplar();
    this.loadOdevler();
  }

  loadTeacherInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        this.teacherInfo = JSON.parse(userStr);
        this.currentOdev.ogretmen_id = this.teacherInfo.id;
        this.currentOdev.ogretmen_adi = this.teacherInfo.adi_soyadi;
      } catch (error) {
        console.error('Öğretmen bilgileri yüklenemedi:', error);
      }
    }
  }

  loadGruplar(): void {
    const token = this.getAuthToken();
    this.http.get<any>('/server/api/ogrenciler_listesi.php', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        if (response?.success && response.data) {
          const teacherName = this.teacherInfo?.adi_soyadi || '';
          const teacherStudents = response.data.filter(
            (student: any) => student.rutbe === 'ogrenci' && student.ogretmeni === teacherName
          );

          const groups = new Set<string>();
          teacherStudents.forEach((student: any) => {
            if (student.grubu && student.grubu.trim() !== '') {
              groups.add(student.grubu);
            }
          });

          this.gruplar = Array.from(groups).sort();
        }
      },
      error: (error) => {
        console.error('Gruplar yüklenemedi:', error);
        this.toastr.error('Gruplar yüklenirken hata oluştu', 'Hata');
      }
    });
  }

  loadOdevler(): void {
    const token = this.getAuthToken();
    this.http.get<any>(`/server/api/odev_listesi.php?ogretmen_id=${this.teacherInfo?.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        if (response?.success) {
          this.odevler = response.data || [];
        }
      },
      error: (error) => {
        console.error('Ödevler yüklenemedi:', error);
        this.toastr.error('Ödevler yüklenirken hata oluştu', 'Hata');
      }
    });
  }

  openOdevModal(): void {
    this.editingOdev = false;
    this.resetForm();
    this.showModal();
  }

  editOdev(odev: Odev): void {
    this.editingOdev = true;
    this.currentOdev = { ...odev };
    this.showModal();
  }

  private showModal(): void {
    const modalElement = document.getElementById('odevModal');
    if (modalElement) {
      this.modal = new bootstrap.Modal(modalElement);
      this.modal.show();
    }
  }

  private hideModal(): void {
    if (this.modal) {
      this.modal.hide();
    }
  }

  resetForm(): void {
    this.currentOdev = {
      grup: '',
      konu: '',
      baslangic_tarihi: '',
      bitis_tarihi: '',
      aciklama: '',
      ogretmen_id: this.teacherInfo?.id || 0,
      ogretmen_adi: this.teacherInfo?.adi_soyadi || ''
    };
    this.selectedFile = null;
    this.uploadProgress = 0;
    this.isUploading = false;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        this.toastr.error('Lütfen PDF dosyası seçiniz', 'Hata');
        return;
      }

      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        this.toastr.error('Dosya boyutu 50MB\'dan büyük olamaz', 'Hata');
        return;
      }

      this.selectedFile = file;
    }
  }

  clearFile(): void {
    this.selectedFile = null;
    const fileInput = document.getElementById('pdfFile') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  isFormValid(): boolean {
    return !!(
      this.currentOdev.grup &&
      this.currentOdev.konu &&
      this.currentOdev.baslangic_tarihi &&
      this.currentOdev.bitis_tarihi
    );
  }

  saveOdev(): void {
    if (!this.isFormValid()) {
      this.toastr.error('Lütfen zorunlu alanları doldurunuz', 'Hata');
      return;
    }

    if (new Date(this.currentOdev.bitis_tarihi) <= new Date(this.currentOdev.baslangic_tarihi)) {
      this.toastr.error('Bitiş tarihi başlangıç tarihinden sonra olmalıdır', 'Hata');
      return;
    }

    this.isUploading = true;

    if (this.selectedFile) {
      this.uploadPdfAndSaveOdev();
    } else {
      this.saveOdevData();
    }
  }

  private uploadPdfAndSaveOdev(): void {
    const formData = new FormData();
    formData.append('pdf', this.selectedFile!);
    formData.append('ogretmen_id', this.currentOdev.ogretmen_id.toString());

    const token = this.getAuthToken();

    this.http.post<any>('/server/api/odev_pdf_yukle.php', formData, {
      headers: { Authorization: `Bearer ${token}` },
      reportProgress: true,
      observe: 'events'
    }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress = Math.round(100 * event.loaded / (event.total || 1));
        } else if (event.type === HttpEventType.Response) {
          if (event.body?.success) {
            this.currentOdev.pdf_dosyasi = event.body.filename;
            this.saveOdevData();
          } else {
            this.isUploading = false;
            this.toastr.error(event.body?.message || 'PDF yükleme hatası', 'Hata');
          }
        }
      },
      error: (error) => {
        this.isUploading = false;
        this.uploadProgress = 0;
        console.error('PDF yükleme hatası:', error);
        this.toastr.error('PDF yüklenirken hata oluştu', 'Hata');
      }
    });
  }

  private saveOdevData(): void {
    const token = this.getAuthToken();
    const url = this.editingOdev ? '/server/api/odev_guncelle.php' : '/server/api/odev_ekle.php';

    this.http.post<any>(url, this.currentOdev, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response) => {
        this.isUploading = false;
        if (response?.success) {
          this.toastr.success(
            this.editingOdev ? 'Ödev başarıyla güncellendi' : 'Ödev başarıyla verildi',
            'Başarılı'
          );
          this.hideModal();
          this.loadOdevler();
          this.resetForm();
        } else {
          this.toastr.error(response?.message || 'Ödev kaydedilirken hata oluştu', 'Hata');
        }
      },
      error: (error) => {
        this.isUploading = false;
        console.error('Ödev kaydetme hatası:', error);
        this.toastr.error('Ödev kaydedilirken hata oluştu', 'Hata');
      }
    });
  }

  deleteOdev(odevId: number): void {
    if (confirm('Bu ödevi silmek istediğinizden emin misiniz?')) {
      const token = this.getAuthToken();
      this.http.delete<any>(`/server/api/odev_sil.php?id=${odevId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({
        next: (response) => {
          if (response?.success) {
            this.toastr.success('Ödev başarıyla silindi', 'Başarılı');
            this.loadOdevler();
          } else {
            this.toastr.error(response?.message || 'Ödev silinemedi', 'Hata');
          }
        },
        error: (error) => {
          console.error('Ödev silme hatası:', error);
          this.toastr.error('Ödev silinirken hata oluştu', 'Hata');
        }
      });
    }
  }

  openPdf(filename: string): void {
    if (filename) {
      const pdfUrl = `/server/uploads/odevler/${filename}`;
      window.open(pdfUrl, '_blank');
    }
  }

  isOdevActive(odev: Odev): boolean {
    const today = new Date();
    const bitisDate = new Date(odev.bitis_tarihi);
    return bitisDate >= today;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  trackByOdevId(index: number, odev: Odev): any {
    return odev.id || index;
  }

  private getAuthToken(): string {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.token || '';
    }
    return '';
  }
}
