import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-dovme-randevu-sayfasi',
  templateUrl: './dovme-randevu-sayfasi.component.html',
  styleUrls: ['./dovme-randevu-sayfasi.component.scss'],
  standalone: false
})
export class DovmeRandevuSayfasiComponent implements OnInit {
  randevuForm: FormGroup;
  isSubmitting = false;
  minDate: string = '';

  constructor(private fb: FormBuilder) {
    this.randevuForm = this.fb.group({
      ad: ['', [Validators.required, Validators.minLength(2)]],
      soyad: ['', [Validators.required, Validators.minLength(2)]],
      telefon: ['', [Validators.required, Validators.pattern(/^[0-9]{10,11}$/)]],
      email: ['', [Validators.required, Validators.email]],
      tarih: ['', Validators.required],
      saat: ['', Validators.required],
      dovmeTuru: ['', Validators.required],
      aciklama: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit(): void {
    // Set minimum date to today (local timezone)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.minDate = `${year}-${month}-${day}`;
  }

  onSubmit(): void {
    if (this.randevuForm.valid) {
      this.isSubmitting = true;
      
      // Simulate API call
      setTimeout(() => {
        console.log('Randevu Bilgileri:', this.randevuForm.value);
        this.isSubmitting = false;
        this.randevuForm.reset();
      }, 1500);
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.randevuForm.controls).forEach(key => {
      const control = this.randevuForm.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.randevuForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.randevuForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) {
        return 'Bu alan zorunludur';
      }
      if (field.errors['minlength']) {
        return `En az ${field.errors['minlength'].requiredLength} karakter olmalıdır`;
      }
      if (field.errors['email']) {
        return 'Geçerli bir email adresi giriniz';
      }
      if (field.errors['pattern']) {
        return 'Geçerli bir telefon numarası giriniz';
      }
    }
    return '';
  }
}