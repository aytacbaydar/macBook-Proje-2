import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';

import { DovmeRandevuSayfasiComponent } from './dovme-randevu-sayfasi.component';

describe('DovmeRandevuSayfasiComponent', () => {
  let component: DovmeRandevuSayfasiComponent;
  let fixture: ComponentFixture<DovmeRandevuSayfasiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DovmeRandevuSayfasiComponent ],
      imports: [ ReactiveFormsModule ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DovmeRandevuSayfasiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty values', () => {
    expect(component.randevuForm.get('ad')?.value).toBe('');
    expect(component.randevuForm.get('soyad')?.value).toBe('');
    expect(component.randevuForm.get('telefon')?.value).toBe('');
    expect(component.randevuForm.get('email')?.value).toBe('');
  });

  it('should validate required fields', () => {
    const form = component.randevuForm;
    
    expect(form.get('ad')?.invalid).toBeTruthy();
    expect(form.get('soyad')?.invalid).toBeTruthy();
    expect(form.get('telefon')?.invalid).toBeTruthy();
    expect(form.get('email')?.invalid).toBeTruthy();
    expect(form.get('tarih')?.invalid).toBeTruthy();
    expect(form.get('saat')?.invalid).toBeTruthy();
    expect(form.get('dovmeTuru')?.invalid).toBeTruthy();
    expect(form.get('aciklama')?.invalid).toBeTruthy();
  });

  it('should validate email format', () => {
    const emailControl = component.randevuForm.get('email');
    
    emailControl?.setValue('invalid-email');
    expect(emailControl?.invalid).toBeTruthy();
    
    emailControl?.setValue('valid@email.com');
    expect(emailControl?.valid).toBeTruthy();
  });

  it('should validate phone number format', () => {
    const phoneControl = component.randevuForm.get('telefon');
    
    phoneControl?.setValue('123');
    expect(phoneControl?.invalid).toBeTruthy();
    
    phoneControl?.setValue('5551234567');
    expect(phoneControl?.valid).toBeTruthy();
  });
});