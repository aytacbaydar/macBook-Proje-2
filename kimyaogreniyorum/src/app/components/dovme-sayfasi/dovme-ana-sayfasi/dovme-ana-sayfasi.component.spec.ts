import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DovmeAnaSayfasiComponent } from './dovme-ana-sayfasi.component';

describe('DovmeAnaSayfasiComponent', () => {
  let component: DovmeAnaSayfasiComponent;
  let fixture: ComponentFixture<DovmeAnaSayfasiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DovmeAnaSayfasiComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DovmeAnaSayfasiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
