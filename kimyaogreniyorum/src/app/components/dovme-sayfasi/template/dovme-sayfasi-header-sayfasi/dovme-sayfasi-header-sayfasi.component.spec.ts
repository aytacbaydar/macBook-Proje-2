import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DovmeSayfasiHeaderSayfasiComponent } from './dovme-sayfasi-header-sayfasi.component';

describe('DovmeSayfasiHeaderSayfasiComponent', () => {
  let component: DovmeSayfasiHeaderSayfasiComponent;
  let fixture: ComponentFixture<DovmeSayfasiHeaderSayfasiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DovmeSayfasiHeaderSayfasiComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DovmeSayfasiHeaderSayfasiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
