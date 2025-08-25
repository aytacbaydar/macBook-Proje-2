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

  // Variables for the new PDF upload logic
  selectedPdf: File | null = null;
  pdfFileName: string = '';
  showForm: boolean = false;
  newOdev: Odev = { // Renamed from currentOdev for clarity in new logic, but keeping currentOdev for existing structure
    grup: '',
    konu: '',
    baslangic_tarihi: '',
    bitis_tarihi: '',
    aciklama: '',
    ogretmen_id: 0,
    ogretmen_adi: '',
    pdf_dosyasi: ''
  };
  currentUser: any = null; // Assuming this holds current logged-in user info

  private modal: any;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadTeacherInfo();
    this.loadGruplar();
    this.loadOdevler();
    this.loadCurrentUser(); // Load current user info
  }

  loadCurrentUser(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        this.currentUser = JSON.parse(userStr);
      } catch (error) {
        console.error('Current user info not loaded:', error);
      }
    }
  }


  loadTeacherInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        this.teacherInfo = JSON.parse(userStr);
        this.currentOdev.ogretmen_id = this.teacherInfo.id;
        this.currentOdev.ogretmen_adi = this.teacherInfo.adi_soyadi;
        this.newOdev.ogretmen_id = this.teacherInfo.id; // Also set for newOdev
        this.newOdev.ogretmen_adi = this.teacherInfo.adi_soyadi; // Also set for newOdev
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
    this.editingOdev = true; // Set editingOdev to true to indicate edit mode
    this.currentOdev = { ...odev }; // Copy the odev to currentOdev for display in the form
    this.newOdev = { ...odev }; // Copy the odev to newOdev for form binding

    // Eğer ödevde PDF varsa, dosya adını ayarla
    if (odev.pdf_dosyasi) {
      this.pdfFileName = odev.pdf_dosyasi;
    } else {
      this.pdfFileName = '';
      this.selectedPdf = null;
    }

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
    this.currentOdev = { // Reset currentOdev as well if it's used directly in the form
      grup: '',
      konu: '',
      baslangic_tarihi: '',
      bitis_tarihi: '',
      aciklama: '',
      ogretmen_id: this.teacherInfo?.id || 0,
      ogretmen_adi: this.teacherInfo?.adi_soyadi || ''
    };
    this.newOdev = {
      grup: '',
      konu: '',
      baslangic_tarihi: '',
      bitis_tarihi: '',
      aciklama: '',
      pdf_dosyasi: ''
    };
    this.editingOdev = false; // Reset editingOdev flag
    this.showForm = false;
    this.selectedPdf = null;
    this.pdfFileName = '';

    // File input'u temizle
    const fileInput = document.getElementById('pdfFile') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
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
      this.newOdev.grup && // Use newOdev for validation
      this.newOdev.konu &&
      this.newOdev.baslangic_tarihi &&
      this.newOdev.bitis_tarihi
    );
  }

  saveOdev(): void {
    if (!this.isFormValid()) {
      this.toastr.error('Lütfen zorunlu alanları doldurunuz', 'Hata');
      return;
    }

    if (new Date(this.newOdev.bitis_tarihi) <= new Date(this.newOdev.baslangic_tarihi)) {
      this.toastr.error('Bitiş tarihi başlangıç tarihinden sonra olmalıdır', 'Hata');
      return;
    }

    this.isUploading = true;

    if (this.selectedPdf) { // Check if a new PDF is selected
      this.uploadPdfAndSaveOdev();
    } else if (this.editingOdev && this.newOdev.pdf_dosyasi) {
      // If editing and no new PDF is selected, but an existing PDF is present, save with existing PDF name
      this.saveOdevData();
    }
     else {
      // If no PDF is selected or uploaded, and not editing an existing odev with a PDF
      this.saveOdevData();
    }
  }

  // This method handles both PDF upload and then saving Odev data
  private uploadPdfAndSaveOdev(): void {
    const formData = new FormData();
    formData.append('pdf', this.selectedPdf!);
    // Ensure correct teacher_id is used, preferably from the loaded teacherInfo or currentUser
    formData.append('ogretmen_id', this.teacherInfo?.id.toString() || this.currentUser?.id.toString() || '0');

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
            // PDF successfully uploaded, assign the filename to newOdev
            this.newOdev.pdf_dosyasi = event.body.filename;
            this.pdfFileName = event.body.filename; // Update component's pdfFileName
            this.saveOdevData(); // Now save the Odev data with the new PDF filename
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

  // This method saves the Odev data without uploading a new PDF
  private saveOdevData(): void {
    const token = this.getAuthToken();
    const url = this.editingOdev ? '/server/api/odev_guncelle.php' : '/server/api/odev_ekle.php';

    // Ensure pdf_dosyasi is correctly set in newOdev before sending
    // If editing and no new PDF, pdf_dosyasi should retain its original value from editOdev
    // If creating and new PDF was uploaded, it's set in uploadPdfAndSaveOdev
    // If creating and no PDF, it remains undefined/empty string

    const odevDataToSend = {
      ...this.newOdev,
      // Ensure teacher_id and teacher_adi are from the correct source if newOdev wasn't fully populated
      ogretmen_id: this.newOdev.ogretmen_id || this.teacherInfo?.id || this.currentUser?.id || 0,
      ogretmen_adi: this.newOdev.ogretmen_adi || this.teacherInfo?.adi_soyadi || this.currentUser?.adi_soyadi || '',
      pdf_dosyasi: this.newOdev.pdf_dosyasi // Use the pdf_dosyasi from newOdev
    };

    // If editing, ensure the ID is included
    if (this.editingOdev && this.currentOdev.id) {
      (odevDataToSend as any).id = this.currentOdev.id;
    }


    this.http.post<any>(url, odevDataToSend, {
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

  // Placeholder for uploadPdf function, assuming it exists elsewhere or needs to be implemented
  // This is a mock implementation for demonstration. Replace with actual http call.
  async uploadPdf(file: File): Promise<{ success: boolean; data?: { filename: string }; message?: string }> {
    console.log('Uploading file:', file.name);
    // Simulate an API call
    return new Promise((resolve) => {
      setTimeout(() => {
        const filename = `uploaded_${Date.now()}_${file.name}`;
        resolve({ success: true, data: { filename: filename } });
      }, 1000);
    });
  }
}