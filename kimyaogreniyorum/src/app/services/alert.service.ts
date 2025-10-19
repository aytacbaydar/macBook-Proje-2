import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import Swal, { SweetAlertIcon } from 'sweetalert2';

type AlertIcon = Extract<SweetAlertIcon, 'success' | 'error' | 'warning' | 'info' | 'question'>;

export interface AlertOptions {
  title?: string;
  text: string;
  icon?: AlertIcon;
  confirmButtonText?: string;
  allowOutsideClick?: boolean;
  allowEscapeKey?: boolean;
}

export interface ConfirmOptions extends AlertOptions {
  cancelButtonText?: string;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  reverseButtons?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  constructor(private readonly toastr: ToastrService) {}

  async success(text: string, title = 'İşlem Başarılı'): Promise<void> {
    this.toastr.success(text, title, this.toastOptions);
    return Promise.resolve();
  }

  async error(text: string, title = 'Hata'): Promise<void> {
    this.toastr.error(text, title, this.toastOptions);
    return Promise.resolve();
  }

  async warning(text: string, title = 'Uyarı'): Promise<void> {
    this.toastr.warning(text, title, this.toastOptions);
    return Promise.resolve();
  }

  async info(text: string, title = 'Bilgi'): Promise<void> {
    this.toastr.info(text, title, this.toastOptions);
    return Promise.resolve();
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const result = await Swal.fire({
      title: options.title ?? 'Emin misiniz?',
      text: options.text,
      icon: options.icon ?? 'warning',
      showCancelButton: true,
      confirmButtonText: options.confirmButtonText ?? 'Evet',
      cancelButtonText: options.cancelButtonText ?? 'Hayır',
      confirmButtonColor: options.confirmButtonColor ?? '#2563eb',
      cancelButtonColor: options.cancelButtonColor ?? '#6b7280',
      reverseButtons: options.reverseButtons ?? false,
      allowOutsideClick: options.allowOutsideClick ?? false,
      allowEscapeKey: options.allowEscapeKey ?? true,
    });
    return result.isConfirmed;
  }

  private readonly toastOptions = {
    closeButton: true,
    progressBar: true,
    timeOut: 5000,
    enableHtml: false,
    tapToDismiss: true,
  } as const;
}
