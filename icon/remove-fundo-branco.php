<?php

declare(strict_types=1);

/**
 * Remove o fundo branco conectado às bordas da imagem.
 *
 * Pixels brancos internos ao desenho não são afetados, desde que não estejam
 * conectados ao fundo branco externo.
 */
function removeWhiteBorder(string $filename, int $threshold = 235): bool
{
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
    $isWhite = static function (int $color) use ($threshold): bool {
        $alpha = ($color >> 24) & 0x7F;

        // Pixel já transparente não precisa ser removido.
        if ($alpha >= 120) {
            return false;
        }

        $red   = ($color >> 16) & 0xFF;
        $green = ($color >> 8) & 0xFF;
        $blue  = $color & 0xFF;

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

    $tmp = $filename . '.tmp.png';

    $saved = imagepng($image, $tmp, 9);

    imagedestroy($image);

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

    echo "OK: {$filename}\n";

    return true;
}


$files = glob(__DIR__ . '/*/icon.png');

if (!$files) {
    echo "Nenhum arquivo encontrado em */icon.png\n";
    exit;
}

echo "Encontradas " . count($files) . " imagens.\n\n";

foreach ($files as $file) {
    removeWhiteBorder($file);
}

echo "\nConcluído.\n";