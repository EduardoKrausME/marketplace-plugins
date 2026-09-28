<?php

require_once __DIR__ . '/marketplace.php';

$component = $_GET["component"] ?? "";
$plugin = null;
$catalogError = null;

try {
    $plugins = marketplace_load_plugins(__DIR__ . '/plugins.json');
    $plugin = marketplace_find_plugin($plugins, $component);
} catch (RuntimeException $exception) {
    $catalogError = $exception->getMessage();
}

if ($plugin === null) {
    http_response_code(404);
}

$name = (string) ($plugin["name"] ?? 'Plugin not found');
$description = (string) ($plugin["description"] ?? 'The requested component does not exist in the catalog.');
$iconUrl = $plugin["iconUrl"];
$moodleVersion = (string) ($plugin["moodle"] ?? 'Not specified');
$category = (string) ($plugin["category"] ?? "plugin");
$categoryLabels = [
        "administration" => 'Administration',
        "themes" => "Themes",
        "video" => 'Video',
        "reports" => 'Reports',
        "integrations" => 'Integrations',
];
$categoryLabel = $categoryLabels[$category] ?? ucfirst($category);
$screenshots = is_array($plugin["screenshots"] ?? null) ? array_values($plugin["screenshots"]) : [];
$downloadUrl = $plugin ? marketplace_download_url($plugin["repository_url"]) : "#";

// These links can be defined individually in plugins.json later.
$forumUrl = trim((string) ($plugin["forum_url"] ?? ""));
$learnUrl = trim((string) ($plugin["learn_url"] ?? ""));
?>
<!doctype html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="<?php echo $description ?>">
    <title><?php echo $name ?> | Eduardo Kraus Plugin Marketplace</title>
    <link rel="stylesheet" href="<?php echo marketplace_url('styles/bootstrap.css') ?>">
    <link rel="stylesheet" href="<?php echo marketplace_url('styles/styles.css') ?>">
</head>
<body class="detail-page">
<main>
    <header class="topbar detail-topbar shell">
        <a class="brand" href="<?php
        echo marketplace_url() ?>" aria-label="Return to the Eduardo Kraus Plugin Marketplace">
            <span class="brand-mark"><b>EK</b><i>✚</i></span>
            <span>Plugin Marketplace <strong>Eduardo Kraus</strong></span>
        </a>
        <a class="back-to-catalog" href="<?php
        echo marketplace_url() ?>">← Back to catalog</a>
        <div class="theme-toggle" aria-label="Choose theme">
            <button id="dark-button" type="button" class="active">☾ <span>Dark</span></button>
            <button id="light-button" type="button">☀ <span>Light</span></button>
        </div>
    </header>

    <section class="detail-shell shell">
        <?php
        if ($plugin === null): ?>
            <div class="not-found-card">
                <span class="not-found-code">404</span>
                <h1>Plugin not found</h1>
                <p><?php
                    echo $catalogError ?? 'No plugin with the requested component exists in plugins.json.' ?></p>
                <a class="primary-button inline-button" href="<?php
                echo marketplace_url() ?>">Back to marketplace</a>
            </div>
        <?php
        else: ?>
            <nav class="breadcrumb" aria-label="Breadcrumb">
                <a href="<?php
                echo marketplace_url() ?>">Marketplace</a>
                <span>›</span>
                <span><?php echo $plugin["component"] ?></span>
            </nav>

            <header class="plugin-detail-hero">
                <div class="detail-icon <?php
                echo $category ?>">
                    <?php
                    if ($iconUrl !== ""): ?>
                        <img src="<?php echo $iconUrl ?>" alt="Plugin icon for <?php echo $name ?>">
                    <?php
                    else: ?>
                        <span>EK</span>
                    <?php
                    endif; ?>
                </div>
                <div class="detail-heading">
                    <h1><?php echo $name ?></h1>
                    <code><?php echo $plugin["component"] ?></code>
                    <p><?php echo $description ?></p>
                    <div class="detail-badges">
                        <span>Moodle™ Software <?php echo $moodleVersion ?></span>
                        <span><?php echo $categoryLabel ?></span>
                    </div>
                </div>
                <div class="detail-primary-action">
                    <a href="<?php echo $downloadUrl ?>" target="_blank">Download plugin <span>↓</span></a>
                </div>
            </header>

            <section class="detail-panel">
                <div class="detail-tabs" role="tablist" aria-label="Plugin information">
                    <button type="button" class="active" id="tab-description" role="tab" aria-selected="true"
                            aria-controls="panel-description" data-tab="description">Description</button>
                    <button type="button" id="tab-download" role="tab" aria-selected="false" aria-controls="panel-download"
                            data-tab="download">Download</button>
                    <button type="button" id="tab-learn" role="tab" aria-selected="false" aria-controls="panel-learn"
                            data-tab="learn">Learn</button>
                </div>

                <div class="tab-panel active" id="panel-description" role="tabpanel" aria-labelledby="tab-description"
                     data-panel="description">
                    <?php
                    if ($screenshots !== []): ?>
                        <section class="screenshots-section" aria-label="Screenshots">
                            <div class="screenshot-carousel" data-carousel>
                                <div class="carousel-viewport">
                                    <div class="carousel-track">
                                        <?php
                                        foreach ($screenshots as $index => $screenshot):
                                            $screenshotUrl = $screenshot["url"];
                                            $screenshotName = (string) ($screenshot["originalName"] ??
                                                    $name . ' - Screenshot ' . ($index + 1));
                                            ?>
                                            <figure class="carousel-slide<?php
                                            echo $index === 0 ? ' active' : "" ?>" data-slide="<?php
                                            echo $index ?>">
                                                <img src="<?php
                                                echo $screenshotUrl ?>" alt="<?php
                                                echo $screenshotName ?>" <?php
                                                echo $index === 0 ? "" : 'loading="lazy"' ?>>
                                                <figcaption><?php
                                                    echo $screenshotName ?></figcaption>
                                            </figure>
                                        <?php
                                        endforeach; ?>
                                    </div>
                                    <?php
                                    if (count($screenshots) > 1): ?>
                                        <button type="button" class="carousel-arrow carousel-prev" data-carousel-prev
                                                aria-label="Previous screenshot">‹
                                        </button>
                                        <button type="button" class="carousel-arrow carousel-next" data-carousel-next
                                                aria-label="Next screenshot">›
                                        </button>
                                    <?php
                                    endif; ?>
                                </div>
                                <?php
                                if (count($screenshots) > 1): ?>
                                    <div class="carousel-thumbnails">
                                        <?php
                                        foreach ($screenshots as $index => $screenshot):
                                            $thumbnailUrl = $screenshot["url"];
                                            ?>
                                            <button type="button" class="carousel-thumbnail<?php
                                            echo $index === 0 ? ' active' : "" ?>" data-carousel-go="<?php
                                            echo $index ?>" aria-label="Open screenshot <?php
                                            echo $index + 1 ?>">
                                                <img src="<?php
                                                echo $thumbnailUrl ?>" alt="" loading="lazy">
                                            </button>
                                        <?php
                                        endforeach; ?>
                                    </div>
                                <?php
                                endif; ?>
                            </div>
                        </section>
                    <?php
                    endif; ?>

                    <section class="plugin-description-html">
                        <div class="rich-content">
                            <?php echo $plugin["description_html"] ?>
                        </div>
                    </section>
                </div>

                <div class="tab-panel" id="panel-download" role="tabpanel" aria-labelledby="tab-download" data-panel="download"
                     hidden>
                    <div class="action-content">
                        <span class="action-icon">↓</span>
                        <h2>Download the latest version</h2>
                        <p>The file is generated directly by GitHub using the current content of the <code>master</code> branch.</p>
                        <a class="primary-button inline-button" href="<?php echo $downloadUrl ?>" target="_blank">Download <?php echo $plugin["component"] ?>.zip</a>
                        <a class="text-link" href="<?php echo $plugin["repository_url"] ?>" target="_blank" rel="noreferrer">Open repository on GitHub ↗</a>
                    </div>
                </div>

                <div class="tab-panel" id="panel-learn" role="tabpanel" aria-labelledby="tab-learn" data-panel="learn" hidden>
                    <div class="action-content">
                        <span class="action-icon">▷</span>
                        <span class="section-kicker">COURSE AND DOCUMENTATION</span>
                        <h2>Learn how to use this plugin</h2>
                        <p>This button can open the corresponding course within Moodle™ Software.</p>
                        <?php
                        if ($learnUrl !== ""): ?>
                            <a class="primary-button inline-button" href="<?php echo $learnUrl ?>">Open course</a>
                        <?php endif; ?>
                    </div>
                </div>
            </section>
        <?php
        endif; ?>
    </section>

    <footer>
        <div class="shell"><span>© 2026 Eduardo Kraus</span><span>Moodle™ Software plugins made in Brazil.</span></div>
    </footer>
</main>
<script src="<?php echo marketplace_url('js/detail.js') ?>"></script>
<script src="<?php echo marketplace_url('js/theme.js') ?>"></script>
</body>
</html>
