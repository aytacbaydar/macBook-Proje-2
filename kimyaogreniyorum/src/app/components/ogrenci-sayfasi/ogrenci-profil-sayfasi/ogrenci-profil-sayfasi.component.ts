
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-ogrenci-profil-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-profil-sayfasi.component.html',
  styleUrl: './ogrenci-profil-sayfasi.component.scss',
})
export class OgrenciProfilSayfasiComponent implements OnInit {
  student: any = {
    id: '',
    adi_soyadi: '',
    email: '',
    cep_telefonu: '',
    rutbe: '',
    aktif: true,
    avatar: '',
    okulu: '',
    sinifi: '',
    grubu: '',
    ders_adi: '',
    ders_gunu: '',
    ders_saati: '',
    ucret: '',
    brans: '',
    veli_adi: '',
    veli_cep: '',
  };
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
    private router: Router,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadStudentData();
  }

  initForm(): void {
    this.editForm = this.fb.group(
      {
        // Temel bilgiler
        adi_soyadi: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        cep_telefonu: [''],
        sifre: [''],
        sifre_tekrar: [''],

        // Eğitim bilgileri
        okulu: [''],
        sinifi: [''],

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
      .post<any>('./server/api/ogrenci_profil.php', {}, { headers })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.student = response.data;
            console.log('Öğrenci verileri:', this.student);

            // Form'u doldur
            this.editForm.patchValue({
              // Temel bilgiler
              adi_soyadi: this.student.adi_soyadi || '',
              email: this.student.email || '',
              cep_telefonu: this.student.cep_telefonu || '',

              // Eğitim bilgileri
              okulu: this.student.okulu || '',
              sinifi: this.student.sinifi || '',

              // Veli bilgileri
              veli_adi: this.student.veli_adi || '',
              veli_cep: this.student.veli_cep || '',
            });

            this.isLoading = false;
          } else {
            this.isLoading = false;
            this.error = response.message || 'Profil bilgileri alınamadı.';
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

    // Önce avatar yükle (varsa)
    this.uploadAvatar()
      .then((avatarPath) => {
        // Form verilerini hazırla
        const formData = this.prepareFormData(avatarPath);

        // Token'ı al
        let token = '';
        const userStr =
          localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          token = user.token || '';
        }

        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        });

        // Güncelleme isteği gönder
        this.http
          .post('./server/api/ogrenci_profil.php', formData, { headers })
          .subscribe({
            next: (response: any) => {
              if (response.success) {
                this.toastr.success('Profil bilgileriniz başarıyla güncellendi!','Başarılı');
                this.success = 'Profil bilgileriniz başarıyla güncellendi!';
                this.student = { ...this.student, ...response.data };

                // localStorage'daki user bilgilerini güncelle
                const userStr =
                  localStorage.getItem('user') ||
                  sessionStorage.getItem('user');
                if (userStr) {
                  const user = JSON.parse(userStr);
                  user.adi_soyadi = response.data.adi_soyadi;
                  user.email = response.data.email;
                  user.cep_telefonu = response.data.cep_telefonu;
                  if (response.data.avatar) {
                    user.avatar = response.data.avatar;
                  }

                  if (localStorage.getItem('user')) {
                    localStorage.setItem('user', JSON.stringify(user));
                  } else {
                    sessionStorage.setItem('user', JSON.stringify(user));
                  }
                }

                // Başarı mesajını 3 saniye göster
                setTimeout(() => {
                  this.success = null;
                }, 3000);
              } else {
                this.error =
                  response.message || 'Güncelleme sırasında hata oluştu.';
              }
              this.isSubmitting = false;
            },
            error: (error) => {
              this.error =
                'Bağlantı hatası: ' +
                (error.error?.message ||
                  error.message ||
                  'Bilinmeyen bir hata oluştu.');

              this.isSubmitting = false;
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
      // Öğrenci kendi ID'sini kullanır
      formData.append('id', this.student.id.toString());

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
      temel_bilgiler: {
        adi_soyadi: formValues.adi_soyadi,
        email: formValues.email,
        cep_telefonu: formValues.cep_telefonu,
      },
      detay_bilgiler: {
        okulu: formValues.okulu,
        sinifi: formValues.sinifi,
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
    this.router.navigate(['/ogrenci-sayfasi']);
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
