import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DovmeSayfasiIndexSayfasiComponent } from './dovme-sayfasi-index-sayfasi.component';

describe('DovmeSayfasiIndexSayfasiComponent', () => {
  let component: DovmeSayfasiIndexSayfasiComponent;
  let fixture: ComponentFixture<DovmeSayfasiIndexSayfasiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DovmeSayfasiIndexSayfasiComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DovmeSayfasiIndexSayfasiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
