import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

interface DovmeTuru {
  name: string;
  unitPrice: number;
}

@Component({
  selector: 'app-dovme-randevu-sayfasi',
  templateUrl: './dovme-randevu-sayfasi.component.html',
  styleUrls: ['./dovme-randevu-sayfasi.component.scss'],
  standalone: false
})
export class DovmeRandevuSayfasiComponent implements OnInit {
  randevuForm!: FormGroup;
  isSubmitting = false;
  minDate: string = new Date().toISOString().split('T')[0];

  dovmeTurleri: DovmeTuru[] = [
    { name: 'Portre Dövme', unitPrice: 600 },
    { name: 'Tribal Dövme', unitPrice: 450 },
    { name: 'Kapatma Dövmesi', unitPrice: 300 }
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.randevuForm = this.fb.group({
      ad: ['', Validators.required],
      soyad: ['', Validators.required],
      telefon: ['', [Validators.required, Validators.pattern('^[0-9]{10,11}$')]],
      email: ['', [Validators.required, Validators.email]],
      tarih: ['', Validators.required],
      saat: ['', Validators.required],
      dovmeTuru: ['', Validators.required],
      genislik: [1, [Validators.required, Validators.min(0.1)]],
      yukseklik: [1, [Validators.required, Validators.min(0.1)]],
      adet: [1, [Validators.required, Validators.min(1)]],
      toplamFiyat: [{ value: 0, disabled: true }],
      aciklama: ['', Validators.required],
    });

    // Herhangi bir alan değişince toplam fiyatı güncelle
    this.randevuForm.valueChanges.subscribe(() => this.hesaplaToplam());
  }

  hesaplaToplam() {
    const { dovmeTuru, genislik, yukseklik, adet } = this.randevuForm.value;
    const secilen = this.dovmeTurleri.find(t => t.name === dovmeTuru);
    if (!secilen) {
      this.randevuForm.get('toplamFiyat')?.setValue(0);
      return;
    }
    const alan = (genislik || 0) * (yukseklik || 0);
    const toplam = secilen.unitPrice * alan * (adet || 1);
    this.randevuForm.get('toplamFiyat')?.setValue(toplam);
  }

  onSubmit() {
    if (this.randevuForm.invalid) {
      this.randevuForm.markAllAsTouched();
      return;
    }

    const data = this.randevuForm.getRawValue(); // disabled alanlar dahil
    this.isSubmitting = true;

    setTimeout(() => {
      this.isSubmitting = false;
      alert('Randevunuz başarıyla oluşturuldu!\\n\\n' + JSON.stringify(data, null, 2));
      this.randevuForm.reset({
        genislik: 1,
        yukseklik: 1,
        adet: 1,
        toplamFiyat: 0
      });
    }, 1000);
  }

  isFieldInvalid(field: string): boolean {
    const c = this.randevuForm.get(field);
    return !!(c && c.invalid && c.touched);
  }

  getFieldError(field: string): string {
    const c = this.randevuForm.get(field);
    if (c?.hasError('required')) return 'Bu alan zorunludur';
    if (c?.hasError('email')) return 'Geçerli bir e-posta giriniz';
    if (c?.hasError('pattern')) return 'Geçerli bir telefon giriniz';
    return '';
  }
}
