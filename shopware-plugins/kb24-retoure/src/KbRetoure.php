<?php declare(strict_types=1);

namespace KbRetoure;

use Shopware\Core\Framework\Plugin;

/**
 * kfzBlitz24 Retoure — Plugin-Bootstrap.
 *
 * Verbindet Shopware-Bestellungen mit dem internen RMA-Portal
 * (https://retoure.kfzblitz24-group.com bzw. das Staging-Pendant).
 *
 * Die eigentliche Logik liegt in:
 *   - Service\RetoureApiClient            (HTTP-Aufruf gegen die RMA-API)
 *   - Storefront\Subscriber\AccountOrderRouteSubscriber (Button-Injection)
 *   - Resources/views/.../order-detail.html.twig        (Twig-Override)
 *
 * Konfiguration im Admin: Settings → System → Plugins → kfzBlitz24 Retoure.
 */
class KbRetoure extends Plugin
{
}
