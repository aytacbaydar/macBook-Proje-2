import { 
  ogrenciler, 
  ogrenciBilgileri, 
  type Ogrenci, 
  type InsertOgrenci, 
  type OgrenciBilgileri, 
  type InsertOgrenciBilgileri,
  type OgrenciWithBilgileri,
  type Login
} from "../shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import * as crypto from "crypto";

// Şifre hash fonksiyonu
function hashPassword(password: string): string {
  return crypto.createHash('md5').update(password).digest('hex');
}

// Storage Interface
export interface IStorage {
  // Öğrenci işlemleri
  getOgrenci(id: number): Promise<OgrenciWithBilgileri | undefined>;
  getOgrenciByEmail(email: string): Promise<Ogrenci | undefined>;
  createOgrenci(ogrenci: InsertOgrenci): Promise<Ogrenci>;
  updateOgrenci(id: number, ogrenci: Partial<InsertOgrenci>): Promise<Ogrenci | undefined>;
  deleteOgrenci(id: number): Promise<boolean>;
  getAllOgrenciler(): Promise<OgrenciWithBilgileri[]>;
  
  // Öğrenci bilgileri işlemleri
  getOgrenciBilgileri(ogrenciId: number): Promise<OgrenciBilgileri | undefined>;
  createOgrenciBilgileri(bilgiler: InsertOgrenciBilgileri): Promise<OgrenciBilgileri>;
  updateOgrenciBilgileri(ogrenciId: number, bilgiler: Partial<InsertOgrenciBilgileri>): Promise<OgrenciBilgileri | undefined>;
  
  // Kimlik doğrulama
  validateLogin(loginData: Login): Promise<Ogrenci | undefined>;
}

// DB Storage Implementation
export class DbStorage implements IStorage {
  // Öğrenci işlemleri
  async getOgrenci(id: number): Promise<OgrenciWithBilgileri | undefined> {
    const result = await db.select().from(ogrenciler).where(eq(ogrenciler.id, id));
    if (!result.length) return undefined;
    
    const ogrenci = result[0];
    const bilgilerResult = await this.getOgrenciBilgileri(id);
    
    return {
      ...ogrenci,
      bilgiler: bilgilerResult
    };
  }
  
  async getOgrenciByEmail(email: string): Promise<Ogrenci | undefined> {
    const result = await db.select().from(ogrenciler).where(eq(ogrenciler.email, email));
    return result[0];
  }
  
  async createOgrenci(insertOgrenci: InsertOgrenci): Promise<Ogrenci> {
    // Şifreyi hashle
    const hashedPassword = hashPassword(insertOgrenci.sifre);
    
    const result = await db.insert(ogrenciler).values({
      ...insertOgrenci,
      sifre: hashedPassword
    }).returning();
    
    return result[0];
  }
  
  async updateOgrenci(id: number, updateData: Partial<InsertOgrenci>): Promise<Ogrenci | undefined> {
    // Eğer şifre güncellenmişse hashle
    if (updateData.sifre) {
      updateData.sifre = hashPassword(updateData.sifre);
    }
    
    const result = await db.update(ogrenciler)
      .set(updateData)
      .where(eq(ogrenciler.id, id))
      .returning();
      
    return result[0];
  }
  
  async deleteOgrenci(id: number): Promise<boolean> {
    // Önce öğrenci bilgilerini sil
    await db.delete(ogrenciBilgileri).where(eq(ogrenciBilgileri.ogrenci_id, id));
    
    // Sonra öğrenciyi sil
    const result = await db.delete(ogrenciler).where(eq(ogrenciler.id, id)).returning();
    return result.length > 0;
  }
  
  async getAllOgrenciler(): Promise<OgrenciWithBilgileri[]> {
    const ogrencilerResult = await db.select().from(ogrenciler);
    const bilgilerResult = await db.select().from(ogrenciBilgileri);
    
    // Öğrenci ve bilgileri birleştir
    return ogrencilerResult.map(ogrenci => {
      const bilgi = bilgilerResult.find(b => b.ogrenci_id === ogrenci.id);
      return {
        ...ogrenci,
        bilgiler: bilgi
      };
    });
  }
  
  // Öğrenci bilgileri işlemleri
  async getOgrenciBilgileri(ogrenciId: number): Promise<OgrenciBilgileri | undefined> {
    const result = await db.select()
      .from(ogrenciBilgileri)
      .where(eq(ogrenciBilgileri.ogrenci_id, ogrenciId));
      
    return result[0];
  }
  
  async createOgrenciBilgileri(bilgiler: InsertOgrenciBilgileri): Promise<OgrenciBilgileri> {
    const result = await db.insert(ogrenciBilgileri)
      .values(bilgiler)
      .returning();
      
    return result[0];
  }
  
  async updateOgrenciBilgileri(ogrenciId: number, updateData: Partial<InsertOgrenciBilgileri>): Promise<OgrenciBilgileri | undefined> {
    // Bilgiler var mı kontrol et
    const mevcut = await this.getOgrenciBilgileri(ogrenciId);
    
    if (mevcut) {
      // Güncelle
      const result = await db.update(ogrenciBilgileri)
        .set(updateData)
        .where(eq(ogrenciBilgileri.ogrenci_id, ogrenciId))
        .returning();
        
      return result[0];
    } else {
      // Yeni kayıt oluştur
      const newData = {
        ogrenci_id: ogrenciId,
        ...updateData
      } as InsertOgrenciBilgileri;
      
      return this.createOgrenciBilgileri(newData);
    }
  }
  
  // Kimlik doğrulama
  async validateLogin(loginData: Login): Promise<Ogrenci | undefined> {
    const hashedPassword = hashPassword(loginData.sifre);
    
    const result = await db.select()
      .from(ogrenciler)
      .where(
        and(
          eq(ogrenciler.email, loginData.email),
          eq(ogrenciler.sifre, hashedPassword)
        )
      );
      
    return result[0];
  }
}

export const storage = new DbStorage();
