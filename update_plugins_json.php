<?php
function httpGet(string $url): string {
    echo "\n\nAguarda 3S antes de {$url}\n";
    sleep(3);

    $curl = curl_init();

    if ($curl === false) {
        throw new RuntimeException('Não foi possível iniciar o cURL.');
    }
    $headers = [
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
    $options = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER => $headers,

        CURLOPT_COOKIE => implode('; ', [
            'intercom-id-c4141deq=858a0269-58b3-4e02-9e5f-9dd01582d548',
            'intercom-device-id-c4141deq=6f447b02-9abf-4788-8bf8-71c648b4e531',
            '_ga=GA1.1.277724052.1784545633',
            'PHPSESSID=de7e6342be69251a03533531b466dae0',
            'intercom-session-c4141deq=',
            '_ga_4RB3QDEDTX=GS2.1.s1784662833$o4$g1$t1784665565$j28$l0$h0',
        ]),
        CURLOPT_REFERER => 'https://marketplace.moodle.com/plugins/3089/edit/description',

        CURLOPT_COOKIEJAR => __DIR__ . '/cookies.txt',
        CURLOPT_COOKIEFILE => __DIR__ . '/cookies.txt',
    ];
    curl_setopt_array($curl, $options);

    $body = curl_exec($curl);
    $error = curl_error($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $effectiveUrl = (string) curl_getinfo($curl, CURLINFO_EFFECTIVE_URL);

    curl_close($curl);

    if ($body === false) {
        // throw new RuntimeException('cURL: ' . $error);
        return false;
    }

    if ($status < 200 || $status >= 300) {
        //throw new RuntimeException(
        //    sprintf('HTTP %d em %s', $status, $effectiveUrl ?: $url)
        //);
        return false;
    }

    return (string) $body;
}
