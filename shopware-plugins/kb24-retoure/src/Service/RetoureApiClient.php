<?php declare(strict_types=1);

namespace KbRetoure\Service;

use Psr\Log\LoggerInterface;
use Shopware\Core\System\SystemConfig\SystemConfigService;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * HTTP-Client gegen die interne kfzBlitz24-RMA-API.
 *
 * Endpunkte:
 *   POST {apiBaseUrl}/api/retoure/prefill
 *
 * Hinweis: Der Endpoint /api/retoure/prefill wird in Phase 9 des
 * Retoure-Service implementiert. Bis dahin ist diese Klasse ein
 * funktionsfähiger Stub — sie führt den HTTP-Call wirklich aus,
 * fängt Fehler aber sauber ab damit die Storefront nie crasht.
 */
class RetoureApiClient
{
    private const CONFIG_DOMAIN = 'KbRetoure.config';
    private const PREFILL_PATH  = '/api/retoure/prefill';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly SystemConfigService $systemConfig,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * Fordert einen Prefill-Token bei der RMA-API an. Mit diesem Token
     * kann der Kunde auf {apiBaseUrl}/start?token=… landen und sieht
     * eine vorausgefüllte Retoure-Anmeldung (Bestellnr, Artikel, Anschrift).
     *
     * @param string  $orderId      Shopware Order-ID
     * @param string  $customerId   Shopware Customer-ID
     * @param mixed[] $items        Liste der zurückzusendenden Positionen
     *
     * @return array{token?: string, url?: string, error?: string}
     */
    public function createPrefillToken(string $orderId, string $customerId, array $items): array
    {
        if (!$this->isEnabled()) {
            return ['error' => 'plugin_disabled'];
        }

        $baseUrl = $this->getBaseUrl();
        $token   = $this->getApiToken();

        if ($baseUrl === '' || $token === '') {
            $this->logger->warning('[KbRetoure] API-Konfiguration unvollständig', [
                'hasBaseUrl' => $baseUrl !== '',
                'hasToken'   => $token !== '',
            ]);

            return ['error' => 'config_missing'];
        }

        try {
            $response = $this->httpClient->request('POST', $baseUrl . self::PREFILL_PATH, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $token,
                    'Content-Type'  => 'application/json',
                    'Accept'        => 'application/json',
                ],
                'json' => [
                    'orderId'    => $orderId,
                    'customerId' => $customerId,
                    'items'      => $items,
                    'source'     => 'shopware-kb24-retoure',
                ],
                'timeout' => 5.0,
            ]);

            $status = $response->getStatusCode();
            if ($status >= 200 && $status < 300) {
                $data           = $response->toArray(false);
                $data['url']  ??= $baseUrl . '/start?token=' . ($data['token'] ?? '');

                return $data;
            }

            $this->logger->warning('[KbRetoure] Prefill-API antwortete nicht 2xx', [
                'status' => $status,
                'orderId' => $orderId,
            ]);

            return ['error' => 'api_error_' . $status];
        } catch (ExceptionInterface $e) {
            $this->logger->error('[KbRetoure] HTTP-Fehler beim Prefill-Call', [
                'exception' => $e->getMessage(),
                'orderId'   => $orderId,
            ]);

            return ['error' => 'http_exception'];
        }
    }

    public function isEnabled(): bool
    {
        return (bool) $this->systemConfig->get(self::CONFIG_DOMAIN . '.enabled');
    }

    public function getBaseUrl(): string
    {
        $value = (string) $this->systemConfig->get(self::CONFIG_DOMAIN . '.apiBaseUrl');

        return rtrim($value, '/');
    }

    private function getApiToken(): string
    {
        return (string) $this->systemConfig->get(self::CONFIG_DOMAIN . '.apiToken');
    }
}
