package de.kfzblitz24.retoure_pda.ui.screens.case.steps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.ui.components.BigButton

@Composable
fun ReceiveStep(
    loading: Boolean,
    onReceive: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("📦", fontSize = 56.sp, textAlign = TextAlign.Center)

        Text(
            "Paket entgegennehmen?",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            textAlign = TextAlign.Center,
        )

        Text(
            "Bestätige, dass das Paket physisch im Lager angekommen ist.",
            fontSize = 14.sp,
            color = Color.White.copy(alpha = 0.65f),
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(8.dp))

        BigButton(
            text = "✓ Paket angenommen",
            onClick = onReceive,
            loading = loading,
        )
    }
}
