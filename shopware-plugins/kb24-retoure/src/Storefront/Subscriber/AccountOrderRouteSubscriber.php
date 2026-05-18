<?php declare(strict_types=1);

namespace KbRetoure\Storefront\Subscriber;

use KbRetoure\Service\RetoureApiClient;
use Shopware\Core\System\SystemConfig\SystemConfigService;
use Shopware\Storefront\Page\Account\Order\AccountOrderDetailPageLoadedEvent;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Reichert die Account-Order-Detail-Page mit den Daten an, die
 * das Twig-Template (order-detail.html.twig) für den "Retoure
 * anmelden"-Button braucht.
 *
 * Der eigentliche Prefill-API-Call passiert NICHT hier (zu teuer
 * pro Page-Load) — wir reichen nur die API-URL und ein Flag durch.
 * Der Button selbst sendet ein POST gegen einen kleinen Storefront-
 * Controller, der dann erst den Token holt. (Controller-Stub
 * wird in Phase 9 ergänzt — siehe README.)
 */
class AccountOrderRouteSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private readonly RetoureApiClient $apiClient,
        private readonly SystemConfigService $systemConfig,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            AccountOrderDetailPageLoadedEvent::class => 'onAccountOrderDetailLoaded',
        ];
    }

    public function onAccountOrderDetailLoaded(AccountOrderDetailPageLoadedEvent $event): void
    {
        if (!$this->apiClient->isEnabled()) {
            return;
        }

        $page    = $event->getPage();
        $baseUrl = $this->apiClient->getBaseUrl();

        // Wird im Twig-Override als {{ page.extensions.kbRetoure.apiBaseUrl }} verfügbar.
        // Wir nutzen das interne addExtension-Pattern von Shopware so, wie es
        // jedes andere Shopware-Plugin macht (vergl. ShopwareSamplePlugin).
        $page->addArrayExtension('kbRetoure', [
            'enabled'    => true,
            'apiBaseUrl' => $baseUrl,
            // Order-ID wird im Twig aus page.order.id gelesen.
        ]);
    }
}
