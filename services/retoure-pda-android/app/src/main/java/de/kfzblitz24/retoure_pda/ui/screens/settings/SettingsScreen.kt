package de.kfzblitz24.retoure_pda.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.data.auth.TokenStore
import de.kfzblitz24.retoure_pda.ui.components.BigButton
import de.kfzblitz24.retoure_pda.ui.theme.Navy
import de.kfzblitz24.retoure_pda.ui.theme.Orange

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    tokenStore: TokenStore,
    onBack: () -> Unit,
    onLogout: () -> Unit,
    onOpenPrinterSettings: () -> Unit = {},
) {
    var baseUrl by remember { mutableStateOf(tokenStore.getBaseUrl()) }
    var manualToken by remember { mutableStateOf(tokenStore.getToken() ?: "") }
    val pdaId = tokenStore.getPdaId() ?: "—"

    var savedConfirm by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Einstellungen", color = Color.White) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Zurück", tint = Color.White)
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
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {

            // ── Base-URL ──────────────────────────────────────────────
            SettingsSection(title = "Server-URL") {
                Text(
                    "Standard: ${TokenStore.DEFAULT_BASE_URL}",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp,
                )
                OutlinedTextField(
                    value = baseUrl,
                    onValueChange = { baseUrl = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Base-URL") },
                    placeholder = { Text(TokenStore.DEFAULT_BASE_URL, fontFamily = FontFamily.Monospace, fontSize = 12.sp) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Uri,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = KeyboardActions(onDone = {
                        tokenStore.setBaseUrl(baseUrl)
                        savedConfirm = "URL gespeichert."
                    }),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Orange,
                        unfocusedBorderColor = Orange.copy(alpha = 0.4f),
                        cursorColor = Orange,
                    ),
                    shape = RoundedCornerShape(10.dp),
                )
                Button(
                    onClick = {
                        tokenStore.setBaseUrl(baseUrl)
                        savedConfirm = "URL gespeichert."
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Orange),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text("Speichern")
                }
                Button(
                    onClick = {
                        baseUrl = TokenStore.DEFAULT_BASE_URL
                        tokenStore.setBaseUrl(TokenStore.DEFAULT_BASE_URL)
                        savedConfirm = "Auf Standard zurückgesetzt."
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.1f)),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text("Auf Staging-Standard zurücksetzen", color = Color.White)
                }
            }

            // ── Manueller Token (Fallback für Tests) ───────────────────
            SettingsSection(title = "Token (manuell für Tests)") {
                Text(
                    "Nur für Entwickler — normalerweise automatisch via Pairing gesetzt.",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp,
                )
                OutlinedTextField(
                    value = manualToken,
                    onValueChange = { manualToken = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Bearer Token") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = KeyboardActions(onDone = {
                        tokenStore.setToken(manualToken)
                        savedConfirm = "Token gespeichert."
                    }),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Orange,
                        unfocusedBorderColor = Orange.copy(alpha = 0.4f),
                        cursorColor = Orange,
                    ),
                    shape = RoundedCornerShape(10.dp),
                )
                Button(
                    onClick = {
                        tokenStore.setToken(manualToken)
                        savedConfirm = "Token gespeichert."
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.1f)),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text("Token speichern", color = Color.White)
                }
            }

            // ── PDA-ID (read-only) ────────────────────────────────────
            SettingsSection(title = "Gerät-Info") {
                InfoRow("PDA-ID", pdaId)
                InfoRow("Base-URL", tokenStore.getBaseUrl())
            }

            // ── Bestätigungshinweis ───────────────────────────────────
            savedConfirm?.let { msg ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0x2200C853))
                        .padding(10.dp),
                ) {
                    Text(msg, color = Color(0xFFB9F6CA), fontSize = 13.sp)
                }
            }

            Divider(color = Color.White.copy(alpha = 0.12f))

            // ── Drucker ───────────────────────────────────────────────
            SettingsSection(title = "Drucker") {
                Text(
                    "Bluetooth-Drucker (Munbyn RW403B u. Ä.) für Paletten-Labels.",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp,
                )
                Button(
                    onClick = onOpenPrinterSettings,
                    colors = ButtonDefaults.buttonColors(containerColor = Orange),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text("Drucker verwalten")
                }
            }

            Divider(color = Color.White.copy(alpha = 0.12f))

            // ── Logout ────────────────────────────────────────────────
            BigButton(
                text = "Abmelden (Gerät neu pairen)",
                onClick = {
                    tokenStore.clear()
                    onLogout()
                },
                containerColor = Color(0xFFC62828),
            )

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SettingsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.05f))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            title.uppercase(),
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.8.sp,
        )
        content()
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Column {
        Text(label, color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
        Text(
            value,
            color = Color.White,
            fontSize = 14.sp,
            fontFamily = if (label == "PDA-ID" || label == "Base-URL") FontFamily.Monospace else FontFamily.Default,
        )
    }
}
