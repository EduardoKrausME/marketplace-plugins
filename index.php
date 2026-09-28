<?php

declare(strict_types = 1);

require_once __DIR__ . '/marketplace.php';

$catalogError = null;
$plugins = [];

try {
    $plugins = marketplace_load_plugins(__DIR__ . '/plugins.json');
} catch (RuntimeException $exception) {
    $catalogError = $exception->getMessage();
}

$categoryLabels = [
        "administration" => 'Administration',
        "themes" => "Themes",
        "video" => 'Video',
        "reports" => 'Reports',
        "integrations" => 'Integrations',
];

/**
 * Resolves a plugin asset URL without forcing absolute/root URLs through the project base URL.
 */
function marketplace_asset_url(string $path): string {
    $path = trim($path);

    if ($path === "") {
        return "";
    }

    if (
            preg_match('#^(?:https?:)?//#i', $path) === 1 ||
            strncmp($path, 'data:', 5) === 0 ||
            strncmp($path, "/", 1) === 0
    ) {
        return $path;
    }

    return marketplace_url($path);
}
?>
<!doctype html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="Marketplace for Moodle™ Software plugins developed by Eduardo Kraus.">
    <title>Eduardo Kraus Plugin Marketplace</title>
    <link rel="stylesheet" href="<?php echo marketplace_url('styles/bootstrap.css') ?>">
    <link rel="stylesheet" href="<?php echo marketplace_url('styles/styles.css') ?>">
</head>
<body>
<main>
    <header class="topbar shell">
        <a class="brand" href="<?php echo marketplace_url() ?>"
           aria-label="Eduardo Kraus Plugin Marketplace">
            <span class="brand-mark"><b>EK</b><i>✚</i></span>
            <span>Plugin Marketplace <strong>Eduardo Kraus</strong></span>
        </a>
        <label class="search">
            <span>⌕</span>
            <input id="search" placeholder="Search plugins..." aria-label="Search plugins">
            <button id="clear-search" type="button" aria-label="Clear search" hidden>×</button>
        </label>
        <div class="theme-toggle" aria-label="Choose theme">
            <button id="dark-button" type="button" class="active">☾ <span>Dark</span></button>
            <button id="light-button" type="button">☀ <span>Light</span></button>
        </div>
    </header>

    <section class="hero shell" id="top">
        <div class="hero-copy">
            <p class="eyebrow">PLUGINS FOR MOODLE™ SOFTWARE</p>
            <h1>Expand your Moodle™ Software.<br>Transform learning.</h1>
            <p class="lead">Powerful plugins, built with excellence to enhance your Moodle™ Software platform experience.</p>
        </div>
        <div class="hero-art" aria-hidden="true">
            <div class="code-card">
                <div class="code-title">&lt;/&gt;</div>
                <i></i><i></i><i></i><i></i><i></i><i></i></div>
            <div class="float-card card-one">≡</div>
            <div class="float-card card-two">{ }</div>
            <div class="cube cube-one">✚</div>
            <div class="cube cube-two">⚙</div>
            <span class="orb orb-one"></span><span class="orb orb-two"></span>
        </div>
    </section>

    <section class="catalog shell" id="catalog">
        <nav class="filters" aria-label="Plugin categories">
            <button type="button" class="active" data-category="all"><span>▦</span>All</button>
            <button type="button" data-category="administration"><span>⬡</span>Administration</button>
            <button type="button" data-category="themes"><span>✦</span>Themes</button>
            <button type="button" data-category="video"><span>▣</span>Video</button>
            <button type="button" data-category="reports"><span>▥</span>Reports</button>
            <button type="button" data-category="integrations"><span>⛓</span>Integrations</button>
        </nav>
        <div class="section-heading">
            <h2><span>☆</span><b id="section-title">Featured plugins</b></h2>
            <p id="result-count"><?php echo count($plugins) ?> <?php echo count($plugins) === 1 ? "plugin" : "plugins" ?></p>
        </div>

        <?php if ($catalogError !== null): ?>
            <div class="empty catalog-error">
                <span>!</span>
                <h3>Unable to load the catalog</h3>
                <p><?php echo $catalogError ?></p>
            </div>
        <?php else: ?>
            <div class="plugin-grid" id="plugin-grid">
                <?php foreach ($plugins as $plugin):
                    $name = trim((string) ($plugin["name"] ?? "Plugin"));
                    $component = trim((string) ($plugin["component"] ?? ""));
                    $pluginCategory = trim((string) ($plugin["category"] ?? "plugin"));
                    $description = trim((string) ($plugin["description"] ?? ""));
                    $moodleVersion = trim((string) ($plugin["moodle"] ?? ""));
                    $categoryLabel = $categoryLabels[$pluginCategory] ?? ($pluginCategory !== "" ? ucfirst($pluginCategory) : "Plugin");
                    $iconUrl = marketplace_asset_url((string) ($plugin["iconUrl"] ?? ""));
                    $pluginUrl = marketplace_url('plugin/' . rawurlencode($component));
                    $searchText = trim("{$name} {$component} {$description}");
                    ?>
                    <article class="plugin-card"
                             data-plugin-card
                             data-category="<?php echo $pluginCategory ?>"
                             data-search="<?php echo $searchText ?>">
                        <button class="favorite"
                                type="button"
                                data-favorite="<?php echo $component ?>"
                                aria-label="Add to favorites <?php echo $name ?>">☆</button>

                        <a class="plugin-icon <?php echo $pluginCategory ?>"
                           href="<?php echo $pluginUrl ?>"
                           aria-label="Open <?php echo $name ?>">
                            <?php if ($iconUrl !== ""): ?>
                                <img src="<?php echo $iconUrl ?>" alt="" loading="lazy">
                            <?php else: ?>
                                <span class="plugin-icon-fallback">EK</span>
                            <?php endif; ?>
                        </a>

                        <div class="plugin-content">
                            <h3><a href="<?php echo $pluginUrl ?>"><?php echo $name ?></a></h3>
                            <code><?php echo $component ?></code>
                            <p><?php echo $description ?></p>
                        </div>

                        <div class="plugin-meta">
                            <span class="category-tag"><?php echo $categoryLabel ?></span>
                            <span class="version">Moodle™ Software <?php echo $moodleVersion ?></span>
                        </div>

                        <a class="plugin-link" href="<?php echo $pluginUrl ?>">
                            View details <span>›</span>
                        </a>
                    </article>
                <?php endforeach; ?>
            </div>
            <div class="empty" id="empty" hidden>
                <span>⌕</span>
                <h3>No plugins found</h3>
                <p>Try another search term or select a different category.</p>
            </div>
        <?php endif; ?>
    </section>

    <footer>
        <div class="shell"><span>© 2026 Eduardo Kraus</span><span>Moodle™ Software plugins made in Brazil.</span></div>
    </footer>
</main>
<script src="<?php echo marketplace_url('js/app.js') ?>?v=<?php echo filemtime(__DIR__ . '/js/app.js') ?>"></script>
<script src="<?php echo marketplace_url('js/theme.js') ?>?v=<?php echo filemtime(__DIR__ . '/js/theme.js') ?>"></script>
</body>
</html>
