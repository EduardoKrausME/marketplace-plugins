<?php
$plugins = json_decode(file_get_contents("plugins.json"));
foreach ($plugins as $plugin) {
    mkdir("plugin/{$plugin->component}/");
    file_put_contents("plugin/{$plugin->component}/index.html", "page");
}
