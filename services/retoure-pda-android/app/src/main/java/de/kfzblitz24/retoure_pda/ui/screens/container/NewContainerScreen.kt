package de.kfzblitz24.retoure_pda.ui.screens.container

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.data.api.dto.SupplierDto
import de.kfzblitz24.retoure_pda.data.printer.PrinterRepository
import de.kfzblitz24.retoure_pda.data.printer.PrinterStore
import de.kfzblitz24.retoure_pda.data.repo.CaseRepository
import de.kfzblitz24.retoure_pda.data.repo.ContainerRepository
import de.kfzblitz24.retoure_pda.ui.components.BigButton
import de.kfzblitz24.retoure_pda.ui.theme.Navy
import de.kfzblitz24.retoure_pda.ui.theme.Orange
import kotlinx.coroutines.launch

/**
 * Standalone-Container-Anlage.
 *
 * Erreichbar von der Home-Page (Header-Action "+ Container"). Mitarbeiter
 * wählt einen Lieferanten, tappt "Palette anlegen" — Backend erzeugt
 * Container mit Code `PAL-<slug>-YYYY-NNNNNN`. Erfolgsmeldung mit dem
 * neuen Code, dann zurück zur Home.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewContainerScreen(
    caseRepository: CaseRepository,
    containerRepository: ContainerRepository,
    printerRepository: PrinterRepository,
    printerStore: PrinterStore,
    onBack: () -> Unit,
    onOpenPrinterSettings: () -> Unit,
) {
    val scope = rememberCoroutineScope()

    var suppliers by remember { mutableStateOf<List<SupplierDto>>(emptyList()) }
    var loadingSuppliers by remember { mutableStateOf(true) }
    var selectedSupplierId by remember { mutableStateOf<String?>(null) }
    var creating by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var createdCode by remember { mutableStateOf<String?>(null) }
    var createdId by remember { mutableStateOf<String?>(null) }

    // Print-State
    var printing by remember { mutableStateOf(false) }
    var printMessage by remember { mutableStateOf<String?>(null) }
    var printError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        caseRepository.getSuppliers()
            .onSuccess { list ->
                suppliers = list
                // Default-Logik (siehe PaletteStep für Begründung):
                //   1. "Interparts" — Stand jetzt unser Standard-Distributor.
                //   2. Bei nur einem Supplier: der einzige.
                //   3. Sonst nichts vorselektieren — User muss tappen.
                selectedSupplierId = list.firstOrNull { it.name.equals("Interparts", ignoreCase = true) }?.id
                    ?: if (list.size == 1) list.first().id else null
            }
            .onFailure { error = it.message ?: "Lieferanten laden fehlgeschlagen." }
        loadingSuppliers = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Neuer Container",
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // ── Erfolgs-Anzeige ──────────────────────────────────────
            if (createdCode != null && createdId != null) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x2200C853))
                        .padding(16.dp),
                ) {
                    Text(
                        "✓ Palette angelegt",
                        color = Color(0xFFB9F6CA),
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                    )
                    Text(
                        createdCode!!,
                        color = Color.White,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
                Spacer(Modifier.height(8.dp))

                // ── Print-Block ────────────────────────────────────
                val hasPrinter = printerStore.has()
                val printerName = printerStore.get()?.name ?: "—"
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.06f))
                        .padding(16.dp),
                ) {
                    Text(
                        if (hasPrinter) "Drucker: $printerName" else "Kein Drucker konfiguriert",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                    )
                    Spacer(Modifier.height(8.dp))
                    if (hasPrinter) {
                        BigButton(
                            text = if (printing) "Drucke…" else "🖨 Label drucken",
                            onClick = {
                                printing = true
                                printMessage = null
                                printError = null
                                scope.launch {
                                    when (val r = printerRepository.printContainerLabel(createdId!!)) {
                                        is PrinterRepository.PrintOutcome.Ok -> {
                                            printMessage = "✓ Gedruckt auf ${r.printerName} (${r.durationMs} ms)"
                                        }
                                        PrinterRepository.PrintOutcome.NoPrinterConfigured -> {
                                            printError = "Kein Drucker konfiguriert."
                                        }
                                        is PrinterRepository.PrintOutcome.Err -> {
                                            printError = r.message
                                        }
                                    }
                                    printing = false
                                }
                            },
                            loading = printing,
                            enabled = !printing,
                        )
                    } else {
                        Text(
                            "Bitte in den Einstellungen einen Bluetooth-Drucker auswählen.",
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = 12.sp,
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = onOpenPrinterSettings,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Text("Drucker auswählen", color = Color.White)
                        }
                    }

                    // Print-Feedback
                    printMessage?.let { msg ->
                        Spacer(Modifier.height(8.dp))
                        Text(msg, color = Color(0xFFB9F6CA), fontSize = 13.sp)
                    }
                    printError?.let { err ->
                        Spacer(Modifier.height(8.dp))
                        Text(err, color = Color(0xFFEF9A9A), fontSize = 13.sp)
                    }
                }

                Spacer(Modifier.height(8.dp))
                BigButton(
                    text = "Weitere Palette anlegen",
                    onClick = {
                        createdCode = null
                        createdId = null
                        selectedSupplierId = null
                        error = null
                        printMessage = null
                        printError = null
                    },
                )
                OutlinedButton(
                    onClick = onBack,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text("Zurück zur Startseite", color = Color.White)
                }
                return@Column
            }

            // ── Lieferanten-Picker ───────────────────────────────────
            Text(
                "Wähle Lieferant",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "Pro Container ein Lieferant — Items werden später nur darauf gelegt wenn sie zu diesem Lieferanten gehören.",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 12.sp,
            )

            when {
                loadingSuppliers -> {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(32.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = Orange)
                    }
                }
                suppliers.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0x22FFAB00))
                            .padding(12.dp),
                    ) {
                        Text(
                            "Keine aktiven Lieferanten gepflegt. Bitte im Admin-Dashboard unter /admin/suppliers anlegen (z. B. Interparts, Autopartner).",
                            color = Color(0xFFFFE082),
                            fontSize = 13.sp,
                        )
                    }
                }
                else -> {
                    suppliers.forEach { s ->
                        val isSelected = selectedSupplierId == s.id
                        Button(
                            onClick = { selectedSupplierId = s.id },
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isSelected) Orange else Color.White.copy(alpha = 0.08f),
                                contentColor = Color.White,
                            ),
                        ) {
                            Text(
                                s.name,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                            )
                        }
                    }
                }
            }

            // ── Anlegen ─────────────────────────────────────────────
            Spacer(Modifier.height(8.dp))
            BigButton(
                text = if (creating) "Lege an…" else "Palette anlegen",
                onClick = {
                    val sid = selectedSupplierId ?: return@BigButton
                    creating = true
                    error = null
                    scope.launch {
                        containerRepository.createContainer(sid)
                            .onSuccess { created ->
                                createdCode = created.code
                                createdId = created.id
                                creating = false
                            }
                            .onFailure { e ->
                                error = e.message ?: "Anlage fehlgeschlagen."
                                creating = false
                            }
                    }
                },
                loading = creating,
                enabled = !creating && selectedSupplierId != null && suppliers.isNotEmpty(),
            )

            // ── Fehler ──────────────────────────────────────────────
            error?.let { err ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0x33F44336))
                        .padding(12.dp),
                ) {
                    Text(err, color = Color(0xFFEF9A9A), fontSize = 13.sp)
                }
            }
        }
    }
}
