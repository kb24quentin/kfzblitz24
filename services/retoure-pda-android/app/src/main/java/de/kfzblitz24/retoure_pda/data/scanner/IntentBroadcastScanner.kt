package de.kfzblitz24.retoure_pda.data.scanner

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow

/**
 * Scanner-Adapter für PDA-Hardware mit System-Intent-Broadcasting.
 *
 * Unterstützte Hersteller:
 *   - Newland          → Action: `nlscan.action.SCANNER_RESULT`
 *                         Extra: `SCAN_BARCODE1`
 *   - Honeywell        → Action: `com.honeywell.aidc.action.ACTION_BARCODE_DATA`
 *                         Extra: `data`
 *   - Zebra DataWedge  → Action: `com.symbol.datawedge.api.RESULT_ACTION`
 *                         Extra: `com.symbol.datawedge.data_string`
 *   - Generisch (CN)   → Action: `scan.rcv.message`
 *                         Extra: `barocode` (sic — Tippfehler in Firmware!) ODER `barcode`
 *
 * Lifecycle:
 *   startListening() registriert den BroadcastReceiver dynamisch.
 *   stopListening() meldet ihn wieder ab. Kein statischer Eintrag in
 *   AndroidManifest.xml nötig (mit Ausnahme älterer Newland-Firmware,
 *   siehe Kommentar im Manifest).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VENDOR-SDK PLUG-IN-PUNKT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Einige Hersteller bieten SDKs an, die direkte Callback-Registrierung
 * (ohne Broadcast) ermöglichen — typischerweise zuverlässiger und schneller.
 *
 * Um ein Vendor-SDK einzustöpseln:
 *   1. Füge die SDK-AAR/Dependency zur app/build.gradle.kts hinzu.
 *   2. Erstelle eine neue Klasse `VendorXyzScanner : BarcodeScanner`.
 *   3. Initialisiere den SDK-Scanner im Konstruktor.
 *   4. Im CompositeScanner: ergänze die neue Instanz neben keyboard + intent.
 *
 * Auskommentierter Stub für Referenz:
 *
 *   class VendorSdkScanner(private val context: Context) : BarcodeScanner {
 *       private val _scans = MutableSharedFlow<String>(extraBufferCapacity = 32)
 *       override val scans: Flow<String> = _scans
 *
 *       // Vendor-SDK-Instanz (hier als Platzhalter):
 *       // private val barcodeReader = BarcodeReaderFactory.create(context)
 *
 *       override fun startListening() {
 *           // barcodeReader.addBarcodeListener { barcode ->
 *           //     _scans.tryEmit(barcode.barcodeData)
 *           // }
 *           // barcodeReader.claim()
 *       }
 *
 *       override fun stopListening() {
 *           // barcodeReader.release()
 *       }
 *   }
 */
class IntentBroadcastScanner(private val context: Context) : BarcodeScanner {

    private val _scans = MutableSharedFlow<String>(extraBufferCapacity = 32)
    override val scans: Flow<String> = _scans

    private var receiver: BroadcastReceiver? = null

    override fun startListening() {
        if (receiver != null) return  // already registered

        val br = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                if (intent == null) return
                // Diagnostik: Action + alle Extras dumpen — hilft enorm
                // beim Debugging unbekannter OEM-Firmware (z. B. wenn
                // der Q900 unter `scan.rcv.message` ein anderes Extra-
                // Feld nutzt als wir erwarten).
                val extras = intent.extras
                val extraDump = extras?.keySet()?.joinToString(", ") { key ->
                    "$key=${extras.get(key)}"
                } ?: "(no extras)"
                Log.d(TAG, "BROADCAST action=${intent.action} extras={$extraDump}")

                val barcode = extractBarcode(intent) ?: return
                if (barcode.isNotBlank()) {
                    Log.d(TAG, "SCAN emit: '$barcode'")
                    _scans.tryEmit(barcode.trim())
                }
            }
        }

        val filter = IntentFilter().apply {
            addAction(ACTION_NEWLAND)
            addAction(ACTION_HONEYWELL)
            addAction(ACTION_ZEBRA)
            addAction(ACTION_GENERIC)
            addAction(ACTION_HS_BARCODE_SEND)
            addAction(ACTION_HS_DCS)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // WICHTIG: RECEIVER_EXPORTED (nicht NOT_EXPORTED!). Die OEM-
            // Scanner-Services (Netum/Newland/Honeywell) laufen in einem
            // SEPARATEN System-Prozess und senden ihren Broadcast als
            // externe App. Mit NOT_EXPORTED würden wir auf Android 13+
            // diese Broadcasts STILL droppen — das war der Grund warum
            // Q900-Scans gar nicht erst bei uns ankamen.
            context.registerReceiver(br, filter, Context.RECEIVER_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(br, filter)
        }
        receiver = br
    }

    override fun stopListening() {
        receiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (_: IllegalArgumentException) {
                // Schon abgemeldet — ignorieren
            }
        }
        receiver = null
    }

    private fun extractBarcode(intent: Intent): String? {
        return when (intent.action) {
            ACTION_NEWLAND    -> intent.getStringExtra(EXTRA_NEWLAND)
            ACTION_HONEYWELL  -> intent.getStringExtra(EXTRA_HONEYWELL)
            ACTION_ZEBRA      -> intent.getStringExtra(EXTRA_ZEBRA)
            ACTION_GENERIC    -> {
                // Generische chinesische Firmware hat Tippfehler "barocode"
                intent.getStringExtra(EXTRA_GENERIC_TYPO)
                    ?: intent.getStringExtra(EXTRA_GENERIC_CORRECT)
            }
            ACTION_HS_BARCODE_SEND, ACTION_HS_DCS -> {
                // Netum Q900 / Honeywell-HS-Wrapper-Firmware. Wir kennen
                // den Extra-Key noch nicht exakt — probieren der Reihe
                // nach die wahrscheinlichsten Kandidaten. Das Logging in
                // onReceive() zeigt im Logcat welche Keys tatsächlich da
                // sind, dann können wir das hier präzisieren.
                intent.getStringExtra("barcode_string")
                    ?: intent.getStringExtra("barcode")
                    ?: intent.getStringExtra("barocode")
                    ?: intent.getStringExtra("data")
                    ?: intent.getStringExtra("result")
                    ?: intent.getStringExtra("BarcodeData")
                    ?: intent.getStringExtra("scannerdata")
                    ?: intent.getStringExtra("SCAN_RESULT")
            }
            else -> null
        }
    }

    companion object {
        private const val TAG = "PdaScanner"

        // Intent-Actions
        const val ACTION_NEWLAND          = "nlscan.action.SCANNER_RESULT"
        const val ACTION_HONEYWELL        = "com.honeywell.aidc.action.ACTION_BARCODE_DATA"
        const val ACTION_ZEBRA            = "com.symbol.datawedge.api.RESULT_ACTION"
        const val ACTION_GENERIC          = "scan.rcv.message"
        // Netum Q900 (Honeywell HS7 + "hs"-Wrapper-Firmware):
        const val ACTION_HS_BARCODE_SEND  = "com.android.hs.action.BARCODE_SEND"
        const val ACTION_HS_DCS           = "com.hs.dcsservice.action"

        // Extra-Keys
        const val EXTRA_NEWLAND          = "SCAN_BARCODE1"
        const val EXTRA_HONEYWELL        = "data"
        const val EXTRA_ZEBRA            = "com.symbol.datawedge.data_string"
        const val EXTRA_GENERIC_TYPO     = "barocode"  // sic — Firmware-Tippfehler
        const val EXTRA_GENERIC_CORRECT  = "barcode"
    }
}
