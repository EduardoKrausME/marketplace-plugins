<?php

declare(strict_types=1);

$threshold = 150;
$whiteAlphaCutoff = 120;
$cropAlphaCutoff = 127;
$pngCompression = 9;

/**
 * Remove o fundo branco conectado às bordas e depois recorta a borda
 * transparente, mantendo o resultado quadrado sem redimensionar o conteúdo.
 */
function processImage(string $filename): bool
{
    global $threshold, $whiteAlphaCutoff, $cropAlphaCutoff, $pngCompression;

    $image = @imagecreatefrompng($filename);

    if (!$image) {
        echo "Erro ao abrir: {$filename}\n";
        return false;
    }

    // Garante imagem true color.
    if (!imageistruecolor($image)) {
        imagepalettetotruecolor($image);
    }

    imagealphablending($image, false);
    imagesavealpha($image, true);

    $width = imagesx($image);
    $height = imagesy($image);

    if ($width === 0 || $height === 0) {
        imagedestroy($image);
        return false;
    }

    $queue = new SplQueue();

    /**
     * Indica se o pixel é branco/quase branco.
     */
    $isWhite = static function (int $color) use ($threshold, $whiteAlphaCutoff): bool {
        $alpha = ($color >> 24) & 0x7F;

        // Pixel já transparente não precisa ser removido.
        if ($alpha >= $whiteAlphaCutoff) {
            return false;
        }

        $red = ($color >> 16) & 0xFF;
        $green = ($color >> 8) & 0xFF;
        $blue = $color & 0xFF;

        return $red >= $threshold
            && $green >= $threshold
            && $blue >= $threshold;
    };

    /**
     * Para não precisar manter um array gigante de pixels visitados,
     * transformamos o pixel em transparente no momento em que entra na fila.
     */
    $addPixel = static function (int $x, int $y) use (
        $image,
        $width,
        $height,
        $queue,
        $isWhite
    ): void {
        if ($x < 0 || $y < 0 || $x >= $width || $y >= $height) {
            return;
        }

        $color = imagecolorat($image, $x, $y);

        if (!$isWhite($color)) {
            return;
        }

        // Transparente total.
        imagesetpixel($image, $x, $y, 0x7F000000);
        $queue->enqueue([$x, $y]);
    };

    // Inicia em toda a borda superior e inferior.
    for ($x = 0; $x < $width; $x++) {
        $addPixel($x, 0);
        $addPixel($x, $height - 1);
    }

    // Inicia nas bordas esquerda e direita.
    for ($y = 0; $y < $height; $y++) {
        $addPixel(0, $y);
        $addPixel($width - 1, $y);
    }

    // Flood fill somente pelo branco conectado às bordas.
    while (!$queue->isEmpty()) {
        [$x, $y] = $queue->dequeue();

        $addPixel($x - 1, $y);
        $addPixel($x + 1, $y);
        $addPixel($x, $y - 1);
        $addPixel($x, $y + 1);

        // Diagonais ajudam a eliminar restos de antialiasing.
        $addPixel($x - 1, $y - 1);
        $addPixel($x + 1, $y - 1);
        $addPixel($x - 1, $y + 1);
        $addPixel($x + 1, $y + 1);
    }

    $result = cropTransparentSquare($image, $cropAlphaCutoff);
    imagedestroy($image);

    if ($result === null) {
        echo "Erro: imagem totalmente transparente após processamento: {$filename}\n";
        return false;
    }

    $tmp = $filename . '.tmp.png';
    $saved = imagepng($result, $tmp, $pngCompression);

    $newWidth = imagesx($result);
    $newHeight = imagesy($result);
    imagedestroy($result);

    if (!$saved) {
        @unlink($tmp);
        echo "Erro ao salvar: {$filename}\n";
        return false;
    }

    // Substitui somente depois que a nova imagem foi salva corretamente.
    if (!rename($tmp, $filename)) {
        @unlink($tmp);
        echo "Erro ao substituir: {$filename}\n";
        return false;
    }

    echo "OK: {$filename} ({$width}x{$height} -> {$newWidth}x{$newHeight})\n";

    return true;
}

/**
 * Remove a borda transparente da imagem e mantém o resultado quadrado.
 *
 * No GD, alpha 0 = opaco e 127 = totalmente transparente.
 * Pixels com alpha >= $alphaCutoff são ignorados ao calcular o conteúdo.
 */
function cropTransparentSquare(GdImage $image, int $alphaCutoff): ?GdImage
{
    $width = imagesx($image);
    $height = imagesy($image);

    [$minX, $minY, $maxX, $maxY] = findVisibleBounds($image, $alphaCutoff);

    if ($minX === null || $minY === null || $maxX === null || $maxY === null) {
        return null;
    }

    $contentWidth = $maxX - $minX + 1;
    $contentHeight = $maxY - $minY + 1;
    $side = max($contentWidth, $contentHeight);

    // Centraliza o menor quadrado possível em torno do conteúdo visível.
    $centerX = ($minX + $maxX) / 2.0;
    $centerY = ($minY + $maxY) / 2.0;
    $cropLeft = (int)floor($centerX - (($side - 1) / 2.0));
    $cropTop = (int)floor($centerY - (($side - 1) / 2.0));

    $result = imagecreatetruecolor($side, $side);
    imagealphablending($result, false);
    imagesavealpha($result, true);

    $transparent = imagecolorallocatealpha($result, 0, 0, 0, 127);
    imagefilledrectangle($result, 0, 0, $side - 1, $side - 1, $transparent);

    // Copia apenas a interseção do quadrado calculado com a imagem original.
    $srcX = max(0, $cropLeft);
    $srcY = max(0, $cropTop);
    $srcRight = min($width, $cropLeft + $side);
    $srcBottom = min($height, $cropTop + $side);

    $copyWidth = $srcRight - $srcX;
    $copyHeight = $srcBottom - $srcY;

    if ($copyWidth > 0 && $copyHeight > 0) {
        $dstX = $srcX - $cropLeft;
        $dstY = $srcY - $cropTop;

        imagecopy(
            $result,
            $image,
            $dstX,
            $dstY,
            $srcX,
            $srcY,
            $copyWidth,
            $copyHeight
        );
    }

    return $result;
}

/**
 * Retorna [minX, minY, maxX, maxY] dos pixels considerados visíveis.
 */
function findVisibleBounds(GdImage $image, int $alphaCutoff): array
{
    $width = imagesx($image);
    $height = imagesy($image);

    $minY = null;
    $maxY = null;
    $minX = null;
    $maxX = null;

    for ($y = 0; $y < $height; $y++) {
        if (rowHasVisiblePixel($image, $y, $width, $alphaCutoff)) {
            $minY = $y;
            break;
        }
    }

    if ($minY === null) {
        return [null, null, null, null];
    }

    for ($y = $height - 1; $y >= $minY; $y--) {
        if (rowHasVisiblePixel($image, $y, $width, $alphaCutoff)) {
            $maxY = $y;
            break;
        }
    }

    for ($x = 0; $x < $width; $x++) {
        if (columnHasVisiblePixel($image, $x, $minY, $maxY, $alphaCutoff)) {
            $minX = $x;
            break;
        }
    }

    for ($x = $width - 1; $x >= $minX; $x--) {
        if (columnHasVisiblePixel($image, $x, $minY, $maxY, $alphaCutoff)) {
            $maxX = $x;
            break;
        }
    }

    return [$minX, $minY, $maxX, $maxY];
}

function rowHasVisiblePixel(GdImage $image, int $y, int $width, int $alphaCutoff): bool
{
    for ($x = 0; $x < $width; $x++) {
        $rgba = imagecolorat($image, $x, $y);
        $alpha = ($rgba >> 24) & 0x7F;

        if ($alpha < $alphaCutoff) {
            return true;
        }
    }

    return false;
}

function columnHasVisiblePixel(
    GdImage $image,
    int $x,
    int $minY,
    int $maxY,
    int $alphaCutoff
): bool {
    for ($y = $minY; $y <= $maxY; $y++) {
        $rgba = imagecolorat($image, $x, $y);
        $alpha = ($rgba >> 24) & 0x7F;

        if ($alpha < $alphaCutoff) {
            return true;
        }
    }

    return false;
}

if (!extension_loaded('gd')) {
    echo "Erro: a extensão GD do PHP não está habilitada.\n";
    exit(1);
}

// Não recebe parâmetros: procura os icon.png nas pastas ao lado deste script.
$files = glob(__DIR__ . '/*/icon.png');

if (!$files) {
    echo "Nenhum arquivo encontrado em */icon.png\n";
    exit;
}

echo "Encontradas " . count($files) . " imagens.\n\n";

foreach ($files as $file) {
    processImage($file);
}

echo "\nConcluído.\n";
