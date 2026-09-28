<?php

/**
 * Script CLI de uso único para descartar versões de plugins.
 *
 * Uso:
 *   php discard_versions.php
 *
 * Caso seja necessário informar os cookies da sessão:
 *
 *   MARKETPLACE_COOKIE='COOKIE1=valor; COOKIE2=valor' php discard_versions.php
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Este script deve ser executado pelo terminal.\n");
    exit(1);
}

const PLUGINS_FILE = __DIR__ . '/plugins.json';

const LOCAL_BASE_URL = 'https://marketplace.moodle.com';
/**
 * Tempo entre exclusões para não sobrecarregar o servidor.
 */
const REQUEST_DELAY_MICROSECONDS = 300000;

/**
 * Altere para true para apenas listar as versões sem enviar os POSTs.
 */
const DRY_RUN = false;

$cookieHeader = trim((string) getenv('MARKETPLACE_COOKIE'));
$cookieJar = tempnam(sys_get_temp_dir(), 'moodle-marketplace-cookie-');

if ($cookieJar === false) {
    throw new RuntimeException('Não foi possível criar o arquivo temporário de cookies.');
}

register_shutdown_function(static function() use ($cookieJar): void {
    if (is_file($cookieJar)) {
        @unlink($cookieJar);
    }
});

try {
    $plugins = loadPlugins(PLUGINS_FILE);

    echo sprintf(
        "Encontrados %d plugins em %s.\n\n",
        count($plugins),
        PLUGINS_FILE
    );

    $totalVersions = 0;
    $totalDiscarded = 0;
    $totalErrors = 0;

    foreach ($plugins as $index => $plugin) {
        $pluginId = filter_var(
            $plugin['id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if ($pluginId === false) {
            echo sprintf(
                "[%d/%d] Plugin ignorado: ID inválido.\n\n",
                $index + 1,
                count($plugins)
            );

            $totalErrors++;
            continue;
        }

        $pluginName = trim((string) ($plugin['name'] ?? 'Plugin sem nome'));

        echo sprintf(
            "[%d/%d] %s — ID %d\n",
            $index + 1,
            count($plugins),
            $pluginName,
            $pluginId
        );

        $versionsUrl = sprintf(
            '%s/plugins/%d/edit/versions',
            LOCAL_BASE_URL,
            $pluginId
        );

        try {
            $versionsHtml = httpRequest(
                method: 'GET',
                url: $versionsUrl,
                cookieJar: $cookieJar,
            );

            $versionIds = extractVersionIds(
                html: $versionsHtml,
                pluginId: $pluginId
            );
        } catch (Throwable $exception) {
            echo "  ERRO ao carregar versões: {$exception->getMessage()}\n\n";
            $totalErrors++;
            continue;
        }

        if ($versionIds === []) {
            echo "  Nenhuma versão encontrada.\n\n";
            continue;
        }

        echo sprintf(
            "  %d versão(ões) encontrada(s): %s\n",
            count($versionIds),
            implode(', ', $versionIds)
        );

        foreach ($versionIds as $position => $versionId) {
            $totalVersions++;

            $detailsUrl = sprintf(
                '%s/plugins/%d/versions/%d/edit-details',
                LOCAL_BASE_URL,
                $pluginId,
                $versionId
            );

            echo sprintf(
                "  [%d/%d] Versão %d: ",
                $position + 1,
                count($versionIds),
                $versionId
            );

            try {
                $detailsHtml = httpRequest(
                    method: 'GET',
                    url: $detailsUrl,
                    cookieJar: $cookieJar,
                    referer: $versionsUrl
                );

                $token = extractVersionToken($detailsHtml);

                if (DRY_RUN) {
                    echo "token encontrado; POST não enviado por causa do DRY_RUN.\n";
                    continue;
                }

                $discardUrl = sprintf(
                    '%s/plugins/%d/versions/%d/discard',
                    LOCAL_BASE_URL,
                    $pluginId,
                    $versionId
                );

                $response = httpRequest(
                    method: 'POST',
                    url: $discardUrl,
                    cookieJar: $cookieJar,
                    postFields: [
                        '_token' => $token,
                    ],
                    referer: $detailsUrl
                );

                if (isAuthenticationPage($response)) {
                    throw new RuntimeException(
                        'o servidor retornou uma página de autenticação. ' .
                        'Informe os cookies em MARKETPLACE_COOKIE.'
                    );
                }

                echo "descartada.\n";
                $totalDiscarded++;

                usleep(REQUEST_DELAY_MICROSECONDS);
            } catch (Throwable $exception) {
                echo "ERRO: {$exception->getMessage()}\n";
                $totalErrors++;
            }
        }

        echo "\n";
    }

    echo "Processamento concluído.\n";
    echo "Versões encontradas: {$totalVersions}\n";
    echo "Versões descartadas: {$totalDiscarded}\n";
    echo "Erros: {$totalErrors}\n";

    exit($totalErrors > 0 ? 2 : 0);
} catch (Throwable $exception) {
    fwrite(STDERR, "ERRO FATAL: {$exception->getMessage()}\n");
    exit(1);
}

/**
 * @return array<int, array<string, mixed>>
 */
function loadPlugins(string $filename): array {
    if (!is_file($filename)) {
        throw new RuntimeException(
            "Arquivo não encontrado: {$filename}"
        );
    }

    $contents = file_get_contents($filename);

    if ($contents === false) {
        throw new RuntimeException(
            "Não foi possível ler o arquivo: {$filename}"
        );
    }

    try {
        $plugins = json_decode(
            $contents,
            true,
            512,
            JSON_THROW_ON_ERROR
        );
    } catch (JsonException $exception) {
        throw new RuntimeException(
            'JSON inválido: ' . $exception->getMessage(),
            previous: $exception
        );
    }

    if (!is_array($plugins)) {
        throw new RuntimeException(
            'O conteúdo do plugins.json deve ser uma lista de plugins.'
        );
    }

    return $plugins;
}

/**
 * @param array<string, string>|null $postFields
 */
function httpRequest(
    string $method,
    string $url,
    string $cookieJar,
    ?array $postFields = null,
    ?string $referer = null
): string {
    echo "\n\nAguarda 1S antes de {$url}\n";
    sleep(1);
    $curl = curl_init();

    if ($curl === false) {
        throw new RuntimeException('Não foi possível iniciar o cURL.');
    }

    $responseHeaders = [];

    $options = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 90,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
        CURLOPT_COOKIEJAR => $cookieJar,
        CURLOPT_COOKIEFILE => $cookieJar,
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7,cy;q=0.6,es;q=0.5,da;q=0.4,fr;q=0.3,mt;q=0.2,hu;q=0.1',
            'Cache-Control: no-cache',
            'Pragma: no-cache',
            'DNT: 1',
            'Priority: u=0, i',
            'Sec-CH-UA: "Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
            'Sec-CH-UA-Mobile: ?0',
            'Sec-CH-UA-Platform: "macOS"',
            'Sec-Fetch-Dest: document',
            'Sec-Fetch-Mode: navigate',
            'Sec-Fetch-Site: same-origin',
            'Sec-Fetch-User: ?1',
            'Upgrade-Insecure-Requests: 1',
        ],
        CURLOPT_HEADERFUNCTION => static function(
            CurlHandle $curl,
            string $header
        ) use (&$responseHeaders): int {
            $responseHeaders[] = trim($header);
            return strlen($header);
        },
    ];

    $options[CURLOPT_COOKIE] = 'intercom-id-c4141deq=858a0269-58b3-4e02-9e5f-9dd01582d548; intercom-device-id-c4141deq=6f447b02-9abf-4788-8bf8-71c648b4e531; _ga=GA1.1.277724052.1784545633; PHPSESSID=de7e6342be69251a03533531b466dae0; intercom-session-c4141deq=; _ga_4RB3QDEDTX=GS2.1.s1784666918$o1$g1$t1784683841$j60$l0$h0';

    if ($referer !== null) {
        $options[CURLOPT_REFERER] = $referer;
    }

    if (strtoupper($method) === 'POST') {
        $options[CURLOPT_POST] = true;
        $options[CURLOPT_POSTFIELDS] = http_build_query(
            $postFields ?? [],
            '',
            '&',
            PHP_QUERY_RFC3986
        );
        $options[CURLOPT_HTTPHEADER][] =
            'Content-Type: application/x-www-form-urlencoded';
    }

    $host = strtolower((string) parse_url($url, PHP_URL_HOST));

    if (in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
        $options[CURLOPT_SSL_VERIFYPEER] = false;
        $options[CURLOPT_SSL_VERIFYHOST] = 0;
    }

    curl_setopt_array($curl, $options);

    $response = curl_exec($curl);

    if ($response === false) {
        $error = curl_error($curl);
        curl_close($curl);

        throw new RuntimeException(
            "Falha na requisição para {$url}: {$error}"
        );
    }

    $statusCode = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $effectiveUrl = curl_getinfo($curl, CURLINFO_EFFECTIVE_URL);

    curl_close($curl);

    if ($statusCode < 200 || $statusCode >= 400) {
        throw new RuntimeException(
            sprintf(
                'HTTP %d ao acessar %s. URL final: %s',
                $statusCode,
                $url,
                $effectiveUrl
            )
        );
    }

    return $response;
}

/**
 * @return int[]
 */
function extractVersionIds(string $html, int $pluginId): array {
    $xpath = createXPath($html);

    $expectedPrefix = sprintf(
        '/plugins/%d/versions/',
        $pluginId
    );

    $nodes = $xpath->query(
        sprintf(
            '//a[' .
            'starts-with(@href, "%s") and ' .
            'contains(@href, "/edit-details")' .
            ']',
            $expectedPrefix
        )
    );

    if ($nodes === false) {
        throw new RuntimeException(
            'Não foi possível procurar os links das versões.'
        );
    }

    $versionIds = [];

    foreach ($nodes as $node) {
        $href = html_entity_decode(
            trim((string) $node->attributes?->getNamedItem('href')?->nodeValue),
            ENT_QUOTES | ENT_HTML5
        );

        $pattern = sprintf(
            '~^/plugins/%d/versions/(\d+)/edit-details(?:[?#].*)?$~',
            $pluginId
        );

        if (preg_match($pattern, $href, $matches) !== 1) {
            continue;
        }

        $versionId = (int) $matches[1];

        if ($versionId > 0) {
            $versionIds[$versionId] = $versionId;
        }
    }

    $versionIds = array_values($versionIds);
    sort($versionIds, SORT_NUMERIC);

    return $versionIds;
}

function extractVersionToken(string $html): string {
    $xpath = createXPath($html);

    $queries = [
        '//input[@name="_token"]/@value',
    ];

    foreach ($queries as $query) {
        $nodes = $xpath->query($query);

        if ($nodes === false || $nodes->length === 0) {
            continue;
        }

        $token = trim((string) $nodes->item(0)?->nodeValue);

        if ($token !== '') {
            return $token;
        }
    }

    throw new RuntimeException(
        'Token plugin_version_file_form[_token] não encontrado.'
    );
}

function createXPath(string $html): DOMXPath {
    if (trim($html) === '') {
        throw new RuntimeException('O servidor retornou HTML vazio.');
    }

    $document = new DOMDocument();

    $previousState = libxml_use_internal_errors(true);

    try {
        $loaded = $document->loadHTML(
            $html,
            LIBXML_NOWARNING |
            LIBXML_NOERROR |
            LIBXML_NONET |
            LIBXML_COMPACT
        );
    } finally {
        libxml_clear_errors();
        libxml_use_internal_errors($previousState);
    }

    if ($loaded === false) {
        throw new RuntimeException(
            'Não foi possível interpretar o HTML recebido.'
        );
    }

    return new DOMXPath($document);
}

function isAuthenticationPage(string $html): bool {
    $normalized = strtolower($html);

    return str_contains($normalized, 'name="_username"')
        || str_contains($normalized, 'name="username"')
        || str_contains($normalized, 'sign in to moodle')
        || str_contains($normalized, 'log in to moodle');
}