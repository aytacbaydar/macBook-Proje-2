import { Component } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-index-iletisim-sayfasi',
  standalone: false,
  templateUrl: './index-iletisim-sayfasi.component.html',
  styleUrl: './index-iletisim-sayfasi.component.scss'
})
export class IndexIletisimSayfasiComponent {
  contactForm: FormGroup;
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';
  private apiBaseUrl = './server/api';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    this.contactForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      subject: [''],
      message: ['', [Validators.required, Validators.minLength(10)]],
      phone: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  

  onSubmit() {
    if (this.contactForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';

    const formData = new FormData();

    // Form verilerini ekle
    const formValues = this.contactForm.value;
    
    // Genel bir öğrenci ID'si kullanacağız (admin mesajı olarak)
    formData.append('ogrenci_id', '1'); // Genel mesajlar için
    formData.append('gonderen_adi', formValues.firstName + ' ' + formValues.lastName);
    formData.append('gonderen_email', this.contactForm.get('email')?.value || '');
    formData.append('telefon', this.contactForm.get('phone')?.value || '');
    formData.append('konu', this.contactForm.get('subject')?.value || '');
    formData.append('mesaj_metni', formValues.message);

    // API'ye gönder
    this.http.post<any>(`${this.apiBaseUrl}/iletisim_mesajlari.php`, formData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Mesajınız başarıyla gönderildi. En kısa sürede size dönüş yapacağız.';
            this.contactForm.reset();
          } else {
            this.errorMessage = response.error || 'Mesaj gönderilirken bir hata oluştu.';
          }
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Contact form error:', error);
          this.errorMessage = 'Mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.';
          this.isSubmitting = false;
        }
      });
  }

  private markFormGroupTouched() {
    Object.keys(this.contactForm.controls).forEach(key => {
      const control = this.contactForm.get(key);
      control?.markAsTouched();
    });
  }

  // Hata mesajları için yardımcı metodlar
  getFieldError(fieldName: string): string {
    const field = this.contactForm.get(fieldName);
    if (field?.touched && field?.errors) {
      if (field.errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} gereklidir.`;
      }
      if (field.errors['minlength']) {
        return `${this.getFieldDisplayName(fieldName)} en az ${field.errors['minlength'].requiredLength} karakter olmalıdır.`;
      }
      if (field.errors['email']) {
        return 'Geçerli bir e-posta adresi giriniz.';
      }
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      firstName: 'Ad',
      lastName: 'Soyad',
      email: 'E-posta',
      subject: 'Konu',
      message: 'Mesaj',
      phone: 'Telefon'
    };
    return displayNames[fieldName] || fieldName;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.contactForm.get(fieldName);
    return !!(field?.touched && field?.errors);
  }
}