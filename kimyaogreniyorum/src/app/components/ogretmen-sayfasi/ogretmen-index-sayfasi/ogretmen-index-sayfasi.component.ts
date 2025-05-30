
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-ogretmen-index-sayfasi',
  templateUrl: './ogretmen-index-sayfasi.component.html',
  styleUrls: ['./ogretmen-index-sayfasi.component.scss'],
  standalone: false,
})
export class OgretmenIndexSayfasiComponent implements OnInit {
  
  // Sidebar state
  isSidebarOpen: boolean = true;
  
  // Teacher information
  teacherName: string = 'Ahmet Yılmaz';
  teacherAvatar: string = 'https://via.placeholder.com/32x32?text=AY';
  
  // Dashboard statistics
  totalStudents: number = 45;
  activeStudents: number = 42;
  totalGroups: number = 8;
  activeGroups: number = 6;
  totalTopics: number = 24;
  completedTopics: number = 18;
  totalExams: number = 12;
  pendingExams: number = 3;

  constructor() { }

  ngOnInit(): void {
    this.checkScreenSize();
    window.addEventListener('resize', () => {
      this.checkScreenSize();
    });
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  private checkScreenSize(): void {
    if (window.innerWidth < 768) {
      this.isSidebarOpen = false;
    } else {
      this.isSidebarOpen = true;
    }
  }
}
