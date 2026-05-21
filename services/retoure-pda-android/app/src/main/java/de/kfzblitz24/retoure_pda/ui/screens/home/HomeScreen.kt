package de.kfzblitz24.retoure_pda.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import de.kfzblitz24.retoure_pda.data.repo.CaseRepository
import de.kfzblitz24.retoure_pda.data.scanner.BarcodeScanner
import de.kfzblitz24.retoure_pda.ui.theme.Navy
import de.kfzblitz24.retoure_pda.ui.theme.Orange

/**
 * Home-Screen für die Lager-Mitarbeiter.
 *
 * Production-Design: kein Eingabefeld, kein "Suchen"-Button — nur eine
 * große Aufforderung "Bitte Paket / Retourenschein scannen". Der
 * Mitarbeiter drückt den Hardware-Trigger am PDA, der Broadcast-Intent
 * geht in den `BarcodeScanner` (Composite hört auf alle bekannten OEM-
 * Actions), wir füttern den Code in `vm.search()` und navigieren bei
 * Erfolg direkt in die Case-Detail-View.
 *
 * Fallback (z. B. wenn der Scanner kaputt ist oder beim Dev-Test ohne
 * Q900): am Bildschirm-Ende ein kleiner "Manuell eingeben"-Link → öffnet
 * ein Dialog mit Input-Feld + Suchen-Knopf.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    caseRepository: CaseRepository,
    scanner: BarcodeScanner,
    onCaseClick: (String) -> Unit,
    onSettingsClick: () -> Unit,
    onNewContainerClick: () -> Unit = {},
) {
    val vm: HomeViewModel = viewModel(factory = HomeViewModel.Factory(caseRepository))
    val state by vm.uiState.collectAsState()

    var manualOpen by remember { mutableStateOf(false) }

    // Auto-Navigate sobald lookup erfolgreich war.
    LaunchedEffect(state.foundCaseId) {
        state.foundCaseId?.let { id ->
            onCaseClick(id)
            vm.consumeFoundCase()
        }
    }

    // Scanner-Lifecycle: nur lauschen während HomeScreen sichtbar ist.
    DisposableEffect(Unit) {
        scanner.startListening()
        onDispose { scanner.stopListening() }
    }

    // Auf Scan-Events reagieren — Code direkt an vm.search() füttern.
    LaunchedEffect(scanner) {
        scanner.scans.collect { code ->
            val cleaned = code.trim()
            if (cleaned.isNotEmpty()) {
                vm.onQueryChange(cleaned)
                vm.search()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("kfz", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text("blitz", color = Orange, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text("24", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "Retoure",
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Normal,
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onNewContainerClick) {
                        Icon(
                            Icons.Default.Add,
                            contentDescription = "Neuer Container",
                            tint = Orange,
                        )
                    }
                    IconButton(onClick = onSettingsClick) {
                        Icon(Icons.Default.Settings, contentDescription = "Einstellungen", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Navy,
                    scrolledContainerColor = Navy,
                ),
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
                // Großes Scanner-Icon
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .clip(RoundedCornerShape(60.dp))
                        .background(Orange.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "▢",
                        color = Orange,
                        fontSize = 64.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }

                // Loading-State zeigt einen subtilen Progress unterm Icon
                if (state.loading) {
                    LinearProgressIndicator(
                        color = Orange,
                        trackColor = Orange.copy(alpha = 0.2f),
                        modifier = Modifier
                            .fillMaxWidth(0.6f)
                            .height(3.dp),
                    )
                }

                // ── Stufe-1- vs Stufe-2-Prompt ─────────────────────
                val stage2 = state.pendingPackageCode != null
                if (!stage2) {
                    Text(
                        "1. Scanne das Paket-Label",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        "Carrier-Tracking auf dem Paket — Scanner darüber halten und triggern.",
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                    )
                } else {
                    // Großer Hinweis-Block: Paket noch unbekannt
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0x33FFAB00))
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(
                            "Paket noch nicht zugeordnet",
                            color = Color(0xFFFFE082),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            state.pendingPackageCode ?: "",
                            color = Color.White,
                            fontSize = 12.sp,
                        )
                    }
                    Text(
                        "2. Scanne den Retourenschein",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        "KB24-… auf dem Schein — wir verknüpfen das Paket dann automatisch.",
                        color = Color.White.copy(alpha = 0.65f),
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                    )
                    OutlinedButton(
                        onClick = { vm.resetScanFlow() },
                        modifier = Modifier.fillMaxWidth(0.7f),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Text("Abbrechen / Anderes Paket", color = Color.White)
                    }
                }

                state.error?.let { err ->
                    Spacer(Modifier.height(8.dp))
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
                        )
                        Text(
                            err,
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }

            // Fallback ganz unten: kleiner Link zur manuellen Eingabe
            TextButton(
                onClick = { manualOpen = true },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 24.dp),
            ) {
                Text(
                    "Manuell eingeben",
                    color = Color.White.copy(alpha = 0.35f),
                    fontSize = 12.sp,
                )
            }
        }

        if (manualOpen) {
            ManualEntryDialog(
                initial = state.query,
                loading = state.loading,
                onDismiss = { manualOpen = false },
                onSubmit = { code ->
                    vm.onQueryChange(code)
                    vm.search()
                    manualOpen = false
                },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ManualEntryDialog(
    initial: String,
    loading: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (String) -> Unit,
) {
    var input by remember { mutableStateOf(initial) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                "Manuell eingeben",
                color = Color.White,
                fontWeight = FontWeight.Bold,
            )
        },
        text = {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = {
                    Text(
                        "Bestellnummer oder RMA-Code…",
                        color = Color.White.copy(alpha = 0.4f),
                    )
                },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = null, tint = Orange)
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Search,
                    autoCorrect = false,
                ),
                keyboardActions = KeyboardActions(
                    onSearch = {
                        if (input.isNotBlank()) onSubmit(input.trim())
                    },
                ),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Orange,
                    unfocusedBorderColor = Orange.copy(alpha = 0.4f),
                    cursorColor = Orange,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                ),
                shape = RoundedCornerShape(10.dp),
            )
        },
        confirmButton = {
            Button(
                onClick = { if (input.isNotBlank()) onSubmit(input.trim()) },
                enabled = input.isNotBlank() && !loading,
                colors = ButtonDefaults.buttonColors(containerColor = Orange),
            ) {
                Text("Suchen", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Abbrechen", color = Color.White.copy(alpha = 0.6f))
            }
        },
        containerColor = Navy,
    )
}
