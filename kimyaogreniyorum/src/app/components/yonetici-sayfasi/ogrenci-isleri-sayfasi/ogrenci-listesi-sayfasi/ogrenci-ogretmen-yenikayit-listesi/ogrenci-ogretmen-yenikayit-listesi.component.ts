import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-ogrenci-ogretmen-yenikayit-listesi',
  standalone: false,
  templateUrl: './ogrenci-ogretmen-yenikayit-listesi.component.html',
  styleUrl: './ogrenci-ogretmen-yenikayit-listesi.component.scss',
})
export class OgrenciOgretmenYenikayitListesiComponent {
  @Input() users: any[] = [];
  @Input() page: number = 1;
  @Input() itemsPerPage: number = 5;
  @Input() userType: 'ogrenci' | 'ogretmen' | 'yeni' = 'ogrenci';
  @Output() pageChange = new EventEmitter<number>();

  get paginatedUsers() {
    const start = (this.page - 1) * this.itemsPerPage;
    return this.users.slice(start, start + this.itemsPerPage);
  }

  get totalPages() {
    return Math.ceil(this.users.length / this.itemsPerPage);
  }

  setPage(page: number) {
    this.pageChange.emit(page);
  }

  getPageArray() {
    return Array(this.totalPages)
      .fill(0)
      .map((_, i) => i + 1);
  }
}