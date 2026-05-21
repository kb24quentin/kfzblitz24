package de.kfzblitz24.retoure_pda.ui.screens.case

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import de.kfzblitz24.retoure_pda.data.api.dto.CaseDetail
import de.kfzblitz24.retoure_pda.data.repo.CaseRepository
import de.kfzblitz24.retoure_pda.data.repo.ContainerRepository
import de.kfzblitz24.retoure_pda.data.scanner.BarcodeScanner
import de.kfzblitz24.retoure_pda.ui.components.StepProgress
import de.kfzblitz24.retoure_pda.ui.screens.case.steps.*
import de.kfzblitz24.retoure_pda.ui.theme.Navy
import de.kfzblitz24.retoure_pda.ui.theme.Orange

/**
 * Produziert eine virtuelle "Merged-Case"-Sicht für die Wizard-Steps:
 * primärer Case mit Items aus ALLEN Cases der Session zusammengefügt.
 * Andere Felder (Status, partnerReceivedAt, etc.) bleiben aus der
 * primären Case — die Step-Composables nutzen die nicht für Routing,
 * nur für Anzeige.
 */
private fun mergedForUi(primary: CaseDetail, secondaries: List<CaseDetail>): CaseDetail =
    if (secondaries.isEmpty()) primary
    else primary.copy(items = primary.items + secondaries.flatMap { it.items })

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CaseDetailScreen(
    caseId: String,
    caseRepository: CaseRepository,
    containerRepository: ContainerRepository,
    scanner: BarcodeScanner,
    onBack: () -> Unit,
    onOpenPhotos: (caseId: String, itemId: String) -> Unit,
) {
    val vm: CaseDetailViewModel = viewModel(
        key = "case_$caseId",
        factory = CaseDetailViewModel.Factory(caseId, caseRepository, containerRepository),
    )
    val state by vm.uiState.collectAsState()

    // Sheet-State: wenn true, ersetzt der Add-Case-Screen den Wizard
    // komplett damit der Scanner nicht von zwei Listenern gleichzeitig
    // konsumiert wird.
    var addCaseSheetOpen by remember { mutableStateOf(false) }

    // Auto-Receive: sobald der primäre Case geladen ist UND noch keine
    // partnerReceivedAt gesetzt hat, sofort POST /receive. Wenn weitere
    // Cases hinzukommen, fängt die nächste receiveCase()-Iteration die
    // ein.
    var autoReceived by remember { mutableStateOf(false) }
    LaunchedEffect(state.caseDetail?.id, state.caseDetail?.partnerReceivedAt) {
        val detail = state.caseDetail
        if (!autoReceived &&
            detail != null &&
            detail.partnerReceivedAt == null &&
            !state.actionLoading
        ) {
            autoReceived = true
            vm.receiveCase()
        }
    }

    // ── Add-Case-Sheet (fullscreen Replacement) ──────────────────────
    if (addCaseSheetOpen) {
        AddCaseSheet(
            scanner = scanner,
            currentSessionCount = state.allCases.size,
            primaryBestellnummer = state.caseDetail?.bestellnummer ?: "—",
            actionLoading = state.actionLoading,
            errorBanner = state.actionError,
            successBanner = state.addCaseBanner,
            onScan = { code ->
                vm.addCaseToSession(code)
                // Sheet bleibt offen damit Worker auch dritten Schein
                // scannen kann. Schließen passiert via "Fertig"-Button.
            },
            onDismiss = {
                vm.clearAddCaseBanner()
                vm.clearActionError()
                addCaseSheetOpen = false
            },
        )
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            state.caseDetail?.bestellnummer ?: "Lade…",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = Color.White,
                        )
                        // Badge wenn weitere Cases in der Session sind
                        if (state.secondaryCases.isNotEmpty()) {
                            Spacer(Modifier.width(8.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Orange)
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                            ) {
                                Text(
                                    "+${state.secondaryCases.size}",
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Black,
                                )
                            }
                        }
                    }
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
                actions = {
                    // "+ Weiterer Retourenschein" — für Multi-Retoure-
                    // Unified (Use Case 1: ein Paket, mehrere RMAs).
                    // Worker findet 2. Schein beim Auspacken → tippt hier
                    // drauf → Scanner-Vollbild → scant Schein → Items
                    // mergen in den Wizard.
                    IconButton(onClick = { addCaseSheetOpen = true }) {
                        Icon(
                            Icons.Default.Add,
                            contentDescription = "Weiterer Retourenschein",
                            tint = Orange,
                        )
                    }
                    TextButton(onClick = vm::load) {
                        Text("↻", color = Color.White, fontSize = 18.sp)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Navy),
            )
        },
        containerColor = Color(0xFF0D1B2A),
    ) { padding ->

        when {
            state.loading && state.caseDetail == null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = Orange)
                }
            }

            state.error != null && state.caseDetail == null -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0x33F44336))
                            .padding(12.dp),
                    ) {
                        Text(state.error ?: "Fehler", color = Color(0xFFEF9A9A), fontSize = 13.sp)
                    }
                    Button(
                        onClick = onBack,
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.1f)),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Text("Zurück", color = Color.White)
                    }
                }
            }

            else -> {
                val primary = state.caseDetail ?: return@Scaffold
                // Wizard-Step über ALLE Cases derived (langsamster Case
                // gewinnt → Wizard hängt da fest bis alles aufgeholt).
                val step = deriveStep(state.allCases)
                // Für die Step-Composables eine virtuelle Merged-Case-
                // Sicht: Items aller Cases unioned, sonst aus primary.
                val merged = mergedForUi(primary, state.secondaryCases)

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 16.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Spacer(Modifier.height(4.dp))

                    StepProgress(currentStep = step)

                    // Add-Case-Banner (kurz nach Hinzufügen einer Case)
                    state.addCaseBanner?.let { msg ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Orange.copy(alpha = 0.2f))
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                        ) {
                            Text(
                                msg,
                                color = Color(0xFFFFCC80),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }

                    state.actionError?.let { err ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFFB71C1C))
                                .padding(horizontal = 18.dp, vertical = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text(
                                "✗ FEHLER",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp,
                            )
                            Text(
                                err,
                                color = Color.White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }

                    when (step) {
                        WizardStep.RECEIVE -> ReceiveStep(
                            loading = state.actionLoading,
                            onReceive = { vm.receiveCase() },
                        )

                        WizardStep.SCAN -> ScanStep(
                            caseDetail = merged,
                            scanner = scanner,
                            actionLoading = state.actionLoading,
                            lastScanResult = state.lastScanResult,
                            onScanEan = { ean -> vm.scanEan(ean) },
                            onClearLastScan = { vm.clearLastScanResult() },
                            onScanItem = { itemId, present ->
                                vm.scanItem(itemId, present)
                            },
                            onAssessItem = { itemId, score, reason ->
                                vm.assessItem(itemId, score, reason)
                            },
                            onCompleteScanStep = { vm.completeScanStep() },
                        )

                        WizardStep.ASSESS -> AssessStep(
                            caseId = caseId,
                            caseDetail = merged,
                            actionLoading = state.actionLoading,
                            onAssess = { itemId, score, reason ->
                                vm.assessItem(itemId, score, reason)
                            },
                            onOpenPhotos = onOpenPhotos,
                        )

                        WizardStep.PALETTE -> PaletteStep(
                            caseDetail = merged,
                            suppliers = state.suppliers,
                            containerRepository = containerRepository,
                            scanner = scanner,
                            actionLoading = state.actionLoading,
                            onLinkToContainer = { containerId, itemId ->
                                vm.addItemToContainer(containerId, itemId)
                            },
                            onCreateContainerAndLink = { supplierId, itemId ->
                                vm.createContainerAndAddItem(supplierId, itemId)
                            },
                        )

                        WizardStep.DONE -> DoneStep(
                            caseDetail = merged,
                            actionLoading = state.actionLoading,
                            onGoHome = onBack,
                        )
                    }

                    TextButton(
                        onClick = onBack,
                        modifier = Modifier.align(Alignment.CenterHorizontally),
                    ) {
                        Text(
                            "Abbrechen / zurück zur Startseite",
                            color = Color.White.copy(alpha = 0.35f),
                            fontSize = 12.sp,
                        )
                    }

                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

/**
 * Fullscreen-Sheet zum Hinzufügen eines weiteren Retourenscheins zur
 * aktuellen Session. Hijackt den Scanner alleinig — wird nur gerendert
 * statt des Wizards, sodass kein doppelter Collector den Scan abgreift.
 *
 * Worker kann mehrere Scheine hintereinander scannen, jedes Mal kommt
 * ein Banner. "Fertig" tappt → zurück zum Wizard.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddCaseSheet(
    scanner: BarcodeScanner,
    currentSessionCount: Int,
    primaryBestellnummer: String,
    actionLoading: Boolean,
    errorBanner: String?,
    successBanner: String?,
    onScan: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    DisposableEffect(Unit) {
        scanner.startListening()
        onDispose { scanner.stopListening() }
    }

    LaunchedEffect(scanner) {
        scanner.scans.collect { code ->
            val cleaned = code.trim()
            if (cleaned.isNotEmpty()) onScan(cleaned)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Weiterer Retourenschein",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onDismiss) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Schließen",
                            tint = Color.White,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Navy),
            )
        },
        containerColor = Color(0xFF0D1B2A),
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .clip(RoundedCornerShape(60.dp))
                        .background(Orange.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("▢", color = Orange, fontSize = 64.sp, fontWeight = FontWeight.Bold)
                }

                if (actionLoading) {
                    LinearProgressIndicator(
                        color = Orange,
                        trackColor = Orange.copy(alpha = 0.2f),
                        modifier = Modifier
                            .fillMaxWidth(0.6f)
                            .height(3.dp),
                    )
                }

                Text(
                    "Scanne weiteren Retourenschein",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )

                Text(
                    "Aktuelle Session: $primaryBestellnummer" +
                        if (currentSessionCount > 1) " + ${currentSessionCount - 1} weitere" else "",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                )

                successBanner?.let { msg ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0x4400C853))
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                    ) {
                        Text(
                            msg,
                            color = Color(0xFFA5D6A7),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }

                errorBanner?.let { err ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFFB71C1C))
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                    ) {
                        Text(
                            err,
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }

                Spacer(Modifier.height(8.dp))

                Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth(0.7f),
                    colors = ButtonDefaults.buttonColors(containerColor = Orange),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text(
                        "Fertig — weiter im Wizard",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                    )
                }
            }
        }
    }
}
