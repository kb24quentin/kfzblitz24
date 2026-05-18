<?php declare(strict_types=1);

namespace KbRetoure\Storefront\Controller;

use KbRetoure\Service\RetoureApiClient;
use Shopware\Core\Checkout\Order\OrderEntity;
use Shopware\Core\Framework\Context;
use Shopware\Core\Framework\DataAbstractionLayer\EntityRepository;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Shopware\Core\System\SalesChannel\SalesChannelContext;
use Shopware\Storefront\Controller\StorefrontController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Storefront-Controller für den "Retoure anmelden"-Klick im Account.
 *
 * Flow:
 *   1. Kunde klickt im Order-Detail auf den Button → POSTet auf
 *      /account/order/retoure (Symfony-Route frontend.kb24.retoure.start).
 *   2. Wir laden die Bestellung via OrderRepository und mappen sie auf
 *      einen Prefill-Payload.
 *   3. RetoureApiClient::createPrefillToken() ruft die RMA-API auf und
 *      liefert {token, url} zurück.
 *   4. Wir leiten den Kunden auf die zurückgegebene url um — die landet
 *      auf https://retoure.{env}.kfzblitz24-group.com/start?token=…
 *
 * Bei Fehlern: Flash-Message + Redirect auf die Order-Detail-Page.
 *
 * @Route(defaults={"_routeScope"={"storefront"}})
 */
class RetoureController extends StorefrontController
{
    public function __construct(
        private readonly RetoureApiClient $apiClient,
        private readonly EntityRepository $orderRepository,
    ) {
    }

    /**
     * POST /account/order/retoure — startet den Prefill-Hand-off.
     *
     * @Route(
     *     path="/account/order/retoure",
     *     name="frontend.kb24.retoure.start",
     *     methods={"POST"},
     *     defaults={"_loginRequired"=true, "XmlHttpRequest"=false, "csrf_protected"=true}
     * )
     */
    public function start(Request $request, SalesChannelContext $context): RedirectResponse
    {
        $orderId = (string) $request->request->get('orderId', '');
        if ($orderId === '') {
            $this->addFlash('danger', $this->trans('kb24Retoure.error.missingOrder', [], 'storefront'));
            return $this->redirectToRoute('frontend.account.order.page');
        }

        $order = $this->loadOrder($orderId, $context->getContext());
        if (!$order) {
            $this->addFlash('danger', $this->trans('kb24Retoure.error.orderNotFound', [], 'storefront'));
            return $this->redirectToRoute('frontend.account.order.page');
        }

        // Defensive: prüfe, dass die Order zum aktuell eingeloggten
        // Customer gehört — sonst könnte ein angemeldeter Kunde durch
        // raten der Order-IDs anderer Kunden Prefill-Tokens erzeugen.
        $customer = $context->getCustomer();
        $orderCustomer = $order->getOrderCustomer();
        if (!$customer || !$orderCustomer || $orderCustomer->getCustomerId() !== $customer->getId()) {
            $this->addFlash('danger', $this->trans('kb24Retoure.error.notYourOrder', [], 'storefront'));
            return $this->redirectToRoute('frontend.account.order.page');
        }

        $payload = $this->mapOrderToPrefillPayload($order);
        $result = $this->apiClient->createPrefillToken($payload);

        if (isset($result['error']) || empty($result['url'])) {
            $this->addFlash(
                'danger',
                $this->trans('kb24Retoure.error.apiFailed', ['%error%' => (string) ($result['error'] ?? 'unknown')], 'storefront')
            );
            return $this->redirectToRoute(
                'frontend.account.order.single.page',
                ['deepLinkCode' => $order->getDeepLinkCode() ?? ''],
            );
        }

        return new RedirectResponse((string) $result['url']);
    }

    private function loadOrder(string $orderId, Context $context): ?OrderEntity
    {
        $criteria = new Criteria([$orderId]);
        $criteria->addAssociation('orderCustomer');
        $criteria->addAssociation('lineItems');
        $criteria->addAssociation('addresses');
        $criteria->addAssociation('billingAddress');

        /** @var OrderEntity|null $order */
        $order = $this->orderRepository->search($criteria, $context)->first();
        return $order;
    }

    /**
     * Mappt eine Shopware-Order auf den Prefill-Payload für die RMA-API.
     *
     * Konvention: bestellnummer = Order-Number (nicht UUID). Die
     * RMA-Seite gleicht die Nummer gegen Webisco ab.
     *
     * @return array<string,mixed>
     */
    private function mapOrderToPrefillPayload(OrderEntity $order): array
    {
        $customer = [];
        $oc = $order->getOrderCustomer();
        if ($oc) {
            $customer['anrede']  = $oc->getSalutation()?->getDisplayName();
            $customer['vorname'] = $oc->getFirstName();
            $customer['name']    = $oc->getLastName();
            $customer['email']   = $oc->getEmail();
        }

        $billing = $order->getBillingAddress();
        if ($billing) {
            $customer['strasse'] = trim(($billing->getStreet() ?? '') . ' ' . ($billing->getAdditionalAddressLine1() ?? ''));
            $customer['plz']     = $billing->getZipcode();
            $customer['ort']     = $billing->getCity();
            $customer['telefon'] = $billing->getPhoneNumber();
        }

        // Strip leere Felder, damit die API-Antwort sauber bleibt.
        $customer = array_filter($customer, static fn ($v) => $v !== null && $v !== '');

        $items = [];
        foreach ($order->getLineItems() ?? [] as $li) {
            // Nur "normale" Produkt-Positionen, keine Promotions/Shipping.
            if ($li->getType() !== 'product') {
                continue;
            }
            $artikelnummer = $li->getPayload()['productNumber'] ?? $li->getProductId() ?? null;
            if ($artikelnummer === null) {
                continue;
            }
            $items[] = [
                'artikelnummer' => (string) $artikelnummer,
                'menge'         => (int) $li->getQuantity(),
            ];
        }

        return [
            'orderId'       => $order->getId(),
            'bestellnummer' => (string) ($order->getOrderNumber() ?? ''),
            'customer'      => $customer,
            'items'         => $items,
            'source'        => 'shopware',
        ];
    }
}
