<?php

declare(strict_types=1);

const CACHE_TTL = 300;
const ALLOWED_ORIGIN = "https://marketplace.moodle.com";
const GITHUB_API_VERSION = "2026-03-10";

header("X-Content-Type-Options: nosniff");

$origin = $_SERVER["HTTP_ORIGIN"] ?? "";

if ($origin === ALLOWED_ORIGIN) {
    header("Access-Control-Allow-Origin: " . ALLOWED_ORIGIN);
    header("Vary: Origin");
}

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    jsonError("Only GET is supported.", 405);
}

$action = $_GET["action"] ?? "";
$repo = trim($_GET["repo"] ?? "");

if (!in_array($action, ["info", "support", "zip", "asset", "catalog", "catalog_icon"], true)) {
    jsonError("Invalid action.", 400);
}

if ($action === "catalog") {
    $component = trim(
        $_GET["component"] ?? ""
    );

    jsonResponse(
        getCatalogPlugin(
            $component
        )
    );
}

if ($action === "catalog_icon") {
    $component = trim(
        $_GET["component"] ?? ""
    );

    streamCatalogIcon(
        $component
    );
}

[$owner, $repository] = parseRepository($repo);

if ($action === "support") {
    jsonResponse(
        getRepositorySupportInfo(
            $owner,
            $repository
        )
    );
}

if ($action === "asset") {
    $tag = trim($_GET["tag"] ?? "");
    $path = trim($_GET["path"] ?? "");

    if ($tag === "") {
        jsonError("Missing tag.", 400);
    }

    if ($path === "") {
        jsonError("Missing path.", 400);
    }

    streamRepositoryAsset(
        $owner,
        $repository,
        $tag,
        $path
    );
}

if ($action === "info") {
    $force = ($_GET["force"] ?? "") === "1";

    $info = getRepositoryInfo(
        $owner,
        $repository,
        $force
    );

    jsonResponse($info);
}

if ($action === "zip") {
    $tag = trim($_GET["tag"] ?? "");

    if ($tag === "") {
        jsonError("Missing tag.", 400);
    }

    streamZip(
        $owner,
        $repository,
        $tag
    );
}

function parseRepository(string $repo): array {
    $repo = trim($repo);

    if (!preg_match(
        '~^([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$~',
        $repo,
        $matches
    )) {
        jsonError(
            "Invalid repository. Expected owner/repository.",
            400
        );
    }

    return [
        $matches[1],
        $matches[2],
    ];
}


function getRepositorySupportInfo(
    string $owner,
    string $repository
): array {
    $apiBase =
        "https://api.github.com/repos/" .
        rawurlencode($owner) .
        "/" .
        rawurlencode($repository);

    $repositoryInfo =
        githubJsonRequest(
            $apiBase
        );

    $defaultBranch =
        trim(
            (string)(
                $repositoryInfo["default_branch"] ??
                ""
            )
        );

    $docsExists = false;

    if ($defaultBranch !== "") {
        $docs =
            githubJsonRequestOptional(
                $apiBase .
                "/contents/docs?ref=" .
                rawurlencode($defaultBranch)
            );

        if (is_array($docs)) {
            $docsExists =
                array_is_list($docs) ||
                (
                    isset($docs["type"]) &&
                    $docs["type"] === "dir"
                );
        }
    }

    $hasPages =
        (bool)(
            $repositoryInfo["has_pages"] ??
            false
        );

    $pagesUrl = "";

    if ($hasPages) {
        $pages =
            githubJsonRequestOptional(
                $apiBase .
                "/pages"
            );

        $pagesUrl =
            trim(
                (string)(
                    $pages["html_url"] ??
                    ""
                )
            );

        if ($pagesUrl === "") {
            $pagesUrl =
                "https://" .
                strtolower($owner) .
                ".github.io/" .
                rawurlencode($repository) .
                "/";
        }
    }

    $repositoryUrl =
        "https://github.com/" .
        $owner .
        "/" .
        $repository;

    return [
        "repo" =>
            $owner . "/" . $repository,

        "repository_url" =>
            $repositoryUrl,

        "issues_url" =>
            $repositoryUrl . "/issues",

        "default_branch" =>
            $defaultBranch,

        "docs_exists" =>
            $docsExists,

        "has_pages" =>
            $hasPages,

        "pages_url" =>
            $pagesUrl !== ""
                ? $pagesUrl
                : null,

        "documentation_url" =>
            $docsExists &&
            $hasPages &&
            $pagesUrl !== ""
                ? $pagesUrl
                : null,
    ];
}

function getRepositoryInfo(
    string $owner,
    string $repository,
    bool $force = false
): array {
    $cacheDir = getCacheDirectory();

    $cacheKey = strtolower(
        $owner . "/" . $repository
    );

    $cacheFile =
        $cacheDir .
        "/" .
        hash("sha256", $cacheKey) .
        ".json";

    if (
        !$force &&
        is_file($cacheFile) &&
        filemtime($cacheFile) !== false &&
        filemtime($cacheFile) >= time() - CACHE_TTL
    ) {
        $contents = file_get_contents($cacheFile);

        if ($contents !== false) {
            $cached = json_decode(
                $contents,
                true
            );

            if (is_array($cached)) {
                $cached["cached"] = true;

                return $cached;
            }
        }
    }

    $releaseUrl =
        "https://api.github.com/repos/" .
        rawurlencode($owner) .
        "/" .
        rawurlencode($repository) .
        "/releases/latest";

    $release = githubJsonRequest(
        $releaseUrl
    );

    $tag = trim(
        (string)($release["tag_name"] ?? "")
    );

    if ($tag === "") {
        throwApiError(
            "GitHub release does not contain tag_name.",
            502
        );
    }

    $versionPhp = getVersionPhp(
        $owner,
        $repository,
        $tag
    );

    $parsedVersion = parseVersionPhp(
        $versionPhp
    );

    $result = [
        "repo" => $owner . "/" . $repository,

        "owner" => $owner,

        "repository" => $repository,

        "tag" => $tag,

        "release" =>
            $parsedVersion["release"] ??
            normalizeTag($tag),

        "build" =>
            $parsedVersion["build"],

        "github_release_name" =>
            $release["name"] ?? null,

        "published_at" =>
            $release["published_at"] ?? null,

        "html_url" =>
            $release["html_url"] ?? null,

        "fetched_at" =>
            gmdate("c"),

        "cached" => false,
    ];

    writeCache(
        $cacheFile,
        $result
    );

    return $result;
}

function getVersionPhp(
    string $owner,
    string $repository,
    string $tag
): string {
    $url =
        "https://api.github.com/repos/" .
        rawurlencode($owner) .
        "/" .
        rawurlencode($repository) .
        "/contents/version.php?ref=" .
        rawurlencode($tag);

    $response = githubJsonRequest(
        $url
    );

    $encoding = strtolower(
        (string)($response["encoding"] ?? "")
    );

    $content =
        $response["content"] ?? null;

    if (
        $encoding !== "base64" ||
        !is_string($content)
    ) {
        throwApiError(
            "Unable to read version.php from GitHub release.",
            502
        );
    }

    $decoded = base64_decode(
        str_replace(
            ["\r", "\n"],
            "",
            $content
        ),
        true
    );

    if ($decoded === false) {
        throwApiError(
            "Unable to decode version.php.",
            502
        );
    }

    return $decoded;
}

function getRepositoryFileBytes(
    string $owner,
    string $repository,
    string $tag,
    string $path
): string {
    if (
        $path === "" ||
        str_contains($path, "..") ||
        str_starts_with($path, "/") ||
        str_contains($path, "\\")
    ) {
        jsonError(
            "Invalid repository path.",
            400
        );
    }

    $url =
        "https://api.github.com/repos/" .
        rawurlencode($owner) .
        "/" .
        rawurlencode($repository) .
        "/contents/" .
        implode(
            "/",
            array_map(
                "rawurlencode",
                explode("/", $path)
            )
        ) .
        "?ref=" .
        rawurlencode($tag);

    $response = githubJsonRequest(
        $url
    );

    $encoding = strtolower(
        (string)($response["encoding"] ?? "")
    );

    $content =
        $response["content"] ?? null;

    if (
        $encoding !== "base64" ||
        !is_string($content)
    ) {
        throwApiError(
            "Unable to read repository file: " . $path,
            502
        );
    }

    $decoded = base64_decode(
        str_replace(
            ["\r", "\n"],
            "",
            $content
        ),
        true
    );

    if ($decoded === false) {
        throwApiError(
            "Unable to decode repository file: " . $path,
            502
        );
    }

    return $decoded;
}

function getCatalogPlugin(
    string $component
): array {
    if (!preg_match(
        "/^[a-z][a-z0-9]*_[a-z0-9_]+$/i",
        $component
    )) {
        jsonError(
            "Invalid plugin component.",
            400
        );
    }

    $filename =
        dirname(__DIR__) .
        "/plugins.json";

    $contents =
        file_get_contents(
            $filename
        );

    if ($contents === false) {
        throwApiError(
            "Unable to read plugins.json.",
            500
        );
    }

    $plugins =
        json_decode(
            $contents,
            true
        );

    if (!is_array($plugins)) {
        throwApiError(
            "plugins.json contains invalid JSON.",
            500
        );
    }

    foreach ($plugins as $plugin) {
        if (
            !is_array($plugin) ||
            ($plugin["component"] ?? null) !==
            $component
        ) {
            continue;
        }

        $description =
            trim(
                (string)(
                    $plugin["description"] ??
                    ""
                )
            );

        $iconUrl =
            trim(
                (string)(
                    $plugin["iconUrl"] ??
                    ""
                )
            );

        if ($description === "") {
            throwApiError(
                "Catalog description is empty for " .
                $component .
                ".",
                500
            );
        }

        if ($iconUrl === "") {
            throwApiError(
                "Catalog iconUrl is empty for " .
                $component .
                ".",
                500
            );
        }

        return [
            "component" =>
                $component,

            "name" =>
                trim(
                    (string)(
                        $plugin["name"] ??
                        ""
                    )
                ),

            "description" =>
                $description,

            "iconUrl" =>
                $iconUrl,

            "repository_url" =>
                trim(
                    (string)(
                        $plugin["repository_url"] ??
                        ""
                    )
                ),
        ];
    }

    jsonError(
        "Plugin not found in plugins.json: " .
        $component,
        404
    );
}

function streamCatalogIcon(
    string $component
): never {
    $plugin =
        getCatalogPlugin(
            $component
        );

    $iconUrl =
        $plugin["iconUrl"];

    $prefix =
        "/marketplace-plugins/";

    if (!str_starts_with(
        $iconUrl,
        $prefix
    )) {
        jsonError(
            "Catalog iconUrl must point inside /marketplace-plugins/.",
            400
        );
    }

    $relative =
        substr(
            $iconUrl,
            strlen($prefix)
        );

    if (
        $relative === "" ||
        str_contains(
            $relative,
            ".."
        )
    ) {
        jsonError(
            "Invalid catalog iconUrl.",
            400
        );
    }

    $root =
        realpath(
            dirname(__DIR__)
        );

    $filename =
        realpath(
            dirname(__DIR__) .
            "/" .
            $relative
        );

    if (
        $root === false ||
        $filename === false ||
        !str_starts_with(
            $filename,
            $root .
            DIRECTORY_SEPARATOR
        ) ||
        !is_file($filename)
    ) {
        jsonError(
            "Catalog icon file was not found: " .
            $iconUrl,
            404
        );
    }

    $extension =
        strtolower(
            pathinfo(
                $filename,
                PATHINFO_EXTENSION
            )
        );

    $types = [
        "png" =>
            "image/png",
        "webp" =>
            "image/webp",
        "jpg" =>
            "image/jpeg",
        "jpeg" =>
            "image/jpeg",
        "gif" =>
            "image/gif",
        "svg" =>
            "image/svg+xml",
    ];

    if (!isset(
        $types[$extension]
    )) {
        jsonError(
            "Unsupported catalog icon type.",
            415
        );
    }

    $size =
        filesize(
            $filename
        );

    header(
        "Content-Type: " .
        $types[$extension]
    );
    header(
        'Content-Disposition: inline; filename="' .
        addcslashes(
            basename($filename),
            "\\""
        ) .
        '"'
    );
    header(
        "X-Asset-Filename: " .
        basename($filename)
    );
    header(
        "X-Asset-Path: " .
        $iconUrl
    );
    header(
        "Access-Control-Expose-Headers: X-Asset-Filename, X-Asset-Path"
    );
    header(
        "Cache-Control: no-store"
    );

    if ($size !== false) {
        header(
            "Content-Length: " .
            $size
        );
    }

    readfile(
        $filename
    );

    exit;
}

function streamRepositoryAsset(
    string $owner,
    string $repository,
    string $tag,
    string $path
): never {
    $allowed = [
        "pix/icon.svg" =>
            "image/svg+xml",
        "pix/icon.png" =>
            "image/png",
        "pix/icon.webp" =>
            "image/webp",
        "pix/icon.jpg" =>
            "image/jpeg",
        "pix/icon.jpeg" =>
            "image/jpeg",
        "pix/icon.gif" =>
            "image/gif",
    ];

    if (!isset($allowed[$path])) {
        jsonError(
            "Asset path is not allowed.",
            400
        );
    }

    $info = getRepositoryInfo(
        $owner,
        $repository
    );

    if (
        !isset($info["tag"]) ||
        !hash_equals(
            (string)$info["tag"],
            $tag
        )
    ) {
        jsonError(
            "Requested tag is not the current cached release.",
            409
        );
    }

    $bytes = getRepositoryFileBytes(
        $owner,
        $repository,
        $tag,
        $path
    );

    header(
        "Content-Type: " .
        $allowed[$path]
    );
    header("Cache-Control: no-store");
    header(
        "Content-Length: " .
        strlen($bytes)
    );

    echo $bytes;
    exit;
}

function parseVersionPhp(string $contents): array {
    $build = null;
    $release = null;

    if (preg_match(
        '/\$plugin->version\s*=\s*([0-9]+)\s*;/',
        $contents,
        $matches
    )) {
        $build = (int)$matches[1];
    }

    if (preg_match(
        '/\$plugin->release\s*=\s*([\'"])(.*?)\1\s*;/',
        $contents,
        $matches
    )) {
        $release = trim(
            $matches[2]
        );
    }

    return [
        "build" => $build,
        "release" => $release,
    ];
}

function normalizeTag(string $tag): string {
    return preg_replace(
        '/^v(?=\d)/i',
        "",
        trim($tag)
    ) ?? trim($tag);
}

function githubJsonRequest(string $url): array {
    $response = githubRequest(
        $url
    );

    if ($response === null) {
        throwApiError(
            "GitHub resource was not found.",
            404
        );
    }

    $data = json_decode(
        $response["body"],
        true
    );

    if (!is_array($data)) {
        throwApiError(
            "GitHub returned invalid JSON.",
            502
        );
    }

    return $data;
}

function githubJsonRequestOptional(
    string $url
): ?array {
    $response =
        githubRequest(
            $url,
            true
        );

    if ($response === null) {
        return null;
    }

    $data =
        json_decode(
            $response["body"],
            true
        );

    if (!is_array($data)) {
        throwApiError(
            "GitHub returned invalid JSON.",
            502
        );
    }

    return $data;
}

function githubRequest(
    string $url,
    bool $allowNotFound = false
): ?array {
    $ch = curl_init();

    if ($ch === false) {
        throwApiError(
            "Unable to initialize cURL.",
            500
        );
    }

    curl_setopt_array(
        $ch,
        [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => githubHeaders(),
        ]
    );

    $body = curl_exec($ch);

    if ($body === false) {
        $error = curl_error($ch);

        curl_close($ch);

        throwApiError(
            "GitHub request failed: " . $error,
            502
        );
    }

    $status = (int)curl_getinfo(
        $ch,
        CURLINFO_RESPONSE_CODE
    );

    curl_close($ch);

    if (
        $status === 404 &&
        $allowNotFound
    ) {
        return null;
    }

    if ($status < 200 || $status >= 300) {
        $message =
            "GitHub returned HTTP " .
            $status;

        $json = json_decode(
            $body,
            true
        );

        if (
            is_array($json) &&
            !empty($json["message"])
        ) {
            $message .=
                ": " .
                $json["message"];
        }

        throwApiError(
            $message,
            $status === 404 ? 404 : 502
        );
    }

    return [
        "status" => $status,
        "body" => $body,
    ];
}

function githubHeaders(): array {
    $headers = [
        "Accept: application/vnd.github+json",
        "X-GitHub-Api-Version: " . GITHUB_API_VERSION,
        "User-Agent: Eduardo-Kraus-Marketplace-Updater",
    ];

    $token = trim(
        getenv("GITHUB_TOKEN") ?: ""
    );

    if ($token !== "") {
        $headers[] =
            "Authorization: Bearer " .
            $token;
    }

    return $headers;
}

function streamZip(
    string $owner,
    string $repository,
    string $tag
): never {
    /*
     * Busca a informação pelo cache/API para garantir
     * que o tag solicitado é realmente o último release
     * conhecido pelo proxy.
     */
    $info = getRepositoryInfo(
        $owner,
        $repository
    );

    if (
        !isset($info["tag"]) ||
        !hash_equals(
            (string)$info["tag"],
            $tag
        )
    ) {
        jsonError(
            "Requested tag is not the current cached release.",
            409
        );
    }

    $url =
        "https://api.github.com/repos/" .
        rawurlencode($owner) .
        "/" .
        rawurlencode($repository) .
        "/zipball/" .
        rawurlencode($tag);

    $safeRepository = preg_replace(
        '/[^A-Za-z0-9._-]+/',
        "-",
        $repository
    );

    $safeTag = preg_replace(
        '/[^A-Za-z0-9._-]+/',
        "-",
        $tag
    );

    $filename =
        $safeRepository .
        "-" .
        $safeTag .
        ".zip";

    header("Content-Type: application/zip");
    header(
        'Content-Disposition: attachment; filename="' .
        $filename .
        '"'
    );
    header("Cache-Control: no-store, no-cache, must-revalidate");
    header("Pragma: no-cache");

    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    $ch = curl_init();

    if ($ch === false) {
        http_response_code(500);
        exit;
    }

    curl_setopt_array(
        $ch,
        [
            CURLOPT_URL => $url,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_HTTPHEADER => githubHeaders(),

            /*
             * O ZIP é escrito diretamente na resposta HTTP.
             * Nenhum arquivo ZIP é criado em cache/.
             */
            CURLOPT_WRITEFUNCTION => static function (
                CurlHandle $ch,
                string $data
            ): int {
                echo $data;

                flush();

                return strlen($data);
            },
        ]
    );

    $result = curl_exec($ch);

    if ($result === false) {
        error_log(
            "GitHub ZIP download error: " .
            curl_error($ch)
        );
    }

    curl_close($ch);

    exit;
}

function getCacheDirectory(): string {
    $directory =
        __DIR__ .
        "/cache";

    if (!is_dir($directory)) {
        if (
            !mkdir(
                $directory,
                0775,
                true
            ) &&
            !is_dir($directory)
        ) {
            throwApiError(
                "Unable to create cache directory.",
                500
            );
        }
    }

    return $directory;
}

function writeCache(
    string $filename,
    array $data
): void {
    $json = json_encode(
        $data,
        JSON_PRETTY_PRINT |
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE
    );

    if ($json === false) {
        return;
    }

    $temporary =
        $filename .
        "." .
        getmypid() .
        ".tmp";

    if (
        file_put_contents(
            $temporary,
            $json,
            LOCK_EX
        ) === false
    ) {
        return;
    }

    rename(
        $temporary,
        $filename
    );
}

function jsonResponse(
    array $data,
    int $status = 200
): never {
    http_response_code($status);

    header(
        "Content-Type: application/json; charset=utf-8"
    );

    header("Cache-Control: no-store");

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE
    );

    exit;
}

function jsonError(
    string $message,
    int $status
): never {
    jsonResponse(
        [
            "error" => $message,
        ],
        $status
    );
}

function throwApiError(
    string $message,
    int $status
): never {
    jsonError(
        $message,
        $status
    );
}

