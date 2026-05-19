package de.kfzblitz24.retoure_pda.ui.screens.pair

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.camera.core.ExperimentalGetImage
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import de.kfzblitz24.retoure_pda.data.repo.PairRepository
import de.kfzblitz24.retoure_pda.ui.components.BigButton
import de.kfzblitz24.retoure_pda.ui.theme.Navy
import de.kfzblitz24.retoure_pda.ui.theme.Orange

@Composable
fun PairScreen(
    pairRepository: PairRepository,
    onPaired: () -> Unit,
) {
    val vm: PairViewModel = viewModel(factory = PairViewModel.Factory(pairRepository))
    val state by vm.uiState.collectAsState()

    LaunchedEffect(state.paired) {
        if (state.paired) onPaired()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0D1B2A))
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Spacer(Modifier.height(32.dp))

        // ── Header ────────────────────────────────────────────────────
        Column {
            // kfzBlitz24 Wordmark (text-basiert wie in der PWA)
            Text(
                buildString {
                    append("kfz")
                    append("blitz")
                    append("24")
                },
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
            // Wir bauen das Wordmark inline mit einem AnnotatedString
            // um Orange für "blitz" zu setzen. Da BasicText-Inline
            // über AnnotatedString geht:
            Text(
                text = "Retoure PDA",
                fontSize = 14.sp,
                color = Color.White.copy(alpha = 0.6f),
            )
        }

        Text(
            "Gerät pairen",
            style = MaterialTheme.typography.headlineMedium,
        )

        Text(
            "Scanne den QR-Code aus dem Admin-Dashboard oder tippe den Pairing-Code manuell ein.",
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 14.sp,
        )

        // ── QR-Scanner ────────────────────────────────────────────────
        QrScannerCard(
            onQrDetected = { qrValue ->
                vm.pair(qrValue)
            },
        )

        Divider(color = Color.White.copy(alpha = 0.15f))

        Text(
            "oder Code manuell eingeben:",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 13.sp,
        )

        // ── Manuelles Code-Feld ────────────────────────────────────────
        OutlinedTextField(
            value = state.codeInput,
            onValueChange = vm::onCodeChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Pairing-Code") },
            placeholder = { Text("PDA-XXXX-XXXX", fontFamily = FontFamily.Monospace) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Ascii,
                capitalization = KeyboardCapitalization.Characters,
                imeAction = ImeAction.Done,
                autoCorrect = false,
            ),
            keyboardActions = KeyboardActions(onDone = { vm.pair() }),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Orange,
                unfocusedBorderColor = Orange.copy(alpha = 0.5f),
                cursorColor = Orange,
                focusedLabelColor = Orange,
            ),
            shape = RoundedCornerShape(12.dp),
        )

        BigButton(
            text = "Pairen",
            onClick = { vm.pair() },
            loading = state.loading,
            enabled = state.codeInput.isNotBlank(),
        )

        state.error?.let { err ->
            ErrorCard(message = err)
        }
    }
}

// ── QR-Scanner-Karte mit CameraX + ML Kit ────────────────────────────────────

@OptIn(ExperimentalGetImage::class)
@Composable
private fun QrScannerCard(onQrDetected: (String) -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var hasCameraPermission by remember { mutableStateOf(false) }
    var scanDone by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
    }

    LaunchedEffect(Unit) {
        permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(200.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        if (!hasCameraPermission) {
            Text(
                "Kamera-Erlaubnis benötigt — bitte unten Code manuell eingeben.",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 13.sp,
                modifier = Modifier.padding(16.dp),
            )
        } else {
            AndroidView(
                factory = { ctx ->
                    val previewView = PreviewView(ctx)
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

                    cameraProviderFuture.addListener({
                        val cameraProvider = cameraProviderFuture.get()

                        val preview = Preview.Builder().build().also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }

                        val options = BarcodeScannerOptions.Builder()
                            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                            .build()
                        val scanner = BarcodeScanning.getClient(options)

                        val imageAnalysis = ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()

                        imageAnalysis.setAnalyzer(
                            ContextCompat.getMainExecutor(ctx)
                        ) { imageProxy ->
                            if (scanDone) {
                                imageProxy.close()
                                return@setAnalyzer
                            }
                            val mediaImage = imageProxy.image
                            if (mediaImage != null) {
                                val image = InputImage.fromMediaImage(
                                    mediaImage,
                                    imageProxy.imageInfo.rotationDegrees,
                                )
                                scanner.process(image)
                                    .addOnSuccessListener { barcodes ->
                                        barcodes.firstOrNull()?.rawValue?.let { value ->
                                            if (!scanDone) {
                                                scanDone = true
                                                onQrDetected(value)
                                            }
                                        }
                                    }
                                    .addOnCompleteListener { imageProxy.close() }
                            } else {
                                imageProxy.close()
                            }
                        }

                        try {
                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                imageAnalysis,
                            )
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }, ContextCompat.getMainExecutor(ctx))

                    previewView
                },
                modifier = Modifier.fillMaxSize(),
            )

            // Overlay-Hinweis
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(8.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color.Black.copy(alpha = 0.6f))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                Text(
                    "QR-Code auf die Kamera halten",
                    color = Color.White,
                    fontSize = 12.sp,
                )
            }
        }
    }
}

@Composable
fun ErrorCard(message: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0x33F44336))
            .padding(12.dp),
    ) {
        Text(
            text = message,
            color = Color(0xFFEF9A9A),
            fontSize = 13.sp,
        )
    }
}
