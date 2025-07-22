import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: false,
  template: `
    <div class="confirm-dialog">
      <div class="confirm-dialog-content">
        <h2 mat-dialog-title>{{ title }}</h2>
        <div mat-dialog-content>
          <p>{{ message }}</p>
        </div>
        <div mat-dialog-actions>
          <button mat-button (click)="onConfirm()">{{ confirmText }}</button>
          <button mat-button (click)="onCancel()">{{ cancelText }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .confirm-dialog-content {
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
      width: 400px;
      max-width: 90%;
    }

    .confirm-dialog-content h2 {
      margin-top: 0;
    }

    .confirm-dialog-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }

    .confirm-dialog-actions button {
      margin-left: 10px;
    }
  `]
})
export class ConfirmDialogComponent {
  @Input() title: string = 'Confirmation';
  @Input() message: string = 'Are you sure?';
  @Input() confirmText: string = 'Confirm';
  @Input() cancelText: string = 'Cancel';
  @Output() confirm = new EventEmitter<boolean>();

  onConfirm(): void {
    this.confirm.emit(true);
  }

  onCancel(): void {
    this.confirm.emit(false);
  }
}