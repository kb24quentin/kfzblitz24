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
 *     Body: { orderId, bestellnummer, customer{…}, items[…], source }
 *     Resp: { token, expiresAt, url }   — url ist die Hand-off-URL,
 *           dorthin redirecten wir den Kunden direkt aus dem Controller.
 *
 * Konfiguration kommt aus SystemConfigService (siehe config.xml):
 *   - KbRetoure.config.enabled    (bool)
 *   - KbRetoure.config.apiBaseUrl (string, ohne trailing /)
 *   - KbRetoure.config.apiToken   (string, Bearer-Token der RMA-API)
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
     * landet der Kunde auf {apiBaseUrl}/start?token=… und sieht eine
     * vorausgefüllte Retoure-Anmeldung.
     *
     * @param array<string,mixed> $payload Bereits passend gemappter Body:
     *   {
     *     orderId?: string,
     *     bestellnummer: string,
     *     customer?: array,
     *     items?: array<int, array{artikelnummer:string, menge:int}>,
     *     source?: string
     *   }
     *
     * @return array{token?: string, expiresAt?: string, url?: string, error?: string}
     */
    public function createPrefillToken(array $payload): array
    {
        if (!$this->isEnabled()) {
            return ['error' => 'plugin_disabled'];
        }

        if (!isset($payload['bestellnummer']) || !is_string($payload['bestellnummer']) || $payload['bestellnummer'] === '') {
            return ['error' => 'bestellnummer_missing'];
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
                'json'    => $payload,
                'timeout' => 5.0,
            ]);

            $status = $response->getStatusCode();
            if ($status >= 200 && $status < 300) {
                $data = $response->toArray(false);
                // Falls die API mal nur den Token zurückgibt, bauen wir
                // die URL als Fallback selbst — Defensive.
                if (!isset($data['url']) && isset($data['token'])) {
                    $data['url'] = $baseUrl . '/start?token=' . rawurlencode((string) $data['token']);
                }

                return $data;
            }

            $this->logger->warning('[KbRetoure] Prefill-API antwortete nicht 2xx', [
                'status'        => $status,
                'bestellnummer' => $payload['bestellnummer'],
            ]);

            return ['error' => 'api_error_' . $status];
        } catch (ExceptionInterface $e) {
            $this->logger->error('[KbRetoure] HTTP-Fehler beim Prefill-Call', [
                'exception'     => $e->getMessage(),
                'bestellnummer' => $payload['bestellnummer'] ?? null,
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
