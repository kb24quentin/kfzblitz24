package de.kfzblitz24.retoure_pda.ui.screens.case

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import de.kfzblitz24.retoure_pda.data.repo.CaseRepository
import de.kfzblitz24.retoure_pda.data.repo.ContainerRepository
import de.kfzblitz24.retoure_pda.data.scanner.BarcodeScanner
import de.kfzblitz24.retoure_pda.ui.components.StepProgress
import de.kfzblitz24.retoure_pda.ui.screens.case.steps.*
import de.kfzblitz24.retoure_pda.ui.theme.Navy

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

    // Auto-Receive: sobald der Case geladen ist UND noch keine
    // partnerReceivedAt gesetzt hat, sofort POST /receive. Mitarbeiter
    // hat den Lookup ja schon bestätigt — die "Paket angenommen"-Hürde
    // entfällt damit.
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        state.caseDetail?.bestellnummer ?: "Lade…",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = Color.White,
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
                actions = {
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
                    contentAlignment = androidx.compose.ui.Alignment.Center,
                ) {
                    CircularProgressIndicator(color = de.kfzblitz24.retoure_pda.ui.theme.Orange)
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
                val detail = state.caseDetail ?: return@Scaffold
                val step = deriveStep(detail)

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 16.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Spacer(Modifier.height(4.dp))

                    // ── Step-Progress ─────────────────────────────────
                    // Bestellnummer steht schon in der TopAppBar oben —
                    // nicht doppelt anzeigen. Hier direkt mit dem Wizard-
                    // Step-Indikator weitermachen.
                    StepProgress(currentStep = step)

                    // ── Action-Error ──────────────────────────────────
                    state.actionError?.let { err ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0x33F44336))
                                .padding(10.dp),
                        ) {
                            Text(err, color = Color(0xFFEF9A9A), fontSize = 13.sp)
                        }
                    }

                    // ── Wizard-Schritte ───────────────────────────────
                    when (step) {
                        WizardStep.RECEIVE -> ReceiveStep(
                            loading = state.actionLoading,
                            onReceive = { vm.receiveCase() },
                        )

                        WizardStep.SCAN -> ScanStep(
                            caseDetail = detail,
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
                            caseDetail = detail,
                            actionLoading = state.actionLoading,
                            onAssess = { itemId, score, reason ->
                                vm.assessItem(itemId, score, reason)
                            },
                            onOpenPhotos = onOpenPhotos,
                        )

                        WizardStep.PALETTE -> PaletteStep(
                            caseDetail = detail,
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
                            caseDetail = detail,
                            actionLoading = state.actionLoading,
                            onGoHome = onBack,
                        )
                    }

                    // ── Footer ────────────────────────────────────────
                    TextButton(
                        onClick = onBack,
                        modifier = Modifier.align(androidx.compose.ui.Alignment.CenterHorizontally),
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
