export class CevapAnahtari {
  id?: number;
  sinav_adi: string;
  sinav_turu: string;
  soru_sayisi: number;
  tarih: string;
  sinav_kapagi: string;
  // Her soru için ayrı sütunlar olarak cevapları tutacak obje
  cevaplar: { [key: string]: string }; // Örn: { ca1: 'A', ca2: 'B', ... }
  // Her soru için konu bilgisi
  konular: { [key: string]: string }; // Örn: { ka1: 'Fonksiyonlar', ka2: 'Türev', ... }
  // Her soru için video çözümü linki
  videolar: { [key: string]: string }; // Örn: { va1: 'video_url1', va2: 'video_url2', ... }
  // Sınavın aktiflik durumu
  aktiflik: boolean;

  constructor(data?: Partial<CevapAnahtari>) {
    this.id = data?.id;
    this.sinav_adi = data?.sinav_adi || '';
    this.sinav_turu = data?.sinav_turu || '';
    this.soru_sayisi = data?.soru_sayisi || 0;
    this.tarih = data?.tarih || '';
    this.sinav_kapagi = data?.sinav_kapagi || '';
    this.cevaplar = data?.cevaplar || {};
    this.konular = data?.konular || {};
    this.videolar = data?.videolar || {};
    this.aktiflik = data?.aktiflik ?? true;
  }

  // Yardımcı metod: JSON'dan CevapAnahtari nesnesi oluşturur
  static fromJson(json: any): CevapAnahtari {
    return new CevapAnahtari({
      id: json.id,
      sinav_adi: json.sinav_adi,
      sinav_turu: json.sinav_turu,
      soru_sayisi: json.soru_sayisi,
      tarih: json.tarih,
      sinav_kapagi: json.sinav_kapagi,
      cevaplar:
        typeof json.cevaplar === 'object'
          ? json.cevaplar
          : JSON.parse(json.cevaplar || '{}'),
      konular:
        typeof json.konular === 'object'
          ? json.konular
          : JSON.parse(json.konular || '{}'),
      videolar:
        typeof json.videolar === 'object'
          ? json.videolar
          : JSON.parse(json.videolar || '{}'),
      aktiflik: json.aktiflik !== undefined ? Boolean(json.aktiflik) : true,
    });
  }

  // Yardımcı metod: CevapAnahtari nesnesini JSON formatına dönüştürür
  toJson(): any {
    return {
      id: this.id,
      sinav_adi: this.sinav_adi,
      sinav_turu: this.sinav_turu,
      soru_sayisi: this.soru_sayisi,
      tarih: this.tarih,
      sinav_kapagi: this.sinav_kapagi,
      cevaplar: this.cevaplar,
      konular: this.konular,
      videolar: this.videolar,
      aktiflik: this.aktiflik,
    };
  }
}
