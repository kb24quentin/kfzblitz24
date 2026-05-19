package de.kfzblitz24.retoure_pda.ui.screens.case.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
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
import de.kfzblitz24.retoure_pda.data.api.dto.CaseDetail
import de.kfzblitz24.retoure_pda.data.api.dto.ContainerDto
import de.kfzblitz24.retoure_pda.data.api.dto.SupplierDto
import de.kfzblitz24.retoure_pda.data.repo.ContainerRepository
import de.kfzblitz24.retoure_pda.ui.components.BigButton
import de.kfzblitz24.retoure_pda.ui.theme.Orange
import kotlinx.coroutines.launch

@Composable
fun PaletteStep(
    caseDetail: CaseDetail,
    suppliers: List<SupplierDto>,
    containerRepository: ContainerRepository,
    actionLoading: Boolean,
    onLinkToContainer: (containerId: String, itemId: String) -> Unit,
    onCreateContainerAndLink: (supplierId: String, itemId: String) -> Unit,
) {
    val queue = caseDetail.items.filter {
        it.status == "assessed" && it.verdict != "red"
    }
    val current = queue.firstOrNull()
    val completed = caseDetail.items.count { it.status == "on_pallet" }
    val totalToPalettize = queue.size + completed

    var selectedSupplierId by remember(current?.id) {
        mutableStateOf<String?>(current?.supplierId)
    }
    var openContainers by remember(selectedSupplierId) { mutableStateOf<List<ContainerDto>>(emptyList()) }
    var loadingContainers by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // Wenn Supplier neu gesetzt wird: offene Container laden
    LaunchedEffect(selectedSupplierId) {
        val sid = selectedSupplierId ?: return@LaunchedEffect
        loadingContainers = true
        containerRepository.getOpenContainers(sid)
            .onSuccess { openContainers = it }
            .onFailure { openContainers = emptyList() }
        loadingContainers = false
    }

    if (current == null) {
        Text(
            "Keine Artikel mehr für Paletten — weiter.",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 14.sp,
        )
        return
    }

    val chosen = suppliers.find { it.id == selectedSupplierId }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "Auf Palette legen",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
        Text(
            "${completed + 1} von $totalToPalettize",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 13.sp,
        )

        // Item-Card
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.06f))
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                "${current.menge}× ${current.beschreibung ?: "—"}",
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
                fontSize = 15.sp,
            )
            val meta = listOfNotNull(current.artikelnummer, current.hersteller).joinToString(" · ")
            if (meta.isNotEmpty()) {
                Text(meta, color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp, fontFamily = FontFamily.Monospace)
            }
            current.verdict?.let { v ->
                val badgeColor = if (v == "green") Color(0x4400C853) else Color(0x44FFAB00)
                val badgeText  = if (v == "green") Color(0xFFB9F6CA) else Color(0xFFFFE082)
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(badgeColor)
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                ) {
                    Text("● $v", color = badgeText, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // Stufe 1: Supplier wählen
        if (selectedSupplierId == null) {
            Text(
                "An welchen Lieferanten geht der Artikel zurück?",
                color = Color.White.copy(alpha = 0.75f),
                fontSize = 14.sp,
            )
            if (suppliers.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0x22FFAB00))
                        .padding(10.dp),
                ) {
                    Text(
                        "Keine Lieferanten gepflegt — bitte im Admin-Dashboard anlegen.",
                        color = Color(0xFFFFE082),
                        fontSize = 13.sp,
                    )
                }
            } else {
                suppliers.forEach { s ->
                    Button(
                        onClick = { selectedSupplierId = s.id },
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color.White.copy(alpha = 0.1f),
                            contentColor = Color.White,
                        ),
                    ) {
                        Text(s.name, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        // Stufe 2: Container auswählen oder neu anlegen
        if (selectedSupplierId != null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Lieferant: ",
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 14.sp,
                )
                Text(
                    chosen?.name ?: selectedSupplierId!!,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
                TextButton(onClick = { selectedSupplierId = null }) {
                    Text("ändern", color = Orange, fontSize = 12.sp)
                }
            }

            when {
                loadingContainers -> Text(
                    "Container laden…",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 13.sp,
                )
                openContainers.isEmpty() -> Text(
                    "Keine offene Palette für ${chosen?.name ?: "diesen Lieferanten"}.",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 13.sp,
                )
                else -> {
                    Text(
                        "OFFENE PALETTEN",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White.copy(alpha = 0.5f),
                        letterSpacing = 0.8.sp,
                    )
                    openContainers.forEach { container ->
                        Button(
                            onClick = { onLinkToContainer(container.id, current.id) },
                            enabled = !actionLoading,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color.White.copy(alpha = 0.07f),
                                contentColor = Color.White,
                            ),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    container.code,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text(
                                    "${container.itemCount} Artikel",
                                    color = Color.White.copy(alpha = 0.5f),
                                    fontSize = 11.sp,
                                )
                            }
                        }
                    }
                }
            }

            BigButton(
                text = if (actionLoading) "Lege an…"
                       else "+ Neue Palette für ${chosen?.name ?: "Lieferant"}",
                onClick = { onCreateContainerAndLink(selectedSupplierId!!, current.id) },
                loading = actionLoading,
                enabled = !loadingContainers,
            )
        }
    }
}
