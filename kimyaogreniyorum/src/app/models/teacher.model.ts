
export interface Teacher {
  id?: number;
  adi_soyadi: string;
  email: string;
  cep_telefonu?: string;
  sifre?: string;
  brans?: string;
  rutbe?: string;
  aktif: boolean;
  avatar?: string;
  kayit_tarihi?: string;
  guncelleme_tarihi?: string;
}

export interface TeacherResponse {
  success: boolean;
  data?: Teacher | Teacher[];
  message?: string;
  error?: string;
}
