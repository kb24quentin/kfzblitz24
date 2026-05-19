package de.kfzblitz24.retoure_pda.data.repo

import de.kfzblitz24.retoure_pda.data.api.RetoureApi
import de.kfzblitz24.retoure_pda.data.api.dto.*
import de.kfzblitz24.retoure_pda.data.api.safeApi
import de.kfzblitz24.retoure_pda.data.auth.TokenStore

class ContainerRepository(
    private val api: RetoureApi,
    private val tokenStore: TokenStore,
) {
    suspend fun getOpenContainers(supplierId: String): Result<List<ContainerDto>> =
        safeApi("Container-Liste") {
            api.getContainers(status = "open", supplierId = supplierId).containers
        }

    suspend fun createContainer(supplierId: String): Result<ContainerCreated> =
        safeApi("Neue Palette") {
            val pdaId = tokenStore.getPdaId() ?: "unknown"
            api.createContainer(
                CreateContainerRequest(
                    type = "palette",
                    supplierId = supplierId,
                    createdByPda = pdaId,
                ),
            ).container
        }

    suspend fun addItemToContainer(containerId: String, itemId: String): Result<Unit> =
        safeApi("Artikel auf Palette legen") {
            val pdaId = tokenStore.getPdaId() ?: "unknown"
            api.addItemToContainer(
                containerId,
                AddItemToContainerRequest(itemId = itemId, actor = pdaId),
            )
            Unit
        }
}
