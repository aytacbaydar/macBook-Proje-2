import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { DersAnlatimTahasiComponent } from '../components/ogretmen-sayfalari/ders-anlatim-tahasi/ders-anlatim-tahasi.component';
import { AlertService } from '../services/alert.service';

@Injectable({
  providedIn: 'root',
})
export class DersAnlatimTahasiDeactivateGuard
  implements CanDeactivate<DersAnlatimTahasiComponent>
{
  constructor(private readonly alertService: AlertService) {}

  async canDeactivate(component: DersAnlatimTahasiComponent): Promise<boolean> {
    if (component.hasPendingChanges()) {
      return this.alertService.confirm({
        title: 'Siteden çıkılsın mı?',
        text: 'Yaptığınız değişiklikler kaydedilmemiş olabilir. Devam etmek istiyor musunuz?',
        icon: 'warning',
        confirmButtonText: 'Evet, ayrıl',
        cancelButtonText: 'Kal',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#2563eb',
        reverseButtons: true,
        allowOutsideClick: false,
        allowEscapeKey: true,
      });
    }
    return true;
  }
}
