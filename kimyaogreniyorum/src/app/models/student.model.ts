
export interface Student {
  id?: number;
  adi_soyadi: string;
  email: string;
  cep_telefonu?: string;
  sifre?: string;
  okulu?: string;
  sinifi?: string;
  grubu?: string;
  ders_gunu?: string;
  ders_saati?: string;
  ucret?: string;
  rutbe?: string;
  aktif: boolean;
  avatar?: string;
  veli_adi?: string;
  veli_cep?: string;
  brans?: string; // Yeni eklenen branş alanı
  kayit_tarihi?: string;
  guncelleme_tarihi?: string;
}

export interface StudentResponse {
  success: boolean;
  data?: Student | Student[];
  message?: string;
  error?: string;
}

export interface StudentListResponse extends StudentResponse {
  data?: Student[];
  total?: number;
  page?: number;
  limit?: number;
}
