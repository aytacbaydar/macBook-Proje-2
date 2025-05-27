import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, insertOgrenciSchema, insertOgrenciBilgileriSchema } from "../shared/schema";
import { z } from "zod";
import { log } from "./vite";
import session from 'express-session';

// Session tipi tanımlaması
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
      adi_soyadi: string;
      rutbe: string;
    }
  }
}

// API yanıt tipi
type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};

// Error processing middleware
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Token kontrolü
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUser = req.session.user;
  
  if (!sessionUser) {
    return res.status(401).json({
      success: false,
      error: "Yetkilendirme hatası: Lütfen giriş yapın"
    });
  }
  
  next();
}

// Admin kontrolü
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sessionUser = req.session.user;
  
  if (!sessionUser) {
    return res.status(401).json({
      success: false,
      error: "Yetkilendirme hatası: Lütfen giriş yapın"
    });
  }
  
  if (sessionUser.rutbe !== 'admin') {
    return res.status(403).json({
      success: false,
      error: "Yetki hatası: Bu işlem için admin yetkisi gerekiyor"
    });
  }
  
  next();
}



export async function registerRoutes(app: Express): Promise<Server> {
  
  // API Rotaları
  // 1. Kimlik doğrulama
  app.post('/api/login', asyncHandler(async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const user = await storage.validateLogin(validatedData);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Hatalı email veya şifre"
        });
      }
      
      if (!user.aktif) {
        return res.status(403).json({
          success: false,
          error: "Hesabınız aktif değil. Lütfen yönetici ile iletişime geçin."
        });
      }
      
      // Session'a kullanıcı bilgilerini sakla
      req.session.user = {
        id: user.id,
        email: user.email,
        adi_soyadi: user.adi_soyadi,
        rutbe: user.rutbe
      };
      
      // Hassas bilgileri çıkart
      const { sifre, ...userWithoutPassword } = user;
      
      res.json({
        success: true,
        data: userWithoutPassword
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.errors.map(e => e.message).join(', ')
        });
      }
      throw error;
    }
  }));
  
  app.post('/api/register', asyncHandler(async (req, res) => {
    try {
      const validatedData = insertOgrenciSchema.parse(req.body);
      
      // Email daha önce kullanılmış mı kontrol et
      const existingUser = await storage.getOgrenciByEmail(validatedData.email);
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: "Bu email adresi zaten kullanılıyor"
        });
      }
      
      const newUser = await storage.createOgrenci(validatedData);
      
      // Hassas bilgileri çıkart
      const { sifre, ...userWithoutPassword } = newUser;
      
      // Otomatik giriş yap
      req.session.user = {
        id: newUser.id,
        email: newUser.email,
        adi_soyadi: newUser.adi_soyadi,
        rutbe: newUser.rutbe
      };
      
      res.status(201).json({
        success: true,
        data: userWithoutPassword
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.errors.map(e => e.message).join(', ')
        });
      }
      throw error;
    }
  }));
  
  app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: "Çıkış yapılırken bir hata oluştu"
        });
      }
      
      res.json({
        success: true,
        message: "Başarıyla çıkış yapıldı"
      });
    });
  });
  
  // 2. Kullanıcı profili işlemleri
  app.get('/api/profile', requireAuth, asyncHandler(async (req, res) => {
    const userId = req.session.user!.id;
    const user = await storage.getOgrenci(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Kullanıcı bulunamadı"
      });
    }
    
    // Hassas bilgileri çıkart
    const { sifre, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: userWithoutPassword
    });
  }));
  
  app.patch('/api/profile', requireAuth, asyncHandler(async (req, res) => {
    try {
      const userId = req.session.user!.id;
      
      // Temel bilgiler güncellemesi
      if (req.body.temel_bilgiler) {
        // Validate update data
        const { temel_bilgiler } = req.body;
        
        // Admin değilse rutbe ve aktif alanlarını değiştirmeye izin verme
        if (req.session.user!.rutbe !== 'admin') {
          delete temel_bilgiler.rutbe;
          delete temel_bilgiler.aktif;
        }
        
        await storage.updateOgrenci(userId, temel_bilgiler);
        
        // Session bilgilerini güncelle
        if (temel_bilgiler.adi_soyadi) {
          req.session.user!.adi_soyadi = temel_bilgiler.adi_soyadi;
        }
        
        if (temel_bilgiler.email) {
          req.session.user!.email = temel_bilgiler.email;
        }
      }
      
      // Detay bilgileri güncellemesi
      if (req.body.detay_bilgiler) {
        const { detay_bilgiler } = req.body;
        await storage.updateOgrenciBilgileri(userId, detay_bilgiler);
      }
      
      // Güncel kullanıcı bilgilerini getir
      const updatedUser = await storage.getOgrenci(userId);
      
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          error: "Kullanıcı bulunamadı"
        });
      }
      
      // Hassas bilgileri çıkart
      const { sifre, ...userWithoutPassword } = updatedUser;
      
      res.json({
        success: true,
        data: userWithoutPassword,
        message: "Profil başarıyla güncellendi"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.errors.map(e => e.message).join(', ')
        });
      }
      throw error;
    }
  }));
  
  // 3. Admin işlemleri
  app.get('/api/students', requireAdmin, asyncHandler(async (req, res) => {
    const students = await storage.getAllOgrenciler();
    
    // Hassas bilgileri çıkart
    const studentsWithoutPassword = students.map(student => {
      const { sifre, ...studentWithoutPassword } = student;
      return studentWithoutPassword;
    });
    
    res.json({
      success: true,
      data: studentsWithoutPassword
    });
  }));
  
  app.get('/api/students/:id', requireAdmin, asyncHandler(async (req, res) => {
    const studentId = parseInt(req.params.id);
    
    if (isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        error: "Geçersiz öğrenci ID"
      });
    }
    
    const student = await storage.getOgrenci(studentId);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        error: "Öğrenci bulunamadı"
      });
    }
    
    // Hassas bilgileri çıkart
    const { sifre, ...studentWithoutPassword } = student;
    
    res.json({
      success: true,
      data: studentWithoutPassword
    });
  }));
  
  app.post('/api/students', requireAdmin, asyncHandler(async (req, res) => {
    try {
      // Yeni öğrenci kaydı
      const validatedData = insertOgrenciSchema.parse(req.body);
      
      // Email daha önce kullanılmış mı kontrol et
      const existingUser = await storage.getOgrenciByEmail(validatedData.email);
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: "Bu email adresi zaten kullanılıyor"
        });
      }
      
      const newStudent = await storage.createOgrenci(validatedData);
      
      // Hassas bilgileri çıkart
      const { sifre, ...studentWithoutPassword } = newStudent;
      
      res.status(201).json({
        success: true,
        data: studentWithoutPassword,
        message: "Öğrenci başarıyla oluşturuldu"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.errors.map(e => e.message).join(', ')
        });
      }
      throw error;
    }
  }));
  
  app.patch('/api/students/:id', requireAdmin, asyncHandler(async (req, res) => {
    try {
      const studentId = parseInt(req.params.id);
      
      if (isNaN(studentId)) {
        return res.status(400).json({
          success: false,
          error: "Geçersiz öğrenci ID"
        });
      }
      
      // Öğrenci varlığını kontrol et
      const student = await storage.getOgrenci(studentId);
      
      if (!student) {
        return res.status(404).json({
          success: false,
          error: "Öğrenci bulunamadı"
        });
      }
      
      // Temel bilgiler güncellemesi
      if (req.body.temel_bilgiler) {
        const { temel_bilgiler } = req.body;
        await storage.updateOgrenci(studentId, temel_bilgiler);
      }
      
      // Detay bilgileri güncellemesi
      if (req.body.detay_bilgiler) {
        const { detay_bilgiler } = req.body;
        await storage.updateOgrenciBilgileri(studentId, detay_bilgiler);
      }
      
      // Güncel öğrenci bilgilerini getir
      const updatedStudent = await storage.getOgrenci(studentId);
      
      if (!updatedStudent) {
        return res.status(404).json({
          success: false,
          error: "Öğrenci bulunamadı"
        });
      }
      
      // Hassas bilgileri çıkart
      const { sifre, ...studentWithoutPassword } = updatedStudent;
      
      res.json({
        success: true,
        data: studentWithoutPassword,
        message: "Öğrenci bilgileri başarıyla güncellendi"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.errors.map(e => e.message).join(', ')
        });
      }
      throw error;
    }
  }));
  
  app.delete('/api/students/:id', requireAdmin, asyncHandler(async (req, res) => {
    const studentId = parseInt(req.params.id);
    
    if (isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        error: "Geçersiz öğrenci ID"
      });
    }
    
    // Öğrenci varlığını kontrol et
    const student = await storage.getOgrenci(studentId);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        error: "Öğrenci bulunamadı"
      });
    }
    
    // Öğrenciyi sil
    const deleted = await storage.deleteOgrenci(studentId);
    
    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: "Öğrenci silinirken bir hata oluştu"
      });
    }
    
    res.json({
      success: true,
      message: "Öğrenci başarıyla silindi"
    });
  }));
  
  // HTTP Server oluştur
  const httpServer = createServer(app);

  return httpServer;
}
