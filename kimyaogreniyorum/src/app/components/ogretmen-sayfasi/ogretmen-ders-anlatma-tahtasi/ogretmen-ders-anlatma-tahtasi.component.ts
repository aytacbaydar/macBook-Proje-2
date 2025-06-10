import { Component, OnInit, AfterViewInit, HostListener } from '@angular/core';
import * as fabric from 'fabric';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { jsPDF } from 'jspdf';
@Component({
  selector: 'app-ogretmen-ders-anlatma-tahtasi',
  standalone: false,
  templateUrl: './ogretmen-ders-anlatma-tahtasi.component.html',
  styleUrl: './ogretmen-ders-anlatma-tahtasi.component.scss',
})
export class OgretmenDersAnlatmaTahtasiComponent
  implements OnInit, AfterViewInit
{
  canvasInstances: fabric.Canvas[] = [];
  sayfalar: any[] = [{}]; // Başlangıçta bir sayfa olsun
  currentPage: number = 1;
  totalPages: number = 1;
  ogrenciGruplari: string[] = [];
  secilenGrup: string = '';
  kaydetmeIsleminde: boolean = false;
  kalemRengi: string = '#000000';
  kalemKalinligi: number = 4; // Varsayılan olarak normal kalınlık
  isTamEkran: boolean = false; // Tam ekran durumu
  kalemKalinlikSecenekleri: number[] = [2, 4, 8, 12, 16]; // İnce, normal, kalın, çok kalın, ekstra kalın
  cizilebilir: boolean = true;
  silgiModu: boolean = false;
  fosforluKalemModu: boolean = false;
  oncekiKalemRengi: string = '#000000';
  oncekiKalemKalinligi: number = 2;
  fosforluRenkler: { [key: string]: string } = {
    sari: '#ffff0080', // Sarı fosforlu
    yesil: '#00ff0080', // Yeşil fosforlu
    pembe: '#ff00ff80', // Pembe fosforlu
    mavi: '#00ffff80', // Mavi fosforlu
    turuncu: '#ffa50080', // Turuncu fosforlu
  };
  secilenFosforluRenk: string = '#ffff0080'; // Varsayılan sarı fosforlu

  // Şekil çizim değişkenleri
  sekilModu: boolean = false;
  secilenSekil: string = ''; // cizgi, dikdortgen, daire, ok, ucgen
  geciciSekil: fabric.Object | null = null;
  baslangicX: number = 0;
  baslangicY: number = 0;

  // Resim yükleme özellikleri
  resimYukleniyor: boolean = false;

  // PDF yükleme özellikleri (Background-image yaklaşımı için)
  pdfYukleniyor: boolean = false;
  yuklenenPdf: any = null;
  pdfSayfaSayisi: number = 0;
  seciliPdfSayfasi: number = 1;

  constructor(private http: HttpClient) {
    // PDF.js dependency kaldırıldı, background-image yaklaşımı kullanılıyor
  }

  ngOnInit(): void {
    // Kalem modunu aktifleştir
    document.body.classList.add('kalem-aktif');

    // Öğrenci gruplarını API'den çek
    this.getOgrenciGruplari();
  }

  // Öğrenci gruplarını API'den çekme fonksiyonu
  getOgrenciGruplari(): void {
    // Tüm öğrencileri listeleyen API
    const apiUrl = './server/api/ogrenciler_listesi.php';

    console.log('Öğrenci grupları yükleniyor...');

    // LocalStorage veya sessionStorage'dan token'ı al
    let token = '';
    let loggedInUser: any = null;
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      loggedInUser = JSON.parse(userStr);
      token = loggedInUser.token || '';
    }

    console.log('Öğrenci grupları API isteği gönderiliyor:', apiUrl);
    this.http
      .get<any>(apiUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response) => {
          console.log('API yanıtı:', response);
          if (response && response.success && response.data) {
            // Giriş yapan öğretmenin adi_soyadi'sını al
            const loggedInTeacherName = loggedInUser?.adi_soyadi || '';

            // Sadece öğrencileri filtrele ve giriş yapan öğretmenin öğrencilerini al
            const teacherStudents = response.data.filter(
              (student: any) =>
                student.rutbe === 'ogrenci' && student.ogretmeni === loggedInTeacherName
            );

            // Öğrencilerden benzersiz grupları çıkar
            const gruplar = new Set<string>();

            // Öğretmenin öğrencilerini döngüyle dolaşarak grubu değerlerini al
            teacherStudents.forEach((ogrenci: any) => {
              if (
                ogrenci.grubu &&
                typeof ogrenci.grubu === 'string' &&
                ogrenci.grubu.trim() !== ''
              ) {
                gruplar.add(ogrenci.grubu);
              }
            });

            // Set'ten array'e çevir ve alfabetik sırala
            this.ogrenciGruplari = Array.from(gruplar).sort();

            // Grupların tarih formatında olanları üste taşı
            const bugun = new Date();
            const yil = bugun.getFullYear();
            this.ogrenciGruplari.sort((a, b) => {
              // Yıl içeren grupları önce göster
              const aHasYear = a.includes(yil.toString());
              const bHasYear = b.includes(yil.toString());

              if (aHasYear && !bHasYear) return -1;
              if (!aHasYear && bHasYear) return 1;
              return a.localeCompare(b);
            });

            console.log('Öğretmenin grupları yüklendi:', this.ogrenciGruplari);
            console.log('Öğretmen adı:', loggedInTeacherName);
          }
        },
        error: (error) => {
          console.error('Grupları getirme hatası:', error);
          // Hata türünü kontrol et
          if (error.status === 0) {
            console.warn(
              'Ağ hatası veya CORS sorunu olabilir. Alternatif çözüm uygulanıyor...'
            );
          }

          // Hata durumunda boş grup listesi
          this.ogrenciGruplari = [];
          console.log('Hata nedeniyle grup listesi boş bırakıldı');
        },
      });
  }

  ngAfterViewInit(): void {
    // İlk canvas'ı oluştur
    setTimeout(() => {
      this.canvasOlustur(1);
    }, 500);
  }

  // Kağıt arka planı yükleme metodu
  kagitArkaPlaniYukle(): void {
    this.pdfYukleniyor = true;

    try {
      // Canvas elementini al
      const canvas = this.canvasInstances[this.currentPage - 1];
      if (canvas) {
        // Kağıt resmini arka plan olarak ayarla
        const canvasElement = canvas.getElement();
        const kagitUrl = '/kagit.png'; // public klasöründeki kagit.png
        
        // Canvas arka planını kağıt resmi olarak ayarla
        canvasElement.style.backgroundImage = `url(${kagitUrl})`;
        canvasElement.style.backgroundSize = 'cover';
        canvasElement.style.backgroundRepeat = 'no-repeat';
        canvasElement.style.backgroundPosition = 'center';
        
        // PDF bilgilerini ayarla (kağıt için)
        this.yuklenenPdf = { local: true, url: kagitUrl };
        this.pdfSayfaSayisi = 1;
        this.seciliPdfSayfasi = 1;

        console.log('Kağıt arka planı başarıyla yüklendi');
        this.pdfYukleniyor = false;
        
        // Çizim modunu aktifleştir
        this.kalemModunuAc();
      } else {
        throw new Error('Canvas bulunamadı');
      }
    } catch (error) {
      console.error('Kağıt arka planı yükleme hatası:', error);
      alert('Kağıt arka planı yüklenemedi!');
      this.pdfYukleniyor = false;
    }
  }

  // PDF dosyası yükleme metodu (kullanıcı dosya seçerse)
  pdfYukle(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      this.pdfYukleniyor = true;

      const file = input.files[0];

      // Dosya boyutu kontrolü (25MB limit)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        alert('PDF dosyası çok büyük! Maksimum 25MB olmalı.');
        this.pdfYukleniyor = false;
        input.value = '';
        return;
      }

      if (file.type !== 'application/pdf') {
        alert('Lütfen sadece PDF dosyası seçin!');
        this.pdfYukleniyor = false;
        input.value = '';
        return;
      }

      // PDF'i Base64 olarak oku ve arka plan resmi olarak ayarla
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const base64String = e.target?.result as string;
          if (!base64String) {
            throw new Error('PDF dosyası okunamadı');
          }

          // Canvas elementini al
          const canvas = this.canvasInstances[this.currentPage - 1];
          if (canvas) {
            // PDF'i arka plan resmi olarak ayarla
            const canvasElement = canvas.getElement();
            const pdfDataUrl = base64String;
            
            // Canvas arka planını PDF olarak ayarla
            canvasElement.style.backgroundImage = `url(${pdfDataUrl})`;
            canvasElement.style.backgroundSize = 'contain';
            canvasElement.style.backgroundRepeat = 'no-repeat';
            canvasElement.style.backgroundPosition = 'center';
            
            // PDF bilgilerini ayarla
            this.yuklenenPdf = { base64: base64String };
            this.pdfSayfaSayisi = 1; // Tek sayfa olarak işle
            this.seciliPdfSayfasi = 1;

            console.log('PDF başarıyla arka plan olarak yüklendi');
            this.pdfYukleniyor = false;
            
            // Çizim modunu aktifleştir
            this.kalemModunuAc();
          } else {
            throw new Error('Canvas bulunamadı');
          }
        } catch (error) {
          console.error('PDF yükleme hatası:', error);
          alert('PDF dosyası yüklenemedi! Dosya bozuk olabilir.');
          this.pdfYukleniyor = false;
        }
      };

      reader.onerror = () => {
        console.error('PDF okuma hatası');
        alert('PDF dosyası okunamadı!');
        this.pdfYukleniyor = false;
      };

      reader.readAsDataURL(file);

      // Input değerini sıfırla
      input.value = '';
    }
  }

  // PDF arka plan görüntüsünü temizle
  pdfArkaPlaniTemizle(): void {
    const canvas = this.canvasInstances[this.currentPage - 1];
    if (canvas) {
      const canvasElement = canvas.getElement();
      canvasElement.style.backgroundImage = 'none';
      
      // PDF verilerini temizle
      this.yuklenenPdf = null;
      this.pdfSayfaSayisi = 0;
      this.seciliPdfSayfasi = 1;
      
      console.log('PDF arka planı temizlendi');
    }
  }

  // PDF arka plan saydamlığını ayarla
  pdfSaydamlikAyarla(saydamlik: number): void {
    const canvas = this.canvasInstances[this.currentPage - 1];
    if (canvas && this.yuklenenPdf) {
      const canvasElement = canvas.getElement();
      canvasElement.style.opacity = saydamlik.toString();
    }
  }

  // PDF boyutunu ayarla
  pdfBoyutAyarla(boyut: 'contain' | 'cover' | '100% 100%'): void {
    const canvas = this.canvasInstances[this.currentPage - 1];
    if (canvas && this.yuklenenPdf) {
      const canvasElement = canvas.getElement();
      canvasElement.style.backgroundSize = boyut;
    }
  }

  // Resim yükleme metotları
  resimYukle(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      this.resimYukleniyor = true;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Resmi canvas'a ekle
          const canvas = this.canvasInstances[this.currentPage - 1];
          if (canvas) {
            // Şekil ve kalem modlarını devre dışı bırak
            this.sekilModu = false;
            this.secilenSekil = '';
            canvas.isDrawingMode = false;

            // Daha sonra yeniden boyutlandırılabilmesi için
            const imgWidth = Math.min(img.width, canvas.width * 0.8);
            const imgHeight = img.height * (imgWidth / img.width);

            // Yeni bir fabric.Image nesnesi oluştur
            fabric.Image.fromURL(
              e.target?.result as string,
              {
                crossOrigin: 'anonymous',
              },
              (img: fabric.Image) => {
                img.set({
                  left: (canvas.width - imgWidth) / 2,
                  top: (canvas.height - imgHeight) / 2,
                  scaleX: imgWidth / (img.width || 1),
                  scaleY: imgHeight / (img.height || 1),
                  selectable: true,
                  hasControls: true,
                  hasBorders: true,
                });

                canvas.add(img);
                canvas.setActiveObject(img);
                canvas.renderAll();

                this.resimYukleniyor = false;
              }
            );
          } else {
            console.error('Canvas bulunamadı');
            this.resimYukleniyor = false;
          }
        };
        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        console.error('Resim yükleme hatası');
        this.resimYukleniyor = false;
      };

      reader.readAsDataURL(input.files[0]);

      // Input değerini sıfırla, böylece aynı dosya tekrar seçilebilir
      input.value = '';
    }
  }

  // Şekil çizim metodları
  sekilSec(sekil: string): void {
    if (this.secilenSekil === sekil) {
      // Şekil modunu kapat
      this.secilenSekil = '';
      this.sekilModu = false;
      this.kalemModunuAc(); // Kalem moduna dön
    } else {
      // Yeni şekil modunu aç
      this.secilenSekil = sekil;
      this.sekilModu = true;
      this.silgiModu = false;
      this.fosforluKalemModu = false;
      this.cizilebilir = false;

      // Kalem, silgi ve fosforlu kalem modlarını kapat, şekil çizim modunu etkinleştir
      document.body.classList.remove(
        'kalem-aktif',
        'silgi-aktif',
        'el-imleci-aktif',
        'fosforlu-kalem-aktif'
      );
      document.body.classList.add('sekil-ciz-aktif');

      // Canvas olaylarını ayarla
      this.ayarlaSekilOlaylari();
    }
  }

  ayarlaSekilOlaylari(): void {
    const canvas = this.canvasInstances[this.currentPage - 1];
    if (!canvas) return;

    // Mevcut olayları temizle
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    // Çizim modunu kapat
    canvas.isDrawingMode = false;

    // Yeni olayları ekle
    canvas.on('mouse:down', (o: fabric.TEvent) => {
      const pointer = canvas.getPointer(o.e);
      this.baslangicX = pointer.x;
      this.baslangicY = pointer.y;

      // Geçici şekli oluştur
      this.geciciSekil = this.sekilOlustur(
        this.secilenSekil,
        pointer.x,
        pointer.y,
        pointer.x,
        pointer.y
      );
      if (this.geciciSekil) {
        canvas.add(this.geciciSekil);
      }
    });

    canvas.on('mouse:move', (o: fabric.TEvent) => {
      if (!this.geciciSekil) return;

      const pointer = canvas.getPointer(o.e);
      this.sekilGuncelle(
        this.geciciSekil,
        this.secilenSekil,
        this.baslangicX,
        this.baslangicY,
        pointer.x,
        pointer.y
      );
      canvas.renderAll();
    });

    canvas.on('mouse:up', () => {
      this.geciciSekil = null;
    });
  }

  sekilOlustur(
    sekil: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): fabric.Object | null {
    const canvas = this.canvasInstances[this.currentPage - 1];
    if (!canvas) return null;

    let sekilObj: fabric.Object | null = null;

    switch (sekil) {
      case 'cizgi':
        sekilObj = new fabric.Line([x1, y1, x2, y2], {
          stroke: this.kalemRengi,
          strokeWidth: this.kalemKalinligi,
          selectable: true,
        });
        break;

      case 'dikdortgen':
        sekilObj = new fabric.Rect({
          left: Math.min(x1, x2),
          top: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
          stroke: this.kalemRengi,
          strokeWidth: this.kalemKalinligi,
          fill: 'transparent',
          selectable: true,
        });
        break;

      case 'daire':
        const radius =
          Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 2;
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        sekilObj = new fabric.Circle({
          left: centerX - radius,
          top: centerY - radius,
          radius: radius,
          stroke: this.kalemRengi,
          strokeWidth: this.kalemKalinligi,
          fill: 'transparent',
          selectable: true,
        });
        break;

      case 'ok':
        // Ok için çizgi
        const lineObj = new fabric.Line([x1, y1, x2, y2], {
          stroke: this.kalemRengi,
          strokeWidth: this.kalemKalinligi,
          selectable: true,
        });

        // Ok başı için hesaplama
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = 15;
        const arrowAngle = Math.PI / 6; // 30 derece

        const x3 = x2 - headLength * Math.cos(angle - arrowAngle);
        const y3 = y2 - headLength * Math.sin(angle - arrowAngle);
        const x4 = x2 - headLength * Math.cos(angle + arrowAngle);
        const y4 = y2 - headLength * Math.sin(angle + arrowAngle);

        const trianglePoints = [
          { x: x2, y: y2 },
          { x: x3, y: y3 },
          { x: x4, y: y4 },
        ];

        const headObj = new fabric.Polygon(trianglePoints, {
          fill: this.kalemRengi,
          stroke: this.kalemRengi,
          strokeWidth: 1,
          selectable: true,
        });

        // Ok nesnesini gruplandır
        sekilObj = new fabric.Group([lineObj, headObj], {
          selectable: true,
        });
        break;

      case 'ucgen':
        sekilObj = new fabric.Triangle({
          left: Math.min(x1, x2),
          top: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
          stroke: this.kalemRengi,
          strokeWidth: this.kalemKalinligi,
          fill: 'transparent',
          selectable: true,
        });
        break;
    }

    return sekilObj;
  }

  sekilGuncelle(
    sekilObj: fabric.Object,
    sekil: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): void {
    if (!sekilObj) return;

    switch (sekil) {
      case 'cizgi':
        if (sekilObj instanceof fabric.Line) {
          sekilObj.set({ x2: x2, y2: y2 });
        }
        break;

      case 'dikdortgen':
        if (sekilObj instanceof fabric.Rect) {
          sekilObj.set({
            left: Math.min(x1, x2),
            top: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1),
          });
        }
        break;

      case 'daire':
        if (sekilObj instanceof fabric.Circle) {
          const radius =
            Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 2;
          const centerX = (x1 + x2) / 2;
          const centerY = (y1 + y2) / 2;
          sekilObj.set({
            left: centerX - radius,
            top: centerY - radius,
            radius: radius,
          });
        }
        break;

      case 'ok':
        if (sekilObj instanceof fabric.Group) {
          const lineObj = sekilObj.getObjects()[0] as fabric.Line;
          if (lineObj) {
            lineObj.set({ x2: x2, y2: y2 });
          }

          // Ok başını güncelle
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLength = 15;
          const arrowAngle = Math.PI / 6; // 30 derece

          const x3 = x2 - headLength * Math.cos(angle - arrowAngle);
          const y3 = y2 - headLength * Math.sin(angle - arrowAngle);
          const x4 = x2 - headLength * Math.cos(angle + arrowAngle);
          const y4 = y2 - headLength * Math.sin(angle + arrowAngle);

          const headObj = sekilObj.getObjects()[1] as fabric.Polygon;
          if (headObj) {
            headObj.set('points', [
              { x: x2, y: y2 },
              { x: x3, y: y3 },
              { x: x4, y: y4 },
            ]);
          }

          sekilObj.setCoords();
        }
        break;

      case 'ucgen':
        if (sekilObj instanceof fabric.Triangle) {
          sekilObj.set({
            left: Math.min(x1, x2),
            top: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1),
          });
        }
        break;
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    // Tüm canvas'ları yeniden boyutlandır
    this.canvasInstances.forEach((canvas, index) => {
      if (canvas) {
        this.canvasBoyutlandir(index + 1);
      }
    });
  }

  // Hızlı renk seçimi için metod
  hizliRenkSec(renk: string): void {
    this.kalemRengi = renk;
    this.silgiModu = false; // Renk seçildiğinde silgi modundan çık
    this.ayarlaKalemOzellikleri();

    // Kalem modunu etkinleştir
    document.body.classList.add('kalem-aktif');
    document.body.classList.remove('silgi-aktif');
  }

  canvasOlustur(sayfaNo: number): void {
    try {
      const canvasId = `canvas-${sayfaNo}`;
      const canvasEl = document.getElementById(canvasId) as HTMLCanvasElement;

      if (!canvasEl) {
        console.error(`Canvas element ${canvasId} bulunamadı`);
        return;
      }

      // Canvas boyutlarını ayarla
      const container = canvasEl.parentElement;
      if (container) {
        canvasEl.width = container.clientWidth;
        canvasEl.height = container.clientHeight;
      }

      // Yeni fabric canvas oluştur
      const canvas = new fabric.Canvas(canvasId, {
        isDrawingMode: true,
        width: canvasEl.width,
        height: canvasEl.height,
        selection: false,
        renderOnAddRemove: true,
        interactive: true,
        backgroundColor: '#ffffff',
      });

      // Canvas array'e ekle veya güncelle
      if (this.canvasInstances.length < sayfaNo) {
        this.canvasInstances.push(canvas);
      } else {
        this.canvasInstances[sayfaNo - 1] = canvas;
      }

      // Kalem özelliklerini ayarla
      this.ayarlaKalemOzellikleri(sayfaNo);

      console.log(`Canvas ${sayfaNo} oluşturuldu`, canvas);
    } catch (error) {
      console.error(`Canvas ${sayfaNo} oluşturma hatası:`, error);
    }
  }

  canvasBoyutlandir(sayfaNo: number): void {
    const canvas = this.canvasInstances[sayfaNo - 1];
    if (!canvas) return;

    try {
      const canvasEl = document.getElementById(
        `canvas-${sayfaNo}`
      ) as HTMLCanvasElement;
      const container = canvasEl.parentElement;

      if (container) {
        // Canvas boyutlarını güncelle
        canvas.setWidth(container.clientWidth);
        canvas.setHeight(container.clientHeight);
        canvas.renderAll();
      }
    } catch (error) {
      console.error(`Canvas ${sayfaNo} boyutlandırma hatası:`, error);
    }
  }

  sayfaEkle(): void {
    this.sayfalar.push({});
    this.totalPages = this.sayfalar.length;

    // Yeni sayfaya geç
    this.currentPage = this.totalPages;
    this.sayfayaGit(this.currentPage);

    // Yeni sayfanın canvas'ını oluştur
    setTimeout(() => {
      this.canvasOlustur(this.currentPage);
    }, 100);
  }

  // Sayfa navigasyon fonksiyonları
  sayfaBas(): void {
    if (this.currentPage !== 1) {
      this.currentPage = 1;
      this.sayfayaGit(1);
    }
  }

  oncekiSayfa(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.sayfayaGit(this.currentPage);
    }
  }

  sonrakiSayfa(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.sayfayaGit(this.currentPage);
    }
  }

  sayfaSon(): void {
    if (this.currentPage !== this.totalPages) {
      this.currentPage = this.totalPages;
      this.sayfayaGit(this.totalPages);
    }
  }

  sayfayaGit(sayfa: number): void {
    // Aktif sayfa sınıfını değiştir
    const sayfalar = document.querySelectorAll('.beyaz-tahta');
    sayfalar.forEach((element, index) => {
      if (index + 1 === sayfa) {
        element.classList.add('aktif-sayfa');
      } else {
        element.classList.remove('aktif-sayfa');
      }
    });

    this.currentPage = sayfa;

    // Eğer bu sayfanın canvas'ı yoksa oluştur
    if (!this.canvasInstances[sayfa - 1]) {
      setTimeout(() => {
        this.canvasOlustur(sayfa);
      }, 100);
    } else {
      // Kalem özelliklerini güncelle
      this.ayarlaKalemOzellikleri(sayfa);
    }
  }

  temizleSayfa(): void {
    const canvas = this.canvasInstances[this.currentPage - 1];
    if (canvas) {
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      canvas.renderAll();
    }
  }

  toggleCizim(): void {
    // Şekil modundan çık
    this.sekilModu = false;
    this.secilenSekil = '';

    this.cizilebilir = !this.cizilebilir;

    const canvas = this.canvasInstances[this.currentPage - 1];
    if (canvas) {
      canvas.isDrawingMode = this.cizilebilir;

      // El imleç modunda olayları temizle
      if (!this.cizilebilir) {
        canvas.off('mouse:down');
        canvas.off('mouse:move');
        canvas.off('mouse:up');
      }
    }

    // İmleç stilini güncelle
    if (this.cizilebilir) {
      if (this.silgiModu) {
        document.body.classList.add('silgi-aktif');
        document.body.classList.remove(
          'kalem-aktif',
          'el-imleci-aktif',
          'sekil-ciz-aktif',
          'fosforlu-kalem-aktif'
        );
      } else if (this.fosforluKalemModu) {
        document.body.classList.add('fosforlu-kalem-aktif');
        document.body.classList.remove(
          'kalem-aktif',
          'silgi-aktif',
          'el-imleci-aktif',
          'sekil-ciz-aktif'
        );
      } else {
        document.body.classList.add('kalem-aktif');
        document.body.classList.remove(
          'silgi-aktif',
          'el-imleci-aktif',
          'sekil-ciz-aktif',
          'fosforlu-kalem-aktif'
        );
      }
    } else {
      // Kalem, silgi, fosforlu ve şekil modlarını kapat, el imleci kullan
      document.body.classList.remove(
        'kalem-aktif',
        'silgi-aktif',
        'sekil-ciz-aktif',
        'fosforlu-kalem-aktif'
      );
      document.body.classList.add('el-imleci-aktif');
    }

    console.log(
      'Çizim modu değiştirildi:',
      this.cizilebilir ? 'Kalem/Silgi/Fosforlu Aktif' : 'El İmleci Aktif'
    );
  }

  ayarlaKalemOzellikleri(sayfaNo?: number): void {
    const pageNo = sayfaNo || this.currentPage;
    const canvas = this.canvasInstances[pageNo - 1];

    if (!canvas) {
      console.log(`Canvas ${pageNo} henüz hazır değil`);
      return;
    }

    // Canvas'ı çizim moduna al
    canvas.isDrawingMode = this.cizilebilir;

    // Brush'ı kontrol et
    if (!canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    }

    // Kalem ayarlarını güncelle
    canvas.freeDrawingBrush.color = this.kalemRengi;
    canvas.freeDrawingBrush.width = this.kalemKalinligi;

    // İnce çizgiler için ek ayarlar (fabric.js versiyonuna göre)
    try {
      if (canvas.freeDrawingBrush.hasOwnProperty('getInk')) {
        (canvas.freeDrawingBrush as any).getInk = false;
            }
    } catch (e) {
      console.log('getInk özelliği bu fabric.js versiyonunda desteklenmiyor');
    }
  }

  silgiModunuAc(): void {
    // Şekil modundan çık
    this.sekilModu = false;
    this.secilenSekil = '';
    this.cizilebilir = true;
    this.fosforluKalemModu = false;

    if (!this.silgiModu) {
      this.silgiModu = true;
      // Önceki kalem ayarlarını kaydet
      this.oncekiKalemRengi = this.kalemRengi;
      this.oncekiKalemKalinligi = this.kalemKalinligi;

      // Silgi modunu etkinleştir - beyaz renk ile silme efekti
      this.kalemRengi = '#ffffff';
      this.kalemKalinligi = Math.max(20, this.kalemKalinligi); // Silgi en az 20px olsun
      this.ayarlaKalemOzellikleri();

      // İmleç stilini güncelle
      document.body.classList.add('silgi-aktif');
      document.body.classList.remove(
        'kalem-aktif',
        'el-imleci-aktif',
        'sekil-ciz-aktif',
        'fosforlu-kalem-aktif'
      );

      // Canvas'ı silgi moduna getir
      const canvas = this.canvasInstances[this.currentPage - 1];
      if (canvas) {
        // Gerekli olayları temizle
        canvas.off('mouse:down');
        canvas.off('mouse:move');
        canvas.off('mouse:up');

        // Çizim modunu aktifleştir
        canvas.isDrawingMode = true;
      }
    }
  }

  kalemModunuAc(): void {
    // Silgi, şekil veya başka bir moddan kalem moduna geçiş
    this.silgiModu = false;
    this.fosforluKalemModu = false;
    this.sekilModu = false;
    this.secilenSekil = '';
    this.cizilebilir = true;

    // Önceki kalem ayarlarını geri yükle
    this.kalemRengi = this.oncekiKalemRengi;
    this.kalemKalinligi = this.oncekiKalemKalinligi;
    this.ayarlaKalemOzellikleri();

    // İmleç stilini güncelle
    document.body.classList.add('kalem-aktif');
    document.body.classList.remove(
      'silgi-aktif',
      'el-imleci-aktif',
      'sekil-ciz-aktif',
      'fosforlu-kalem-aktif'
    );

    // Canvas'ı kalem moduna getir
    const canvas = this.canvasInstances[this.currentPage - 1];
    if (canvas) {
      // Gerekli olayları temizle
      canvas.off('mouse:down');
      canvas.off('mouse:move');
      canvas.off('mouse:up');

      // Çizim modunu aktifleştir
      canvas.isDrawingMode = true;
    }
  }

  fosforluKalemModunuAc(renk?: string): void {
    // Diğer modlardan fosforlu kalem moduna geçiş
    this.silgiModu = false;
    this.sekilModu = false;
    this.secilenSekil = '';
    this.cizilebilir = true;
    this.fosforluKalemModu = true;

    // Önceki kalem ayarlarını kaydet
    if (!this.fosforluKalemModu) {
      this.oncekiKalemRengi = this.kalemRengi;
      this.oncekiKalemKalinligi = this.kalemKalinligi;
    }

    // Renk belirtilmişse o rengi kullan
    if (renk && this.fosforluRenkler[renk]) {
      this.secilenFosforluRenk = this.fosforluRenkler[renk];
    }

    // Fosforlu kalem ayarlarını uygula
    this.kalemRengi = this.secilenFosforluRenk;
    this.kalemKalinligi = 16; // Fosforlu kalem için daha kalın
    this.ayarlaKalemOzellikleri();

    // İmleç stilini güncelle
    document.body.classList.add('fosforlu-kalem-aktif');
    document.body.classList.remove(
      'kalem-aktif',
      'silgi-aktif',
      'el-imleci-aktif',
      'sekil-ciz-aktif'
    );

    // Canvas'ı fosforlu kalem moduna getir
    const canvas = this.canvasInstances[this.currentPage - 1];
    if (canvas) {
      // Gerekli olayları temizle
      canvas.off('mouse:down');
      canvas.off('mouse:move');
      canvas.off('mouse:up');

      // Çizim modunu aktifleştir
      canvas.isDrawingMode = true;

      // Transparency için özel brush ayarları
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = this.secilenFosforluRenk;
        canvas.freeDrawingBrush.width = 16;
      }
    }
  }

  // PDF'i oluştur ve indir
  indirPDF(): void {
    this.kaydetmeIsleminde = true;

    try {
      // PDF oluştur
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const processNextPage = (page: number) => {
        if (page > this.totalPages) {
          // Tüm sayfalar tamamlandı, PDF'i indir
          const bugun = new Date();
          const tarihKodu = `${bugun.getFullYear()}${(bugun.getMonth() + 1)
            .toString()
            .padStart(2, '0')}${bugun.getDate().toString().padStart(2, '0')}`;

          const dosyaAdi = this.secilenGrup
            ? `${this.secilenGrup.replace(/\s+/g, '_')}_${tarihKodu}.pdf`
            : `ders_notu_${tarihKodu}.pdf`;

          pdf.save(dosyaAdi);
          this.kaydetmeIsleminde = false;
          return;
        }

        // Geçerli sayfayı görünür yap ve canvas'ı al
        this.sayfayaGit(page);

        setTimeout(() => {
          const canvas = this.canvasInstances[page - 1];
          if (canvas) {
            // Canvas'ı PNG olarak dışa aktar - boyutu küçültmek için kalite ve çarpanı azalttık
            const dataURL = canvas.toDataURL({
              format: 'png',
              quality: 0.8, // Kaliteyi düşürerek dosya boyutunu azalt
              multiplier: 1.5, // Çarpanı düşürerek dosya boyutunu azalt
            });

            // İlk sayfa değilse yeni sayfa ekle
            if (page > 1) {
              pdf.addPage();
            }

            // PNG'yi PDF'e ekle
            const imgWidth = 210; // A4 genişliği (mm)
            const imgHeight = 297; // A4 yüksekliği (mm)
            pdf.addImage(dataURL, 'PNG', 0, 0, imgWidth, imgHeight);

            // Sonraki sayfaya geç
            processNextPage(page + 1);
          } else {
            console.error(`Canvas ${page} bulunamadı`);
            processNextPage(page + 1);
          }
        }, 200);
      };

      // İlk sayfadan başla
      processNextPage(1);
    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      alert('PDF oluşturulurken bir hata oluştu!');
      this.kaydetmeIsleminde = false;
    }
  }

  // Veritabanına kaydetme işlemi (parametresiz)
  veritabaninaKaydet(): void {
    // ADIM 1: Öğrenci grubu kontrolü
    if (!this.secilenGrup) {
      alert('Lütfen bir öğrenci grubu seçin!');
      return;
    }

    this.kaydetmeIsleminde = true;
    console.log('Kaydetme işlemi başlatıldı...');

    try {
      // ADIM 2: PDF oluşturmaya başla
      console.log('ADIM 2: PDF oluşturuluyor...');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Tarih formatını oluştur
      const bugun = new Date();
      const tarih = `${bugun.getDate()}.${
        bugun.getMonth() + 1
      }.${bugun.getFullYear()}`;

      // PDF dosya adını grup adı ve tarih ile oluştur
      const dosyaAdi = `${this.secilenGrup} - ${tarih}`;
      const dosyaDosyaAdi = `${this.secilenGrup.replace(
        /\s+/g,
        '_'
      )}_${bugun.getFullYear()}${(bugun.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${bugun.getDate().toString().padStart(2, '0')}.pdf`;
      console.log('PDF Dosya adı:', dosyaAdi);
      console.log('Fiziksel dosya adı:', dosyaDosyaAdi);

      // Tüm sayfaları PDF'e ekle
      const processAllPages = async () => {
        // ADIM 3: Canvas sayfalarını PDF'e ekle
        console.log("ADIM 3: Canvas sayfaları PDF'e ekleniyor...");
        for (let page = 1; page <= this.totalPages; page++) {
          console.log(`Sayfa ${page}/${this.totalPages} işleniyor...`);
          // Sayfayı görünür yap
          this.sayfayaGit(page);

          // Kısa bir bekleme
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Canvas'ı al
          const canvas = this.canvasInstances[page - 1];
          if (canvas) {
            // Canvas'ı PNG olarak dışa aktar
            const dataURL = canvas.toDataURL({
              format: 'png',
              quality: 0.8, // Kaliteyi düşürerek dosya boyutunu azalt
              multiplier: 1.5, // Çarpanı düşürerek dosya boyutunu azalt
            });

            // İlk sayfa değilse yeni sayfa ekle
            if (page > 1) {
              pdf.addPage();
            }

            // PNG'yi PDF'e ekle
            const imgWidth = 210; // A4 genişliği (mm)
            const imgHeight = 297; // A4 yüksekliği (mm)
            pdf.addImage(dataURL, 'PNG', 0, 0, imgWidth, imgHeight);
            console.log(`Sayfa ${page} PDF'e eklendi.`);
          } else {
            console.error(`Canvas ${page} bulunamadı!`);
          }
        }

        // ADIM 4: PDFi blob olarak hazırla
        console.log('ADIM 4: PDF blob olarak hazırlanıyor...');
        const pdfOutput = pdf.output('blob');
        console.log('PDF blob boyutu:', pdfOutput.size, 'bytes');

        if (!pdfOutput || pdfOutput.size <= 0) {
          alert('PDF oluşturulamadı! PDF boyutu sıfır.');
          this.kaydetmeIsleminde = false;
          return;
        }

        // ADIM 5: FormData oluştur
        console.log('ADIM 5: FormData oluşturuluyor...');
        const formData = new FormData();

        // ADIM 6: Gerekli alanları kontrol et
        console.log('ADIM 6: Gerekli alanlar kontrol ediliyor...');

        // PDF adı kontrolü
        if (!dosyaAdi || dosyaAdi.trim() === '') {
          alert('PDF adı boş olamaz!');
          this.kaydetmeIsleminde = false;
          return;
        }

        // Öğrenci grubu kontrolü
        if (!this.secilenGrup || this.secilenGrup.trim() === '') {
          alert('Öğrenci grubu seçilmelidir!');
          this.kaydetmeIsleminde = false;
          return;
        }

        // ADIM 7: Form alanlarını doldur
        console.log('ADIM 7: FormData alanları dolduruluyor...');

        // Metin alanlarını ekle
        formData.append('pdf_adi', dosyaAdi);
        formData.append('ogrenci_grubu', this.secilenGrup);
        formData.append('sayfa_sayisi', this.totalPages.toString());

        // ADIM 8: PDF dosyasını FormData'ya ekle
        console.log("ADIM 8: PDF dosyası FormData'ya ekleniyor...");

        // PDF dosyasını oluştur
        const pdfFile = new File([pdfOutput], dosyaDosyaAdi, {
          type: 'application/pdf',
          lastModified: Date.now(),
        });

        // Dosya geçerlilik kontrolü
        if (!pdfFile || pdfFile.size <= 0) {
          alert('PDF dosyası oluşturulamadı veya boş!');
          this.kaydetmeIsleminde = false;
          return;
        }

        // PDF dosyasını FormData'ya ekle - üçüncü parametre dosya adını belirtir
        formData.append('pdf_dosyasi', pdfFile, dosyaDosyaAdi);
        console.log(
          "PDF dosyası FormData'ya eklendi:",
          pdfFile.name,
          pdfFile.size,
          'bytes'
        );

        // ADIM 9: Kapak sayfası ekle (opsiyonel)
        console.log('ADIM 9: Kapak sayfası ekleye hazırlanıyor...');
        if (this.canvasInstances[0]) {
          const coverDataURL = this.canvasInstances[0].toDataURL({
            format: 'png',
            quality: 0.8,
            multiplier: 1.5,
          });
          const coverBlob = this.dataURLtoBlob(coverDataURL);
          const coverFile = new File([coverBlob], 'kapak.png', {
            type: 'image/png',
            lastModified: Date.now(),
          });
          formData.append('cizim_verisi', coverFile, 'kapak.png');
          console.log(
            "Kapak sayfası FormData'ya eklendi:",
            coverFile.size,
            'bytes'
          );
        } else {
          console.log("Kapak sayfası canvas'ı bulunamadı. Kapak eklenmedi.");
        }

        // ADIM 10: FormData içeriğini kontrol et
        console.log('ADIM 10: FormData içeriği kontrol ediliyor...');
        let formDataEmpty = true;
        let hasPdfFile = false;
        let hasGroup = false;
        let hasPdfName = false;

        formData.forEach((value, key) => {
          formDataEmpty = false;
          console.log(
            `FormData içeriği - ${key}:`,
            value instanceof File
              ? `File (${value.name}, ${value.type}, ${value.size} bytes)`
              : value
          );

          if (
            key === 'pdf_dosyasi' &&
            value instanceof File &&
            value.size > 0
          ) {
            hasPdfFile = true;
          }
          if (key === 'ogrenci_grubu') {
            hasGroup = true;
          }
          if (key === 'pdf_adi') {
            hasPdfName = true;
          }
        });

        if (formDataEmpty) {
          alert('FormData boş! Hiçbir veri eklenemedi.');
          this.kaydetmeIsleminde = false;
          return;
        }

        if (!hasPdfFile) {
          alert("PDF dosyası FormData'ya eklenemedi!");
          this.kaydetmeIsleminde = false;
          return;
        }

        if (!hasGroup) {
          alert("Öğrenci grubu FormData'ya eklenemedi!");
          this.kaydetmeIsleminde = false;
          return;
        }

        if (!hasPdfName) {
          alert("PDF adı FormData'ya eklenemedi!");
          this.kaydetmeIsleminde = false;
          return;
        }

        // ADIM 11: API URL'ini belirle
        console.log('ADIM 11: API URL hazırlanıyor...');
        // Relative path kullanmak daha güvenilir
        const apiUrl = './server/api/konu_anlatim_kaydet.php';
        console.log('API URL:', apiUrl);

        // ADIM 12: HTTP isteğini gönder - daha sağlam yapılandırma ile
        console.log('ADIM 12: HTTP isteği gönderiliyor...');

        // HTTP istek yapılandırması - zaman aşımı süresini artırma
        const httpOptions = {
          reportProgress: true, // İlerleme raporlama
          observe: 'events' as const, // Olayları izle
          // 5 dakika zaman aşımı - büyük dosyalar için
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        };

        console.log('ADIM 12.1: İstek başlatılıyor...');

        // Authorization header'ını ekle
        let token = '';
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          token = user.token || '';
        }

        // HTTP istek gönderimi
        this.http
          .post(apiUrl, formData, {
            reportProgress: true,
            observe: 'events',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
            },
            responseType: 'json'
          })
          .subscribe({
            next: (event: any) => {
              // Event türüne göre işlemler
              if (event.type === 0) {
                console.log('ADIM 12.2: İstek gönderildi');
              } else if (event.type === 1) {
                // İlerleme olayı - yükleme ilerleme durumu
                if (event.loaded && event.total) {
                  const percentDone = Math.round(
                    (100 * event.loaded) / event.total
                  );
                  console.log(
                    `ADIM 12.3: Yükleme ilerlemesi: %${percentDone} (${event.loaded}/${event.total} bytes)`
                  );
                }
              } else if (event.type === 4) {
                // Yanıt alındı - ekstra güvenlik için try-catch bloğu içinde işliyoruz
                console.log('ADIM 13: Yanıt alındı - ham veri:', event.body);

                try {
                  // Yanıt zaten JSON objesi ise doğrudan kullan, string ise parse et
                  const jsonResponse = event.body;

                  if (jsonResponse && jsonResponse.success === true) {
                    console.log('İşlem başarılı:', jsonResponse);
                    alert(
                      `Konu anlatımı "${this.secilenGrup}" için başarıyla kaydedildi!`
                    );
                  } else {
                    console.warn('Sunucu hatası:', jsonResponse);
                    alert(
                      `Kaydetme hatası: ${
                        jsonResponse?.error ||
                        'Sunucu yanıtı beklenmeyen formatta'
                      }`
                    );
                  }
                } catch (e) {
                  console.error('Yanıt işleme hatası:', e);
                  console.log('Ham yanıt:', event.body);
                  alert(
                    'Kaydetme işlemi sırasında bir hata oluştu. Sunucu yanıtı işlenemedi.'
                  );
                }

                this.kaydetmeIsleminde = false;
              }
            },
            error: (error) => {
              console.error('ADIM 13: Kaydetme hatası - detaylı:', error);
              let errorMsg = 'Kaydetme işlemi sırasında bir hata oluştu: ';

              if (error.status === 0) {
                errorMsg +=
                  'Sunucuya bağlanılamadı. Ağ bağlantınızı kontrol edin.';
              } else if (error.status === 413) {
                errorMsg +=
                  'Dosya boyutu çok büyük. Daha küçük bir dosya deneyin.';
              } else if (error.status === 400) {
                errorMsg += 'Geçersiz istek. Lütfen tüm alanları kontrol edin.';
              } else if (error.error) {
                // Hata yanıtını işleme
                try {
                  if (typeof error.error === 'string') {
                    // HTML içeren yanıt kontrolü
                    if (
                      error.error.includes('<br />') ||
                      error.error.includes('<b>')
                    ) {
                      // PHP hata çıktısı gelmiş, düzgün bir şekilde göster
                      console.error('PHP hatası:', error.error);
                      errorMsg +=
                        'Sunucu tarafında PHP hatası oluştu. Lütfen yöneticinize başvurun.';
                    } else {
                      // String ise JSON'a çevirmeyi dene
                      try {
                        const jsonError = JSON.parse(error.error);
                        errorMsg += jsonError.error || 'Bilinmeyen hata';
                      } catch (e) {
                        // JSON parse hatası, ham string'i göster
                        errorMsg += error.error || 'Bilinmeyen hata';
                      }
                    }
                  } else if (typeof error.error === 'object') {
                    // Zaten nesne ise doğrudan kullan
                    errorMsg += error.error.error || 'Bilinmeyen hata';
                  } else {
                    errorMsg += 'Sunucu yanıtı beklenmeyen formatta';
                  }
                } catch (jsonErrorParseError) {
                  errorMsg += `Hata ayrıştırılamadı: ${
                    (jsonErrorParseError as any).message
                  }`;
                }
              } else {
                errorMsg += `Bilinmeyen bir hata oluştu. Durum kodu: ${error.status}`;
              }

              alert(errorMsg);
              console.log('Tam hata detayları:', error);
              this.kaydetmeIsleminde = false;
            },
            complete: () => {
              console.log('ADIM 14: İstek tamamlandı');
              this.kaydetmeIsleminde = false;
            },
          });
      };

      // İşlemi başlat
      processAllPages();
    } catch (error) {
      console.error('Beklenmeyen hata:', error);
      alert(
        'İşlem sırasında beklenmeyen bir hata oluştu: ' +
          (error instanceof Error ? error.message : String(error))
      );
      this.kaydetmeIsleminde = false;
    }
  }

  // DataURL'yi Blob'a dönüştür
  dataURLtoBlob(dataURL: string): Blob {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  // Sayfa terk edildiğinde uyarı mesajı göster
  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: any) {
    // Herhangi bir canvas'ta çizim var mı kontrol et
    let hasDrawings = false;

    for (const canvas of this.canvasInstances) {
      if (canvas && canvas.getObjects().length > 0) {
        hasDrawings = true;
        break;
      }
    }

    if (hasDrawings) {
      event.returnValue =
        'Sayfadan ayrılmak istediğinize emin misiniz? Yapılan değişiklikler kaybolabilir.';
      return event.returnValue;
    }
    return true;
  }

  // Tam ekran modu fonksiyonu
  tamEkranModu(): void {
    if (this.isTamEkran) {
      // Tam ekrandan çık
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    } else {
      // Tam ekrana geç
      const element = document.documentElement;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        (element as any).mozRequestFullScreen();
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((document as any).msRequestFullscreen) {
        (document as any).msRequestFullscreen();
      }
    }
    this.isTamEkran = !this.isTamEkran;
  }
}