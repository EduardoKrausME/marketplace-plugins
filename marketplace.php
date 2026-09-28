<?php

declare(strict_types = 1);

/**
 * Shared helpers for the plugin marketplace.
 */

function marketplace_load_plugins(string $jsonFile): array {
    if (!is_file($jsonFile) || !is_readable($jsonFile)) {
        throw new RuntimeException('The plugins.json file was not found or cannot be read.');
    }

    $json = file_get_contents($jsonFile);
    if ($json === false) {
        throw new RuntimeException('Unable to read the plugins.json file.');
    }

    try {
        $plugins = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new RuntimeException('The plugins.json file contains invalid JSON.', 0, $exception);
    }

    if (!is_array($plugins)) {
        throw new RuntimeException('The plugin catalog has an invalid format.');
    }

    return array_values(array_filter($plugins, "is_array"));
}

function marketplace_find_plugin(array $plugins, string $component): ?array {
    foreach ($plugins as $plugin) {
        if (($plugin["component"] ?? "") === $component) {
            return $plugin;
        }
    }

    return null;
}

function marketplace_base_url(): string {
    $documentRoot = realpath((string) ($_SERVER["DOCUMENT_ROOT"] ?? ""));
    $projectRoot = realpath(__DIR__);

    if ($documentRoot !== false && $projectRoot !== false) {
        $documentRoot = rtrim(str_replace("\\", "/", $documentRoot), "/");
        $projectRoot = rtrim(str_replace("\\", "/", $projectRoot), "/");

        if ($projectRoot === $documentRoot) {
            return "";
        }

        if (strpos($projectRoot, "{$documentRoot}/") === 0) {
            return "/" . ltrim(substr($projectRoot, strlen($documentRoot)), "/");
        }
    }

    $scriptName = str_replace("\\", "/", (string) ($_SERVER["SCRIPT_NAME"] ?? ""));
    $directory = rtrim(dirname($scriptName), "/.");

    return $directory === "" ? "" : $directory;
}

function marketplace_url(string $path = ""): string {
    $baseUrl = marketplace_base_url();
    $path = ltrim($path, "/");

    if ($path === "") {
        return $baseUrl === "" ? "/" : "{$baseUrl}/";
    }

    return ($baseUrl === "" ? "" : $baseUrl) . "/{$path}";
}

function marketplace_download_url(string $repository_url): string {
    return $repository_url . '/archive/refs/heads/master.zip';
}

function install_url($plugin) {
    $data = [
        "name" => $plugin["name"],
        "version" => 2025050200,
        "component" => $plugin["component"],
        "url" => "{$plugin["repository_url"]}/archive/refs/heads/master.zip",
    ];
    return "https://moodle.aulaemvideo.com.br/admin/tool/installaddon/index.php?installaddonrequest=" .
        urlencode(base64_encode(json_encode($data)));
}