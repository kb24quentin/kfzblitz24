# kfzblitz24 Retoure PDA — Android App

Native Android-Companion zur PWA unter `https://pda.rma.staging.kfzblitz24-group.com/pda-app`.

## Projekt in Android Studio öffnen

1. Android Studio starten (Hedgehog 2023.1.1 oder neuer empfohlen)
2. **File → Open** → Ordner `services/retoure-pda-android/` auswählen
3. Android Studio erkennt das Gradle-Projekt automatisch
4. **Gradle Sync starten**: oben rechts "Sync Now" klicken oder `File → Sync Project with Gradle Files`
5. JDK 17 muss konfiguriert sein: `File → Project Structure → SDK Location → JDK location`

## Debug-APK bauen

Im Ordner `services/retoure-pda-android/`:

```bash
./gradlew assembleDebug
```

Das APK liegt anschließend unter:
```
app/build/outputs/apk/debug/app-debug.apk
```

## Auf Gerät installieren

**Variante A — USB:**
1. Gerät per USB anschließen
2. Entwickleroptionen + USB-Debugging aktivieren (Einstellungen → Über das Telefon → 7× auf Build-Nummer tippen)
3. APK installieren:
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

**Variante B — Direkt aus Android Studio:**
- Gerät verbinden → im "Run"-Dropdown das Gerät auswählen → "Run" klicken (grünes Dreieck)

## Erste Inbetriebnahme — Base-URL auf Prod stellen

Nach der Installation öffnet sich die Pair-Seite. Bevor gepairt wird, Base-URL prüfen:
1. In der Pair-Seite gibt es keinen direkten URL-Zugang — zuerst manuell einen Token eingeben (aus dem Admin-Dashboard kopieren)
2. Nach erfolgreichem Login: **Settings-Icon** (oben rechts auf dem Home-Screen) öffnen
3. **Server-URL** auf Produktions-URL ändern: `https://pda.rma.kfzblitz24-group.com`
4. "Speichern" tippen
5. **Abmelden** → neu pairen mit Prod-QR-Code

Alternativ: Einfach den Prod-QR-Code aus dem Admin-Dashboard scannen — das Pairing erfolgt direkt gegen die in der QR-URL enthaltene Basis-URL.

## Scanner-Konfiguration — Vendor-SDK-Adapter einstöpseln

Die Scanner-Abstraktion besteht aus drei Schichten:

```
CompositeScanner
  ├── KeyboardWedgeScanner  (HID-Keyboard-Emulation, z. B. Netum Q900)
  └── IntentBroadcastScanner (Newland, Honeywell, Zebra DataWedge, generisch)
```

**Wo der Vendor-SDK-Adapter eingestöpselt wird:**

Datei: `app/src/main/java/de/kfzblitz24/retoure_pda/data/scanner/IntentBroadcastScanner.kt`

Im Kommentar-Block ist ein vollständiger auskommentierter Stub `VendorSdkScanner`:

```kotlin
// class VendorSdkScanner(private val context: Context) : BarcodeScanner {
//     private val _scans = MutableSharedFlow<String>(extraBufferCapacity = 32)
//     override val scans: Flow<String> = _scans
//     // private val barcodeReader = BarcodeReaderFactory.create(context)
//     override fun startListening() { /* barcodeReader.claim() */ }
//     override fun stopListening() { /* barcodeReader.release() */ }
// }
```

Schritte zum Einbinden:
1. SDK-AAR zu `app/build.gradle.kts` hinzufügen
2. Klasse `VendorSdkScanner` aus dem Stub erzeugen und ausfüllen
3. In `CompositeScanner.kt` einbinden (neben `keyboard` und `intent`)

## Unterstützte PDA-Scanner (out of the box)

| Hersteller | Intent-Action | Extra-Key |
|---|---|---|
| Newland | `nlscan.action.SCANNER_RESULT` | `SCAN_BARCODE1` |
| Honeywell | `com.honeywell.aidc.action.ACTION_BARCODE_DATA` | `data` |
| Zebra DataWedge | `com.symbol.datawedge.api.RESULT_ACTION` | `com.symbol.datawedge.data_string` |
| Generisch (CN) | `scan.rcv.message` | `barocode` oder `barcode` |
| HID Keyboard Wedge | — (TextField-Eingabe) | — |

## Permissions

Die App benötigt folgende Android-Permissions (in `AndroidManifest.xml` deklariert):

| Permission | Wozu |
|---|---|
| `INTERNET` | API-Kommunikation mit dem Server |
| `CAMERA` | QR-Code-Scan beim Pairing + Foto-Capture (CameraX) |

Keine sensitiven Permissions (kein Storage, kein Location, kein Contacts).

## Architektur-Überblick

```
RetourePdaApp          (Application — Singletons: TokenStore, ApiClient, Repos, Scanner)
MainActivity           (Compose Entry + NavHost)
  ├── PairScreen       (QR-Scan mit ML Kit + manuelle Eingabe)
  ├── HomeScreen       (Suche nach Bestellnummer/RMA-Code)
  ├── CaseDetailScreen (5-Step-Wizard: Eingang → Scannen → Bewerten → Palette → Fertig)
  │     └── steps/     (ReceiveStep, ScanStep, AssessStep, PaletteStep, DoneStep)
  ├── ItemPhotosScreen (CameraX-Capture + Coil-Thumbnails mit Auth)
  └── SettingsScreen   (Base-URL, manueller Token, Logout)
```

**Kein Hilt** — manuelle DI via `RetourePdaApp`-Singletons. Kann später nachgerüstet werden.
**Kein Room** — kein Offline-Cache (kommt in Phase 2).
**Kein FCM** — keine Push-Notifications (nicht benötigt).

## Bekannte Einschränkungen (Scaffold-Stand)

- OCR/AI-Score aus dem Backend wird im Assess-Step angezeigt, aber nicht animiert
- Extra-Artikel-Eingabe (Artikel im Paket der nicht zur Order gehört) ist noch nicht implementiert — Button im Scan-Step führt zur Web-Fallback-URL
- Offline-Modus: kein Caching — App braucht aktive Verbindung

## Branching

Direkt auf `develop` committed. User pusht nach Review. Nicht auf `main` pushen ohne explizite Freigabe.
