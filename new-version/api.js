(() => {
    "use strict";

    const CONFIG = {
        apiUrl: "https://eduardokraus.com/marketplace-plugins/new-version/api.php",
        githubOwner: "EduardoKrausME",
        setupPageTimeoutMs: 45000,
        setupImageSize: 512,
        autoUpload: true,
        concurrency: 2,
        delayBetweenPluginsMs: 500,
        clientCacheTtlMs: 24 * 60 * 60 * 1000,
        clientCachePrefix: "marketplace-github-info:v1:",
        pluginOkCachePrefix: "marketplace-plugin-ok:v1:",
    };

    const SCRIPT_BUILD =
        "2026-09-28.8-filepond-api";

    console.info(
        `[Marketplace] JS carregado: ${SCRIPT_BUILD}`
    );

    function marketplaceErrorMessage(error) {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }

    function logMarketplaceError(
        error,
        context = {}
    ) {
        const message =
            marketplaceErrorMessage(error);

        const stack =
            error instanceof Error
                ? error.stack
                : null;

        const plugin =
            context.plugin || null;

        const debug =
            context.debug || {};

        console.group(
            `[Marketplace][ERRO] ${plugin?.component || "erro geral"}`
        );

        console.error(
            "Erro capturado:",
            error
        );

        console.error(
            "Build do JS:",
            SCRIPT_BUILD
        );

        if (plugin) {
            console.error(
                "Plugin:",
                {
                    id: plugin.id,
                    component: plugin.component,
                }
            );
        }

        console.error(
            "Etapa em execuÃ§Ã£o:",
            debug.status || context.phase || "nÃ£o identificada"
        );

        if (debug.details) {
            console.error(
                "Detalhes da etapa:",
                debug.details
            );
        }

        if (debug.marketplace) {
            console.error(
                "VersÃ£o no Marketplace:",
                debug.marketplace
            );
        }

        if (debug.repository) {
            console.error(
                "RepositÃ³rio:",
                debug.repository
            );
        }

        if (debug.repositoryInfo) {
            console.error(
                "Resposta da API/cache para o repositÃ³rio:",
                debug.repositoryInfo
            );
        }

        console.error(
            "Mensagem:",
            message
        );

        if (stack) {
            console.error(
                "Stack trace (arquivo/linha exatos):",
                stack
            );
        }

        if (/\bremote is not defined\b/i.test(message)) {
            console.error(
                "DIAGNÃ“STICO: 'remote is not defined' Ã© um ReferenceError do JavaScript, " +
                "nÃ£o um erro da API do GitHub. A API pode ter retornado HTTP 200 e mesmo assim " +
                "um JS antigo tentar usar uma variÃ¡vel chamada 'remote' fora do escopo."
            );

            console.error(
                "Nesta build a variÃ¡vel executÃ¡vel 'remote' nem existe mais: ela foi renomeada " +
                "para 'repositoryInfo'. Se este erro aparecer junto de uma build diferente de " +
                `"${SCRIPT_BUILD}", o navegador estÃ¡ executando uma versÃ£o antiga do script. ` +
                "Confira no stack trace acima qual arquivo e linha geraram o erro."
            );
        }

        console.groupEnd();
    }

    window.addEventListener(
        "error",
        (event) => {
            const error =
                event.error ||
                new Error(
                    event.message ||
                    "JavaScript error without Error object"
                );

            logMarketplaceError(
                error,
                {
                    phase: `window.error @ ${event.filename || "arquivo desconhecido"}:${event.lineno || "?"}:${event.colno || "?"}`,
                }
            );
        }
    );

    window.addEventListener(
        "unhandledrejection",
        (event) => {
            logMarketplaceError(
                event.reason,
                {
                    phase: "Promise rejeitada sem tratamento",
                }
            );
        }
    );

    const sleep = (ms) =>
        new Promise((resolve) => setTimeout(resolve, ms));

    function normalizeRelease(value) {
        return String(value || "")
            .trim()
            .replace(/^release[-_\s]*/i, "")
            .replace(/^v(?=\d)/i, "")
            .trim();
    }

    function compareVersions(a, b) {
        const pa = normalizeRelease(a)
            .split(/[.+\-]/)
            .map((part) => {
                const match = part.match(/^\d+/);

                return match
                    ? Number(match[0])
                    : 0;
            });

        const pb = normalizeRelease(b)
            .split(/[.+\-]/)
            .map((part) => {
                const match = part.match(/^\d+/);

                return match
                    ? Number(match[0])
                    : 0;
            });

        const max = Math.max(
            pa.length,
            pb.length
        );

        for (let i = 0; i < max; i++) {
            const va = pa[i] || 0;
            const vb = pb[i] || 0;

            if (va > vb) {
                return 1;
            }

            if (va < vb) {
                return -1;
            }
        }

        return normalizeRelease(a)
            .localeCompare(
                normalizeRelease(b),
                undefined,
                {
                    numeric: true,
                    sensitivity: "base",
                }
            );
    }

    function getDashboardPlugins() {
        const plugins = [];

        for (
            const row
            of document.querySelectorAll(
            "table tbody tr"
        )
            ) {
            const cells =
                row.querySelectorAll("td");

            if (cells.length < 4) {
                continue;
            }

            const componentCell =
                cells[1];

            const statusCell =
                cells[2];

            const listingCell =
                cells[3];

            const component =
                componentCell
                    .querySelector("span")
                    ?.textContent
                    .trim() ||
                componentCell
                    .textContent
                    .trim();

            if (!component) {
                continue;
            }

            /*
             * Plugins ignorados.
             */
            if (
                component.endsWith("_videofront") ||
                component.endsWith("_cloudstudio")
            ) {
                continue;
            }

            /*
             * Processa tanto plugins publicados quanto
             * plugins aprovados que ainda precisam passar
             * pelo wizard "Set up plugin page".
             */
            const setupLink =
                listingCell.querySelector(
                    "a[data-ga-label='setup_after_review'][href^='/plugins/']"
                );

            const changesNeededLink =
                statusCell.querySelector(
                    "a[data-ga-label='changes_needed'][href^='/plugins/']"
                );

            const published = [
                ...listingCell.querySelectorAll(
                    "span"
                ),
            ].some(
                (span) =>
                    span.textContent.trim() ===
                    "Published"
            );

            if (
                !published &&
                !setupLink &&
                !changesNeededLink
            ) {
                continue;
            }

            const link =
                setupLink ||
                changesNeededLink ||
                listingCell.querySelector(
                    "a[href^='/plugins/']"
                );

            if (!link) {
                continue;
            }

            const idMatch =
                link
                    .getAttribute("href")
                    ?.match(
                        /^\/plugins\/(\d+)(?:\/|$)/
                    );

            if (!idMatch) {
                continue;
            }

            plugins.push({
                id: Number(idMatch[1]),
                component,
                componentCell,
                row,
                published,
                needsSetup:
                    Boolean(setupLink),
                needsChanges:
                    Boolean(changesNeededLink),
            });
        }

        return plugins;
    }

    function addStatusRow(plugin) {
        const debugContext = {
            status: "inicializando",
            details: "",
            marketplace: null,
            repository: null,
            repositoryInfo: null,
        };

        let container =
            plugin.componentCell.querySelector(
                ".marketplace-github-status"
            );

        if (!container) {
            container =
                document.createElement("div");

            container.className =
                "marketplace-github-status";

            container.style.cssText = [
                "margin-top:5px",
                "font-size:12px",
                "line-height:1.35",
            ].join(";");

            plugin.componentCell.appendChild(
                container
            );
        }

        container.innerHTML = `
            <div data-role="status"></div>
            <div
                data-role="details"
                style="
                    margin-top:2px;
                    font-size:11px;
                    color:#6c757d;
                    word-break:break-word;
                "
            ></div>
        `;

        return {
            set(
                status,
                details = "",
                kind = "normal"
            ) {
                debugContext.status = status;
                debugContext.details = details;

                const statusElement =
                    container.querySelector(
                        "[data-role='status']"
                    );

                const detailsElement =
                    container.querySelector(
                        "[data-role='details']"
                    );

                statusElement.textContent =
                    status;

                detailsElement.textContent =
                    details;

                statusElement.style.fontWeight =
                    "600";

                if (kind === "success") {
                    statusElement.style.color =
                        "#198754";
                } else if (
                    kind === "warning"
                ) {
                    statusElement.style.color =
                        "#fd7e14";
                } else if (
                    kind === "error"
                ) {
                    statusElement.style.color =
                        "#dc3545";
                } else {
                    statusElement.style.color =
                        "#6c757d";
                }
            },

            setDebug(key, value) {
                debugContext[key] = value;
            },

            getDebugContext() {
                return {
                    ...debugContext,
                };
            },
        };
    }

    async function marketplaceFetch(
        url,
        options = {}
    ) {
        const response =
            await fetch(
                url,
                {
                    credentials: "include",
                    redirect: "follow",
                    ...options,
                }
            );

        if (!response.ok) {
            throw new Error(
                `Marketplace HTTP ${response.status}`
            );
        }

        return response;
    }

    async function marketplaceHtml(url) {
        const response =
            await marketplaceFetch(url);

        const html =
            await response.text();

        return {
            response,

            html,

            document:
                new DOMParser()
                    .parseFromString(
                        html,
                        "text/html"
                    ),
        };
    }

    function parseMarketplaceVersion(
        documentObject
    ) {
        const card =
            documentObject.querySelector(
                "section[aria-labelledby='versions-heading'] .card .card"
            );

        const heading =
            card?.querySelector("h2");

        if (!heading) {
            throw new Error(
                "Marketplace version not found."
            );
        }

        const text =
            heading.textContent.trim();

        const match =
            text.match(
                /^(.*?)\s*\((\d+)\)\s*$/
            );

        if (!match) {
            throw new Error(
                `Unable to parse Marketplace version: ${text}`
            );
        }

        return {
            release:
                match[1].trim(),

            build:
                Number(match[2]),
        };
    }

    async function getMarketplaceRepositoryUrl(
        pluginId
    ) {
        const support =
            await marketplaceHtml(
                `/plugins/${pluginId}/edit/support`
            );

        const input =
            support.document.querySelector(
                "#plugin_edit_support_form_sourceControlUrl"
            );

        if (!input) {
            throw new Error(
                "Repository URL field not found."
            );
        }

        const repositoryUrl =
            input.value.trim();

        if (!repositoryUrl) {
            throw new Error(
                "Repository URL is empty."
            );
        }

        return repositoryUrl;
    }

    function parseGitHubRepository(url) {
        const match =
            String(url)
                .trim()
                .match(
                    /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/?#]|$)/i
                );

        if (!match) {
            return null;
        }

        return {
            owner: match[1],
            repository: match[2],
            fullName:
                `${match[1]}/${match[2]}`,
        };
    }

    function apiInfoCacheKey(repository) {
        return (
            CONFIG.clientCachePrefix +
            String(repository)
                .trim()
                .toLowerCase()
        );
    }


    function pluginOkCacheKey(plugin) {
        return (
            CONFIG.pluginOkCachePrefix +
            plugin.id + ":" +
            String(plugin.component || "")
                .trim()
                .toLowerCase()
        );
    }

    function getPluginOkCache(plugin) {
        try {
            const key =
                pluginOkCacheKey(plugin);

            const raw =
                localStorage.getItem(key);

            if (!raw) {
                return null;
            }

            const entry = JSON.parse(raw);
            const checkedAt = Number(
                entry?.checkedAt
            );

            if (
                !Number.isFinite(checkedAt) ||
                Date.now() - checkedAt >=
                CONFIG.clientCacheTtlMs
            ) {
                localStorage.removeItem(key);

                return null;
            }

            return entry;
        } catch (error) {
            console.warn(
                "[Marketplace] Falha ao ler cache OK do plugin:",
                error
            );

            return null;
        }
    }

    function savePluginOkCache(
        plugin,
        details
    ) {
        try {
            localStorage.setItem(
                pluginOkCacheKey(plugin),
                JSON.stringify({
                    checkedAt: Date.now(),
                    ...details,
                })
            );
        } catch (error) {
            console.warn(
                "[Marketplace] Falha ao salvar cache OK do plugin:",
                error
            );
        }
    }

    function getCachedApiInfo(repository) {
        try {
            const raw = localStorage.getItem(
                apiInfoCacheKey(repository)
            );

            if (!raw) {
                return null;
            }

            const entry = JSON.parse(raw);
            const savedAt = Number(
                entry?.savedAt
            );

            if (
                !Number.isFinite(savedAt) ||
                !entry?.data ||
                typeof entry.data !== "object"
            ) {
                localStorage.removeItem(
                    apiInfoCacheKey(repository)
                );

                return null;
            }

            if (
                Date.now() - savedAt >=
                CONFIG.clientCacheTtlMs
            ) {
                localStorage.removeItem(
                    apiInfoCacheKey(repository)
                );

                return null;
            }

            return {
                ...entry.data,
                client_cached: true,
                client_cached_at:
                    new Date(savedAt)
                        .toISOString(),
            };
        } catch (error) {
            console.warn(
                "[Marketplace] Falha ao ler cache local:",
                error
            );

            return null;
        }
    }

    function saveApiInfoCache(
        repository,
        data
    ) {
        try {
            localStorage.setItem(
                apiInfoCacheKey(repository),
                JSON.stringify({
                    savedAt: (() => {
                        const fetchedAt = Date.parse(
                            data?.fetched_at || ""
                        );

                        return Number.isFinite(fetchedAt)
                            ? fetchedAt
                            : Date.now();
                    })(),
                    data,
                })
            );
        } catch (error) {
            console.warn(
                "[Marketplace] Falha ao salvar cache local:",
                error
            );
        }
    }

    async function apiInfo(
        repository,
        force = false
    ) {
        const cached =
            force
                ? null
                : getCachedApiInfo(
                    repository
                );

        if (cached !== null) {
            return cached;
        }

        const url =
            new URL(
                CONFIG.apiUrl
            );

        url.searchParams.set(
            "action",
            "info"
        );

        url.searchParams.set(
            "repo",
            repository
        );

        if (force) {
            url.searchParams.set(
                "force",
                "1"
            );
        }

        const response =
            await fetch(
                url.toString(),
                {
                    cache: "no-store",
                }
            );

        let data;

        try {
            data = await response.json();
        } catch (_) {
            throw new Error(
                `API returned invalid JSON (HTTP ${response.status})`
            );
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                `API HTTP ${response.status}`
            );
        }

        if (
            !data ||
            typeof data !== "object" ||
            !data.tag ||
            !data.repo
        ) {
            throw new Error(
                "API returned an incomplete repository response."
            );
        }

        /*
         * Somente respostas vÃ¡lidas/OK entram no localStorage.
         * Erros nunca sÃ£o cacheados no navegador.
         */
        saveApiInfoCache(
            repository,
            data
        );

        return data;
    }

    async function apiZip(
        repository,
        tag,
        component
    ) {
        const url =
            new URL(
                CONFIG.apiUrl
            );

        url.searchParams.set(
            "action",
            "zip"
        );

        url.searchParams.set(
            "repo",
            repository
        );

        url.searchParams.set(
            "tag",
            tag
        );

        const response =
            await fetch(
                url.toString(),
                {
                    cache: "no-store",
                }
            );

        if (!response.ok) {
            let message =
                `ZIP API HTTP ${response.status}`;

            try {
                const data =
                    await response.json();

                if (data.error) {
                    message =
                        data.error;
                }
            } catch (_) {
                // ZIP errors may not be JSON.
            }

            throw new Error(message);
        }

        const blob =
            await response.blob();

        const safeTag =
            String(tag)
                .replace(
                    /[^A-Za-z0-9._-]+/g,
                    "-"
                );

        return new File(
            [
                blob,
            ],
            `${component}-${safeTag}.zip`,
            {
                type: "application/zip",
            }
        );
    }


    async function apiSupport(
        repository
    ) {
        const url =
            new URL(
                CONFIG.apiUrl
            );

        url.searchParams.set(
            "action",
            "support"
        );

        url.searchParams.set(
            "repo",
            repository
        );

        const response =
            await fetch(
                url.toString(),
                {
                    cache: "no-store",
                }
            );

        let data;

        try {
            data =
                await response.json();
        } catch (_) {
            throw new Error(
                `Support API returned invalid JSON (HTTP ${response.status})`
            );
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                `Support API HTTP ${response.status}`
            );
        }

        if (
            !data ||
            typeof data !== "object" ||
            !data.repository_url ||
            !data.issues_url
        ) {
            throw new Error(
                "Support API returned an incomplete response."
            );
        }

        return data;
    }

    async function apiCatalog(
        component
    ) {
        const url =
            new URL(
                CONFIG.apiUrl
            );

        url.searchParams.set(
            "action",
            "catalog"
        );

        url.searchParams.set(
            "component",
            component
        );

        const response =
            await fetch(
                url.toString(),
                {
                    cache: "no-store",
                }
            );

        let data;

        try {
            data =
                await response.json();
        } catch (_) {
            throw new Error(
                `Catalog returned invalid JSON (HTTP ${response.status})`
            );
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                `Catalog HTTP ${response.status}`
            );
        }

        if (
            !data ||
            data.component !== component ||
            !data.description ||
            !data.iconUrl
        ) {
            throw new Error(
                `plugins.json entry is incomplete for ${component}.`
            );
        }

        return data;
    }

    async function apiCatalogIcon(
        component
    ) {
        const url =
            new URL(
                CONFIG.apiUrl
            );

        url.searchParams.set(
            "action",
            "catalog_icon"
        );

        url.searchParams.set(
            "component",
            component
        );

        const response =
            await fetch(
                url.toString(),
                {
                    cache: "no-store",
                }
            );

        if (!response.ok) {
            let message =
                `Catalog icon HTTP ${response.status}`;

            try {
                const data =
                    await response.json();

                if (data.error) {
                    message =
                        data.error;
                }
            } catch (_) {
                // Image errors may not be JSON.
            }

            throw new Error(
                message
            );
        }

        return response;
    }

    async function imageBlobToPngFile(
        blob,
        filename
    ) {
        const objectUrl =
            URL.createObjectURL(
                blob
            );

        try {
            const image =
                new Image();

            await new Promise(
                (resolve, reject) => {
                    image.onload =
                        () => resolve();

                    image.onerror =
                        () => reject(
                            new Error(
                                "Unable to decode catalog icon."
                            )
                        );

                    image.src =
                        objectUrl;
                }
            );

            const size =
                CONFIG.setupImageSize;

            const canvas =
                document.createElement(
                    "canvas"
                );

            canvas.width = size;
            canvas.height = size;

            const context =
                canvas.getContext("2d");

            if (!context) {
                throw new Error(
                    "Canvas 2D is unavailable."
                );
            }

            context.clearRect(
                0,
                0,
                size,
                size
            );

            const sourceWidth =
                image.naturalWidth ||
                size;

            const sourceHeight =
                image.naturalHeight ||
                size;

            const scale =
                Math.min(
                    size / sourceWidth,
                    size / sourceHeight
                );

            const width =
                sourceWidth * scale;

            const height =
                sourceHeight * scale;

            const x =
                (size - width) / 2;

            const y =
                (size - height) / 2;

            context.drawImage(
                image,
                x,
                y,
                width,
                height
            );

            const pngBlob =
                await new Promise(
                    (resolve, reject) => {
                        canvas.toBlob(
                            (result) => {
                                if (result) {
                                    resolve(
                                        result
                                    );
                                } else {
                                    reject(
                                        new Error(
                                            "Unable to rasterize catalog icon."
                                        )
                                    );
                                }
                            },
                            "image/png"
                        );
                    }
                );

            return new File(
                [
                    pngBlob,
                ],
                filename.replace(
                    /\.[^.]+$/,
                    ""
                ) + ".png",
                {
                    type: "image/png",
                }
            );
        } finally {
            URL.revokeObjectURL(
                objectUrl
            );
        }
    }

    async function getCatalogSetupImage(
        component,
        catalog
    ) {
        const response =
            await apiCatalogIcon(
                component
            );

        const blob =
            await response.blob();

        const contentType =
            String(
                blob.type ||
                response.headers.get(
                    "Content-Type"
                ) ||
                ""
            )
                .split(";")[0]
                .trim()
                .toLowerCase();

        const filename =
            response.headers.get(
                "X-Asset-Filename"
            ) ||
            String(
                catalog.iconUrl
            )
                .split("/")
                .pop() ||
            `${component}.png`;

        /*
         * Sempre normaliza a imagem pelo canvas. Antes, PNG/JPEG/WebP/GIF
         * eram enviados no tamanho original, apesar de setupImageSize existir.
         * Isso deixa ícones grandes sujeitos aos limites do FilePond/Marketplace.
         */
        const file =
            await imageBlobToPngFile(
                blob,
                filename
            );

        return {
            file,
            path:
                catalog.iconUrl,
            converted:
                contentType !== "image/png" ||
                file.name !== filename ||
                file.size !== blob.size,
            originalSize:
                blob.size,
            normalizedSize:
                file.size,
        };
    }

    async function waitForCondition(
        callback,
        description,
        timeout =
            CONFIG.setupPageTimeoutMs
    ) {
        const started =
            Date.now();

        while (
            Date.now() - started <
            timeout
        ) {
            const value =
                callback();

            if (value) {
                return value;
            }

            await sleep(100);
        }

        throw new Error(
            `Timeout waiting for ${description}.`
        );
    }

    function waitForIframeLoad(
        iframe,
        description
    ) {
        return new Promise(
            (resolve, reject) => {
                const timer =
                    setTimeout(
                        () => {
                            cleanup();

                            reject(
                                new Error(
                                    `Timeout loading ${description}.`
                                )
                            );
                        },
                        CONFIG.setupPageTimeoutMs
                    );

                const onLoad =
                    () => {
                        cleanup();
                        resolve();
                    };

                function cleanup() {
                    clearTimeout(
                        timer
                    );

                    iframe.removeEventListener(
                        "load",
                        onLoad
                    );
                }

                iframe.addEventListener(
                    "load",
                    onLoad
                );
            }
        );
    }

    async function createSetupIframe(
        url
    ) {
        const iframe =
            document.createElement(
                "iframe"
            );

        iframe.setAttribute(
            "aria-hidden",
            "true"
        );

        iframe.style.cssText = [
            "position:fixed",
            "left:-10000px",
            "top:-10000px",
            "width:1024px",
            "height:768px",
            "opacity:0",
            "pointer-events:none",
            "border:0",
        ].join(";");

        const loaded =
            waitForIframeLoad(
                iframe,
                url
            );

        iframe.src =
            url;

        document.body.appendChild(
            iframe
        );

        await loaded;

        return iframe;
    }

    function setFormValue(
        element,
        value
    ) {
        element.value =
            value;

        const EventClass =
            element.ownerDocument
                ?.defaultView
                ?.Event ||
            Event;

        element.dispatchEvent(
            new EventClass(
                "input",
                {
                    bubbles: true,
                }
            )
        );

        element.dispatchEvent(
            new EventClass(
                "change",
                {
                    bubbles: true,
                }
            )
        );
    }

    async function setFilePondFile(
        iframe,
        rootId,
        hiddenName,
        file
    ) {
        const frameWindow =
            iframe.contentWindow;

        const frameDocument =
            iframe.contentDocument;

        if (
            !frameWindow ||
            !frameDocument
        ) {
            throw new Error(
                "Marketplace setup iframe is unavailable."
            );
        }

        const root =
            await waitForCondition(
                () =>
                    frameDocument.getElementById(
                        rootId
                    ),
                rootId
            );

        const browser =
            await waitForCondition(
                () =>
                    root.querySelector(
                        "input.filepond--browser[type='file']"
                    ),
                `${rootId} file input`
            );

        const hiddenInputs = () => [
            ...root.querySelectorAll(
                "input[type='hidden']"
            ),
        ];

        const oldHiddenValues =
            new Map(
                hiddenInputs().map(
                    (input) => [
                        input.name,
                        input.value,
                    ]
                )
            );

        /*
         * File/DataTransfer precisam pertencer ao mesmo realm do iframe.
         */
        const FrameFile =
            frameWindow.File ||
            File;

        const frameFile =
            new FrameFile(
                [
                    file,
                ],
                file.name,
                {
                    type:
                        file.type ||
                        "application/octet-stream",
                    lastModified:
                        file.lastModified ||
                        Date.now(),
                }
            );

        /*
         * Quando FilePond está exposto no iframe, usamos a API dele.
         * Simular apenas um "change" no input funciona em algumas versões,
         * mas não é a API pública e pode não iniciar load/processamento.
         */
        const FilePondApi =
            frameWindow.FilePond;

        let pond = null;
        let addedItem = null;
        let processWithServer = false;

        if (
            FilePondApi &&
            typeof FilePondApi.find ===
                "function"
        ) {
            const candidates = [
                browser,
                root,
                ...root.querySelectorAll(
                    "input[type='file']"
                ),
            ];

            for (const candidate of candidates) {
                try {
                    pond =
                        FilePondApi.find(
                            candidate
                        );

                    if (pond) {
                        break;
                    }
                } catch (_) {
                    // Tenta o próximo elemento.
                }
            }
        }

        if (
            pond &&
            typeof pond.addFile ===
                "function"
        ) {
            try {
                addedItem =
                    await pond.addFile(
                        frameFile
                    );

                const options =
                    typeof pond.getOptions ===
                    "function"
                        ? pond.getOptions()
                        : {};

                const storeAsFile =
                    options?.storeAsFile ===
                    true;

                const serverProcess =
                    options?.server &&
                    options.server.process;

                processWithServer =
                    Boolean(
                        serverProcess
                    ) &&
                    !storeAsFile &&
                    options?.allowProcess !==
                        false;

                /*
                 * Se existe endpoint de processamento, terminamos o envio
                 * agora em vez de depender do instantUpload da página.
                 */
                if (
                    processWithServer &&
                    typeof pond.processFile ===
                        "function"
                ) {
                    addedItem =
                        await pond.processFile(
                            addedItem?.id ||
                            addedItem
                        );
                }
            } catch (error) {
                throw new Error(
                    `FilePond API failed for ${rootId}: ${marketplaceErrorMessage(error)}`
                );
            }
        } else {
            /*
             * Fallback para páginas em que FilePond não está exposto
             * globalmente, mas o input gerado continua ouvindo change.
             */
            const DataTransferClass =
                frameWindow.DataTransfer ||
                DataTransfer;

            const transfer =
                new DataTransferClass();

            transfer.items.add(
                frameFile
            );

            browser.files =
                transfer.files;

            browser.dispatchEvent(
                new frameWindow.Event(
                    "change",
                    {
                        bubbles: true,
                    }
                )
            );
        }

        await waitForCondition(
            () => {
                const item =
                    root.querySelector(
                        "[data-filepond-item-state]"
                    );

                const state =
                    item?.getAttribute(
                        "data-filepond-item-state"
                    ) || "";

                if (
                    [
                        "load-error",
                        "processing-error",
                        "processing-revert-error",
                        "error",
                    ].includes(
                        state
                    )
                ) {
                    const statusText =
                        item.querySelector(
                            ".filepond--file-status-sub"
                        )?.textContent?.trim() ||
                        item.textContent?.trim() ||
                        state;

                    throw new Error(
                        `FilePond failed for ${rootId}: ${statusText}`
                    );
                }

                const exactValues = [
                    ...root.querySelectorAll(
                        `input[type='hidden'][name="${hiddenName}"]`
                    ),
                ]
                    .map(
                        (input) =>
                            input.value
                    )
                    .filter(Boolean);

                const exactChanged =
                    exactValues.some(
                        (value) =>
                            ![
                                ...oldHiddenValues.values(),
                            ].includes(
                                value
                            )
                    );

                if (exactChanged) {
                    return true;
                }

                const genericChanged =
                    hiddenInputs().some(
                        (input) =>
                            Boolean(input.value) &&
                            (
                                !oldHiddenValues.has(
                                    input.name
                                ) ||
                                oldHiddenValues.get(
                                    input.name
                                ) !== input.value
                            )
                    );

                if (genericChanged) {
                    return true;
                }

                if (
                    state ===
                    "processing-complete"
                ) {
                    return true;
                }

                /*
                 * "idle" significa que o arquivo já foi carregado no pond.
                 * Em storeAsFile / formulário tradicional não haverá
                 * processing-complete nem token hidden novo.
                 */
                if (
                    state === "idle" &&
                    !processWithServer
                ) {
                    return true;
                }

                /*
                 * A chamada addFile/processFile resolveu e o FilePond não
                 * expôs estado DOM. Nesse caso a própria API é a confirmação.
                 */
                if (
                    addedItem &&
                    !processWithServer &&
                    !state
                ) {
                    return true;
                }

                return false;
            },
            `${rootId} file ready`
        );
    }

    function getOverviewErrors(
        documentObject
    ) {
        const messages = [
            ...documentObject.querySelectorAll(
                [
                    ".alert-danger",
                    ".alert-error",
                    ".form-error-message",
                    ".is-invalid + .invalid-feedback",
                    "[aria-invalid='true'] + .invalid-feedback",
                ].join(",")
            ),
        ]
            .map(
                (element) =>
                    element.textContent.trim()
            )
            .filter(Boolean);

        return [
            ...new Set(
                messages
            ),
        ];
    }

    async function submitMarketplaceOverview(
        plugin,
        catalog,
        setupImage
    ) {
        const overviewUrl =
            `/plugins/${plugin.id}/edit/overview`;

        const iframe =
            await createSetupIframe(
                overviewUrl
            );

        try {
            const frameDocument =
                iframe.contentDocument;

            if (!frameDocument) {
                throw new Error(
                    "Marketplace overview document is unavailable."
                );
            }

            const form =
                await waitForCondition(
                    () =>
                        frameDocument.querySelector(
                            "form[name='plugin_edit_overview_form']"
                        ),
                    "overview form"
                );

            const nameInput =
                form.querySelector(
                    "#plugin_edit_overview_form_name"
                );

            const descriptionInput =
                form.querySelector(
                    "#plugin_edit_overview_form_shortDescription"
                );

            if (
                !nameInput ||
                !descriptionInput
            ) {
                throw new Error(
                    "Overview name/description fields were not found."
                );
            }

            const name =
                String(
                    catalog.name ||
                    nameInput.value ||
                    plugin.component
                )
                    .trim()
                    .slice(0, 60);

            const shortDescription =
                String(
                    catalog.description ||
                    ""
                )
                    .trim()
                    .slice(0, 256);

            if (!name) {
                throw new Error(
                    "Plugin name is empty."
                );
            }

            if (!shortDescription) {
                throw new Error(
                    "Short description is empty."
                );
            }

            setFormValue(
                nameInput,
                name
            );

            setFormValue(
                descriptionInput,
                shortDescription
            );

            await setFilePondFile(
                iframe,
                "plugin_edit_overview_form_icon",
                "plugin_edit_overview_form[icon]",
                setupImage.file
            );

            await setFilePondFile(
                iframe,
                "plugin_edit_overview_form_screenshots",
                "plugin_edit_overview_form[screenshots][]",
                setupImage.file
            );

            const submit =
                form.querySelector(
                    "button[type='submit'][name='save_and_next']"
                );

            if (!submit) {
                throw new Error(
                    "Save and next button was not found."
                );
            }

            const submitted =
                waitForIframeLoad(
                    iframe,
                    "overview submit"
                );

            submit.click();

            await submitted;

            const resultDocument =
                iframe.contentDocument;

            const resultWindow =
                iframe.contentWindow;

            if (
                !resultDocument ||
                !resultWindow
            ) {
                throw new Error(
                    "Marketplace overview result is unavailable."
                );
            }

            const path =
                resultWindow.location.pathname;

            if (
                path === overviewUrl ||
                path.endsWith(
                    `/plugins/${plugin.id}/edit/overview`
                )
            ) {
                const errors =
                    getOverviewErrors(
                        resultDocument
                    );

                throw new Error(
                    errors.length
                        ? "Overview: " +
                            errors.join(" | ")
                        : "Overview form remained on the same page after submit."
                );
            }

            return {
                url:
                    resultWindow.location.href,
                name,
                shortDescription,
                imagePath:
                    setupImage.path,
            };
        } finally {
            iframe.remove();
        }
    }


    async function submitMarketplaceSupport(
        plugin,
        repository,
        supportInfo
    ) {
        const supportUrl =
            `/plugins/${plugin.id}/edit/support`;

        const support =
            await marketplaceHtml(
                supportUrl
            );

        const form =
            support.document.querySelector(
                "form[name='plugin_edit_support_form']"
            );

        if (!form) {
            throw new Error(
                "Support form was not found."
            );
        }

        const repositoryInput =
            form.querySelector(
                "#plugin_edit_support_form_sourceControlUrl"
            );

        const issueInput =
            form.querySelector(
                "#plugin_edit_support_form_bugTrackerUrl"
            );

        const documentationInput =
            form.querySelector(
                "#plugin_edit_support_form_documentationUrl"
            );

        const websiteInput =
            form.querySelector(
                "#plugin_edit_support_form_websiteUrl"
            );

        if (
            !repositoryInput ||
            !issueInput ||
            !documentationInput ||
            !websiteInput
        ) {
            throw new Error(
                "One or more support fields were not found."
            );
        }

        const expectedRepository =
            String(
                supportInfo.repository_url ||
                `https://github.com/${repository.fullName}`
            ).trim();

        const expectedIssue =
            String(
                supportInfo.issues_url ||
                `${expectedRepository}/issues`
            ).trim();

        const expectedDocumentation =
            supportInfo.docs_exists &&
            supportInfo.has_pages
                ? String(
                    supportInfo.documentation_url ||
                    supportInfo.pages_url ||
                    ""
                ).trim()
                : "";

        const expectedWebsite =
            `https://eduardokraus.com/marketplace-plugins/plugin/${plugin.component}`;

        setFormValue(
            repositoryInput,
            expectedRepository
        );

        setFormValue(
            issueInput,
            expectedIssue
        );

        setFormValue(
            documentationInput,
            expectedDocumentation
        );

        setFormValue(
            websiteInput,
            expectedWebsite
        );

        const submit =
            form.querySelector(
                "button[type='submit'][name='save_and_next']"
            );

        if (!submit) {
            throw new Error(
                "Support Save and next button was not found."
            );
        }

        const formData =
            formToFormData(
                form
            );

        formData.append(
            submit.name,
            submit.value || ""
        );

        const action =
            form.getAttribute(
                "action"
            );

        const postUrl =
            action
                ? new URL(
                    action,
                    location.origin
                ).toString()
                : new URL(
                    supportUrl,
                    location.origin
                ).toString();

        const response =
            await marketplaceFetch(
                postUrl,
                {
                    method: "POST",
                    body: formData,
                }
            );

        const html =
            await response.text();

        const resultDocument =
            new DOMParser()
                .parseFromString(
                    html,
                    "text/html"
                );

        const errors =
            getOverviewErrors(
                resultDocument
            );

        if (errors.length) {
            throw new Error(
                "Support: " +
                errors.join(" | ")
            );
        }

        const resultUrl =
            new URL(
                response.url,
                location.origin
            );

        if (
            resultUrl.pathname === supportUrl ||
            resultUrl.pathname.endsWith(
                `/plugins/${plugin.id}/edit/support`
            )
        ) {
            throw new Error(
                "Support form remained on the same page after submit."
            );
        }

        return {
            url:
                response.url,

            repositoryUrl:
                expectedRepository,

            issueUrl:
                expectedIssue,

            documentationUrl:
                expectedDocumentation,

            websiteUrl:
                expectedWebsite,

            docsExists:
                Boolean(
                    supportInfo.docs_exists
                ),

            hasPages:
                Boolean(
                    supportInfo.has_pages
                ),
        };
    }

    async function setupMarketplacePlugin(
        plugin,
        status
    ) {
        status.set(
            "Lendo plugins.json...",
            plugin.component
        );

        const catalog =
            await apiCatalog(
                plugin.component
            );

        const repository =
            parseGitHubRepository(
                catalog.repository_url
            );

        if (!repository) {
            throw new Error(
                `Repository URL from plugins.json is invalid: ${catalog.repository_url || "(empty)"}`
            );
        }

        status.setDebug(
            "repository",
            repository.fullName
        );

        status.setDebug(
            "repositoryInfo",
            {
                source:
                    "plugins.json",
                ...catalog,
            }
        );

        status.set(
            "Consultando suporte no GitHub...",
            repository.fullName
        );

        const supportInfo =
            await apiSupport(
                repository.fullName
            );

        status.set(
            "Preparando ícone e screenshot...",
            catalog.iconUrl
        );

        /*
         * A mesma imagem definida por iconUrl no plugins.json é enviada
         * para os campos Icon e Screenshots da página Overview.
         */
        const setupImage =
            await getCatalogSetupImage(
                plugin.component,
                catalog
            );

        status.set(
            "Preenchendo Overview...",
            `${catalog.name || plugin.component} · ${catalog.description.slice(0, 80)} · ${catalog.iconUrl}`
        );

        const overviewResult =
            await submitMarketplaceOverview(
                plugin,
                catalog,
                setupImage
            );

        status.set(
            "Página 1 configurada",
            `${overviewResult.name} · description do plugins.json · ${setupImage.converted ? "ícone convertido para PNG" : "arquivo original usado como ícone e screenshot"} · Save and next`,
            "success"
        );

        status.set(
            "Preenchendo Support...",
            `${supportInfo.repository_url} · issues · ${supportInfo.docs_exists && supportInfo.has_pages ? "GitHub Pages" : "sem Documentation"}`
        );

        const supportResult =
            await submitMarketplaceSupport(
                plugin,
                repository,
                supportInfo
            );

        status.set(
            "Página 2 configurada",
            `${supportResult.repositoryUrl} · ${supportResult.issueUrl} · Documentation: ${supportResult.documentationUrl || "vazia"} · ${supportResult.websiteUrl} · Save and next`,
            "success"
        );

        return {
            state: "setup",
            result: {
                overview:
                    overviewResult,

                support:
                    supportResult,
            },
        };
    }

    function isRemoteNewer(
        marketplace,
        repositoryInfo
    ) {
        if (
            Number.isFinite(repositoryInfo.build) &&
            Number.isFinite(
                marketplace.build
            )
        ) {
            return (
                repositoryInfo.build >
                marketplace.build
            );
        }

        return (
            compareVersions(
                repositoryInfo.release ||
                repositoryInfo.tag,
                marketplace.release
            ) > 0
        );
    }

    async function uploadMarketplaceVersion(
        pluginId,
        file,
        repositoryInfo
    ) {
        /*
         * STEP 1
         *
         * Primeiro carrega a pÃ¡gina para obter
         * um CSRF token novo.
         */
        const step1Url =
            `/plugins/${pluginId}/versions/add/step1`;

        const step1 =
            await marketplaceHtml(
                step1Url
            );

        const tokenInput =
            step1.document.querySelector(
                "input[name='plugin_submission_file_form[_token]']"
            );

        if (!tokenInput?.value) {
            throw new Error(
                "CSRF token not found on step1."
            );
        }

        const form =
            tokenInput.closest("form");

        const formData =
            new FormData();

        formData.append(
            "plugin_submission_file_form[file]",
            file,
            file.name
        );

        formData.append(
            "plugin_submission_file_form[_token]",
            tokenInput.value
        );

        const action =
            form?.getAttribute("action");

        const step1PostUrl =
            action
                ? new URL(
                    action,
                    location.origin
                ).toString()
                : new URL(
                    step1Url,
                    location.origin
                ).toString();

        const uploadResponse =
            await marketplaceFetch(
                step1PostUrl,
                {
                    method: "POST",
                    body: formData,
                }
            );

        const uploadHtml =
            await uploadResponse.text();

        const uploadDocument =
            new DOMParser()
                .parseFromString(
                    uploadHtml,
                    "text/html"
                );

        const step1Errors = [
            ...uploadDocument.querySelectorAll(
                [
                    ".invalid-feedback",
                    ".form-error-message",
                    ".alert-danger",
                    ".alert-error",
                ].join(",")
            ),
        ]
            .map(
                (element) =>
                    element.textContent.trim()
            )
            .filter(Boolean);

        if (step1Errors.length) {
            throw new Error(
                "Step1: " +
                step1Errors.join(" | ")
            );
        }

        /*
         * STEP 2
         *
         * O upload do ZIP deixa os dados preparados
         * na sessÃ£o do Marketplace.
         *
         * Agora carregamos explicitamente o step2
         * e submetemos o formulÃ¡rio existente.
         */
        const step2 =
            await submitMarketplaceStep2(
                pluginId,
                repositoryInfo
            );

        return {
            url: step2.url,
            document: step2.document,
            html: step2.html,
        };
    }

    async function inspectPlugin(
        plugin,
        status
    ) {
        if (plugin.needsSetup) {
            return setupMarketplacePlugin(
                plugin,
                status
            );
        }

        const cachedOk =
            plugin.needsChanges
                ? null
                : getPluginOkCache(plugin);

        if (cachedOk !== null) {
            const checkedAt =
                new Date(cachedOk.checkedAt);

            status.set(
                "OK (cache local)",
                `${cachedOk.release || "versÃ£o jÃ¡ conferida"} Â· ` +
                `verificado ${checkedAt.toLocaleString()}`,
                "success"
            );

            return {
                state: "current",
                clientCached: true,
            };
        }

        status.set(
            plugin.needsChanges
                ? "Changes needed · verificando Marketplace..."
                : "Verificando Marketplace..."
        );

        const versions =
            await marketplaceHtml(
                `/plugins/${plugin.id}/edit/versions`
            );

        const marketplace =
            parseMarketplaceVersion(
                versions.document
            );

        status.setDebug(
            "marketplace",
            marketplace
        );

        status.set(
            "Buscando repositÃ³rio...",
            `${marketplace.release} (${marketplace.build})`
        );

        let repositoryUrl;

        if (plugin.needsChanges) {
            const catalog =
                await apiCatalog(
                    plugin.component
                );

            repositoryUrl =
                catalog.repository_url;
        } else {
            repositoryUrl =
                await getMarketplaceRepositoryUrl(
                    plugin.id
                );
        }

        const repository =
            parseGitHubRepository(
                repositoryUrl
            );

        if (repository) {
            status.setDebug(
                "repository",
                repository.fullName
            );
        }

        if (!repository) {
            status.set(
                "Ignorado",
                `RepositÃ³rio invÃ¡lido: ${repositoryUrl}`,
                "warning"
            );

            return {
                state: "skipped",
            };
        }

        status.set(
            "Consultando GitHub...",
            repository.fullName
        );

        /*
         * Daqui para frente o navegador
         * nÃ£o acessa mais github.com.
         */
        const repositoryInfo =
            await apiInfo(
                repository.fullName,
                plugin.needsChanges
            );

        status.setDebug(
            "repositoryInfo",
            repositoryInfo
        );

        if (repositoryInfo.client_cached) {
            status.set(
                "GitHub em cache local",
                `${repository.fullName} Â· vÃ¡lido por 24h`
            );
        }

        const remoteRelease =
            repositoryInfo.release ||
            repositoryInfo.tag;

        const remoteBuild =
            repositoryInfo.build ?? "?";

        if (
            !isRemoteNewer(
                marketplace,
                repositoryInfo
            )
        ) {
            status.set(
                plugin.needsChanges
                    ? "Changes needed · sem nova versão"
                    : "Atualizado",
                `Marketplace ${marketplace.release} (${marketplace.build}) Â· ` +
                `GitHub ${remoteRelease} (${remoteBuild})`,
                plugin.needsChanges
                    ? "warning"
                    : "success"
            );

            savePluginOkCache(
                plugin,
                {
                    release: remoteRelease,
                    build: remoteBuild,
                    repository: repository.fullName,
                }
            );

            return {
                state: "current",
            };
        }

        status.set(
            plugin.needsChanges
                ? "Changes needed · nova versão encontrada"
                : "Nova versÃ£o",
            `Marketplace ${marketplace.release} (${marketplace.build}) â†’ ` +
            `GitHub ${remoteRelease} (${remoteBuild})`,
            "warning"
        );

        if (!CONFIG.autoUpload) {
            return {
                state: "outdated",
            };
        }

        status.set(
            "Baixando ZIP...",
            `${repository.fullName} @ ${repositoryInfo.tag}`
        );

        /*
         * O navegador baixa atravÃ©s do seu PHP.
         * O PHP transmite o ZIP sem cacheÃ¡-lo.
         */
        const zip =
            await apiZip(
                repository.fullName,
                repositoryInfo.tag,
                plugin.component
            );

        status.set(
            plugin.needsChanges
                ? "Enviando correção ao Marketplace..."
                : "Publicando no Marketplace...",
            `${zip.name} Â· /plugins/${plugin.id}/versions/add/step1 + step2`
        );

        const result =
            await uploadMarketplaceVersion(
                plugin.id,
                zip,
                repositoryInfo
            );

        status.set(
            "Nova versÃ£o enviada",
            `${remoteRelease} (${remoteBuild})`,
            "success"
        );

        status.set(
            "ZIP enviado",
            `${remoteRelease} (${remoteBuild})`,
            "success"
        );

        savePluginOkCache(
            plugin,
            {
                release: remoteRelease,
                build: remoteBuild,
                repository: repository.fullName,
            }
        );

        return {
            state: "uploaded",
            result,
        };
    }

    async function worker(
        queue,
        counters
    ) {
        while (queue.length) {
            const item =
                queue.shift();

            if (!item) {
                return;
            }

            try {
                const result =
                    await inspectPlugin(
                        item.plugin,
                        item.status
                    );

                if (
                    result.state ===
                    "uploaded"
                ) {
                    counters.uploaded++;
                }

                if (
                    result.state ===
                    "setup"
                ) {
                    counters.setup++;
                }

                if (
                    result.state ===
                    "current"
                ) {
                    counters.current++;
                }

                if (
                    result.state ===
                    "outdated"
                ) {
                    counters.outdated++;
                }

                if (
                    result.state ===
                    "skipped"
                ) {
                    counters.skipped++;
                }
            } catch (error) {
                counters.errors++;

                logMarketplaceError(
                    error,
                    {
                        plugin: item.plugin,
                        debug: item.status.getDebugContext(),
                    }
                );

                item.status.set(
                    "Erro",
                    marketplaceErrorMessage(error),
                    "error"
                );
            }

            counters.done++;

            console.log(
                `[Marketplace] ${counters.done}/${counters.total}` +
                ` | enviados=${counters.uploaded}` +
                ` | configurados=${counters.setup}` +
                ` | atuais=${counters.current}` +
                ` | ignorados=${counters.skipped}` +
                ` | erros=${counters.errors}`
            );

            await sleep(
                CONFIG.delayBetweenPluginsMs
            );
        }
    }

    async function main() {
        if (
            window.top !==
            window.self
        ) {
            return;
        }

        const plugins =
            getDashboardPlugins();

        if (!plugins.length) {
            console.log(
                "[Marketplace] Nenhum plugin Published, aguardando setup ou com Changes needed encontrado."
            );

            return;
        }

        console.log(
            `[Marketplace] ${plugins.length} plugins processáveis encontrados.`
        );

        const counters = {
            total:
            plugins.length,

            done: 0,

            uploaded: 0,

            setup: 0,

            current: 0,

            outdated: 0,

            skipped: 0,

            errors: 0,
        };

        const queue =
            plugins.map(
                (plugin) => ({
                    plugin,

                    status:
                        addStatusRow(
                            plugin
                        ),
                })
            );

        const workers = [];

        const concurrency =
            Math.max(
                1,
                Math.min(
                    CONFIG.concurrency,
                    plugins.length
                )
            );

        for (
            let i = 0;
            i < concurrency;
            i++
        ) {
            workers.push(
                worker(
                    queue,
                    counters
                )
            );
        }

        await Promise.all(
            workers
        );

        console.log(
            "[Marketplace] Finalizado",
            counters
        );
    }

    function formToFormData(form) {
        const formData = new FormData();

        for (const element of form.elements) {
            if (!element.name || element.disabled) {
                continue;
            }

            if (
                (element.type === "checkbox" ||
                    element.type === "radio") &&
                !element.checked
            ) {
                continue;
            }

            if (
                element.type === "submit" ||
                element.type === "button" ||
                element.type === "reset" ||
                element.type === "file"
            ) {
                continue;
            }

            if (element.tagName === "SELECT" && element.multiple) {
                for (const option of element.selectedOptions) {
                    formData.append(
                        element.name,
                        option.value
                    );
                }

                continue;
            }

            formData.append(
                element.name,
                element.value
            );
        }

        return formData;
    }

    async function submitMarketplaceStep2(
        pluginId,
        repositoryInfo
    ) {
        if (!repositoryInfo || typeof repositoryInfo !== "object") {
            throw new Error(
                "Remote repository information is missing on step2."
            );
        }

        const step2Url =
            `/plugins/${pluginId}/versions/add/step2`;

        const step2 =
            await marketplaceHtml(
                step2Url
            );

        const form =
            step2.document.querySelector(
                "form"
            );

        if (!form) {
            throw new Error(
                "Step2 form not found."
            );
        }

        const supportedVersions =
            selectSupportedMoodleVersions(
                form,
                repositoryInfo
            );

        console.log(
            `[Marketplace] Moodle supported: ` +
            supportedVersions.join(", ")
        );

        /*
         * NÃ£o envia silenciosamente um formulÃ¡rio
         * se algum campo obrigatÃ³rio estiver vazio.
         */
        const emptyRequired = [
            ...form.querySelectorAll(
                "input[required], select[required], textarea[required]"
            ),
        ].filter((element) => {
            if (
                element.type === "checkbox" ||
                element.type === "radio"
            ) {
                return false;
            }

            return !String(
                element.value || ""
            ).trim();
        });

        if (emptyRequired.length) {
            const names = emptyRequired.map(
                (element) =>
                    element.name ||
                    element.id ||
                    "unknown"
            );

            throw new Error(
                "Step2 contains empty required fields: " +
                names.join(", ")
            );
        }

        const formData =
            formToFormData(form);

        const action =
            form.getAttribute("action");

        const postUrl =
            action
                ? new URL(
                    action,
                    location.origin
                ).toString()
                : new URL(
                    step2Url,
                    location.origin
                ).toString();

        const response =
            await marketplaceFetch(
                postUrl,
                {
                    method: "POST",
                    body: formData,
                }
            );

        const html =
            await response.text();

        const resultDocument =
            new DOMParser()
                .parseFromString(
                    html,
                    "text/html"
                );

        const errors = [
            ...resultDocument.querySelectorAll(
                [
                    ".invalid-feedback",
                    ".form-error-message",
                    ".alert-danger",
                    ".alert-error",
                ].join(",")
            ),
        ]
            .map(
                (element) =>
                    element.textContent.trim()
            )
            .filter(Boolean);

        if (errors.length) {
            throw new Error(
                "Step2: " +
                errors.join(" | ")
            );
        }

        return {
            url: response.url,
            document: resultDocument,
            html,
        };
    }

    function moodleVersionToBranch(version) {
        const parts = String(version)
            .trim()
            .split(".");

        if (parts.length !== 2) {
            return null;
        }

        const major = Number(parts[0]);
        const minor = Number(parts[1]);

        if (!Number.isInteger(major) || !Number.isInteger(minor)) {
            return null;
        }

        /*
         * Moodle branch:
         *
         * 5.2  -> 502
         * 5.1  -> 501
         * 5.0  -> 500
         * 4.5  -> 405
         * 4.0  -> 400
         * 3.11 -> 311
         */
        return major * 100 + minor;
    }

    function selectSupportedMoodleVersions(
        form,
        repositoryInfo
    ) {
        const select =
            form.querySelector(
                "#plugin_version_file_form_moodleVersions"
            );

        if (!select) {
            throw new Error(
                "Moodle versions field not found on step2."
            );
        }

        let minimum =
            repositoryInfo.supported_min ??
            repositoryInfo.requires_branch ??
            null;

        let maximum =
            repositoryInfo.supported_max ??
            null;

        const incompatible =
            repositoryInfo.incompatible ??
            null;

        if (minimum === null) {
            throw new Error(
                "Unable to determine minimum supported Moodle version."
            );
        }

        /*
         * Limpa o default estranho do Marketplace,
         * por exemplo Moodle 1.9 selecionado.
         */
        for (const option of select.options) {
            option.selected = false;
        }

        let selected = 0;

        for (const option of select.options) {
            const branch =
                moodleVersionToBranch(
                    option.textContent
                );

            if (branch === null) {
                continue;
            }

            if (branch < minimum) {
                continue;
            }

            if (
                maximum !== null &&
                branch > maximum
            ) {
                continue;
            }

            /*
             * $plugin->incompatible Ã© a primeira
             * branch incompatÃ­vel.
             */
            if (
                incompatible !== null &&
                branch >= incompatible
            ) {
                continue;
            }

            option.selected = true;
            selected++;
        }

        if (!selected) {
            throw new Error(
                `No Moodle versions matched: ` +
                `min=${minimum}, max=${maximum ?? "*"}`
            );
        }

        return [
            ...select.selectedOptions,
        ].map(
            (option) =>
                option.textContent.trim()
        );
    }

    main().catch(
        (error) => {
            console.error(
                "[Marketplace]",
                error
            );
        }
    );
})();
