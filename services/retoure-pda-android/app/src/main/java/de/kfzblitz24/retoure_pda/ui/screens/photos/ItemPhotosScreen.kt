package de.kfzblitz24.retoure_pda.ui.screens.photos

import android.Manifest
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import de.kfzblitz24.retoure_pda.data.api.dto.PhotoDto
import de.kfzblitz24.retoure_pda.data.auth.TokenStore
import de.kfzblitz24.retoure_pda.data.repo.PhotoRepository
import de.kfzblitz24.retoure_pda.ui.theme.Navy
import de.kfzblitz24.retoure_pda.ui.theme.Orange
import java.io.File
import java.util.concurrent.Executor

/** Foto-Typen mit Labels — exakt wie im Prisma-Schema (kind). */
private val PHOTO_KINDS = listOf(
    "ovp"     to "OVP / Verpackung",
    "artikel" to "Artikel",
    "detail1" to "Detail 1",
    "detail2" to "Detail 2",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ItemPhotosScreen(
    caseId: String,
    itemId: String,
    photoRepository: PhotoRepository,
    tokenStore: TokenStore,
    onBack: () -> Unit,
) {
    val vm: ItemPhotosViewModel = viewModel(
        key = "photos_${caseId}_${itemId}",
        factory = ItemPhotosViewModel.Factory(caseId, itemId, photoRepository, tokenStore),
    )
    val state by vm.uiState.collectAsState()

    var activeCaptureKind by remember { mutableStateOf<String?>(null) }
    var hasCameraPermission by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> hasCameraPermission = granted }

    LaunchedEffect(Unit) {
        permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Fotos", color = Color.White) },
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

        // Kamera-Overlay wenn aktiver Kind-Capture
        if (activeCaptureKind != null && hasCameraPermission) {
            CameraCapture(
                kind = activeCaptureKind!!,
                onCapture = { file ->
                    vm.uploadPhoto(file, activeCaptureKind!!)
                    activeCaptureKind = null
                },
                onDismiss = { activeCaptureKind = null },
            )
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (state.loading) {
                CircularProgressIndicator(color = Orange, modifier = Modifier.align(Alignment.CenterHorizontally))
            }

            state.error?.let { err ->
                Text(err, color = Color(0xFFEF9A9A), fontSize = 13.sp)
            }

            state.uploadError?.let { err ->
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

            if (state.uploading) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    CircularProgressIndicator(color = Orange, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    Text("Hochladen…", color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp)
                }
            }

            // Pro Kind ein Block
            PHOTO_KINDS.forEach { (kind, label) ->
                val kindPhotos = state.photos.filter { it.kind == kind }
                PhotoKindBlock(
                    label = label,
                    kind = kind,
                    photos = kindPhotos,
                    photoUrlBuilder = { photoId -> vm.downloadUrl(photoId) },
                    onCapture = {
                        if (hasCameraPermission) {
                            activeCaptureKind = kind
                        } else {
                            permissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    },
                    uploading = state.uploading,
                )
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun PhotoKindBlock(
    label: String,
    kind: String,
    photos: List<PhotoDto>,
    photoUrlBuilder: (String) -> String,
    onCapture: () -> Unit,
    uploading: Boolean,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label, fontWeight = FontWeight.SemiBold, color = Color.White, fontSize = 15.sp)
            Text("${photos.size} Foto(s)", color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
        }

        // Thumbnails
        if (photos.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                photos.forEach { photo ->
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(photoUrlBuilder(photo.id))
                            .crossfade(true)
                            .build(),
                        contentDescription = photo.kind,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .size(80.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.White.copy(alpha = 0.1f)),
                    )
                }
            }
        }

        // Capture-Button
        Button(
            onClick = onCapture,
            enabled = !uploading,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Orange,
                contentColor = Color.White,
            ),
        ) {
            Text("📷 Foto aufnehmen")
        }
    }
}

// ── CameraX Capture Overlay ──────────────────────────────────────────────────

@Composable
private fun CameraCapture(
    kind: String,
    onCapture: (File) -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var imageCapture: ImageCapture? by remember { mutableStateOf(null) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        AndroidView(
            factory = { ctx ->
                val previewView = PreviewView(ctx)
                val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

                cameraProviderFuture.addListener({
                    val cameraProvider = cameraProviderFuture.get()
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }
                    val capture = ImageCapture.Builder()
                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                        .build()
                    imageCapture = capture

                    try {
                        cameraProvider.unbindAll()
                        cameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            CameraSelector.DEFAULT_BACK_CAMERA,
                            preview,
                            capture,
                        )
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }, ContextCompat.getMainExecutor(ctx))

                previewView
            },
            modifier = Modifier.fillMaxSize(),
        )

        // Steuer-Buttons
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Capture Button
            Button(
                onClick = {
                    val ic = imageCapture ?: return@Button
                    val outputFile = File.createTempFile("photo_${kind}_", ".jpg", context.cacheDir)
                    val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()
                    ic.takePicture(
                        outputOptions,
                        ContextCompat.getMainExecutor(context),
                        object : ImageCapture.OnImageSavedCallback {
                            override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                                onCapture(outputFile)
                            }
                            override fun onError(exc: ImageCaptureException) {
                                exc.printStackTrace()
                                onDismiss()
                            }
                        },
                    )
                },
                modifier = Modifier.size(72.dp),
                shape = RoundedCornerShape(36.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color.White),
            ) {
                Text("●", color = Color.Black, fontSize = 24.sp)
            }

            TextButton(onClick = onDismiss) {
                Text("Abbrechen", color = Color.White, fontSize = 14.sp)
            }
        }
    }
}
