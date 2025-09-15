import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DovmeSayfasiNavbarSayfasiComponent } from './dovme-sayfasi-navbar-sayfasi.component';

describe('DovmeSayfasiNavbarSayfasiComponent', () => {
  let component: DovmeSayfasiNavbarSayfasiComponent;
  let fixture: ComponentFixture<DovmeSayfasiNavbarSayfasiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DovmeSayfasiNavbarSayfasiComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DovmeSayfasiNavbarSayfasiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
