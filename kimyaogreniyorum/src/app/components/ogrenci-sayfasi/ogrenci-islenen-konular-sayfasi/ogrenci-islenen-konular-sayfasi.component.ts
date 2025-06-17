
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface StudentInfo {
  id: number;
  adi_soyadi: string;
  email: string;
  sinifi: string;
  grup: string;
  okulu: string;
}

interface Topic {
  id: number;
  konu_adi: string;
  aciklama: string;
  sinif_seviyesi: string;
  unite_id: number;
}

interface Unit {
  id: number;
  unite_adi: string;
  aciklama: string;
  konular: Topic[];
}

interface ProcessedTopic {
  id: number;
  konu_id: number;
  grup_adi: string;
  isleme_tarihi: string;
  konu_adi: string;
}

@Component({
  selector: 'app-ogrenci-islenen-konular-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-islenen-konular-sayfasi.component.html',
  styleUrl: './ogrenci-islenen-konular-sayfasi.component.scss'
})
export class OgrenciIslenenKonularSayfasiComponent implements OnInit {
  studentInfo: StudentInfo | null = null;
  groupedTopics: Unit[] = [];
  processedTopics: ProcessedTopic[] = [];
  isLoading = true;
  error: string | null = null;

  private apiBaseUrl = './server/api';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.error = null;
    
    // Load student info first
    this.loadStudentInfo().then(() => {
      if (this.studentInfo) {
        // Then load topics and processed topics
        Promise.all([
          this.loadTopics(),
          this.loadProcessedTopics()
        ]).then(() => {
          this.isLoading = false;
        }).catch(error => {
          console.error('Error loading data:', error);
          this.error = 'Veriler yüklenirken hata oluştu.';
          this.isLoading = false;
        });
      } else {
        this.error = 'Öğrenci bilgileri alınamadı.';
        this.isLoading = false;
      }
    });
  }

  private loadStudentInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Token'ı localStorage veya sessionStorage'dan al
      let token = '';
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token || '';
          console.log('Token found:', token ? 'Yes' : 'No');
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }

      if (!token) {
        this.error = 'Oturum bulunamadı. Lütfen tekrar giriş yapın.';
        reject('No token');
        return;
      }

      this.http.get<any>(`${this.apiBaseUrl}/ogrenci_profil.php`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).subscribe({
        next: (response) => {
          if (response.success) {
            this.studentInfo = response.data;
            console.log('Student info loaded:', this.studentInfo);
            resolve();
          } else {
            reject(response.message || 'Öğrenci bilgileri alınamadı');
          }
        },
        error: (error) => {
          console.error('Error loading student info:', error);
          reject('Öğrenci bilgileri yüklenemedi');
        }
      });
    });
  }

  private loadTopics(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Token'ı ekle
      let token = '';
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token || '';
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      this.http.get<any>(`${this.apiBaseUrl}/konu_listesi.php`, { headers }).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Group topics by unite
            const topicsMap = new Map<number, Unit>();
            
            response.data.forEach((topic: any) => {
              if (!topicsMap.has(topic.unite_id)) {
                topicsMap.set(topic.unite_id, {
                  id: topic.unite_id,
                  unite_adi: topic.unite_adi,
                  aciklama: topic.unite_aciklama || '',
                  konular: []
                });
              }
              
              topicsMap.get(topic.unite_id)?.konular.push({
                id: topic.id,
                konu_adi: topic.konu_adi,
                aciklama: topic.aciklama || '',
                sinif_seviyesi: topic.sinif_seviyesi,
                unite_id: topic.unite_id
              });
            });

            this.groupedTopics = Array.from(topicsMap.values());
            console.log('Topics loaded:', this.groupedTopics);
            resolve();
          } else {
            reject('Konular yüklenemedi');
          }
        },
        error: (error) => {
          console.error('Error loading topics:', error);
          reject('Konular yüklenirken hata oluştu');
        }
      });
    });
  }

  private loadProcessedTopics(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.studentInfo?.grup) {
        resolve(); // No group, no processed topics
        return;
      }

      // Token'ı ekle
      let token = '';
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token || '';
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      this.http.get<any>(
        `${this.apiBaseUrl}/islenen_konular.php?grup=${encodeURIComponent(this.studentInfo.grup)}`,
        { headers }
      ).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.processedTopics = response.data;
            console.log('Processed topics loaded:', this.processedTopics);
          }
          resolve(); // Always resolve, even if no processed topics
        },
        error: (error) => {
          console.error('Error loading processed topics:', error);
          resolve(); // Don't reject, just resolve with empty processed topics
        }
      });
    });
  }

  isTopicProcessed(topicId: number): boolean {
    return this.processedTopics.some(pt => pt.konu_id === topicId);
  }

  getTopicProcessedDate(topicId: number): Date | null {
    const processedTopic = this.processedTopics.find(pt => pt.konu_id === topicId);
    return processedTopic ? new Date(processedTopic.isleme_tarihi) : null;
  }

  getProcessedTopicsInUnit(unit: Unit): number {
    return unit.konular.filter(topic => this.isTopicProcessed(topic.id)).length;
  }

  getUnitProgress(unit: Unit): number {
    if (unit.konular.length === 0) return 0;
    return Math.round((this.getProcessedTopicsInUnit(unit) / unit.konular.length) * 100);
  }

  getTotalTopics(): number {
    return this.groupedTopics.reduce((total, unit) => total + unit.konular.length, 0);
  }

  getTotalProcessedTopics(): number {
    return this.processedTopics.length;
  }

  getOverallProgress(): number {
    const total = this.getTotalTopics();
    if (total === 0) return 0;
    return Math.round((this.getTotalProcessedTopics() / total) * 100);
  }
}
