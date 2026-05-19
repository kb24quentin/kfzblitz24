package de.kfzblitz24.retoure_pda.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import de.kfzblitz24.retoure_pda.data.api.dto.CaseSummary
import de.kfzblitz24.retoure_pda.data.repo.CaseRepository
import de.kfzblitz24.retoure_pda.ui.theme.Navy
import de.kfzblitz24.retoure_pda.ui.theme.Orange

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    caseRepository: CaseRepository,
    onCaseClick: (String) -> Unit,
    onSettingsClick: () -> Unit,
) {
    val vm: HomeViewModel = viewModel(factory = HomeViewModel.Factory(caseRepository))
    val state by vm.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    // kfzBlitz24 Wordmark
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // ── Suchfeld ───────────────────────────────────────────────
            OutlinedTextField(
                value = state.query,
                onValueChange = vm::onQueryChange,
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
                keyboardActions = KeyboardActions(onSearch = { vm.search() }),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Orange,
                    unfocusedBorderColor = Orange.copy(alpha = 0.4f),
                    cursorColor = Orange,
                    focusedContainerColor = Color.White.copy(alpha = 0.06f),
                    unfocusedContainerColor = Color.White.copy(alpha = 0.04f),
                ),
                shape = RoundedCornerShape(12.dp),
            )

            Button(
                onClick = vm::search,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                enabled = state.query.isNotBlank() && !state.loading,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Orange),
            ) {
                if (state.loading) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                } else {
                    Text("Suchen", fontWeight = FontWeight.Bold)
                }
            }

            // ── Fehler ─────────────────────────────────────────────────
            state.error?.let { err ->
                Text(
                    err,
                    color = Color(0xFFEF9A9A),
                    fontSize = 13.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0x22F44336))
                        .padding(10.dp),
                )
            }

            // ── Ergebnisliste ──────────────────────────────────────────
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(state.results) { c ->
                    CaseSummaryCard(
                        summary = c,
                        onClick = { onCaseClick(c.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun CaseSummaryCard(summary: CaseSummary, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.08f))
            .clickable(onClick = onClick)
            .padding(14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column {
            Text(
                summary.bestellnummer,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                fontSize = 15.sp,
            )
            summary.belegnummer?.let {
                Text(it, color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
            }
        }

        // Status-Badge
        val badgeColor = when (summary.status) {
            "angemeldet"      -> Color(0xFF1565C0)
            "eingang_partner" -> Orange
            "pruefung"        -> Color(0xFF6A1B9A)
            "erstattet"       -> Color(0xFF2E7D32)
            "abgelehnt"       -> Color(0xFFC62828)
            else              -> Color(0xFF37474F)
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(badgeColor)
                .padding(horizontal = 8.dp, vertical = 4.dp),
        ) {
            Text(
                summary.status.replace("_", " "),
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}
