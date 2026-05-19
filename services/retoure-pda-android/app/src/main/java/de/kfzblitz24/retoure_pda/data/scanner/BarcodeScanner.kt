package de.kfzblitz24.retoure_pda.data.scanner

import kotlinx.coroutines.flow.Flow

/**
 * Einheitliches Interface für alle Barcode/QR-Scanner-Quellen.
 *
 * Implementierungen:
 *   - KeyboardWedgeScanner  — HID-Keyboard-PDAs (Netum Q900, etc.)
 *   - IntentBroadcastScanner — Newland, Honeywell, Zebra, generisch
 *   - CompositeScanner       — merged beide Quellen
 *
 * Jeder Scan emittiert einen String in `scans`. Compose-Screens
 * subscriben via `LaunchedEffect { scanner.scans.collect { ... } }`.
 *
 * Lifecycle: Screens rufen startListening() in onResume/LaunchedEffect
 * und stopListening() in onPause/DisposableEffect auf.
 */
interface BarcodeScanner {
    /** Jeder Scan kommt als einzelner String (ohne Trailing-Newline). */
    val scans: Flow<String>

    fun startListening()
    fun stopListening()
}
