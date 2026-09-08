# ADD SmartDrift Clean — Native App Byggevejledning

**Version:** 3.0.0  
**Platforme:** Web (PWA), iOS, Android  
**Teknologi:** Capacitor 8 + React 19 + TypeScript

---

## Arkitektur

```
Web (React) ──→ Capacitor ──→ iOS App (App Store)
                    │         
                    └────────→ Android App (Google Play)
```

Capacitor pakker den eksisterende web-app som native apps. Én kodebase, tre platforme.

---

## Native Plugins Installeret

| Plugin | Funktion | Brugt til |
|--------|----------|-----------|
| @capacitor/camera | Kamera | Kvalitetskontrol-fotos, QR-scanning |
| @capacitor/geolocation | GPS | Ruteplanlægning, opgave-stempling |
| @capacitor/push-notifications | Push | Notifikationer om nye opgaver, rykkere |
| @capacitor/local-notifications | Lokale notifikationer | Påmindelser, deadlines |
| @capacitor/haptics | Vibration | Feedback ved handlinger |
| @capacitor/network | Netværksstatus | Offline/online detektion |
| @capacitor/status-bar | Status bar | Tema-farve på status bar |
| @capacitor/splash-screen | Splash screen | App-opstart |
| @capacitor/app | App lifecycle | Baggrund/forgrund håndtering |
| @capacitor/keyboard | Keyboard | Keyboard styling (iOS) |
| @capacitor/share | Deling | Del dokumenter, fakturaer |
| @capacitor/preferences | Lokal storage | Cache indstillinger |
| @capacitor/filesystem | Filsystem | Gem/læs filer lokalt |

---

## Native Bridge

`client/src/lib/native-bridge.ts` wrapper alle plugins med web fallbacks:

- **isNative()** — detekterer om appen kører som native eller web
- **takePhoto()** — kamera med web fallback (file input)
- **getCurrentPosition()** — GPS med web fallback (navigator.geolocation)
- **watchPosition()** — live GPS tracking med web fallback
- **initPushNotifications()** — push registrering (kun native)
- **scheduleLocalNotification()** — planlæg lokale notifikationer
- **hapticFeedback()** — vibration (light/medium/heavy)
- **getNetworkStatus() / onNetworkChange()** — netværksdetektion
- **onAppStateChange() / onBackButton()** — app lifecycle
- **shareContent()** — deling med web fallback (navigator.share)
- **saveFile() / readFile()** — lokal filhåndtering

---

## Byg iOS App

### Krav
- macOS computer med Xcode 15+
- Apple Developer konto ($99/år)
- CocoaPods installeret

### Trin
```bash
cd /home/user/workspace/renserapp

# 1. Opdater web bundle
npm run build

# 2. Sync til iOS
npx cap sync ios

# 3. Åbn i Xcode
npx cap open ios

# 4. I Xcode:
#    - Vælg signing team
#    - Sæt Bundle Identifier: dk.smartdriftclean.app
#    - Opdater version til 3.0.0
#    - Build (Cmd+B)
#    - Archive (Product → Archive) for App Store
#    - Upload via App Store Connect
```

### iOS Permissions (Info.plist)
- **NSCameraUsageDescription** — kamera til fotos og QR
- **NSLocationWhenInUseUsageDescription** — GPS til ruter
- **NSLocationAlwaysAndWhenInUseUsageDescription** — baggrunds-GPS
- **NSPhotoLibraryUsageDescription** — vedhæft dokumenter
- **UIBackgroundModes** — remote-notification, location, fetch

---

## Byg Android App

### Krav
- Android Studio (Hedgehog eller nyere)
- Java JDK 17+
- Google Play Developer konto ($25 engangs)

### Trin
```bash
cd /home/user/workspace/renserapp

# 1. Opdater web bundle
npm run build

# 2. Sync til Android
npx cap sync android

# 3. Åbn i Android Studio
npx cap open android

# 4. I Android Studio:
#    - Build → Generate Signed Bundle / APK
#    - Opret keystore (gem sikkert!)
#    - Vælg release build variant
#    - Build APK eller App Bundle (.aab)
#    - Upload til Google Play Console
```

### Android Permissions (AndroidManifest.xml)
- INTERNET — netværksadgang
- CAMERA — kamera
- ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION — GPS
- ACCESS_BACKGROUND_LOCATION — baggrunds-GPS
- POST_NOTIFICATIONS — push notifikationer (Android 13+)
- VIBRATE — haptic feedback
- READ/WRITE_EXTERNAL_STORAGE — filhåndtering
- ACCESS_NETWORK_STATE — netværksstatus
- WAKE_LOCK — baggrundsprocesser
- RECEIVE_BOOT_COMPLETED — auto-start

---

## Opdatering af Apps

Når du har ændringer i web-koden:

```bash
# 1. Byg ny web bundle
npm run build

# 2. Sync til begge platforme
npx cap sync

# 3. Byg og upload apps
npx cap open ios      # iOS: Archive → Upload
npx cap open android  # Android: Build → Generate Signed APK
```

---

## App Store Metadata

### App navn
ADD SmartDrift Clean

### Kort beskrivelse (DK)
Komplet platform til drift af rengøringsselskaber. Håndtér opgaver, ansatte, tidsregistrering, fakturering, kunder og meget mere — alt i én app.

### Lange beskrivelse (DK)
ADD SmartDrift Clean er den komplette platform til rengøringsselskaber der vil digitalisere deres drift. Med over 100 funktioner får du alt du behøver:

• Opgave- og ruteplanlægning med GPS
• Tidsregistrering med automatisk lønberegning
• Fakturering og abonnementer
• Kundeportal med selvbetjening
• Kvalitetskontrol med fotos
• HR og dokumenthåndtering
• GDPR-compliance værktøjer
• Offline understøttelse
• Push-notifikationer

Appen fungerer sammen med ADD SmartRegnskab — et uafhængigt regnskabssystem der håndterer alle virksomhedstyper, ikke kun rengøring.

### Keywords
rengøring, drift, opgaver, tidsregistrering, fakturering, kunder, løn, GDPR

### Kategori
Business

### Aldersgrænse
4+ (ingen upassende indhold)

---

## Produktion Checklist

### Før første upload
- [ ] Test app på fysisk iPhone (mindst iOS 15)
- [ ] Test app på fysisk Android (mindst Android 10)
- [ ] Verificer at kamera, GPS og push virker
- [ ] Test offline mode
- [ ] Opret Apple App Store listing (skærmbilleder, beskrivelse, ikoner)
- [ ] Opret Google Play listing (skærmbilleder, beskrivelse, ikoner)
- [ ] Konfigurer push server (Firebase Cloud Messaging)
- [ ] Sæt produktions API URL i capacitor.config.ts
- [ ] Byg med release keystore / signing certificate
- [ ] Verificer at backend server kører på produktions-URL

### Efter upload
- [ ] Test In-App Purchase (abonnementer)
- [ ] Test push notifikationer fra produktionsserver
- [ ] Overvåg crash reports (Crashlytics / Sentry)
- [ ] Indsaml brugerfeedback
- [ ] Planlæg regelmæssige opdateringer
