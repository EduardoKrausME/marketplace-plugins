<?php

try {
    $plugins = json_decode(
        file_get_contents(__DIR__ . '/plugins.json'),
        true,
        512,
        JSON_THROW_ON_ERROR
    );
} catch (Throwable $exception) {
    fwrite(STDERR, "Erro ao abrir plugins.json: {$exception->getMessage()}\n");
    exit(1);
}

if (!is_array($plugins)) {
    fwrite(STDERR, "O conteúdo do plugins.json não é válido.\n");
    exit(1);
}

$total = count($plugins);

foreach ($plugins as $index => $plugin) {
    $position = $index + 1;

    $id = isset($plugin['id']) ? (int)$plugin['id'] : 0;
    $component = trim((string)($plugin['component'] ?? ''));

    if ($id <= 0 || $component === '') {
        echo "[{$position}/{$total}] Plugin inválido. Ignorando.\n";
        continue;
    }

    $url = "https://marketplace.moodle.com/plugins/{$id}/edit/description";

    echo "[{$position}/{$total}] {$component} ({$id})\n";
    echo "  Obtendo token...\n";

    try {
        $getResponse = httpRequest($url);

        if ($getResponse['status'] < 200 || $getResponse['status'] >= 400) {
            throw new RuntimeException(
                "GET retornou HTTP {$getResponse['status']}"
            );
        }

        $token = extractToken($getResponse['body']);

        if ($token === null) {
            throw new RuntimeException(
                'Token não encontrado. Verifique se o cookie de autenticação está correto.'
            );
        }

        $marketplaceUrl = "https://eduardokraus.com/marketplace-plugins/plugin/{$component}";

        $description = <<<HTML
<p>Since all formatting was compromised and some images and logos from my plugins were lost, the descriptions can only be viewed at:</p>
<p><a href="{$marketplaceUrl}">{$marketplaceUrl}</a></p>
<p>In addition, the Marketplace has discontinued the automatic deployment of new versions, significantly increasing the workload required for plugin developers to keep their plugins up to date. For this reason, the plugins are available for download exclusively from the following website:</p>
<p><a href="{$marketplaceUrl}">{$marketplaceUrl}</a></p>
<p><strong>Note:</strong> As soon as the Marketplace is working properly again-which may take several months-I will restore all the content and make the plugins available there again.</p>
HTML;


        $postFields = [
            'plugin_edit_description_form[_token]' => $token,
            'save_and_next' => '',
            'plugin_edit_description_form[description]' => $description,
        ];

        echo "  Enviando nova descrição...\n";

        $postResponse = httpRequest(
            url: $url,
            method: 'POST',
            fields: $postFields,
        );

        if ($postResponse['status'] < 200 || $postResponse['status'] >= 400) {
            throw new RuntimeException(
                "POST retornou HTTP {$postResponse['status']}"
            );
        }

        echo "  Atualizado com sucesso. HTTP {$postResponse['status']}\n";
    } catch (Throwable $exception) {
        echo "  ERRO: {$exception->getMessage()}\n";
    }

    echo "\n";
}

echo "Processamento concluído.\n";

/**
 * Executa uma requisição HTTP.
 *
 * @return array{status: int, body: string, finalUrl: string}
 */
function httpRequest(string $url, string $method = 'GET', array $fields = []): array {
    echo "\n\nAguarda 3S antes de {$url}\n";
    sleep(3);

    $curl = curl_init();

    if ($curl === false) {
        throw new RuntimeException('Não foi possível iniciar o cURL.');
    }

    $cookieJar = sys_get_temp_dir() . '/plugin-description-updater.cookies';

    $options = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
        CURLOPT_COOKIEJAR => $cookieJar,
        CURLOPT_COOKIEFILE => $cookieJar,
        CURLOPT_COOKIE => 'PHPSESSID=21fa3011d83590f4bc6876c2ae4f6548;',
    ];

    if (strtoupper($method) === 'POST') {
        $options[CURLOPT_POST] = true;
        $options[CURLOPT_POSTFIELDS] = http_build_query(
            $fields,
            '',
            '&',
            PHP_QUERY_RFC3986
        );

        $options[CURLOPT_HTTPHEADER] = [
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
        ];
    }

    curl_setopt_array($curl, $options);

    $body = curl_exec($curl);

    if ($body === false) {
        $error = curl_error($curl);
        curl_close($curl);

        throw new RuntimeException("Erro cURL: {$error}");
    }

    $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $finalUrl = (string)curl_getinfo($curl, CURLINFO_EFFECTIVE_URL);

    curl_close($curl);

    return [
        'status' => $status,
        'body' => $body,
        'finalUrl' => $finalUrl,
    ];
}

/**
 * Extrai o token do campo:
 *
 * <input id="plugin_edit_description_form__token" value="...">
 */
function extractToken(string $html): ?string {
    $document = new DOMDocument();

    libxml_use_internal_errors(true);
    $loaded = $document->loadHTML(
        $html,
        LIBXML_NOWARNING | LIBXML_NOERROR
    );
    libxml_clear_errors();

    if (!$loaded) {
        return null;
    }

    $xpath = new DOMXPath($document);

    $nodes = $xpath->query(
        '//input[@id="plugin_edit_description_form__token"]'
    );

    if ($nodes === false || $nodes->length === 0) {
        return null;
    }

    $token = trim($nodes->item(0)?->getAttribute('value') ?? '');

    return $token !== '' ? $token : null;
}