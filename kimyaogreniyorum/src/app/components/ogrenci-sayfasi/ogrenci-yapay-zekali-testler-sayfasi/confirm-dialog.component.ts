
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
   standalone: false,
  template: `
    <div class="modal-overlay" *ngIf="isVisible" (click)="onCancel()">
      <div class="confirm-dialog" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <i class="icon" [ngClass]="iconClass"></i>
          <h3>{{ title }}</h3>
        </div>
        <div class="dialog-body">
          <p>{{ message }}</p>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-cancel" (click)="onCancel()">
            {{ cancelText }}
          </button>
          <button class="btn btn-confirm" [ngClass]="confirmClass" (click)="onConfirm()">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
    }

    .confirm-dialog {
      background: white;
      border-radius: 16px;
      min-width: 400px;
      max-width: 500px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.3s ease-out;
      overflow: hidden;
    }

    .dialog-header {
      padding: 24px 24px 16px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #e9ecef;

      .icon {
        font-size: 24px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }

      .warning { background: #ff9800; }
      .danger { background: #f44336; }
      .info { background: #2196f3; }
      .success { background: #4caf50; }

      h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #333;
      }
    }

    .dialog-body {
      padding: 20px 24px;

      p {
        margin: 0;
        line-height: 1.5;
        color: #666;
        font-size: 1rem;
      }
    }

    .dialog-actions {
      padding: 16px 24px 24px 24px;
      display: flex;
      gap: 12px;
      justify-content: flex-end;

      .btn {
        padding: 10px 20px;
        border-radius: 8px;
        border: none;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 80px;

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
      }

      .btn-cancel {
        background: #f8f9fa;
        color: #6c757d;
        border: 1px solid #dee2e6;

        &:hover {
          background: #e9ecef;
          color: #495057;
        }
      }

      .btn-confirm {
        color: white;

        &.danger {
          background: #dc3545;
          &:hover { background: #c82333; }
        }

        &.primary {
          background: #007bff;
          &:hover { background: #0056b3; }
        }

        &.warning {
          background: #ffc107;
          color: #212529;
          &:hover { background: #e0a800; }
        }
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideIn {
      from { 
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      to { 
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @media (max-width: 480px) {
      .confirm-dialog {
        margin: 20px;
        min-width: auto;
        width: calc(100% - 40px);
      }

      .dialog-actions {
        flex-direction: column;

        .btn {
          width: 100%;
        }
      }
    }
  `]
})
export class ConfirmDialogComponent {
  @Input() isVisible = false;
  @Input() title = 'Onay';
  @Input() message = 'Bu işlemi gerçekleştirmek istediğinizden emin misiniz?';
  @Input() confirmText = 'Evet';
  @Input() cancelText = 'Hayır';
  @Input() type: 'warning' | 'danger' | 'info' | 'success' = 'warning';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  get iconClass(): string {
    const icons = {
      warning: 'fas fa-exclamation-triangle warning',
      danger: 'fas fa-trash danger',
      info: 'fas fa-info-circle info',
      success: 'fas fa-check success'
    };
    return icons[this.type];
  }

  get confirmClass(): string {
    const classes = {
      warning: 'warning',
      danger: 'danger',
      info: 'primary',
      success: 'primary'
    };
    return classes[this.type];
  }

  onConfirm(): void {
    this.confirmed.emit();
    this.isVisible = false;
  }

  onCancel(): void {
    this.cancelled.emit();
    this.isVisible = false;
  }
}
