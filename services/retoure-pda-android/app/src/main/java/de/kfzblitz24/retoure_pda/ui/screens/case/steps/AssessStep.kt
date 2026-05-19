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
import de.kfzblitz24.retoure_pda.ui.components.BigButton
import de.kfzblitz24.retoure_pda.ui.theme.*

/**
 * Fest-definierte Prüf-Fragen für die Wareneingangs-Bewertung.
 *
 * Jede Frage hat einen Penalty-Wert, der vom Maximum (100) abgezogen
 * wird, falls die Antwort "kritisch" ist (= negative Auswirkung auf
 * den Wiederverkaufs-Zustand).
 *
 *   Score = 100 − Σ Penalty(answer_critical)
 *
 * Schwellen → Verdict:
 *   ≥ 85: GRÜN  — Ware OK, Erstattung freigeben
 *   ≥ 50: GELB  — Hersteller-Prüfung nötig
 *   < 50: ROT   — Ware kann nicht zurückgenommen werden
 */
private data class AssessQuestion(
    val key: String,
    val text: String,
    /**
     * Welche Antwort gilt als KRITISCH (= Penalty wird abgezogen)?
     *   `true`  → "Ja" ist schlecht (z. B. "schon montiert?")
     *   `false` → "Nein" ist schlecht (z. B. "OVP in Ordnung?")
     */
    val criticalAnswer: Boolean,
    val penaltyIfCritical: Int,
)

private val QUESTIONS = listOf(
    AssessQuestion(
        key = "montiert",
        text = "Wurde der Artikel bereits montiert / verbaut?",
        criticalAnswer = true,
        penaltyIfCritical = 40,
    ),
    AssessQuestion(
        key = "ovp_ok",
        text = "Ist die Originalverpackung vorhanden, intakt und wie neu?",
        criticalAnswer = false,
        penaltyIfCritical = 20,
    ),
    AssessQuestion(
        key = "schaeden",
        text = "Sind sichtbare Schäden am Artikel vorhanden?",
        criticalAnswer = true,
        penaltyIfCritical = 50,
    ),
    AssessQuestion(
        key = "vollstaendig",
        text = "Ist der Artikel vollständig (alle Teile + Zubehör)?",
        criticalAnswer = false,
        penaltyIfCritical = 25,
    ),
    AssessQuestion(
        key = "gebrauchsspuren",
        text = "Sind deutliche Gebrauchsspuren vorhanden?",
        criticalAnswer = true,
        penaltyIfCritical = 15,
    ),
)

/**
 * Mindestanzahl Fotos für die Bewertung.
 *
 * DEMO-Modus: 0 → Fotos sind nur empfohlen, kein Block.
 * Production später: auf 2 setzen → Mitarbeiter muss min. 2 Fotos
 * hochladen bevor er bewerten kann.
 */
private const val MIN_PHOTOS = 0

@Composable
fun AssessStep(
    caseId: String,
    caseDetail: CaseDetail,
    actionLoading: Boolean,
    onAssess: (itemId: String, score: Int, reason: String?) -> Unit,
    onOpenPhotos: (caseId: String, itemId: String) -> Unit,
) {
    val queue = caseDetail.items.filter {
        it.status == "received" || it.status == "photographed"
    }
    val current = queue.firstOrNull()
    val completed = caseDetail.items.count { it.status == "assessed" || it.status == "on_pallet" }
    val totalToAssess = queue.size + completed

    // Antworten pro Item gesondert verwalten — Reset beim Item-Wechsel.
    var answers by remember(current?.id) {
        mutableStateOf<Map<String, Boolean>>(emptyMap())
    }
    var reason by remember(current?.id) { mutableStateOf("") }

    if (current == null) {
        Text(
            "Kein Artikel zu bewerten — weiter zum nächsten Schritt.",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 14.sp,
        )
        return
    }

    // Score berechnen (nur aus beantworteten Fragen)
    val allAnswered = QUESTIONS.all { answers.containsKey(it.key) }
    val score = if (allAnswered) {
        val penalty = QUESTIONS.sumOf { q ->
            if (answers[q.key] == q.criticalAnswer) q.penaltyIfCritical else 0
        }
        (100 - penalty).coerceIn(0, 100)
    } else 100

    val verdictColor = when {
        score >= 85 -> VerdictGreen
        score >= 50 -> VerdictYellow
        else        -> VerdictRed
    }
    val verdictLabel = when {
        score >= 85 -> "GRÜN — Ware OK, Erstattung freigeben"
        score >= 50 -> "GELB — Hersteller-Prüfung nötig"
        else        -> "ROT — Ware nicht zurücknehmbar"
    }

    val photoCount = current.photoCount ?: 0
    val photosOk = photoCount >= MIN_PHOTOS

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            "Artikel bewerten",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
        Text(
            "${completed + 1} von $totalToAssess",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 13.sp,
        )

        // ── Artikel-Card ────────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.06f))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
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
            current.grund?.let {
                Text("Retoure-Grund: $it", color = Color.White.copy(alpha = 0.45f), fontSize = 12.sp)
            }
        }

        // ── Fotos (DEMO: optional) ──────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color.White.copy(alpha = 0.06f))
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                if (photoCount > 0) "✓ Fotos vorhanden ($photoCount)"
                else "📷 Fotos aufnehmen (optional)",
                color = if (photoCount > 0) Color(0xFFB9F6CA) else Color.White.copy(alpha = 0.85f),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Button(
                onClick = { onOpenPhotos(caseId, current.id) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White.copy(alpha = 0.12f),
                    contentColor = Color.White,
                ),
            ) {
                Text(
                    if (photoCount == 0) "📷 Fotos aufnehmen"
                    else "📷 Fotos verwalten ($photoCount)",
                    fontWeight = FontWeight.Medium,
                )
            }
        }

        // ── Fragen ──────────────────────────────────────────────────
        Text(
            "PRÜFFRAGEN",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White.copy(alpha = 0.5f),
            letterSpacing = 0.8.sp,
        )
        QUESTIONS.forEach { q ->
            QuestionRow(
                question = q,
                answer = answers[q.key],
                onAnswer = { ans ->
                    answers = answers + (q.key to ans)
                },
            )
        }

        // ── Score-Vorschau (nur wenn alle Fragen beantwortet) ───────
        if (allAnswered) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(verdictColor)
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "$score/100",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 28.sp,
                    )
                    Text(
                        verdictLabel,
                        color = Color.White.copy(alpha = 0.95f),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            // ── Optionale Begründung ─────────────────────────────────
            OutlinedTextField(
                value = reason,
                onValueChange = { reason = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = {
                    Text(
                        "Notiz (optional, z. B. \"Karton eingedrückt\")",
                        color = Color.White.copy(alpha = 0.35f),
                        fontSize = 14.sp,
                    )
                },
                minLines = 2,
                maxLines = 4,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Orange,
                    unfocusedBorderColor = Color.White.copy(alpha = 0.25f),
                    cursorColor = Orange,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                ),
                shape = RoundedCornerShape(10.dp),
            )
        }

        // ── Speichern ────────────────────────────────────────────────
        BigButton(
            text = if (!allAnswered) "Alle Fragen beantworten" else "Speichern + weiter",
            onClick = {
                onAssess(current.id, score, reason.trim().takeIf { it.isNotEmpty() })
            },
            loading = actionLoading,
            enabled = allAnswered,
        )
    }
}

@Composable
private fun QuestionRow(
    question: AssessQuestion,
    answer: Boolean?,
    onAnswer: (Boolean) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            question.text,
            color = Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            AnswerButton(
                label = "Ja",
                selected = answer == true,
                isCritical = question.criticalAnswer,   // true: Ja-Antwort ist die schlechte
                onClick = { onAnswer(true) },
                modifier = Modifier.weight(1f),
            )
            AnswerButton(
                label = "Nein",
                selected = answer == false,
                isCritical = !question.criticalAnswer,  // umgekehrt
                onClick = { onAnswer(false) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun AnswerButton(
    label: String,
    selected: Boolean,
    isCritical: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val containerColor = when {
        selected && isCritical  -> VerdictRed
        selected && !isCritical -> VerdictGreen
        else                    -> Color.White.copy(alpha = 0.10f)
    }
    val contentColor = if (selected) Color.White else Color.White.copy(alpha = 0.85f)

    Button(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = contentColor,
        ),
    ) {
        Text(label, fontWeight = FontWeight.Bold, fontSize = 15.sp)
    }
}
