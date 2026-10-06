<?php

const DEFAULT_WIDTH = 128;
const MAX_WIDTH = 2048;
const BROWSER_CACHE_SECONDS = 86400;

$width = DEFAULT_WIDTH;
if (isset($_GET['width'])) {
    $width = filter_var($_GET['width'], FILTER_VALIDATE_INT);
    if ($width === false || $width < 1 || $width > MAX_WIDTH) {
        http_response_code(400);
        exit('Invalid width.');
    }
}

$file = $_GET['file'] ?? '';
$file = rawurldecode($file);
$file = ltrim(str_replace('\\', '/', $file), '/');

if (
    $file === '' ||
    strpos($file, "\0") !== false ||
    preg_match('#(^|/)\.\.?(/|$)#', $file) ||
    strpos($file, '_cache/') === 0
) {
    http_response_code(404);
    exit('Icon not found.');
}

$root = realpath(__DIR__);
$source = realpath(__DIR__ . '/' . $file);

if ($source !== false && is_dir($source)) {
    $source = realpath($source . '/icon.png');
}

if (
    $source === false ||
    !is_file($source) ||
    strpos($source, $root . DIRECTORY_SEPARATOR) !== 0
) {
    http_response_code(404);
    exit('Icon not found.');
}

$extension = strtolower(pathinfo($source, PATHINFO_EXTENSION));
if (!in_array($extension, ['png'], true)) {
    http_response_code(404);
    exit('Unsupported icon format.');
}

$relative = substr($source, strlen($root) + 1);
$relativepng = preg_replace('/\.[^.]+$/', '.png', $relative);
$cachefile = __DIR__ . '/_cache/' . $width . '/' . $relativepng;
$cachedir = dirname($cachefile);

if (!is_file($cachefile) || filemtime($cachefile) < filemtime($source)) {
    if (!extension_loaded('gd')) {
        http_response_code(500);
        exit('GD extension is required.');
    }

    if (!is_dir($cachedir) && !mkdir($cachedir, 0775, true) && !is_dir($cachedir)) {
        http_response_code(500);
        exit('Unable to create cache directory.');
    }

    switch ($extension) {
        case 'png':
            $image = @imagecreatefrompng($source);
            break;
        default:
            $image = false;
    }

    if ($image === false) {
        http_response_code(500);
        exit('Unable to read icon.');
    }

    $sourcewidth = imagesx($image);
    $sourceheight = imagesy($image);

    if ($sourcewidth < 1 || $sourceheight < 1) {
        imagedestroy($image);
        http_response_code(500);
        exit('Invalid icon.');
    }

    $thumbnail = imagecreatetruecolor($width, $width);
    imagealphablending($thumbnail, false);
    imagesavealpha($thumbnail, true);

    $transparent = imagecolorallocatealpha($thumbnail, 0, 0, 0, 127);
    imagefill($thumbnail, 0, 0, $transparent);

    $scale = min($width / $sourcewidth, $width / $sourceheight);
    $targetwidth = max(1, (int)round($sourcewidth * $scale));
    $targetheight = max(1, (int)round($sourceheight * $scale));
    $targetx = (int)(($width - $targetwidth) / 2);
    $targety = (int)(($width - $targetheight) / 2);

    imagealphablending($thumbnail, true);
    imagecopyresampled(
        $thumbnail,
        $image,
        $targetx,
        $targety,
        0,
        0,
        $targetwidth,
        $targetheight,
        $sourcewidth,
        $sourceheight
    );

    $tempfile = tempnam($cachedir, 'icon-');
    if ($tempfile === false || !imagepng($thumbnail, $tempfile, 6)) {
        imagedestroy($thumbnail);
        imagedestroy($image);
        if ($tempfile !== false && is_file($tempfile)) {
            @unlink($tempfile);
        }
        http_response_code(500);
        exit('Unable to create thumbnail.');
    }

    imagedestroy($thumbnail);
    imagedestroy($image);

    if (!@rename($tempfile, $cachefile)) {
        @unlink($tempfile);
        http_response_code(500);
        exit('Unable to save thumbnail.');
    }
}

$etag = '"' . sha1($relative . '|' . $width . '|' . filemtime($source) . '|' . filesize($source)) . '"';

header('Content-Type: image/png');
header('Cache-Control: public, max-age=' . BROWSER_CACHE_SECONDS);
header('ETag: ' . $etag);
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', filemtime($cachefile)) . ' GMT');

if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    http_response_code(304);
    exit;
}

header('Content-Length: ' . filesize($cachefile));
readfile($cachefile);
