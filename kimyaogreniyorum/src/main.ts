import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app.module';
import { AlertService } from './app/services/alert.service';

platformBrowser()
  .bootstrapModule(AppModule, {
    ngZoneEventCoalescing: true,
  })
  .then((moduleRef) => {
    const alertService = moduleRef.injector.get(AlertService);
    window.alert = (message?: any) => {
      const text =
        typeof message === 'string'
          ? message
          : message === undefined || message === null
            ? ''
            : String(message);
      void alertService.info(text || ' ');
    };
  })
  .catch((err) => console.error(err));
