package de.kfzblitz24.retoure_pda.data.api.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ─────────────────────────────────────────────────────────────────────────────
// Pair
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class PairRequest(
    val code: String,
)

@Serializable
data class PairResponse(
    val token: String,
    val pdaId: String,
)

// ─────────────────────────────────────────────────────────────────────────────
// Case
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class CustomerSnapshot(
    val anrede: String? = null,
    val vorname: String? = null,
    val name: String? = null,
    val plz: String? = null,
    val ort: String? = null,
    val email: String? = null,
)

@Serializable
data class PdaItem(
    val id: String,
    val source: String,            // "registered" | "extra" | "unknown"
    val status: String,
    val artikelnummer: String? = null,
    val hersteller: String? = null,
    val beschreibung: String? = null,
    val menge: Int = 1,
    val grund: String? = null,
    @SerialName("einzelpreis_brutto") val einzelpreisBrutto: Double? = null,
    @SerialName("gesamtpreis_brutto") val gesamtpreisBrutto: Double? = null,
    @SerialName("einzelgewicht_g") val einzelgewichtG: Int? = null,
    /**
     * EAN/GTIN aus Webisco. Wenn vorhanden, kann der PDA-Mitarbeiter
     * den Artikel-Barcode direkt scannen und der ScanStep matcht das
     * automatisch gegen das Item → setzt status="received". Wenn null
     * (Webisco kennt keinen EAN, Sammelartikel, etc.) muss der Worker
     * manuell "Da/Fehlt" tippen.
     */
    val eanCode: String? = null,
    val supplierId: String? = null,
    val supplierName: String? = null,
    val containerId: String? = null,
    val containerCode: String? = null,
    val verdict: String? = null,   // "green" | "yellow" | "red"
    val photoCount: Int = 0,
)

@Serializable
data class CaseDetail(
    val id: String,
    val bestellnummer: String,
    val belegnummer: String? = null,
    val status: String,
    val carrierDeliveredAt: String? = null,
    val partnerReceivedAt: String? = null,
    /** ISO-Timestamp wann Worker "Fertig mit Scannen" gedrückt hat. */
    val scanCompletedAt: String? = null,
    val customer: CustomerSnapshot,
    val items: List<PdaItem>,
)

// ─────────────────────────────────────────────────────────────────────────────
// Scan-EAN — Eingangs-Scan + Klassifikation
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class ScanEanRequest(
    val ean: String,
    val pdaId: String? = null,
)

@Serializable
data class ScanCompleteRequest(
    val pdaId: String? = null,
)

/**
 * Klassifikation eines gescannten EAN:
 *   - "ok_registered" — angemeldetes Item bestätigt (GRÜN)
 *   - "ok_extra"      — aus der Order aber nicht angemeldet (GRÜN)
 *   - "not_ok_unknown"— nicht in der Order / EAN unbekannt (ROT,
 *                       landet auf kfzBlitz24-Retoure-Palette)
 */
@Serializable
data class ScanEanResponse(
    val kind: String,
    val message: String,
    val scannedEan: String,
    val item: PdaItem? = null,
    val resolvedArticle: ResolvedArticle? = null,
)

@Serializable
data class ResolvedArticle(
    val artikelnummer: String? = null,
    val hersteller: String? = null,
    val beschreibung: String? = null,
    val eancode: String? = null,
)

// ─────────────────────────────────────────────────────────────────────────────
// Lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Backend gibt nicht eine Liste, sondern den einzigen Treffer als
 * `{matchedBy, case}` zurück. `matchedBy` ∈ {id, bestellnummer, tracking}
 * sagt nach welchem Feld der Match war (kann später für UI-Hinweise
 * genutzt werden, aktuell ungenutzt).
 */
@Serializable
data class LookupResponse(
    val matchedBy: String,
    val case: CaseSummary,
)

@Serializable
data class CaseSummary(
    val id: String,
    val bestellnummer: String,
    val belegnummer: String? = null,
    val status: String,
    // Lookup-Endpoint liefert createdAt nicht — deshalb nullable.
    val createdAt: String? = null,
    // Optional: Kundennamen aus dem Lookup, falls Backend mitliefert.
    val customer: CustomerSnapshot? = null,
)

// ─────────────────────────────────────────────────────────────────────────────
// Receive
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class ReceiveRequest(
    val pdaId: String,
)

// ─────────────────────────────────────────────────────────────────────────────
// Scan
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class ScanRequest(
    val present: Boolean,
    val pdaId: String,
)

// ─────────────────────────────────────────────────────────────────────────────
// Assess
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class AssessRequest(
    val employeeScore: Int,
    val verdictReason: String? = null,
    val pdaId: String,
)

// ─────────────────────────────────────────────────────────────────────────────
// Supplier
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class SuppliersResponse(
    val suppliers: List<SupplierDto>,
)

@Serializable
data class SupplierDto(
    val id: String,
    val name: String,
)

// ─────────────────────────────────────────────────────────────────────────────
// Container
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class ContainersResponse(
    val containers: List<ContainerDto>,
)

@Serializable
data class ContainerDto(
    val id: String,
    val code: String,
    val supplierId: String? = null,
    val supplierName: String? = null,
    val itemCount: Int = 0,
)

@Serializable
data class CreateContainerRequest(
    val type: String = "palette",
    val supplierId: String,
    val createdByPda: String,
)

@Serializable
data class CreateContainerResponse(
    val container: ContainerCreated,
)

@Serializable
data class ContainerCreated(
    val id: String,
    val code: String,
)

@Serializable
data class AddItemToContainerRequest(
    val itemId: String,
    val actor: String,
)

// ─────────────────────────────────────────────────────────────────────────────
// Finalize
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class FinalizeRequest(
    val pdaId: String,
)

// ─────────────────────────────────────────────────────────────────────────────
// Photo
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class PhotoDto(
    val id: String,
    val kind: String,
    val filename: String,
    val sizeBytes: Int,
)

@Serializable
data class PhotoListResponse(
    val photos: List<PhotoDto>,
)

// ─────────────────────────────────────────────────────────────────────────────
// Generic success / error
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class GenericSuccess(
    val ok: Boolean = true,
    val message: String? = null,
)
