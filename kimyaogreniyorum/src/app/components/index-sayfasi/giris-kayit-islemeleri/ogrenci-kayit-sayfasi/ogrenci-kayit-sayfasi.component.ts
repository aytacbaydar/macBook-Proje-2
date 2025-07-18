import { Component, ElementRef, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

interface Teacher {
  id: number;
  ogrt_adi_soyadi: string;
  email: string;
  brans: string;
  aktif: boolean;
}

@Component({
  selector: 'app-ogrenci-kayit-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-kayit-sayfasi.component.html',
  styleUrl: './ogrenci-kayit-sayfasi.component.scss',
})
export class OgrenciKayitSayfasiComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;

  registrationForm!: FormGroup;
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  isDragActive: boolean = false;
  showPassword: boolean = false;
  submitted: boolean = false;
  isSubmitting: boolean = false;
  avatarError: string = '';
  teachers: Teacher[] = [];
  isLoadingTeachers: boolean = false;

  showToast: boolean = false;
  toastTitle: string = '';
  toastMessage: string = '';
  toastType: string = 'success'; // 'success' | 'error'

  passwordStrength = {
    score: 0,
    label: 'Çok Zayıf',
    cssClass: '',
  };
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private toast: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}
  ngOnInit(): void {
    this.registrationForm = this.fb.group({
      adi_soyadi: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      cep_telefonu: [''],
      sifre: ['', [Validators.required, Validators.minLength(6)]],
      rutbe: ['yeni'],
      aktiflik_durumu: [false],
      ogretmeni: ['', [Validators.required]],
    });
    // Listen to password changes for strength calculation
    this.registrationForm.get('sifre')?.valueChanges.subscribe((password) => {
      if (password) {
        this.calculatePasswordStrength(password);
      } else {
        this.resetPasswordStrength();
      }
    });
    // Öğretmenleri yükle
    this.loadTeachers();
  }
  // Getter for easy form field access
  get f() {
    return this.registrationForm.controls;
  }
  onFileChange(event: any): void {
    if (event.target.files && event.target.files.length) {
      const file = event.target.files[0];
      this.handleFileSelect(file);
    }
  }
  handleDrag(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.isDragActive = event.type === 'dragenter' || event.type === 'dragover';
  }
  trackByTeacherId(index: number, teacher: any): any {
    return teacher.id || teacher.adi_soyadi;
  }
  handleDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragActive = false;

    if (event.dataTransfer && event.dataTransfer.files.length) {
      const file = event.dataTransfer.files[0];
      this.handleFileSelect(file);
    }
  }
  handleFileSelect(file: File): void {
    // Reset error
    this.avatarError = '';

    // Validate file
    if (!this.isValidImage(file)) {
      this.avatarError =
        'Lütfen geçerli bir resim dosyası seçin (JPEG, PNG, GIF, WEBP)';
      return;
    }

    if (!this.isValidFileSize(file)) {
      this.avatarError = "Dosya boyutu 5MB'den küçük olmalıdır";
      return;
    }

    this.selectedFile = file;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.previewUrl = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  isValidImage(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
  }

  isValidFileSize(file: File): boolean {
    return file.size <= 5 * 1024 * 1024; // 5MB
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  calculatePasswordStrength(password: string): void {
    let score = 0;

    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;

    // Complexity checks
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    // Determine label and styling based on score
    let label = 'Çok Zayıf';
    let cssClass = '';

    if (score >= 5) {
      label = 'Çok Güçlü';
      cssClass = 'very-strong';
    } else if (score === 4) {
      label = 'Güçlü';
      cssClass = 'strong';
    } else if (score === 3) {
      label = 'Orta';
      cssClass = 'medium';
    } else if (score === 2) {
      label = 'Zayıf';
      cssClass = 'weak';
    }

    this.passwordStrength = { score, label, cssClass };
  }

  resetPasswordStrength(): void {
    this.passwordStrength = {
      score: 0,
      label: 'Çok Zayıf',
      cssClass: '',
    };
  }

  loadTeachers(): void {
    console.log('Öğretmenler yükleniyor...');
    this.http.get<any>('./server/api/ogretmenler_listesi.php').subscribe({
      next: (response) => {
        
        if (response.success) {
          this.teachers = response.data || [];
          // Manually trigger change detection
          this.cdr.detectChanges();
        } else {
          this.toast.error(
            'Hata',
            response.message || 'Öğretmenler yüklenemedi',
            {
              timeOut: 3000,
              progressBar: true,
              closeButton: true,
            }
          );
        }
      },
      error: (error) => {
        console.error('Öğretmenler yüklenirken hata:', error);
        this.toast.error(
          'Hata',
          error.message || 'Öğretmenler yüklenirken hata oluştu',
          {
            timeOut: 3000,
            progressBar: true,
            closeButton: true,
          }
        );
      },
    });
  }

  onSubmit(): void {
    this.submitted = true;

    // Stop if form is invalid
    if (this.registrationForm.invalid) {
      return;
    }

    if (!this.selectedFile) {
      this.avatarError = 'Lütfen bir profil fotoğrafı seçin';
      return;
    }

    this.isSubmitting = true;

    // Prepare form data
    const formData = new FormData();
    Object.keys(this.registrationForm.value).forEach((key) => {
      formData.append(key, this.registrationForm.value[key]);
    });

    // Add avatar file
    formData.append('avatar', this.selectedFile);

    formData.append('ogretmeni', this.registrationForm.get('ogretmeni')?.value);

    // Send to server
    this.http.post<any>('./server/api/ogrenci_kayit.php', formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.toast.success(
            'Başarılı',
            response.message || 'Öğrenci kaydınız başarıyla alındı!',
            {
              timeOut: 3000,
              progressBar: true,
              closeButton: true,
            }
          );
          this.isSubmitting = false;

          // Navigate to confirmation after delay
          setTimeout(() => {
            this.router.navigate(['/onay-sayfasi']);
          }, 1500);
        } else {
          this.toast.error(
            'Hata',
            response.message || 'Kayıt işlemi başarısız oldu',
            {
              timeOut: 3000,
              progressBar: true,
              closeButton: true,
            }
          );
          this.isSubmitting = false;
        }
      },
      error: (error) => {
        let errorMsg = 'Beklenmeyen bir hata oluştu';

        if (error.error && error.error.error) {
          errorMsg = error.error.error;
        } else if (error.message) {
          errorMsg = error.message;
        }

        this.toast.error('Hata', errorMsg, {
          timeOut: 3000,
          progressBar: true,
          closeButton: true,
        });
        this.isSubmitting = false;
      },
      complete: () => {
        // İşlem tamamlandığında
      },
    });
  }

  navigateToLogin(): void {
    this.router.navigate(['/giris-sayfasi']);
  }
}