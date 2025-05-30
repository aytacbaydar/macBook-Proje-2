import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-ogrenci-detay-sayfasi',
  templateUrl: './ogrenci-detay-sayfasi.component.html',
  styleUrls: ['./ogrenci-detay-sayfasi.component.scss'],
  standalone: false,
})
export class OgrenciDetaySayfasiComponent implements OnInit {
  studentId: number = 1;
  student: any = null;
  editForm!: FormGroup;
  isLoading: boolean = true;
  isSubmitting: boolean = false;
  error: string | null = null;
  success: string | null = null;
  selectedFile: File | null = null;

  // Form odaklanma durumları için
  focusedFields: { [key: string]: boolean } = {};

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initForm();

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.studentId = +id;
        this.loadStudentData();
      } else {
        this.isLoading = false;
        this.error = 'Öğrenci ID bulunamadı.';
      }
    });
  }

  initForm(): void {
    this.editForm = this.fb.group(
      {
        // Temel bilgiler
        adi_soyadi: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        cep_telefonu: [''],
        aktif: [true],
        rutbe: ['ogrenci'], // Varsayılan değer 'ogrenci'
        sifre: [''],
        sifre_tekrar: [''],

        // Eğitim bilgileri
        okulu: [''],
        sinifi: [''],
        grubu: [''],
        ders_gunu: [''],
        ders_saati: [''],
        ucret: [''],
        brans: [''], // Öğretmen branşı için eklendi

        // Veli bilgileri
        veli_adi: [''],
        veli_cep: [''],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('sifre');
    const confirmPassword = control.get('sifre_tekrar');

    if (
      password &&
      confirmPassword &&
      password.value &&
      password.value !== confirmPassword.value
    ) {
      return { passwordMismatch: true };
    }

    return null;
  }

  loadStudentData(): void {
    this.isLoading = true;
    this.error = null;

    // LocalStorage veya sessionStorage'dan token'ı al
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
      .get<any>(`./server/api/ogrenci_bilgileri.php?id=${this.studentId}`, {
        headers,
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.student = response.data;

            // Form'u doldur
            this.editForm.patchValue({
              // Temel bilgiler
              adi_soyadi: this.student.adi_soyadi || '',
              email: this.student.email || '',
              cep_telefonu: this.student.cep_telefonu || '',
              aktif: this.student.aktif === 1 || this.student.aktif === true,
              rutbe: this.student.rutbe || '', // Rütbe alanı eklendi

              // Eğitim bilgileri
              okulu: this.student.okulu || '',
              sinifi: this.student.sinifi || '',
              grubu: this.student.grubu || '',
              ders_gunu: this.student.ders_gunu || '',
              ders_saati: this.student.ders_saati || '',
              ucret: this.student.ucret || '',
              brans: this.student.brans || '',

              // Veli bilgileri
              veli_adi: this.student.veli_adi || '',
              veli_cep: this.student.veli_cep || '',
            });

            this.isLoading = false;
          } else {
            this.isLoading = false;
            this.error = response.error || 'Öğrenci bilgileri alınamadı.';
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.error =
            'Bağlantı hatası: ' +
            (error.message || 'Bilinmeyen bir hata oluştu.');
        },
      });
  }

  onFileChange(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];

      // Avatar önizleme güncelleme
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && e.target.result) {
          this.student.avatar = e.target.result;
        }
      };

      if (this.selectedFile) {
        reader.readAsDataURL(this.selectedFile);
      }
    }
  }

  onSubmit(): void {
    if (this.editForm.invalid) {
      // Form geçersizse tüm kontrolleri dokunulmuş olarak işaretle
      Object.keys(this.editForm.controls).forEach((key) => {
        const control = this.editForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.error = null;
    this.success = null;

    // LocalStorage veya sessionStorage'dan token'ı al
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

    // Önce avatar yükle (eğer varsa)
    this.uploadAvatar()
      .then((avatarUrl) => {
        // Form verilerini hazırla
        const formData = this.prepareFormData(avatarUrl);

        // API'ye gönder
        this.http
          .post<any>('./server/api/ogrenci_profil.php', formData, { headers })
          .subscribe({
            next: (response) => {
              if (response.success) {
                this.success = 'Öğrenci bilgileri başarıyla güncellendi.';
                // Güncel verileri tekrar yükle
                setTimeout(() => {
                  this.loadStudentData();
                }, 1500);
              } else {
                this.error =
                  response.error || 'Güncelleme sırasında bir hata oluştu.';
              }

              // Spinner'ı biraz daha uzun süre görünür tut
              setTimeout(() => {
                this.isSubmitting = false;
              }, 1500); // 1.5 saniye beklet
            },
            error: (error) => {
              this.isSubmitting = false;
              this.error =
                'Bağlantı hatası: ' +
                (error.message || 'Bilinmeyen bir hata oluştu.');

              // Hata durumunda da spinner'ı biraz beklet
              setTimeout(() => {
                this.isSubmitting = false;
              }, 1000); // 1 saniye beklet
            },
          });
      })
      .catch((error) => {
        this.isSubmitting = false;
        this.error = 'Avatar yükleme hatası: ' + error;
      });
  }

  uploadAvatar(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.selectedFile) {
        resolve(this.student?.avatar || '');
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

      const formData = new FormData();
      formData.append('avatar', this.selectedFile);
      formData.append('id', this.studentId.toString());

      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
      });

      this.http
        .post<any>('./server/api/ogrenci_guncelle.php', formData, { headers })
        .subscribe({
          next: (response) => {
            if (response.success && response.data && response.data.avatar) {
              resolve(response.data.avatar);
            } else {
              reject(response.error || 'Dosya yüklenemedi.');
            }
          },
          error: (error) => {
            console.error('Avatar yükleme hatası:', error);
            reject(error.message || 'Bağlantı hatası.');
          },
        });
    });
  }

  prepareFormData(avatarUrl: string): any {
    const formValues = this.editForm.value;

    const data: any = {
      id: this.studentId,
      temel_bilgiler: {
        adi_soyadi: formValues.adi_soyadi,
        email: formValues.email,
        cep_telefonu: formValues.cep_telefonu,
        aktif: formValues.aktif ? 1 : 0,
        rutbe: formValues.rutbe, // Rütbe değerini de ekledik
      },
      detay_bilgiler: {
        okulu: formValues.okulu,
        sinifi: formValues.sinifi,
        grubu: formValues.grubu,
        ders_gunu: formValues.ders_gunu,
        ders_saati: formValues.ders_saati,
        ucret: formValues.ucret,
        brans: formValues.brans,
        veli_adi: formValues.veli_adi,
        veli_cep: formValues.veli_cep,
      },
    };

    // Avatar ekle (eğer güncellendiyse)
    if (avatarUrl) {
      data.temel_bilgiler.avatar = avatarUrl;
    }

    // Şifre ekle (eğer değiştirildiyse)
    if (formValues.sifre) {
      data.temel_bilgiler.sifre = formValues.sifre;
    }

    return data;
  }

  navigateBack(): void {
    this.router.navigate(['/yonetici-sayfasi/ogrenci-liste-sayfasi']);
  }

  // Form alanları için odaklanma yönetimi
  onFocus(fieldName: string): void {
    this.focusedFields[fieldName] = true;
  }

  onBlur(fieldName: string): void {
    this.focusedFields[fieldName] = false;
  }

  isFocused(fieldName: string): boolean {
    return this.focusedFields[fieldName] === true;
  }

  isRaised(fieldName: string): boolean {
    const control = this.editForm.get(fieldName);
    return (
      this.focusedFields[fieldName] === true ||
      (control?.value !== '' &&
        control?.value !== null &&
        control?.value !== undefined)
    );
  }

  isInvalid(fieldName: string): boolean {
    const control = this.editForm.get(fieldName);
    return (control?.invalid && control?.touched) ?? false;
  }
}