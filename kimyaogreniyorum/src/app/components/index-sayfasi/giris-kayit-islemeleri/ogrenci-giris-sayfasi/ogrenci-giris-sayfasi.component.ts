import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { NgxSpinnerService } from 'ngx-spinner';
import { ToastrService } from 'ngx-toastr';

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
            if (this.loginForm.value.remember) {
              localStorage.setItem('user', JSON.stringify(response.data));
            } else {
              sessionStorage.setItem('user', JSON.stringify(response.data));
            }

            // Navigate to appropriate page based on user role
            setTimeout(() => {
              const rutbe = response.data.rutbe;

              if (rutbe === 'admin') {
                this.router.navigate(['/yonetici-sayfasi']);
              } else if (rutbe === 'ogretmen') {
                this.router.navigate(['/ogretmen-sayfasi']);
              } else if (rutbe === 'ogrenci') {
                this.router.navigate(['/ogrenci-sayfasi']);
              } else {
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
}
