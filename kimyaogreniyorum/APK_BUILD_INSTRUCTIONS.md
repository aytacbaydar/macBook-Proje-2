# 📱 Android APK Oluşturma Talimatları

## Ön Gereksinimler (MacBook'unuzda)

### 1. Java Development Kit (JDK) Kurulumu
```bash
# Homebrew ile Java kurulumu
brew install openjdk@17

# Java PATH'i ayarlama (~/.zshrc veya ~/.bash_profile)
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH=$JAVA_HOME/bin:$PATH
```

### 2. Android Studio Kurulumu
1. [Android Studio](https://developer.android.com/studio) indirin ve kurun
2. Android Studio'yu açın ve SDK kurulumunu tamamlayın
3. **SDK Manager** → **SDK Platforms** → **Android 14 (API 34)** seçin
4. **SDK Tools** → **Android SDK Build-Tools** ve **Android SDK Platform-Tools** seçin

### 3. Environment Variables
```bash
# ~/.zshrc veya ~/.bash_profile dosyasına ekleyin
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

## APK Oluşturma Adımları

### 1. Projeyi Hazırlama
```bash
cd kimyaogreniyorum
npm run build
npx cap sync android
```

### 2. Android Studio ile APK Build
```bash
# Android Studio'yu açma
npx cap open android
```

### 3. Android Studio'da:
1. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Build tamamlandığında **locate** linkine tıklayın
3. APK dosyası: `android/app/build/outputs/apk/debug/app-debug.apk`

### 4. APK'yı Web Sitesine Ekleme
```bash
# APK'yı public klasörüne kopyalama
cp android/app/build/outputs/apk/debug/app-debug.apk public/downloads/kimya-ogreniyorum.apk
```

## Test Etme

### Android Telefonda:
1. **Ayarlar** → **Güvenlik** → **Bilinmeyen kaynaklar**ı etkinleştirin
2. APK dosyasını telefona transfer edin
3. Dosyaya tıklayarak kurulumu başlatın

## Production APK İçin

### Release APK (imzalanmış):
1. Android Studio'da **Build** → **Generate Signed Bundle / APK**
2. **APK** seçin → **Next**
3. Keystore oluşturun veya mevcut keystore'u seçin
4. **Release** build variant seçin
5. Build tamamlandığında imzalanmış APK hazır

### APK İmzalama Bilgileri:
- **Keystore**: Google Play Store'da yayın için gerekli
- **Key alias**: Uygulamanızın benzersiz anahtarı
- **Password**: Güvenli şifre kullanın

## Sorun Giderme

### Gradle Build Hatası:
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Permission Denied:
```bash
chmod +x android/gradlew
```

### SDK Path Sorunu:
Android Studio → **File** → **Project Structure** → **SDK Location** kontrolü

## Otomatik Build (Gelişmiş)

### Gradle ile:
```bash
cd android
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

### Release Build:
```bash
./gradlew assembleRelease
# APK: app/build/outputs/apk/release/app-release-unsigned.apk
```

---

**🎯 APK oluşturduktan sonra `/public/downloads/kimya-ogreniyorum.apk` konumuna koyun ki öğrenciler indirebilsin!**