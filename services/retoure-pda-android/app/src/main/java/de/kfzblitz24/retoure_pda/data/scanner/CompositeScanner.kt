package de.kfzblitz24.retoure_pda.data.scanner

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.merge

/**
 * Merged Scans aus KeyboardWedgeScanner und IntentBroadcastScanner in
 * einen einzigen Flow.
 *
 * Screens subscriben ausschliesslich auf CompositeScanner.scans — sie
 * müssen nicht wissen, woher ein Scan kommt.
 *
 * Erweiterung für Vendor-SDKs:
 *   Wenn ein VendorSdkScanner ergänzt werden soll, einfach:
 *     private val vendor = VendorSdkScanner(context)
 *   und im scans-Flow und den lifecycle-Methoden einbinden.
 *   Pointer: siehe auskommentierter Stub in IntentBroadcastScanner.kt
 */
class CompositeScanner(
    private val keyboard: KeyboardWedgeScanner,
    private val intent: IntentBroadcastScanner,
) : BarcodeScanner {

    override val scans: Flow<String> = merge(keyboard.scans, intent.scans)

    override fun startListening() {
        keyboard.startListening()
        intent.startListening()
    }

    override fun stopListening() {
        keyboard.stopListening()
        intent.stopListening()
    }
}
