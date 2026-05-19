package de.kfzblitz24.retoure_pda.data.scanner

import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.type
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow

/**
 * Scanner-Adapter für HID-Keyboard-Wedge-PDAs (Netum Q900, u.a.).
 *
 * Wie es funktioniert:
 *   Keyboard-Wedge-Scanner emulieren eine USB-/BT-Tastatur. Sie senden
 *   den gescannten Code als Tastendruck-Sequenz, gefolgt von Enter (\n).
 *
 * Integration mit Compose:
 *   Der ScanStep-Screen hält einen unsichtbaren, autofokussierten
 *   TextField (ScanInputField). Wenn der Scanner eine Zeichensequenz
 *   + Enter tippt, sammelt der TextField die Zeichen und ruft bei
 *   Enter onScan(value) auf — der Wert landet im normalem TextField-
 *   Flow ohne dass wir Modifier.onKeyEvent benötigen.
 *
 *   ALTERNATIV für Screens ohne TextField: Compose-Modifier.onKeyEvent
 *   auf dem Root-Surface triggert onChar(c) / flush bei Enter-Key.
 *   Dieser Adapter implementiert diese zweite Variante für Screens,
 *   die keinen sichtbaren Scan-Input-Bereich haben.
 *
 * Designentscheidung: ScanInputField ist sauberer (kein Modifier-Hacking),
 * KeyboardWedgeScanner bleibt für Screens ohne TextField-Fokus als Fallback.
 */
class KeyboardWedgeScanner : BarcodeScanner {

    private val _scans = MutableSharedFlow<String>(extraBufferCapacity = 32)
    override val scans: Flow<String> = _scans

    private val buffer = StringBuilder()
    private var listening = false

    override fun startListening() {
        listening = true
        buffer.clear()
    }

    override fun stopListening() {
        listening = false
        buffer.clear()
    }

    /**
     * Aufruf von einem Compose `Modifier.onKeyEvent { onKeyEvent(it); false }`.
     * Gibt `true` zurück wenn das Event konsumiert wurde (Enter-Flush).
     */
    fun onKeyEvent(event: KeyEvent): Boolean {
        if (!listening) return false
        if (event.type != KeyEventType.KeyDown) return false

        return when (event.key) {
            Key.Enter -> {
                val code = buffer.toString().trim()
                buffer.clear()
                if (code.isNotEmpty()) {
                    _scans.tryEmit(code)
                }
                true
            }
            Key.Backspace -> {
                if (buffer.isNotEmpty()) buffer.deleteAt(buffer.lastIndex)
                false
            }
            else -> false  // Buchstaben kommen über TextField-Änderung, nicht hier
        }
    }

    /**
     * Direkte Zeichen-Eingabe (für Non-Compose-Kontexte oder dispatchKeyEvent).
     * Flush bei '\n' oder '\r'.
     */
    fun onChar(c: Char) {
        if (!listening) return
        when (c) {
            '\n', '\r' -> {
                val code = buffer.toString().trim()
                buffer.clear()
                if (code.isNotEmpty()) _scans.tryEmit(code)
            }
            else -> buffer.append(c)
        }
    }
}
