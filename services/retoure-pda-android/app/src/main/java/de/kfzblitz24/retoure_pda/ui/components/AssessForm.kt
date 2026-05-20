package de.kfzblitz24.retoure_pda.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.ui.theme.Orange
import de.kfzblitz24.retoure_pda.ui.theme.VerdictGreen
import de.kfzblitz24.retoure_pda.ui.theme.VerdictRed
import de.kfzblitz24.retoure_pda.ui.theme.VerdictYellow

/**
 * Shared Rating-Form (5 Yes/No-Fragen + Score-Vorschau + Speichern).
 *
 * Wird sowohl von ScanStep (inline nach jedem Artikel-Scan) als auch
 * vom AssessStep (Fallback-Bewertung für manuell bestätigte Items)
 * verwendet. Verhalten + Score-Berechnung sind exakt gleich.
 */
data class AssessQuestion(
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

/** Standard-Prüffragen. Werden aus ScanStep + AssessStep importiert. */
val ASSESS_QUESTIONS = listOf(
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

/** Berechnet den Score (0-100) aus einer Antwort-Map. */
fun calculateAssessScore(answers: Map<String, Boolean>): Int {
    val penalty = ASSESS_QUESTIONS.sumOf { q ->
        if (answers[q.key] == q.criticalAnswer) q.penaltyIfCritical else 0
    }
    return (100 - penalty).coerceIn(0, 100)
}

// Verdict-Farben kommen aus dem Theme — wir reexportieren sie nicht
// damit es keine Konflikte mit den theme-Definitionen gibt.

fun verdictColorFor(score: Int): Color = when {
    score >= 85 -> VerdictGreen
    score >= 50 -> VerdictYellow
    else        -> VerdictRed
}

fun verdictLabelFor(score: Int): String = when {
    score >= 85 -> "GRÜN — Ware OK, Erstattung freigeben"
    score >= 50 -> "GELB — Hersteller-Prüfung nötig"
    else        -> "ROT — Ware nicht zurücknehmbar"
}

/**
 * Composable: kompletter Rating-Form mit Fragen, Score + Speichern-Button.
 *
 * Caller verwaltet `answers` + `reason` als State (damit es z. B. beim
 * Item-Wechsel resettet werden kann via `remember(key)`).
 */
@Composable
fun AssessForm(
    answers: Map<String, Boolean>,
    onAnswer: (key: String, value: Boolean) -> Unit,
    reason: String,
    onReasonChange: (String) -> Unit,
    actionLoading: Boolean,
    onSave: (score: Int, reason: String?) -> Unit,
    saveButtonText: String = "Speichern + weiter",
) {
    val allAnswered = ASSESS_QUESTIONS.all { answers.containsKey(it.key) }
    val score = if (allAnswered) calculateAssessScore(answers) else 100

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "PRÜFFRAGEN",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White.copy(alpha = 0.5f),
            letterSpacing = 0.8.sp,
        )
        ASSESS_QUESTIONS.forEach { q ->
            QuestionRow(
                question = q,
                answer = answers[q.key],
                onAnswer = { ans -> onAnswer(q.key, ans) },
            )
        }

        if (allAnswered) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(verdictColorFor(score))
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
                        verdictLabelFor(score),
                        color = Color.White.copy(alpha = 0.95f),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            OutlinedTextField(
                value = reason,
                onValueChange = onReasonChange,
                modifier = Modifier.fillMaxWidth(),
                placeholder = {
                    Text(
                        "Notiz (optional, z. B. „Karton eingedrückt“)",
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

        BigButton(
            text = if (!allAnswered) "Alle Fragen beantworten" else saveButtonText,
            onClick = {
                onSave(score, reason.trim().takeIf { it.isNotEmpty() })
            },
            loading = actionLoading,
            enabled = allAnswered && !actionLoading,
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
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            question.text,
            color = Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(true, false).forEach { v ->
                val isSelected = answer == v
                val isCritical = v == question.criticalAnswer
                val selectedColor = if (isCritical) VerdictRed else VerdictGreen
                Button(
                    onClick = { onAnswer(v) },
                    modifier = Modifier.weight(1f).height(44.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isSelected) selectedColor
                                         else Color.White.copy(alpha = 0.08f),
                        contentColor = Color.White,
                    ),
                ) {
                    Text(if (v) "Ja" else "Nein", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
