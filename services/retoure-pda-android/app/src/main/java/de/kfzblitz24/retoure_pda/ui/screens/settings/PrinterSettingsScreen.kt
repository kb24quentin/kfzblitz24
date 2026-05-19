package de.kfzblitz24.retoure_pda.ui.screens.settings

import android.Manifest
import android.bluetooth.BluetoothDevice
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import de.kfzblitz24.retoure_pda.data.printer.BluetoothLabelPrinter
import de.kfzblitz24.retoure_pda.data.printer.PrinterStore
import de.kfzblitz24.retoure_pda.ui.theme.Navy
import de.kfzblitz24.retoure_pda.ui.theme.Orange

/**
 * Drucker-Einstellungen: Liste der vom System gepairten Bluetooth-
 * Geräte, Auswahl als Default-Drucker, Speichern in PrinterStore.
 *
 * Pairing selbst macht der User in den Android-System-Einstellungen
 * (Schaltfläche "Bluetooth-Einstellungen öffnen" springt direkt rein).
 *
 * Sobald wir WiFi-Drucker haben:
 *   1. Hier einen Tab "WiFi" hinzufügen
 *   2. Liste aus Backend-API laden (GET /api/admin/printers)
 *   3. Beim Speichern transport=WIFI setzen
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrinterSettingsScreen(
    printerStore: PrinterStore,
    bluetoothPrinter: BluetoothLabelPrinter,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    var devices by remember { mutableStateOf<List<BluetoothDevice>>(emptyList()) }
    var current by remember { mutableStateOf(printerStore.get()) }
    var btReady by remember { mutableStateOf(bluetoothPrinter.isReady()) }
    var permissionDenied by remember { mutableStateOf(false) }

    // Permission-Launcher für BLUETOOTH_CONNECT (Android 12+).
    val connectPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        permissionDenied = !granted
        if (granted) {
            devices = bluetoothPrinter.bondedDevices()
            btReady = bluetoothPrinter.isReady()
        }
    }

    // Beim Öffnen: Permission ggf. anfragen, sonst direkt Liste füllen.
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.BLUETOOTH_CONNECT,
            ) == PackageManager.PERMISSION_GRANTED

            if (granted) {
                devices = bluetoothPrinter.bondedDevices()
                btReady = bluetoothPrinter.isReady()
            } else {
                connectPermissionLauncher.launch(Manifest.permission.BLUETOOTH_CONNECT)
            }
        } else {
            devices = bluetoothPrinter.bondedDevices()
            btReady = bluetoothPrinter.isReady()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Drucker",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Zurück",
                            tint = Color.White,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Navy),
            )
        },
        containerColor = Color(0xFF0D1B2A),
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {

            // ── Aktueller Drucker ────────────────────────────────────
            current?.let { p ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x2200C853))
                        .padding(16.dp),
                ) {
                    Text(
                        "Aktueller Drucker",
                        color = Color(0xFFB9F6CA),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        p.name,
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "${p.transport.uppercase()} · ${p.address} · Sprache: ${p.language.uppercase()}",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                    )

                    // ── Sprache umschalten ZPL ↔ TSPL ──────────────────
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Druckersprache",
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Munbyn RW403B u. Ä. sprechen TSPL out-of-the-box. Echte Zebra-Drucker (oder per Tastatur-Kombo auf ZPL umgeschaltete Clones) brauchen ZPL.",
                        color = Color.White.copy(alpha = 0.65f),
                        fontSize = 11.sp,
                    )
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(
                            PrinterStore.LANGUAGE_TSPL to "TSPL",
                            PrinterStore.LANGUAGE_ZPL to "ZPL",
                        ).forEach { (langKey, langLabel) ->
                            val isSelected = p.language.equals(langKey, ignoreCase = true)
                            Button(
                                onClick = {
                                    printerStore.setLanguage(langKey)
                                    current = printerStore.get()
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isSelected) Orange
                                                     else Color.White.copy(alpha = 0.1f),
                                    contentColor = Color.White,
                                ),
                            ) {
                                Text(langLabel, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = {
                            printerStore.clear()
                            current = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Text("Drucker entfernen", color = Color.White)
                    }
                }
            }

            // ── Status / Permission / Bluetooth aus ────────────────
            if (permissionDenied) {
                WarningBox(
                    title = "Bluetooth-Berechtigung fehlt",
                    body = "Bitte in den App-Einstellungen 'In der Nähe befindliche Geräte' erlauben — sonst kann die App nicht zum Drucker verbinden.",
                )
                FilledTonalButton(
                    onClick = {
                        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = android.net.Uri.fromParts("package", context.packageName, null)
                        }
                        context.startActivity(intent)
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("App-Einstellungen öffnen")
                }
            } else if (!btReady) {
                WarningBox(
                    title = "Bluetooth ist aus oder nicht verfügbar",
                    body = "Bitte Bluetooth in den System-Einstellungen einschalten, dann neu öffnen.",
                )
            }

            // ── Gepairte Geräte ──────────────────────────────────────
            Spacer(Modifier.height(8.dp))
            Text(
                "Gepairte Bluetooth-Geräte",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
            )
            Text(
                "Falls dein Drucker (z. B. Munbyn RW403B) nicht in der Liste steht, zuerst in den System-Einstellungen pairen.",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 12.sp,
            )

            if (devices.isEmpty() && btReady) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0x22FFAB00))
                        .padding(12.dp),
                ) {
                    Text(
                        "Keine gepairten Geräte gefunden. In den System-Einstellungen mit dem Drucker pairen.",
                        color = Color(0xFFFFE082),
                        fontSize = 13.sp,
                    )
                }
            }

            devices.forEach { dev ->
                @Suppress("MissingPermission") // PERMISSION wurde oben geprüft
                val name = dev.name ?: "(unbenannt)"
                val mac = dev.address
                val isSelected = current?.address == mac

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            if (isSelected) Orange.copy(alpha = 0.3f)
                            else Color.White.copy(alpha = 0.06f),
                        )
                        .clickable {
                            val saved = PrinterStore.SavedPrinter(
                                transport = PrinterStore.TRANSPORT_BLUETOOTH,
                                address = mac,
                                name = name,
                            )
                            printerStore.save(saved)
                            current = saved
                        }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            name,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                        )
                        Text(
                            mac,
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                    if (isSelected) {
                        Text(
                            "✓ aktiv",
                            color = Orange,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                        )
                    }
                }
            }

            // ── Hilfs-Aktion: System-BT-Settings öffnen ─────────────
            Spacer(Modifier.height(16.dp))
            OutlinedButton(
                onClick = {
                    val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                    context.startActivity(intent)
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
            ) {
                Text("Bluetooth-Einstellungen öffnen", color = Color.White)
            }
        }
    }
}

@Composable
private fun WarningBox(title: String, body: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0x33F44336))
            .padding(12.dp),
    ) {
        Text(title, color = Color(0xFFEF9A9A), fontWeight = FontWeight.Bold, fontSize = 13.sp)
        Spacer(Modifier.height(4.dp))
        Text(body, color = Color(0xFFFFCDD2), fontSize = 12.sp)
    }
}
