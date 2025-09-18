
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { MobileAppDownloadAlertComponent } from './components/mobile-app-download-alert/mobile-app-download-alert.component';
import { ApkInstallationGuideComponent } from './components/apk-installation-guide/apk-installation-guide.component';
import { IosPwaInstallModalComponent } from './components/ios-pwa-install-modal/ios-pwa-install-modal.component';

@NgModule({
  declarations: [
    ConfirmDialogComponent,
    MobileAppDownloadAlertComponent,
    ApkInstallationGuideComponent,
    IosPwaInstallModalComponent
  ],
  imports: [
    CommonModule,
    BrowserAnimationsModule
  ],
  exports: [
    ConfirmDialogComponent,
    MobileAppDownloadAlertComponent,
    ApkInstallationGuideComponent,
    IosPwaInstallModalComponent
  ]
})
export class SharedModule { }
