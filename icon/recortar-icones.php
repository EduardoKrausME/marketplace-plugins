<?php
/**
 * crop_transparent_square.php
 *
 * Remove a borda transparente de imagens PNG sem redimensionar o conteúdo
 * e mantém o resultado quadrado.
 *
 * Requisitos:
 *   PHP 8+ com extensão GD habilitada.
 *
 * Uso com um arquivo:
 *   php crop_transparent_square.php input.png output.png
 *
 * Uso com uma pasta inteira:
 *   php crop_transparent_square.php ./entrada ./saida
 *
 * Ignorar pixels quase transparentes também (opcional):
 *   php crop_transparent_square.php ./entrada ./saida --alpha=120
 *
 * No GD, alpha 0 = totalmente opaco e 127 = totalmente transparente.
 * O padrão --alpha=127 remove apenas pixels 100% transparentes.
 */

declare(strict_types=1);

if (!extension_loaded('gd')) {
    fwrite(STDERR, "Erro: a extensão GD do PHP não está habilitada.\n");
    fwrite(STDERR, "Em Debian/Ubuntu, normalmente: sudo apt install php-gd\n");
    exit(1);
}

if (PHP_SAPI !== 'cli') {
    http_response_code(400);
    echo "Execute este arquivo pelo terminal.\n";
    exit;
}

$args = $argv;
array_shift($args);

$alphaCutoff = 127;
$positional = [];

foreach ($args as $arg) {
    if (str_starts_with($arg, '--alpha=')) {
        $value = substr($arg, 8);
        if ($value === '' || !ctype_digit($value)) {
            fail("Valor inválido para --alpha. Use um número entre 1 e 127.");
        }
        $alphaCutoff = (int)$value;
        if ($alphaCutoff < 1 || $alphaCutoff > 127) {
            fail("Valor inválido para --alpha. Use um número entre 1 e 127.");
        }
        continue;
    }

    $positional[] = $arg;
}

if (count($positional) < 1 || count($positional) > 2) {
    usage();
    exit(1);
}

$input = $positional[0];
$output = $positional[1] ?? null;

if (is_file($input)) {
    if ($output === null) {
        $info = pathinfo($input);
        $output = ($info['dirname'] !== '.' ? $info['dirname'] . DIRECTORY_SEPARATOR : '')
            . $info['filename'] . '-cropped.png';
    }

    processFile($input, $output, $alphaCutoff);
    exit;
}

if (is_dir($input)) {
    if ($output === null) {
        $output = rtrim($input, DIRECTORY_SEPARATOR) . '-cropped';
    }

    processDirectory($input, $output, $alphaCutoff);
    exit;
}

fail("Entrada não encontrada: {$input}");

function processDirectory(string $inputDir, string $outputDir, int $alphaCutoff): void
{
    $inputDir = rtrim($inputDir, DIRECTORY_SEPARATOR);
    $outputDir = rtrim($outputDir, DIRECTORY_SEPARATOR);

    if (!is_dir($outputDir) && !mkdir($outputDir, 0775, true) && !is_dir($outputDir)) {
        fail("Não foi possível criar a pasta de saída: {$outputDir}");
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($inputDir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    $processed = 0;
    $errors = 0;

    foreach ($iterator as $fileInfo) {
        if (!$fileInfo->isFile()) {
            continue;
        }

        $extension = strtolower($fileInfo->getExtension());
        if ($extension !== 'png') {
            continue;
        }

        $source = $fileInfo->getPathname();
        $relative = substr($source, strlen($inputDir) + 1);
        $destination = $outputDir . DIRECTORY_SEPARATOR . $relative;

        $destinationDir = dirname($destination);
        if (!is_dir($destinationDir) && !mkdir($destinationDir, 0775, true) && !is_dir($destinationDir)) {
            fwrite(STDERR, "ERRO: não foi possível criar {$destinationDir}\n");
            $errors++;
            continue;
        }

        try {
            processFile($source, $destination, $alphaCutoff);
            $processed++;
        } catch (Throwable $e) {
            fwrite(STDERR, "ERRO: {$source}: {$e->getMessage()}\n");
            $errors++;
        }
    }

    echo "\nConcluído: {$processed} PNG(s) processado(s)";
    if ($errors > 0) {
        echo ", {$errors} erro(s)";
    }
    echo ".\n";
}

function processFile(string $source, string $destination, int $alphaCutoff): void
{
    if (strtolower(pathinfo($source, PATHINFO_EXTENSION)) !== 'png') {
        throw new RuntimeException('Este script processa somente PNG.');
    }

    $image = @imagecreatefrompng($source);
    if ($image === false) {
        throw new RuntimeException('Não foi possível abrir o PNG.');
    }

    try {
        imagealphablending($image, false);
        imagesavealpha($image, true);

        $width = imagesx($image);
        $height = imagesy($image);

        [$minX, $minY, $maxX, $maxY] = findVisibleBounds($image, $alphaCutoff);

        if ($minX === null) {
            throw new RuntimeException('A imagem é totalmente transparente.');
        }

        $contentWidth = $maxX - $minX + 1;
        $contentHeight = $maxY - $minY + 1;
        $side = max($contentWidth, $contentHeight);

        // Centraliza o quadrado mínimo em torno do conteúdo detectado.
        $centerX = ($minX + $maxX) / 2.0;
        $centerY = ($minY + $maxY) / 2.0;
        $cropLeft = (int)floor($centerX - (($side - 1) / 2.0));
        $cropTop = (int)floor($centerY - (($side - 1) / 2.0));

        $result = imagecreatetruecolor($side, $side);
        if ($result === false) {
            throw new RuntimeException('Não foi possível criar a imagem de saída.');
        }

        try {
            imagealphablending($result, false);
            imagesavealpha($result, true);

            $transparent = imagecolorallocatealpha($result, 0, 0, 0, 127);
            imagefilledrectangle($result, 0, 0, $side - 1, $side - 1, $transparent);

            // Copia apenas a interseção do quadrado com a imagem original.
            // Isso também funciona se a imagem original não for quadrada.
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

            $destinationDir = dirname($destination);
            if ($destinationDir !== '.' && !is_dir($destinationDir)) {
                if (!mkdir($destinationDir, 0775, true) && !is_dir($destinationDir)) {
                    throw new RuntimeException("Não foi possível criar {$destinationDir}");
                }
            }

            if (!imagepng($result, $destination, 9)) {
                throw new RuntimeException('Não foi possível salvar o PNG.');
            }

            printf(
                "%s: %dx%d -> %dx%d | conteúdo %dx%d | alpha >= %d ignorado\n",
                basename($source),
                $width,
                $height,
                $side,
                $side,
                $contentWidth,
                $contentHeight,
                $alphaCutoff
            );
        } finally {
            imagedestroy($result);
        }
    } finally {
        imagedestroy($image);
    }
}

/**
 * Retorna [minX, minY, maxX, maxY] dos pixels considerados visíveis.
 *
 * GD usa alpha de 0 a 127:
 *   0   = opaco
 *   127 = transparente
 *
 * Um pixel é considerado visível quando alpha < $alphaCutoff.
 * Com cutoff 127, somente o alpha 127 é descartado.
 */
function findVisibleBounds(GdImage $image, int $alphaCutoff): array
{
    $width = imagesx($image);
    $height = imagesy($image);

    $minY = null;
    $maxY = null;
    $minX = null;
    $maxX = null;

    // Procura cada borda de fora para dentro. Em lotes grandes isso evita
    // percorrer todos os pixels do miolo da imagem sem necessidade.
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

function usage(): void
{
    echo <<<TXT
Uso:
  php crop_transparent_square.php input.png [output.png]
  php crop_transparent_square.php pasta_entrada [pasta_saida]

Opção:
  --alpha=N    1..127. Padrão 127.
               127 remove somente pixels totalmente transparentes.
               120 também ignora pixels quase transparentes.

Exemplos:
  php crop_transparent_square.php icon.png icon-cropped.png
  php crop_transparent_square.php ./icons ./icons-cropped
  php crop_transparent_square.php ./icons ./icons-cropped --alpha=120

TXT;
}

function fail(string $message): never
{
    fwrite(STDERR, "Erro: {$message}\n");
    exit(1);
}
