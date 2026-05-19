package de.kfzblitz24.retoure_pda.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.ui.theme.Orange

/**
 * Autofokussierter Scan-Input.
 *
 * Wenn ein HID-Keyboard-Wedge-Scanner (Netum Q900, etc.) angeschlossen
 * ist, landen alle Tastatureingaben in diesem Feld. Beim Enter-Tastendruck
 * (= Ende des Scans) wird onScan() aufgerufen und das Feld geleert.
 *
 * Parallel läuft der CompositeScanner via LaunchedEffect im Screen und
 * liefert Scans aus Intent-Broadcasts. Beide Quellen münden in denselben
 * onScan-Callback.
 */
@Composable
fun ScanInputField(
    value: String,
    onValueChange: (String) -> Unit,
    onScan: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Artikelnummer scannen…",
    enabled: Boolean = true,
) {
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier
            .fillMaxWidth()
            .focusRequester(focusRequester),
        enabled = enabled,
        textStyle = TextStyle(
            fontFamily = FontFamily.Monospace,
            fontSize = 18.sp,
            color = Color.White,
        ),
        placeholder = {
            Text(
                text = placeholder,
                color = Color.White.copy(alpha = 0.4f),
                fontSize = 16.sp,
            )
        },
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Text,
            capitalization = KeyboardCapitalization.Characters,
            imeAction = ImeAction.Done,
            autoCorrect = false,
        ),
        keyboardActions = KeyboardActions(
            onDone = {
                if (value.isNotBlank()) {
                    onScan(value.trim())
                }
            },
        ),
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Orange,
            unfocusedBorderColor = Orange.copy(alpha = 0.5f),
            cursorColor = Orange,
            focusedContainerColor = Color.White.copy(alpha = 0.08f),
            unfocusedContainerColor = Color.White.copy(alpha = 0.05f),
        ),
    )
}
