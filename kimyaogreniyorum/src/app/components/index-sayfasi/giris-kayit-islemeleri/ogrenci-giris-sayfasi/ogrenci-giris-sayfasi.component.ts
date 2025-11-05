import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { NgxSpinnerService } from 'ngx-spinner';

interface Teacher {
  id: number;
  adi_soyadi: string;
  email: string;
  brans: string;
  katogori: string;
  aktif: boolean;
}

@Component({
  selector: 'app-ogrenci-giris-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-giris-sayfasi.component.html',
  styleUrl: './ogrenci-giris-sayfasi.component.scss',
})
export class OgrenciGirisSayfasiComponent implements OnInit {
  loginForm!: FormGroup;
  showPassword: boolean = false;
  submitted: boolean = false;
  isSubmitting: boolean = false;

  showToast: boolean = false;
  toastTitle: string = '';
  toastMessage: string = '';
  toastType: string = 'success'; // 'success' | 'error'

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private toastr: ToastrService,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      sifre: ['', [Validators.required]],
      remember: [false],
    });

    // Sayfa yüklendiğinde kaydedilmiş kullanıcı bilgilerini kontrol et
    this.checkRememberedUser();
  }

  checkRememberedUser(): void {
    const rememberedUser = localStorage.getItem('rememberedUser');
    if (rememberedUser) {
      try {
        const userData = JSON.parse(rememberedUser);
        this.loginForm.patchValue({
          email: userData.email,
          remember: true
        });
      } catch (error) {
        console.error('Kaydedilmiş kullanıcı verisi okunamadı:', error);
        localStorage.removeItem('rememberedUser');
      }
    }
  }

  // Getter for easy form field access
  get f() {
    return this.loginForm.controls;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.submitted = true;

    // Stop if form is invalid
    if (this.loginForm.invalid) {
      return;
    }

    this.isSubmitting = true;

    // Prepare login data
    const loginData = {
      email: this.loginForm.value.email,
      sifre: this.loginForm.value.sifre,
    };

    // Send to server
    this.http
      .post<any>('./server/api/ogrenci_girisi.php', loginData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Show success message
            // Swal.fire('Başarılı!', 'Giriş başarılı. Yönlendiriliyorsunuz...', 'success');
            this.toastr.success('Giriş başarılı. Yönlendiriliyorsunuz...', '', {
              timeOut: 3000,
              progressBar: true,
              closeButton: true,
            });
            this.spinner.show();

            // Store user info in localStorage if remember me is checked
            const userData = response.data || response;
            console.log('Storing user data:', userData);
            console.log('Token in response:', userData.token);

            // Token kontrolü
            if (!userData.token || userData.token.trim() === '') {
              console.error('Token bulunamadı veya boş!', userData);
              this.toastr.error('Giriş sırasında geçerli token alınamadı!', 'Hata');
              this.spinner.hide();
              return;
            }

            // Veriyi kaydet
            const storageData = {
              ...userData,
              loginTime: new Date().toISOString() // Giriş zamanını da kaydet
            };

            if (this.loginForm.value.remember) {
              // Beni hatırla işaretliyse hem oturum hem de hatırlanacak bilgileri kaydet
              localStorage.setItem('user', JSON.stringify(storageData));
              localStorage.setItem('rememberedUser', JSON.stringify({
                email: this.loginForm.value.email,
                rememberMe: true
              }));
              console.log('User data saved to localStorage with token:', userData.token.substring(0, 10) + '...');
              console.log('User credentials remembered for next login');
            } else {
              // Beni hatırla işaretli değilse sessionStorage kullan ve hatırlanan bilgileri temizle
              sessionStorage.setItem('user', JSON.stringify(storageData));
              localStorage.removeItem('rememberedUser');
              console.log('User data saved to sessionStorage with token:', userData.token.substring(0, 10) + '...');
            }

            // Hemen test et
            const testUser = localStorage.getItem('user') || sessionStorage.getItem('user');
            if (testUser) {
              const parsedTest = JSON.parse(testUser);
              console.log('Verification - Token saved correctly:', !!parsedTest.token);
            }

            // Navigate to appropriate page based on user role
            setTimeout(() => {
              console.log('Response data:', response.data);
              const rutbe = response.data?.rutbe || response.rutbe;
              console.log('User rutbe:', rutbe);

              if (rutbe === 'admin') {
                this.router.navigate(['/yonetici-sayfasi']);
              } else if (rutbe === 'ogretmen') {
                this.router.navigate(['/ogretmen-sayfasi']);
              } else if (rutbe === 'ogrenci') {
                this.router.navigate(['/yonetici-sayfasi']);
              } else {
                console.log('Rutbe tanımsız veya bilinmeyen, onay sayfasına yönlendiriliyor');
                this.router.navigate(['/onay-sayfasi']);
              }
              this.spinner.hide();
            }, 1500);
          } else {
            this.toastr.error('Hata', response.error || 'Giriş başarısız', {
              timeOut: 3000,
              progressBar: true,
              closeButton: true,
            });
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

          this.toastr.error('Hata', errorMsg, {
            timeOut: 3000,
            progressBar: true,
            closeButton: true,
          });
          this.isSubmitting = false;
        },
      });
  }

  navigateToRegister(): void {
    this.router.navigate(['/kayit-sayfasi']);
  }

  onForgotPassword(): void {
    this.toastr.info('Şifre sıfırlama özelliği yakında eklenecektir.', 'Bilgi', {
      timeOut: 3000,
      progressBar: true,
      closeButton: true,
    });
  }
}