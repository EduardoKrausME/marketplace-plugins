(() => {
    "use strict";

    const CONFIG = {
        apiUrl: "https://eduardokraus.com/marketplace-plugins/new-version/api.php",
        githubOwner: "EduardoKrausME",
        setupPageTimeoutMs: 45000,
        filePondOperationTimeoutMs: 30000,
        reviewPostTimeoutMs: 90000,
        autoUpload: true,
        concurrency: 2,
        delayBetweenPluginsMs: 500,
    };

    const SCRIPT_BUILD =
        "2026-10-08.03-filepond-removal";

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

    // The FilePond API can leave addFile/processFile/removeFile promises pending forever.
    async function awaitWithTimeout(promise, description, timeoutMs = CONFIG.filePondOperationTimeoutMs) {
        let timer;
        try {
            return await Promise.race([
                Promise.resolve(promise),
                new Promise((_, reject) => {
                    timer = setTimeout(
                        () => reject(new Error(`Timeout after ${Math.round(timeoutMs / 1000)}s: ${description}`)),
                        timeoutMs
                    );
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    const openedStep2Urls =
        new Set();

    function getOpenedStep2Urls() {
        return new Set(
            openedStep2Urls
        );
    }

    function rememberOpenedStep2Url(url) {
        openedStep2Urls.add(
            String(url)
        );
    }

    function ensureStep2PopupStyles() {
        if (
            document.getElementById(
                "marketplace-step2-popup-styles"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "marketplace-step2-popup-styles";

        style.textContent = `
            #marketplace-step2-popup
            a.marketplace-step2-link:visited {
                color: #6c757d !important;
            }

            #marketplace-step2-popup
            .marketplace-step2-row.is-opened {
                background: #f1f3f5 !important;
                border-color: #adb5bd !important;
                opacity: .72 !important;
            }

            #marketplace-step2-popup
            .marketplace-step2-row.is-opened
            a.marketplace-step2-link {
                color: #6c757d !important;
                text-decoration: line-through !important;
            }

            #marketplace-step2-popup
            .marketplace-step2-row.is-opened::after {
                content: "ABERTO";
                display: inline-block;
                margin-top: 8px;
                padding: 2px 7px;
                border-radius: 999px;
                background: #6c757d;
                color: #fff;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: .04em;
            }
        `;

        document.head.appendChild(
            style
        );
    }

    function showStep2Popup(links) {
        if (!Array.isArray(links) || !links.length) {
            return;
        }

        ensureStep2PopupStyles();

        let overlay =
            document.getElementById(
                "marketplace-step2-popup"
            );

        if (!overlay) {
            overlay =
                document.createElement("div");

            overlay.id =
                "marketplace-step2-popup";

            overlay.style.cssText = [
                "position:fixed",
                "inset:0",
                "z-index:2147483647",
                "background:rgba(0,0,0,.55)",
                "display:flex",
                "align-items:center",
                "justify-content:center",
                "padding:24px",
            ].join(";");

            const dialog =
                document.createElement("div");

            dialog.style.cssText = [
                "width:min(900px,100%)",
                "max-height:85vh",
                "overflow:auto",
                "background:#fff",
                "color:#212529",
                "border-radius:10px",
                "box-shadow:0 20px 60px rgba(0,0,0,.35)",
                "padding:24px",
                "font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            ].join(";");

            const header =
                document.createElement("div");

            header.style.cssText = [
                "display:flex",
                "align-items:flex-start",
                "justify-content:space-between",
                "gap:16px",
                "margin-bottom:18px",
            ].join(";");

            const heading =
                document.createElement("div");

            const title =
                document.createElement("h2");

            title.dataset.role =
                "step2-title";

            title.style.cssText =
                "margin:0 0 6px;font-size:22px";

            const description =
                document.createElement("div");

            description.textContent =
                "Os ZIPs vão aparecendo aqui assim que cada Step2 fica disponível. Links já abertos ficam marcados.";

            description.style.cssText =
                "font-size:14px;color:#6c757d";

            heading.append(
                title,
                description
            );

            const close =
                document.createElement("button");

            close.type = "button";
            close.textContent = "Fechar";
            close.style.cssText = [
                "border:1px solid #ced4da",
                "background:#fff",
                "border-radius:6px",
                "padding:7px 12px",
                "cursor:pointer",
            ].join(";");

            close.addEventListener(
                "click",
                () => overlay.remove()
            );

            header.append(
                heading,
                close
            );

            dialog.appendChild(
                header
            );

            const list =
                document.createElement("div");

            list.dataset.role =
                "step2-list";

            list.style.cssText =
                "display:grid;gap:10px";

            dialog.appendChild(
                list
            );

            overlay.appendChild(
                dialog
            );

            overlay.addEventListener(
                "click",
                (event) => {
                    if (event.target === overlay) {
                        overlay.remove();
                    }
                }
            );

            document.body.appendChild(
                overlay
            );
        }

        const title =
            overlay.querySelector(
                "[data-role='step2-title']"
            );

        const list =
            overlay.querySelector(
                "[data-role='step2-list']"
            );

        if (!title || !list) {
            return;
        }

        const openedUrls =
            getOpenedStep2Urls();

        const renderedUrls =
            new Set(
                [
                    ...list.querySelectorAll(
                        "[data-step2-url]"
                    ),
                ].map(
                    (row) =>
                        row.dataset.step2Url
                )
            );

        for (const item of links) {
            const itemUrl =
                String(
                    item.url ||
                    ""
                );

            if (
                !itemUrl ||
                renderedUrls.has(
                    itemUrl
                )
            ) {
                continue;
            }

            const row =
                document.createElement("div");

            row.className =
                "marketplace-step2-row";

            row.dataset.step2Url =
                itemUrl;

            row.style.cssText = [
                "border:1px solid #dee2e6",
                "border-radius:8px",
                "padding:12px 14px",
                "transition:opacity .15s ease,background .15s ease,border-color .15s ease",
            ].join(";");

            const link =
                document.createElement("a");

            link.className =
                "marketplace-step2-link";

            link.href =
                itemUrl;

            link.target =
                "_blank";

            link.rel =
                "noopener noreferrer";

            link.textContent =
                `${item.component} · abrir step2`;

            link.style.cssText = [
                "display:inline-block",
                "font-weight:700",
                "text-decoration:none",
                "margin-bottom:5px",
            ].join(";");

            link.addEventListener(
                "click",
                () => {
                    row.classList.add(
                        "is-opened"
                    );

                    rememberOpenedStep2Url(
                        itemUrl
                    );
                }
            );

            if (
                openedUrls.has(
                    itemUrl
                )
            ) {
                row.classList.add(
                    "is-opened"
                );
            }

            const url =
                document.createElement("div");

            url.textContent =
                itemUrl;

            url.style.cssText = [
                "font-size:12px",
                "color:#6c757d",
                "word-break:break-all",
            ].join(";");

            const repositoryValidation =
                document.createElement("div");

            const validation =
                item.repositoryValidation;

            repositoryValidation.textContent =
                validation?.message ||
                "Validação da URL do GitHub indisponível.";

            repositoryValidation.style.cssText = [
                "margin-top:7px",
                "font-size:12px",
                "font-weight:600",
                validation?.valid
                    ? "color:#198754"
                    : "color:#dc3545",
                "word-break:break-word",
            ].join(";");

            row.append(
                link,
                url,
                repositoryValidation
            );

            list.appendChild(
                row
            );

            renderedUrls.add(
                itemUrl
            );
        }

        const total =
            list.querySelectorAll(
                "[data-step2-url]"
            ).length;

        const opened =
            list.querySelectorAll(
                ".marketplace-step2-row.is-opened"
            ).length;

        title.textContent =
            `Step2 pendente (${total}) · abertos ${opened}`;
    }

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
                component.endsWith("_cloudstudio") ||
                component.endsWith("_pandavideo")
            ) {
                continue;
            }

            /*
             * Processa plugins publicados, ocultos e plugins
             * em estados administrativos que ainda exigem
             * atualização ou configuração.
             */
            const setupLink =
                listingCell.querySelector(
                    "a[data-ga-label='setup_after_review'][href^='/plugins/']"
                );

            const changesNeededLink =
                statusCell.querySelector(
                    "a[data-ga-label='changes_needed'][href^='/plugins/']"
                );

            const submittedForReviewLink =
                statusCell.querySelector(
                    "a[data-ga-label='submitted_for_review'][href^='/plugins/']"
                );

            const hiddenLink =
                listingCell.querySelector(
                    "a[data-ga-label='hidden_plugin'][href^='/plugins/']"
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
                !changesNeededLink &&
                !submittedForReviewLink &&
                !hiddenLink
            ) {
                continue;
            }

            const link =
                setupLink ||
                changesNeededLink ||
                submittedForReviewLink ||
                hiddenLink ||
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
                hidden:
                    Boolean(hiddenLink),
                needsSetup:
                    Boolean(setupLink),
                needsChanges:
                    Boolean(changesNeededLink),
                submittedForReview:
                    Boolean(submittedForReviewLink),
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
        const parseText = (text) => {
            const match =
                String(text || "")
                    .trim()
                    .match(
                        /^(.*?)\s*\((\d+)\)\s*$/
                    );

            if (!match) {
                return null;
            }

            return {
                release:
                    match[1].trim(),

                build:
                    Number(match[2]),
            };
        };

        const card =
            documentObject.querySelector(
                "section[aria-labelledby='versions-heading'] .card .card"
            );

        const heading =
            card?.querySelector("h2");

        const primary =
            parseText(
                heading?.textContent
            );

        if (primary) {
            return primary;
        }

        /*
         * /plugins/submit/step3/[id] uses a different layout.
         * Prefer elements containing "release (build)" and require
         * a long Moodle plugin build number in this fallback.
         */
        for (
            const element
            of documentObject.querySelectorAll(
                "h1, h2, h3, h4, h5, h6, td, dd, strong, span"
            )
        ) {
            const text =
                element.textContent.trim();

            const match =
                text.match(
                    /^(.*?)\s*\((\d{8,14})\)\s*$/
                );

            if (
                match &&
                /\d/.test(match[1])
            ) {
                return {
                    release:
                        match[1].trim(),

                    build:
                        Number(match[2]),
                };
            }
        }

        /*
         * Some summary pages render Release and Version/Build
         * in separate table cells.
         */
        let release = null;
        let build = null;

        for (
            const row
            of documentObject.querySelectorAll(
                "tr"
            )
        ) {
            const cells =
                row.querySelectorAll(
                    "th, td"
                );

            if (cells.length < 2) {
                continue;
            }

            const label =
                cells[0]
                    .textContent
                    .trim()
                    .replace(/:$/, "")
                    .toLowerCase();

            const value =
                cells[cells.length - 1]
                    .textContent
                    .trim();

            if (
                label === "release" &&
                value
            ) {
                release = value;
            }

            if (
                (
                    label === "version" ||
                    label === "build"
                ) &&
                /^\d{8,14}$/.test(value)
            ) {
                build = Number(value);
            }
        }

        if (
            release &&
            Number.isFinite(build)
        ) {
            return {
                release,
                build,
            };
        }

        throw new Error(
            "Marketplace version not found."
        );
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

    function canonicalGitHubRepositoryUrl(value) {
        let parsedUrl;

        try {
            parsedUrl =
                new URL(
                    String(value || "").trim()
                );
        } catch (_) {
            return null;
        }

        if (
            parsedUrl.protocol !== "https:" ||
            parsedUrl.hostname.toLowerCase() !==
            "github.com" ||
            parsedUrl.search ||
            parsedUrl.hash
        ) {
            return null;
        }

        const parts =
            parsedUrl.pathname
                .replace(/\/+$/, "")
                .split("/")
                .filter(Boolean);

        if (parts.length !== 2) {
            return null;
        }

        const owner =
            parts[0];

        const repository =
            parts[1]
                .replace(
                    /\.git$/i,
                    ""
                );

        if (
            !/^[A-Za-z0-9_.-]+$/.test(owner) ||
            !/^[A-Za-z0-9_.-]+$/.test(repository)
        ) {
            return null;
        }

        return {
            owner,
            repository,
            fullName:
                `${owner}/${repository}`,
            url:
                `https://github.com/${owner}/${repository}`,
        };
    }

    function expectedStep2GitHubRepository(
        repositoryInfo
    ) {
        const fullName =
            String(
                repositoryInfo?.repo ||
                (
                    repositoryInfo?.owner &&
                    repositoryInfo?.repository
                        ? `${repositoryInfo.owner}/${repositoryInfo.repository}`
                        : ""
                )
            ).trim();

        const match =
            fullName.match(
                /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/
            );

        if (!match) {
            throw new Error(
                "Unable to determine expected GitHub repository for step2."
            );
        }

        return {
            owner:
                match[1],
            repository:
                match[2],
            fullName:
                `${match[1]}/${match[2]}`,
            url:
                `https://github.com/${match[1]}/${match[2]}`,
        };
    }

    function findStep2RepositoryInput(
        documentObject
    ) {
        const form =
            documentObject.querySelector(
                "form[name='plugin_version_file_form']"
            ) ||
            documentObject.querySelector(
                "form"
            );

        if (!form) {
            return null;
        }

        const preferredSelectors = [
            "#plugin_version_file_form_repositoryUrl",
            "#plugin_version_file_form_sourceControlUrl",
            "input[name='plugin_version_file_form[repositoryUrl]']",
            "input[name='plugin_version_file_form[sourceControlUrl]']",
            "input[name*='repository' i]",
            "input[id*='repository' i]",
            "input[name*='sourcecontrol' i]",
            "input[id*='sourcecontrol' i]",
        ];

        for (
            const selector
            of preferredSelectors
        ) {
            const input =
                form.querySelector(
                    selector
                );

            if (input) {
                return input;
            }
        }

        for (
            const input
            of form.querySelectorAll(
                "input[type='url'], input[type='text']"
            )
        ) {
            const labels =
                input.labels
                    ? [
                        ...input.labels,
                    ]
                        .map(
                            (label) =>
                                label.textContent
                                    .trim()
                        )
                        .join(" ")
                    : "";

            const identity =
                [
                    input.id,
                    input.name,
                    labels,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

            if (
                /github|repository|source\s*control|source\s*code|vcs/.test(
                    identity
                ) ||
                /github\.com/i.test(
                    input.value || ""
                )
            ) {
                return input;
            }
        }

        return null;
    }

    function validateStep2GitHubRepository(
        documentObject,
        repositoryInfo
    ) {
        const expected =
            expectedStep2GitHubRepository(
                repositoryInfo
            );

        const input =
            findStep2RepositoryInput(
                documentObject
            );

        if (!input) {
            return {
                valid: false,
                reason:
                    "field_not_found",
                actual: "",
                expected:
                    expected.url,
                message:
                    `Campo da URL do repositório não encontrado no step2. Esperado: ${expected.url}`,
            };
        }

        const actualValue =
            String(
                input.value || ""
            ).trim();

        const actual =
            canonicalGitHubRepositoryUrl(
                actualValue
            );

        if (!actual) {
            return {
                valid: false,
                reason:
                    "invalid_url",
                actual:
                    actualValue,
                expected:
                    expected.url,
                field:
                    input.name ||
                    input.id ||
                    "",
                message:
                    `URL do GitHub inválida no step2: "${actualValue || "(vazia)"}". Esperado: ${expected.url}`,
            };
        }

        if (
            actual.fullName.toLowerCase() !==
            expected.fullName.toLowerCase()
        ) {
            return {
                valid: false,
                reason:
                    "wrong_repository",
                actual:
                    actual.url,
                expected:
                    expected.url,
                field:
                    input.name ||
                    input.id ||
                    "",
                message:
                    `URL do GitHub aponta para ${actual.fullName}, mas esta versão veio de ${expected.fullName}.`,
            };
        }

        return {
            valid: true,
            reason:
                "ok",
            actual:
                actual.url,
            expected:
                expected.url,
            field:
                input.name ||
                input.id ||
                "",
            message:
                `GitHub OK: ${expected.url}`,
        };
    }

    async function apiInfo(
        repository,
        component,
        force = false
    ) {
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

        url.searchParams.set(
            "component",
            component
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
         * Não há cache no navegador. O api.php é a única camada de cache
         * e decide quando reutilizar ou atualizar os dados do GitHub.
         */

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
            typeof data.description_html !== "string" ||
            !data.description_html.trim() ||
            !data.iconUrl ||
            !Array.isArray(
                data.screenshots
            )
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


    async function apiCatalogScreenshot(
        component,
        filename
    ) {
        const url =
            new URL(
                CONFIG.apiUrl
            );

        url.searchParams.set(
            "action",
            "catalog_screenshot"
        );

        url.searchParams.set(
            "component",
            component
        );

        url.searchParams.set(
            "filename",
            filename
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
                `Catalog screenshot HTTP ${response.status}`;

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
        return new File(
            [
                blob,
            ],
            filename,
            {
                type:
                    blob.type ||
                    "application/octet-stream",
            }
        );
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
         * Mantém o arquivo original exatamente como foi recebido.
         * Não redimensiona, não rasteriza e não converte o formato.
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
                false,
            originalSize:
                blob.size,
            normalizedSize:
                file.size,
        };
    }


    async function getCatalogSetupScreenshots(
        component,
        catalog,
        onProgress = null
    ) {
        const screenshots =
            Array.isArray(
                catalog.screenshots
            )
                ? catalog.screenshots
                : [];

        if (!screenshots.length) {
            throw new Error(
                `No screenshot files found for ${component}.`
            );
        }

        const files = [];
        let screenshotIndex = 0;

        for (const screenshot of screenshots) {
            screenshotIndex++;

            if (onProgress) {
                onProgress(
                    screenshotIndex,
                    screenshots.length,
                    screenshot?.filename ||
                    `screenshot ${screenshotIndex}`
                );
            }
            const filename =
                String(
                    screenshot?.filename ||
                    ""
                ).trim();

            if (!filename) {
                continue;
            }

            const response =
                await apiCatalogScreenshot(
                    component,
                    filename
                );

            const blob =
                await response.blob();

            const contentType =
                String(
                    blob.type ||
                    response.headers.get(
                        "Content-Type"
                    ) ||
                    "application/octet-stream"
                )
                    .split(";")[0]
                    .trim();

            files.push({
                filename,
                path:
                    screenshot.url ||
                    `/marketplace-plugins/screenshots/${component}/${encodeURIComponent(filename)}`,
                file:
                    new File(
                        [
                            blob,
                        ],
                        filename,
                        {
                            type:
                                contentType,
                        }
                    ),
            });
        }

        if (files.length < 2) {
            throw new Error(
                `Missing new-2.png for ${component}: the catalog contains only ${files.length} screenshot(s). ` +
                "The existing Marketplace gallery was not changed."
            );
        }

        return files;
    }


    function getFilePondExistingFiles(
        input
    ) {
        if (!input) {
            return [];
        }

        const raw =
            input.getAttribute(
                "data-filepond-existing-files-value"
            ) ||
            input.dataset
                ?.filepondExistingFilesValue ||
            "";

        if (!String(raw).trim()) {
            return [];
        }

        try {
            const files =
                JSON.parse(raw);

            return Array.isArray(files)
                ? files
                : [];
        } catch (error) {
            console.warn(
                "[Marketplace] Não foi possível ler data-filepond-existing-files-value:",
                error
            );

            return [];
        }
    }


    function normalizeAssetFilename(
        value
    ) {
        return String(value || "")
            .normalize("NFC")
            .trim()
            .toLowerCase();
    }


    function findFilePondBrowser(
        root
    ) {
        if (!root) {
            return null;
        }

        /*
         * No Marketplace, o próprio elemento com o id do campo pode virar o
         * input.filepond--browser. querySelector() procura apenas descendentes
         * e, nesse caso, nunca encontrava o próprio input.
         */
        if (
            root.matches?.(
                "input.filepond--browser[type='file']"
            )
        ) {
            return root;
        }

        return root.querySelector?.(
            "input.filepond--browser[type='file']"
        ) || null;
    }


    function getFilePondScope(
        root,
        browser
    ) {
        return (
            browser?.closest?.(
                ".filepond--root"
            ) ||
            root?.closest?.(
                ".filepond--root"
            ) ||
            root?.querySelector?.(
                ".filepond--root"
            ) ||
            root
        );
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

        try {
            await loaded;
            const expected = new URL(url, location.origin).pathname.replace(/\/$/, "");
            let actualUrl;
            try {
                actualUrl = iframe.contentWindow.location.href;
            } catch (_) {
                throw new Error(`Cannot access Marketplace iframe for ${url}; verify same-origin permissions.`);
            }
            if (new URL(actualUrl).pathname.replace(/\/$/, "") !== expected) {
                throw new Error(`Marketplace iframe redirected from ${url} to ${actualUrl}; check your login and plugin permissions.`);
            }
            return iframe;
        } catch (error) {
            iframe.remove();
            throw error;
        }
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


    async function clearFilePondFiles(
        iframe,
        rootId
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
                    findFilePondBrowser(
                        root
                    ),
                `${rootId} file input`
            );

        const pondScope =
            getFilePondScope(
                root,
                browser
            );

        const FilePondApi =
            frameWindow.FilePond;

        let pond = null;

        if (
            FilePondApi &&
            typeof FilePondApi.find ===
                "function"
        ) {
            const candidates = [
                browser,
                browser.closest(
                    ".filepond--root"
                ),
                root,
                pondScope,
                pondScope?.querySelector?.(
                    ".filepond"
                ),
                ...(
                    pondScope?.querySelectorAll?.(
                        "input[type='file']"
                    ) ||
                    []
                ),
            ].filter(Boolean);

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

        const items = () => [
            ...(pondScope?.querySelectorAll?.(".filepond--item") || []),
        ].filter((item) => item.isConnected && pondScope.contains(item));
        const apiItems = () =>
            typeof pond?.getFiles === "function" ? pond.getFiles() : null;
        const empty = () => items().length === 0 &&
            (apiItems() === null || apiItems().length === 0);

        /*
         * O iframe pode disparar load antes do FilePond/Stimulus terminar
         * de montar os arquivos existentes. Nesse caso, nao devemos
         * considerar a colecao vazia e adicionar outro icone em cima.
         */
        const existing = getFilePondExistingFiles(root);
        if (existing.length && empty()) {
            await waitForCondition(
                () => !empty(),
                `${rootId} existing FilePond files initialization`,
                5000
            );
        }

        const originalCount = Math.max(
            items().length,
            apiItems()?.length || 0
        );
        if (empty()) {
            return 0;
        }

        /*
         * FilePond.removeFiles() / removeFile() retorna void. A chamada
         * nao comprova que os arquivos sairam: verifique getFiles e DOM.
         */
        if (pond && typeof pond.removeFiles === "function") {
            pond.removeFiles();
        } else if (pond && typeof pond.removeFile === "function") {
            for (const file of [...pond.getFiles()]) {
                pond.removeFile(file?.id || file);
            }
        }
        if (pond) {
            try {
                await waitForCondition(
                    empty,
                    `${rootId} FilePond API removal`,
                    3500
                );
                return originalCount;
            } catch (_) {
                // Usa controles reais do item quando o API nao remove.
            }
        }

        /*
         * Cada <li class="filepond--item"> representa um arquivo.
         * Botoes de remocao podem continuar no DOM invisiveis/inativos;
         * nunca use a presenca deles como condicao para repetir cliques.
         */
        const controls = [
            ".filepond--action-remove-item",
            ".filepond--action-revert-item-processing",
            ".filepond--action-confirm-item-removal",
            ".filepond--action-abort-item-processing",
        ].join(",");
        const deadline = Date.now() + CONFIG.filePondOperationTimeoutMs;
        while (items().length && Date.now() < deadline) {
            const item = items()[0];
            const buttons = [...item.querySelectorAll(controls)].filter(
                (button) => !button.disabled
            );
            let removed = false;
            for (const button of buttons) {
                if (!pondScope.contains(item)) {
                    removed = true;
                    break;
                }
                button.click();
                try {
                    await waitForCondition(
                        () => !item.isConnected || !pondScope.contains(item),
                        `${rootId} item DOM removal`,
                        2000
                    );
                    removed = true;
                    break;
                } catch (_) {
                    // Try the next valid action exactly once for this item.
                }
            }
            if (!removed) {
                const state =
                    item.getAttribute("data-filepond-item-state") ||
                    item.querySelector("[data-filepond-item-state]")
                        ?.getAttribute("data-filepond-item-state") ||
                    "unknown";
                throw new Error(
                    `FilePond could not remove ${rootId}: ` +
                    `itemState=${state}, items=${items().length}, ` +
                    `buttons=${buttons.map((button) => button.className).join(",") || "none"}. ` +
                    "No new file was submitted."
                );
            }
        }

        if (!empty()) {
            throw new Error(
                `FilePond removal incomplete for ${rootId}: ` +
                `DOM=${items().length}, API=${apiItems()?.length ?? "unavailable"}`
            );
        }

        console.info(
            "[Marketplace] FilePond cleared",
            { rootId, count: originalCount, method: pond ? "api/dom" : "dom" }
        );
        return originalCount;
    }


    async function removeFilePondFilesByNames(
        iframe,
        rootId,
        filenames
    ) {
        const targets =
            new Set(
                filenames
                    .map(
                        (filename) =>
                            normalizeAssetFilename(
                                filename
                            )
                    )
                    .filter(Boolean)
            );

        if (!targets.size) {
            return {
                removedNames: [],
                clearedAll: false,
            };
        }

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
                    findFilePondBrowser(
                        root
                    ),
                `${rootId} file input`
            );

        const pondScope =
            getFilePondScope(
                root,
                browser
            );

        const FilePondApi =
            frameWindow.FilePond;

        let pond = null;

        if (
            FilePondApi &&
            typeof FilePondApi.find ===
                "function"
        ) {
            const candidates = [
                browser,
                browser.closest(
                    ".filepond--root"
                ),
                root,
                pondScope,
                pondScope?.querySelector?.(
                    ".filepond"
                ),
                ...(
                    pondScope?.querySelectorAll?.(
                        "input[type='file']"
                    ) ||
                    []
                ),
            ].filter(Boolean);

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

        const removedNames = [];

        if (
            pond &&
            typeof pond.getFiles ===
                "function" &&
            typeof pond.removeFile ===
                "function"
        ) {
            const files = [
                ...pond.getFiles(),
            ];

            for (const item of files) {
                const itemName =
                    normalizeAssetFilename(
                        item?.filename ||
                        item?.file?.name ||
                        item?.source?.originalName ||
                        item?.source?.filename ||
                        ""
                    );

                if (
                    !itemName ||
                    !targets.has(
                        itemName
                    )
                ) {
                    continue;
                }

                await awaitWithTimeout(
                    pond.removeFile(item?.id || item),
                    `FilePond.removeFile (${rootId}: ${itemName})`
                );

                removedNames.push(
                    itemName
                );
            }

            if (
                targets.size ===
                new Set(
                    removedNames
                ).size
            ) {
                return {
                    removedNames,
                    clearedAll: false,
                };
            }
        }

        /*
         * Se a versão do FilePond não expuser o filename dos arquivos
         * existentes de forma confiável, faz reset completo. Assim o estado
         * final continua sendo exatamente o conjunto definido no catálogo,
         * em vez de deixar screenshot antiga perdida no Marketplace.
         */
        await clearFilePondFiles(
            iframe,
            rootId
        );

        return {
            removedNames:
                [
                    ...targets,
                ],
            clearedAll: true,
        };
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
                    findFilePondBrowser(
                        root
                    ),
                `${rootId} file input`
            );

        const pondScope =
            getFilePondScope(
                root,
                browser
            );

        const hiddenInputs = () => [
            ...(
                pondScope?.querySelectorAll?.(
                    "input[type='hidden']"
                ) ||
                []
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
                browser.closest(
                    ".filepond--root"
                ),
                root,
                pondScope,
                pondScope?.querySelector?.(
                    ".filepond"
                ),
                ...(
                    pondScope?.querySelectorAll?.(
                        "input[type='file']"
                    ) ||
                    []
                ),
            ].filter(Boolean);

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
                    await awaitWithTimeout(
                        pond.addFile(frameFile),
                        `FilePond.addFile (${rootId}: ${file.name})`
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
                    options?.instantUpload ===
                        false &&
                    typeof pond.processFile ===
                        "function"
                ) {
                    addedItem =
                        await awaitWithTimeout(
                            pond.processFile(addedItem?.id || addedItem),
                            `FilePond.processFile (${rootId}: ${file.name})`
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
                /*
                 * Quando usamos a API pública do FilePond, o FileItem é uma
                 * fonte mais confiável do que o markup interno. O Marketplace
                 * pode mudar classes/estados do DOM sem mudar a API.
                 */
                if (
                    pond &&
                    addedItem
                ) {
                    const currentItem =
                        typeof pond.getFile ===
                        "function"
                            ? (
                                pond.getFile(
                                    addedItem.id
                                ) ||
                                addedItem
                            )
                            : addedItem;

                    const FileStatus =
                        FilePondApi?.FileStatus ||
                        {};

                    const apiStatus =
                        currentItem?.status;

                    const processingComplete =
                        FileStatus.PROCESSING_COMPLETE ??
                        5;

                    const errorStatuses =
                        [
                            FileStatus.LOAD_ERROR,
                            FileStatus.PROCESSING_ERROR,
                            FileStatus.PROCESSING_REVERT_ERROR,
                        ].filter(
                            (status) =>
                                status !== undefined
                        );

                    if (
                        errorStatuses.includes(
                            apiStatus
                        )
                    ) {
                        throw new Error(
                            `FilePond failed for ${rootId}: status=${apiStatus}`
                        );
                    }

                    if (
                        currentItem?.serverId ||
                        (
                            processWithServer &&
                            apiStatus ===
                                processingComplete
                        )
                    ) {
                        return true;
                    }

                    /*
                     * addFile() já resolveu o carregamento local. Sem endpoint
                     * server.process não precisamos esperar um estado visual
                     * específico para considerar o campo pronto.
                     */
                    if (!processWithServer) {
                        return true;
                    }
                }

                const item =
                    pondScope?.querySelector?.(
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

                /*
                 * Fallback nativo: se não há instância FilePond acessível e
                 * também não existe item visual, confirme o File diretamente
                 * no input que recebeu o DataTransfer.
                 */
                if (
                    !pond &&
                    !state &&
                    browser.files?.length
                ) {
                    const nativeFile =
                        browser.files[0];

                    if (
                        nativeFile?.name ===
                            frameFile.name &&
                        nativeFile?.size ===
                            frameFile.size
                    ) {
                        return true;
                    }
                }

                const exactValues = [
                    ...(
                        pondScope?.querySelectorAll?.(
                            `input[type='hidden'][name="${hiddenName}"]`
                        ) ||
                        []
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

                return false;
            },
            `${rootId} file ready`
        );
    }


    /**
     * Replace screenshots as one batch. Matching filenames do not mean
     * matching images, so always re-upload the current catalog bytes.
     */
    async function replaceMarketplaceScreenshots(
        iframe, rootId, fieldName, form, screenshotInput, screenshots,
        onUpload = null
    ) {
        if (screenshots.length < 2) {
            throw new Error(rootId + ": at least two screenshots are required.");
        }
        const expected = screenshots.map((item) =>
            normalizeAssetFilename(item.filename || item.file?.name)
        );
        if (expected.some((name) => !name) ||
            new Set(expected).size !== expected.length) {
            throw new Error("Missing or duplicate screenshot filenames: " + expected.join(", "));
        }

        const frameWindow = iframe.contentWindow;
        const frameDocument = iframe.contentDocument;
        const root = await waitForCondition(
            () => frameDocument.getElementById(rootId), rootId
        );
        const browser = await waitForCondition(
            () => findFilePondBrowser(root), rootId + " file browser"
        );
        const scope = getFilePondScope(root, browser);
        const pondApi = frameWindow.FilePond;
        const candidates = [
            root, browser, scope, browser.closest(".filepond--root"),
            ...scope.querySelectorAll("input[type='file']"),
        ].filter(Boolean);
        const pond = pondApi?.find
            ? candidates.map((element) => {
                try {
                    return pondApi.find(element);
                } catch (_) {
                    return null;
                }
            }).find(Boolean)
            : null;

        const fromInput = Number(
            screenshotInput.getAttribute("data-filepond-max-files-value")
        );
        const fromPond = Number(pond?.getOptions?.()?.maxFiles);
        const limits = [fromInput, fromPond].filter((n) =>
            Number.isFinite(n) && n > 0
        );
        const maxFiles = limits.length ? Math.min(...limits) : 10;

        if (screenshots.length > maxFiles) {
            throw new Error(
                rootId + ": " + screenshots.length + " screenshots required, " +
                "but the Marketplace permits " + maxFiles +
                ". Nothing was removed or silently skipped."
            );
        }

        const previousScreenshotFiles = getFilePondExistingFiles(screenshotInput);
        const existingScreenshotNames = new Set(
            previousScreenshotFiles.map((item) =>
                normalizeAssetFilename(item?.originalName || item?.filename)
            ).filter(Boolean)
        );
        const obsoleteScreenshotNames = previousScreenshotFiles.map((item) =>
            String(item?.originalName || item?.filename || "").trim()
        ).filter(Boolean);

        // Clear even if the initial metadata is empty; the visual FilePond
        // may still contain archived images or files with unknown names.
        await clearFilePondFiles(iframe, rootId);
        await waitForCondition(() => {
            const items = pond?.getFiles?.();
            return (!items || items.length === 0) &&
                scope.querySelectorAll(".filepond--item").length === 0;
        }, rootId + " emptied before upload");

        for (const [index, screenshot] of screenshots.entries()) {
            onUpload?.(index + 1, screenshots.length, screenshot);
            await setFilePondFile(iframe, rootId, fieldName, screenshot.file);
        }

        await waitForCondition(() => {
            let actual;
            if (pond?.getFiles) {
                const items = pond.getFiles();
                actual = items.map((item) =>
                    normalizeAssetFilename(
                        item?.filename || item?.file?.name ||
                        item?.source?.originalName || ""
                    )
                );
                const options = pond.getOptions?.() || {};
                const serverProcessing = Boolean(options.server?.process) &&
                    options.storeAsFile !== true &&
                    options.allowProcess !== false;
                const complete = pondApi?.FileStatus?.PROCESSING_COMPLETE ?? 5;
                if (serverProcessing && items.some((item) =>
                    !item?.serverId && item?.status !== complete
                )) {
                    return false;
                }
            } else {
                actual = [...scope.querySelectorAll(".filepond--item")].map(
                    (item) => normalizeAssetFilename(
                        item.querySelector(".filepond--file-info-main")
                            ?.getAttribute("title") ||
                        item.querySelector(".filepond--file-info-main")
                            ?.textContent || ""
                    )
                );
            }
            return actual.length === expected.length &&
                actual.every((name) => expected.includes(name));
        }, rootId + " complete screenshot batch");

        const serialized = new FormData(form).getAll(fieldName).filter(
            (value) => typeof value === "string"
                ? value.trim() !== ""
                : value && value.size > 0
        );
        if (serialized.length !== screenshots.length) {
            throw new Error(
                rootId + ": " + screenshots.length + " images are shown, but " +
                serialized.length + " are present in FormData. " +
                "Refusing to save an incomplete screenshot gallery."
            );
        }

        return {
            previousScreenshotFiles,
            existingScreenshotNames,
            obsoleteScreenshotNames,
            screenshotsReset: true,
            screenshotsToUpload: screenshots,
            skippedScreenshots: [],
        };
    }

    /**
     * Check the server state after POST, not just the form submitted by JS.
     * A former file with the same name must also have a different file ID.
     */
    async function verifyPersistedScreenshots(
        pageUrl, rootId, screenshots, previousScreenshotFiles
    ) {
        const expected = screenshots.map((item) =>
            normalizeAssetFilename(item.filename || item.file?.name)
        ).sort();
        const previousIds = new Set(previousScreenshotFiles.map((item) =>
            String(item?.id ?? "")
        ).filter(Boolean));
        let observed = "none";

        for (let attempt = 0; attempt < 3; attempt++) {
            const page = await marketplaceHtml(pageUrl);
            const input = page.document.getElementById(rootId);
            if (input) {
                const saved = getFilePondExistingFiles(input);
                const names = saved.map((item) =>
                    normalizeAssetFilename(item?.originalName || item?.filename)
                ).sort();
                const sameNames = names.length === expected.length &&
                    names.every((name, i) => name === expected[i]);
                const reusedId = saved.some((item) =>
                    item?.id != null && previousIds.has(String(item.id))
                );
                observed = names.join(", ") || "empty";
                if (sameNames && !reusedId) {
                    return;
                }
            } else {
                observed = "screenshot field not returned";
            }
            if (attempt < 2) {
                await sleep(800);
            }
        }
        throw new Error(
            rootId + ": Marketplace did not persist the expected fresh screenshots. " +
            "Expected: " + expected.join(", ") + "; found: " + observed
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
        setupIcon,
        setupScreenshots,
        onProgress = null
    ) {
        const overviewUrl =
            `/plugins/${plugin.id}/edit/overview`;

        const progressTotal = 9;

        const progress = (
            step,
            label,
            details = ""
        ) => {
            if (onProgress) {
                onProgress(
                    step,
                    progressTotal,
                    label,
                    details
                );
            }
        };

        progress(
            1,
            "abrindo formulário",
            overviewUrl
        );

        const iframe =
            await createSetupIframe(
                overviewUrl
            );

        progress(
            2,
            "aguardando formulário",
            "iframe carregado; procurando campos do Overview"
        );

        const overviewWaitStarted =
            Date.now();

        let lastOverviewWaitSecond =
            -1;

        const reportOverviewWait = (
            currentDocument,
            currentWindow,
            extra = ""
        ) => {
            const elapsedSeconds =
                Math.floor(
                    (
                        Date.now() -
                        overviewWaitStarted
                    ) / 1000
                );

            if (
                elapsedSeconds ===
                lastOverviewWaitSecond
            ) {
                return;
            }

            lastOverviewWaitSecond =
                elapsedSeconds;

            let locationText =
                "URL indisponível";

            try {
                locationText =
                    currentWindow?.location?.pathname ||
                    currentWindow?.location?.href ||
                    "URL vazia";
            } catch (_) {
                locationText =
                    "URL cross-origin/inacessível";
            }

            const readyState =
                currentDocument?.readyState ||
                "sem documento";

            const formCount =
                currentDocument
                    ? currentDocument.querySelectorAll(
                        "form"
                    ).length
                    : 0;

            const title =
                String(
                    currentDocument?.title ||
                    ""
                ).trim();

            progress(
                2,
                "aguardando formulário",
                [
                    `${elapsedSeconds}s`,
                    `readyState=${readyState}`,
                    `forms=${formCount}`,
                    locationText,
                    title
                        ? `title=${title}`
                        : null,
                    extra || null,
                ]
                    .filter(Boolean)
                    .join(" · ")
            );
        };

        try {
            /*
             * O Marketplace pode alterar a rota, adicionar barra final ou
             * navegar internamente antes de montar o formulário. A URL serve
             * apenas para diagnóstico; o reconhecimento é feito pelos campos
             * reais do Overview.
             */
            const overviewContext =
                await waitForCondition(
                    () => {
                        const currentWindow =
                            iframe.contentWindow;

                        const currentDocument =
                            iframe.contentDocument;

                        if (
                            !currentWindow ||
                            !currentDocument ||
                            !currentDocument.documentElement
                        ) {
                            reportOverviewWait(
                                currentDocument,
                                currentWindow,
                                "iframe/document ainda indisponível"
                            );

                            return false;
                        }

                        let pathname = "";

                        try {
                            pathname =
                                currentWindow.location.pathname ||
                                "";
                        } catch (_) {
                            reportOverviewWait(
                                currentDocument,
                                currentWindow,
                                "não foi possível ler location"
                            );

                            return false;
                        }

                        if (
                            /\/login(?:\/|$)/i.test(
                                pathname
                            )
                        ) {
                            throw new Error(
                                `Overview iframe redirected to login: ${pathname}`
                            );
                        }

                        const nameInput =
                            currentDocument.querySelector(
                                [
                                    "#plugin_edit_overview_form_name",
                                    "[name='plugin_edit_overview_form[name]']",
                                ].join(",")
                            );

                        const descriptionInput =
                            currentDocument.querySelector(
                                [
                                    "#plugin_edit_overview_form_shortDescription",
                                    "[name='plugin_edit_overview_form[shortDescription]']",
                                ].join(",")
                            );

                        const iconInput =
                            currentDocument.querySelector(
                                [
                                    "#plugin_edit_overview_form_icon",
                                    "[name='plugin_edit_overview_form[icon]']",
                                ].join(",")
                            );

                        const screenshotsInput =
                            currentDocument.querySelector(
                                [
                                    "#plugin_edit_overview_form_screenshots",
                                    "[name='plugin_edit_overview_form[screenshots]']",
                                    "[name='plugin_edit_overview_form[screenshots][]']",
                                ].join(",")
                            );

                        const form =
                            currentDocument.querySelector(
                                "#plugin_edit_overview_form"
                            ) ||
                            currentDocument.querySelector(
                                "form[name='plugin_edit_overview_form']"
                            ) ||
                            currentDocument.querySelector(
                                `form[action*="/plugins/${plugin.id}/edit/overview"]`
                            ) ||
                            nameInput?.closest("form") ||
                            descriptionInput?.closest("form") ||
                            iconInput?.closest("form") ||
                            screenshotsInput?.closest("form");

                        const foundFields = [
                            nameInput
                                ? "name"
                                : null,
                            descriptionInput
                                ? "description"
                                : null,
                            iconInput
                                ? "icon"
                                : null,
                            screenshotsInput
                                ? "screenshots"
                                : null,
                        ]
                            .filter(Boolean)
                            .join(",");

                        if (
                            currentDocument.readyState ===
                            "loading" ||
                            !form ||
                            !nameInput ||
                            !descriptionInput ||
                            !iconInput ||
                            !screenshotsInput
                        ) {
                            reportOverviewWait(
                                currentDocument,
                                currentWindow,
                                `campos=${foundFields || "nenhum"}`
                            );

                            return false;
                        }

                        return {
                            frameDocument:
                                currentDocument,
                            frameWindow:
                                currentWindow,
                            form,
                            nameInput,
                            descriptionInput,
                            iconInput,
                            screenshotsInput,
                        };
                    },
                    "overview form"
                );

            const {
                frameDocument,
                frameWindow,
                form,
                nameInput,
                descriptionInput,
                iconInput,
                screenshotsInput,
            } = overviewContext;

            progress(
                3,
                "preenchendo campos",
                catalog.name || plugin.component
            );

            const name =
                String(
                    catalog.name ||
                    nameInput.value ||
                    plugin.component
                )
                    .trim()
                    .slice(0, 60);

            const existingShortDescription =
                String(
                    descriptionInput.value ||
                    ""
                ).trim();

            const shouldPopulateOverview =
                existingShortDescription === "";

            const shortDescription =
                shouldPopulateOverview
                    ? String(
                        catalog.description ||
                        ""
                    )
                        .trim()
                        .slice(0, 256)
                    : existingShortDescription;

            if (!name) {
                throw new Error(
                    "Plugin name is empty."
                );
            }

            if (
                shouldPopulateOverview &&
                !shortDescription
            ) {
                throw new Error(
                    "Short description is empty."
                );
            }

            setFormValue(
                nameInput,
                name
            );

            if (shouldPopulateOverview) {
                setFormValue(
                    descriptionInput,
                    shortDescription
                );
            }

            /*
             * O ícone é sempre substituído pelo arquivo atual do catálogo.
             * Não compara nome, tamanho, hash ou pixels com o Marketplace.
             */
            progress(
                4,
                "removendo ícone anterior",
                setupIcon.file?.name || setupIcon.path || ""
            );

            await clearFilePondFiles(
                iframe,
                "plugin_edit_overview_form_icon"
            );

            progress(
                5,
                "enviando ícone",
                `${setupIcon.file?.name || "ícone"} · ${setupIcon.file?.size || 0} bytes`
            );

            await setFilePondFile(
                iframe,
                "plugin_edit_overview_form_icon",
                "plugin_edit_overview_form[icon]",
                setupIcon.file
            );

            const iconUpdated =
                true;

            /*
             * Screenshots são sempre reenviadas a partir do catálogo.
             *
             * Não dá para considerar um screenshot atualizado apenas porque
             * o filename é igual: new-1.png pode ter sido regenerado mantendo
             * exatamente o mesmo nome. Por isso removemos as imagens atuais e
             * enviamos novamente os bytes do catálogo.
             */
            progress(
                6,
                "analisando screenshots",
                `${setupScreenshots.length} screenshot(s) no catálogo`
            );

            const {
                previousScreenshotFiles,
                existingScreenshotNames,
                obsoleteScreenshotNames,
                screenshotsReset,
                screenshotsToUpload,
                skippedScreenshots,
            } = await replaceMarketplaceScreenshots(
                iframe,
                "plugin_edit_overview_form_screenshots",
                "plugin_edit_overview_form[screenshots][]",
                form,
                screenshotsInput,
                setupScreenshots,
                (index, total, screenshot) => progress(
                    7, "enviando screenshots",
                    `${index}/${total} · ${screenshot.filename || screenshot.file?.name}`
                )
            );

            console.log(
                `[Marketplace] Assets do Overview: ${plugin.component}`,
                {
                    iconUpdated,
                    existingScreenshots:
                        [
                            ...existingScreenshotNames,
                        ],
                    deletedScreenshots:
                        obsoleteScreenshotNames,
                    screenshotsReset,
                    uploadedScreenshots:
                        screenshotsToUpload.map(
                            (screenshot) =>
                                screenshot.filename
                        ),
                    skippedScreenshots:
                        skippedScreenshots.map(
                            (screenshot) =>
                                screenshot.filename
                        ),
                }
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

            const formData =
                new FormData(
                    form
                );

            if (submit.name) {
                formData.append(
                    submit.name,
                    submit.value || ""
                );
            }

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
                        overviewUrl,
                        location.origin
                    ).toString();

            const formEntries =
                [
                    ...formData.entries(),
                ];

            const fileEntries =
                formEntries.filter(
                    ([, value]) =>
                        value instanceof File
                );

            progress(
                8,
                "enviando Overview",
                [
                    `POST ${new URL(postUrl).pathname}`,
                    `${formEntries.length} campo(s)`,
                    `${fileEntries.length} arquivo(s)`,
                ].join(" · ")
            );

            /*
             * O Overview não usa mais submit.click() dentro do iframe.
             * Essa abordagem podia ser bloqueada pela validação/eventos da
             * página sem gerar qualquer POST. Aqui enviamos exatamente o
             * formulário montado, incluindo FilePond/storeAsFile e o valor
             * do botão save_and_next.
             */
            const responsePromise =
                marketplaceFetch(
                    postUrl,
                    {
                        method: "POST",
                        body: formData,
                    }
                );

            progress(
                9,
                "aguardando resposta",
                `POST disparado para ${new URL(postUrl).pathname}`
            );

            const response =
                await responsePromise;

            const responseHtml =
                await response.text();

            const resultDocument =
                new DOMParser()
                    .parseFromString(
                        responseHtml,
                        "text/html"
                    );

            const errors =
                getOverviewErrors(
                    resultDocument
                );

            if (errors.length) {
                throw new Error(
                    "Overview: " +
                    errors.join(" | ")
                );
            }

            const resultUrl =
                new URL(
                    response.url,
                    location.origin
                );

            if (
                resultUrl.pathname === overviewUrl ||
                resultUrl.pathname.endsWith(
                    `/plugins/${plugin.id}/edit/overview`
                )
            ) {
                throw new Error(
                    "Overview form remained on the same page after POST."
                );
            }

            await verifyPersistedScreenshots(
                overviewUrl, "plugin_edit_overview_form_screenshots",
                setupScreenshots, previousScreenshotFiles
            );

            return {
                url:
                    response.url,
                name,
                shortDescription,
                populatedOverview:
                    shouldPopulateOverview,
                iconUpdated,
                iconPath:
                    iconUpdated
                        ? setupIcon.path
                        : null,
                existingScreenshotNames:
                    [
                        ...existingScreenshotNames,
                    ],
                deletedScreenshotNames:
                    obsoleteScreenshotNames,
                screenshotsReset,
                screenshotPaths:
                    screenshotsToUpload.map(
                        (screenshot) =>
                            screenshot.path
                    ),
                uploadedScreenshotNames:
                    screenshotsToUpload.map(
                        (screenshot) =>
                            screenshot.filename
                    ),
                skippedScreenshotNames:
                    skippedScreenshots.map(
                        (screenshot) =>
                            screenshot.filename
                    ),
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

    function buildMarketplaceDescriptionHtml(
        component,
        descriptionHtml
    ) {
        const publicUrl =
            `https://eduardokraus.com/marketplace-plugins/plugin/${component}`;

        const notice = [
            "<p><mark>",
            "As the store migration was not carried out properly, part of the formatting was compromised and the images were lost. For a complete and properly formatted view, please visit: ",
            `<a href="${publicUrl}" target="_blank">${publicUrl}</a>`,
            "</mark></p>",
        ].join("\n");

        return (
          //  notice +
          //  "\n" +
            String(
                descriptionHtml ||
                ""
            ).trim()
        );
    }


    function normalizeDescriptionWhitespace(
        value
    ) {
        return String(value || "")
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }


    function normalizeDescriptionUrl(
        value
    ) {
        const raw =
            String(value || "").trim();

        if (!raw) {
            return "";
        }

        try {
            const parsed =
                new URL(
                    raw,
                    location.origin
                );

            if (
                parsed.origin ===
                location.origin
            ) {
                return (
                    parsed.pathname +
                    parsed.search +
                    parsed.hash
                );
            }

            return parsed.toString();
        } catch (_) {
            return raw;
        }
    }


    function getDescriptionSemanticSignature(
        html
    ) {
        const documentObject =
            new DOMParser()
                .parseFromString(
                    `<div id="marketplace-description-signature">${String(html || "")}</div>`,
                    "text/html"
                );

        const root =
            documentObject.getElementById(
                "marketplace-description-signature"
            );

        if (!root) {
            return {
                text: "",
                links: [],
                images: [],
            };
        }

        return {
            text:
                normalizeDescriptionWhitespace(
                    root.textContent
                ),

            links:
                [
                    ...root.querySelectorAll(
                        "a[href]"
                    ),
                ]
                    .map(
                        (element) =>
                            normalizeDescriptionUrl(
                                element.getAttribute(
                                    "href"
                                )
                            )
                    )
                    .filter(Boolean)
                    .sort(),

            images:
                [
                    ...root.querySelectorAll(
                        "img[src]"
                    ),
                ]
                    .map(
                        (element) =>
                            normalizeDescriptionUrl(
                                element.getAttribute(
                                    "src"
                                )
                            )
                    )
                    .filter(Boolean)
                    .sort(),
        };
    }


    function isDescriptionSemanticallyPersisted(
        expectedHtml,
        actualHtml
    ) {
        const expected =
            getDescriptionSemanticSignature(
                expectedHtml
            );

        const actual =
            getDescriptionSemanticSignature(
                actualHtml
            );

        if (
            expected.text !==
            actual.text
        ) {
            return false;
        }

        if (
            expected.links.length !==
                actual.links.length ||
            expected.images.length !==
                actual.images.length
        ) {
            return false;
        }

        return (
            expected.links.every(
                (value, index) =>
                    value ===
                    actual.links[index]
            ) &&
            expected.images.every(
                (value, index) =>
                    value ===
                    actual.images[index]
            )
        );
    }


    async function submitMarketplaceDescription(
        plugin,
        catalog
    ) {
        const descriptionUrl =
            `/plugins/${plugin.id}/edit/description`;

        const page =
            await marketplaceHtml(
                descriptionUrl
            );

        const form =
            page.document.querySelector(
                "form[name='plugin_edit_description_form']"
            );

        const descriptionInput =
            form?.querySelector(
                "#plugin_edit_description_form_description"
            );

        const tokenInput =
            form?.querySelector(
                "input[name='plugin_edit_description_form[_token]']"
            );

        if (
            !form ||
            !descriptionInput ||
            !tokenInput?.value
        ) {
            throw new Error(
                "Marketplace Description form/textarea/token was not found."
            );
        }

        const html =
            buildMarketplaceDescriptionHtml(
                plugin.component,
                catalog.description_html
            );

        const maxLength =
            Number(
                descriptionInput.getAttribute(
                    "maxlength"
                )
            );

        const formData =
            new FormData();

        formData.append(
            "plugin_edit_description_form[description]",
            html
        );

        formData.append(
            "plugin_edit_description_form[_token]",
            tokenInput.value
        );

        /*
         * Equivale ao botão Save. Não dependemos do TinyMCE porque o valor
         * persistido pelo formulário é o HTML bruto do textarea.
         */
        formData.append(
            "save",
            ""
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
                    descriptionUrl,
                    location.origin
                ).toString();

        const response =
            await marketplaceFetch(
                postUrl,
                {
                    method:
                        "POST",
                    body:
                        formData,
                }
            );

        const responseHtml =
            await response.text();

        const resultDocument =
            new DOMParser()
                .parseFromString(
                    responseHtml,
                    "text/html"
                );

        const resultTextarea =
            resultDocument.querySelector(
                "#plugin_edit_description_form_description"
            );

        const errors = [
            ...resultDocument.querySelectorAll(
                [
                    ".alert-danger",
                    ".alert-error",
                    ".form-error-message",
                    "[aria-invalid='true'] + .invalid-feedback",
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
                "Description: " +
                errors.join(" | ")
            );
        }

        /*
         * O Marketplace normaliza o HTML ao salvar: pode alterar espaços,
         * aspas, fechamento de tags e atributos sem mudar o conteúdo.
         * Validamos texto, links e imagens em vez de exigir igualdade
         * byte a byte entre o HTML enviado e o HTML devolvido.
         */
        if (
            resultTextarea &&
            !isDescriptionSemanticallyPersisted(
                html,
                resultTextarea.value ||
                    ""
            )
        ) {
            const expectedSignature =
                getDescriptionSemanticSignature(
                    html
                );

            const actualSignature =
                getDescriptionSemanticSignature(
                    resultTextarea.value ||
                    ""
                );

            throw new Error(
                [
                    "Description was not persisted with the expected content.",
                    `expected text=${expectedSignature.text.length}`,
                    `actual text=${actualSignature.text.length}`,
                    `expected links=${expectedSignature.links.length}`,
                    `actual links=${actualSignature.links.length}`,
                    `expected images=${expectedSignature.images.length}`,
                    `actual images=${actualSignature.images.length}`,
                ].join(" ")
            );
        }

        return {
            url:
                response.url,
            htmlLength:
                html.length,
            configuredMaxLength:
                Number.isFinite(
                    maxLength
                )
                    ? maxLength
                    : null,
            exceedsDeclaredMaxLength:
                Number.isFinite(
                    maxLength
                ) &&
                maxLength > 0 &&
                html.length > maxLength,
            publicUrl:
                `https://eduardokraus.com/marketplace-plugins/plugin/${plugin.component}`,
        };
    }


    async function syncMarketplaceDescription(
        plugin,
        status,
        catalog
    ) {
        status.set(
            "Sincronizando Description...",
            plugin.component
        );

        try {
            const result =
                await submitMarketplaceDescription(
                    plugin,
                    catalog
                );

            status.set(
                "Description sincronizada",
                result.exceedsDeclaredMaxLength
                    ? `HTML salvo com ${result.htmlLength} caracteres; o campo declara limite de ${result.configuredMaxLength}`
                    : `HTML do plugins.json + aviso no topo · ${result.htmlLength} caracteres`,
                result.exceedsDeclaredMaxLength
                    ? "warning"
                    : "success"
            );

            return {
                ok: true,
                ...result,
            };
        } catch (error) {
            console.error(
                `[Marketplace] Falha sincronizando Description de ${plugin.component}:`,
                error
            );

            status.set(
                "Description não sincronizada",
                marketplaceErrorMessage(
                    error
                ),
                "warning"
            );

            return {
                ok: false,
                error:
                    marketplaceErrorMessage(
                        error
                    ),
            };
        }
    }


    async function submitMarketplaceReviewDetails(
        plugin,
        catalog,
        setupScreenshots,
        onProgress = null
    ) {
        const reviewUrl =
            `/plugins/submit/step3/${plugin.id}`;

        const progress = (step, detail = "") => {
            console.info(`[Marketplace] ${plugin.component} Step3: ${step}`, detail);
            if (onProgress) {
                onProgress(step, detail);
            }
        };

        progress("abrindo formulário", reviewUrl);
        const iframe =
            await createSetupIframe(
                reviewUrl
            );

        try {
            progress("aguardando formulário", reviewUrl);
            /*
             * Submitted for review usa uma página própria. Nela o Marketplace
             * permite atualizar Description e Screenshots, enquanto o nome
             * continua presente apenas como campo obrigatório do formulário.
             * Não tentamos alterar Overview, ícone ou Support neste estado.
             */
            const context =
                await waitForCondition(
                    () => {
                        const currentWindow =
                            iframe.contentWindow;

                        const currentDocument =
                            iframe.contentDocument;

                        if (
                            !currentWindow ||
                            !currentDocument ||
                            !currentDocument.documentElement ||
                            currentDocument.readyState ===
                                "loading"
                        ) {
                            return false;
                        }

                        let pathname = "";

                        try {
                            pathname =
                                currentWindow.location.pathname;
                        } catch (_) {
                            return false;
                        }

                        if (
                            pathname !== reviewUrl &&
                            !pathname.endsWith(
                                `/plugins/submit/step3/${plugin.id}`
                            )
                        ) {
                            return false;
                        }

                        const form =
                            currentDocument.querySelector(
                                "#plugin_step3_form"
                            ) ||
                            currentDocument.querySelector(
                                "form[name='plugin_update_form']"
                            );

                        if (!form) {
                            return false;
                        }

                        return {
                            frameDocument:
                                currentDocument,
                            frameWindow:
                                currentWindow,
                            form,
                        };
                    },
                    `submitted review step3 form (${reviewUrl}; page: ${iframe.contentDocument?.title || "untitled"})`,
                    15000
                );

            progress("formulário localizado", reviewUrl);

            const {
                frameDocument,
                form,
            } = context;

            const nameInput =
                form.querySelector(
                    "#plugin_update_form_name"
                );

            const descriptionInput =
                form.querySelector(
                    "#plugin_update_form_description"
                );

            const screenshotsInput =
                form.querySelector(
                    "#plugin_update_form_screenshots"
                );

            const tokenInput =
                form.querySelector(
                    "input[name='plugin_update_form[_token]']"
                );

            if (
                !nameInput ||
                !descriptionInput ||
                !screenshotsInput ||
                !tokenInput?.value
            ) {
                throw new Error(
                    "Submitted review step3 name/description/screenshots/token fields were not found."
                );
            }

            const preservedName =
                String(
                    nameInput.value ||
                    plugin.component
                ).trim();

            if (!preservedName) {
                throw new Error(
                    "Submitted review step3 plugin name is empty."
                );
            }

            const html =
                buildMarketplaceDescriptionHtml(
                    plugin.component,
                    catalog.description_html
                );

            const maxLength =
                Number(
                    descriptionInput.getAttribute(
                        "maxlength"
                    )
                );

            /*
             * Atualiza somente Description. O nome existente é preservado e
             * seguirá no FormData porque é required no formulário do step3.
             */
            setFormValue(
                descriptionInput,
                html
            );

            const {
                previousScreenshotFiles,
                existingScreenshotNames,
                obsoleteScreenshotNames,
                screenshotsReset,
                screenshotsToUpload,
                skippedScreenshots,
            } = await replaceMarketplaceScreenshots(
                iframe,
                "plugin_update_form_screenshots",
                "plugin_update_form[screenshots][]",
                form,
                screenshotsInput,
                setupScreenshots,
                (index, total, screenshot) => progress(
                    "enviando screenshot",
                    `${index}/${total}: ${screenshot.filename || screenshot.file?.name}`
                )
            );

            /*
             * new FormData(form) imita o submit real da página e, diferente
             * de formToFormData(), também preserva File inputs caso esta
             * instalação do FilePond esteja usando storeAsFile/fallback
             * nativo em vez de server.process.
             */
            const formData =
                new FormData(
                    form
                );

            /*
             * Garante explicitamente o valor atualizado da Description caso
             * algum controller do editor tenha mantido estado próprio.
             */
            formData.set(
                "plugin_update_form[description]",
                html
            );

            formData.set(
                "plugin_update_form[name]",
                preservedName
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
                        reviewUrl,
                        location.origin
                    ).toString();

            progress("salvando Description e Screenshots", postUrl);

            const controller = new AbortController();
            const postTimer = setTimeout(
                () => controller.abort(),
                CONFIG.reviewPostTimeoutMs
            );
            let response;
            let responseHtml;
            try {
                response = await marketplaceFetch(postUrl, {
                    method: "POST",
                    body: formData,
                    signal: controller.signal,
                });
                responseHtml = await response.text();
            } catch (error) {
                if (controller.signal.aborted) {
                    throw new Error(
                        `Timeout after ${CONFIG.reviewPostTimeoutMs / 1000}s saving Submitted for review step3.`
                    );
                }
                throw error;
            } finally {
                clearTimeout(postTimer);
            }

            progress("verificando resposta", response.url);

            const resultDocument =
                new DOMParser()
                    .parseFromString(
                        responseHtml,
                        "text/html"
                    );

            const errors = [
                ...resultDocument.querySelectorAll(
                    [
                        ".alert-danger",
                        ".alert-error",
                        ".form-error-message",
                        ".invalid-feedback",
                        "[aria-invalid='true'] + .invalid-feedback",
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
                    "Submitted review step3: " +
                    errors.join(" | ")
                );
            }

            const resultTextarea =
                resultDocument.querySelector(
                    "#plugin_update_form_description"
                );

            if (
                resultTextarea &&
                !isDescriptionSemanticallyPersisted(
                    html,
                    resultTextarea.value ||
                        ""
                )
            ) {
                throw new Error(
                    "Submitted review step3 Description was not persisted with the expected content."
                );
            }

            await verifyPersistedScreenshots(
                reviewUrl, "plugin_update_form_screenshots",
                setupScreenshots, previousScreenshotFiles
            );

            return {
                url:
                    response.url,
                htmlLength:
                    html.length,
                configuredMaxLength:
                    Number.isFinite(
                        maxLength
                    )
                        ? maxLength
                        : null,
                exceedsDeclaredMaxLength:
                    Number.isFinite(
                        maxLength
                    ) &&
                    maxLength > 0 &&
                    html.length > maxLength,
                existingScreenshotNames:
                    [
                        ...existingScreenshotNames,
                    ],
                deletedScreenshotNames:
                    obsoleteScreenshotNames,
                screenshotsReset,
                uploadedScreenshotNames:
                    screenshotsToUpload.map(
                        (screenshot) =>
                            screenshot.filename
                    ),
                skippedScreenshotNames:
                    skippedScreenshots.map(
                        (screenshot) =>
                            screenshot.filename
                    ),
            };
        } finally {
            iframe.remove();
        }
    }


    async function syncMarketplaceReviewDetails(
        plugin,
        status,
        catalog
    ) {
        status.set(
            "Preparando Description e Screenshots da revisão...",
            plugin.component
        );

        const setupScreenshots =
            await getCatalogSetupScreenshots(
                plugin.component,
                catalog
            );

        status.set(
            "Sincronizando Submitted for review...",
            `${setupScreenshots.length} screenshot(s) · Description HTML`
        );

        const result =
            await submitMarketplaceReviewDetails(
                plugin,
                catalog,
                setupScreenshots,
                (step, detail) => status.set(
                    `Submitted for review · ${step}`,
                    detail || plugin.component
                )
            );

        status.set(
            "Submitted for review sincronizado",
            [
                `Description HTML · ${result.htmlLength} caracteres`,
                result.deletedScreenshotNames.length
                    ? `${result.deletedScreenshotNames.length} screenshot(s) removida(s): ${result.deletedScreenshotNames.join(", ")}`
                    : null,
                result.uploadedScreenshotNames.length
                    ? `${result.uploadedScreenshotNames.length} screenshot(s) adicionada(s): ${result.uploadedScreenshotNames.join(", ")}`
                    : "screenshots já sincronizadas",
                result.skippedScreenshotNames.length
                    ? `limite do Marketplace impediu: ${result.skippedScreenshotNames.join(", ")}`
                    : null,
                result.exceedsDeclaredMaxLength
                    ? `campo declara limite de ${result.configuredMaxLength}`
                    : null,
            ]
                .filter(Boolean)
                .join(" · "),
            (
                result.skippedScreenshotNames.length ||
                result.exceedsDeclaredMaxLength
            )
                ? "warning"
                : "success"
        );

        return result;
    }


    async function syncMarketplaceOverviewAssets(
        plugin,
        status,
        catalog = null
    ) {
        const overviewCatalog =
            catalog ||
            await apiCatalog(
                plugin.component
            );

        status.set(
            "Preparando ícone e screenshots...",
            `${overviewCatalog.iconUrl} · ${overviewCatalog.screenshots.length} arquivo(s)`
        );

        const setupIcon =
            await getCatalogSetupImage(
                plugin.component,
                overviewCatalog
            );

        const setupScreenshots =
            await getCatalogSetupScreenshots(
                plugin.component,
                overviewCatalog,
                (
                    current,
                    total,
                    filename
                ) => {
                    status.set(
                        `Preparando screenshots ${current}/${total}`,
                        filename
                    );
                }
            );

        status.set(
            "Overview 0/9 · iniciando sincronização",
            `${overviewCatalog.name || plugin.component} · ${setupScreenshots.length} screenshot(s)`
        );

        const overviewResult =
            await submitMarketplaceOverview(
                plugin,
                overviewCatalog,
                setupIcon,
                setupScreenshots,
                (
                    current,
                    total,
                    label,
                    details
                ) => {
                    status.set(
                        `Overview ${current}/${total} · ${label}`,
                        details
                    );
                }
            );

        status.set(
            "Overview sincronizado",
            [
                "ícone substituído",
                overviewResult.deletedScreenshotNames.length
                    ? `${overviewResult.deletedScreenshotNames.length} screenshot(s) removida(s): ${overviewResult.deletedScreenshotNames.join(", ")}`
                    : null,
                overviewResult.uploadedScreenshotNames.length
                    ? `${overviewResult.uploadedScreenshotNames.length} screenshot(s) adicionada(s): ${overviewResult.uploadedScreenshotNames.join(", ")}`
                    : "screenshots já sincronizadas",
                overviewResult.skippedScreenshotNames.length
                    ? `limite do Marketplace impediu: ${overviewResult.skippedScreenshotNames.join(", ")}`
                    : null,
            ]
                .filter(Boolean)
                .join(" · "),
            overviewResult.skippedScreenshotNames.length
                ? "warning"
                : "success"
        );

        return {
            catalog:
                overviewCatalog,
            result:
                overviewResult,
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

        const overviewSync =
            await syncMarketplaceOverviewAssets(
                plugin,
                status,
                catalog
            );

        const overviewResult =
            overviewSync.result;

        const descriptionResult =
            await syncMarketplaceDescription(
                plugin,
                status,
                catalog
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

                description:
                    descriptionResult,

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
         * STEP 2 é manual.
         *
         * O POST do step1 normalmente termina na URL do step2 com cacheKey.
         * Quando o HTML final já é o step2, validamos esse próprio documento;
         * se ele só trouxer o destino, fazemos apenas o GET necessário para
         * conferir a URL do GitHub. O formulário continua sempre manual.
         */
        const expectedStep2Path =
            `/plugins/${pluginId}/versions/add/step2`;

        let step2Url =
            new URL(
                uploadResponse.url,
                location.origin
            );

        let step2Document =
            uploadDocument;

        if (
            step2Url.pathname !==
            expectedStep2Path
        ) {
            const step2Target =
                uploadDocument.querySelector(
                    `form[action*="${expectedStep2Path}"], a[href*="${expectedStep2Path}"]`
                );

            const targetUrl =
                step2Target?.tagName === "FORM"
                    ? step2Target.getAttribute(
                        "action"
                    )
                    : step2Target?.getAttribute(
                        "href"
                    );

            if (!targetUrl) {
                throw new Error(
                    "Step2 URL not found after step1 upload."
                );
            }

            step2Url =
                new URL(
                    targetUrl,
                    location.origin
                );

            const step2 =
                await marketplaceHtml(
                    step2Url.toString()
                );

            step2Document =
                step2.document;

            step2Url =
                new URL(
                    step2.response.url,
                    location.origin
                );
        }

        const repositoryValidation =
            validateStep2GitHubRepository(
                step2Document,
                repositoryInfo
            );

        console.log(
            "[Marketplace] Step2 GitHub:",
            repositoryValidation
        );

        return {
            url:
                step2Url.toString(),
            manualStep2: true,
            repositoryValidation,
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

        /*
         * O estado Submitted for review possui uma tela própria:
         * /plugins/submit/step3/[id].
         *
         * Nessa tela sincronizamos somente Description e Screenshots.
         * Published/Hidden/Changes needed continuam usando as páginas de
         * edição normais de Overview e Description.
         */
        let overviewSync = null;
        let descriptionResult = null;
        let reviewDetailsResult = null;

        status.set(
            plugin.submittedForReview
                ? "Lendo plugins.json para Step3..."
                : "Lendo plugins.json para Overview e Description...",
            plugin.component
        );

        const catalog =
            await apiCatalog(
                plugin.component
            );

        if (plugin.submittedForReview) {
            reviewDetailsResult =
                await syncMarketplaceReviewDetails(
                    plugin,
                    status,
                    catalog
                );
        } else {
            overviewSync =
                await syncMarketplaceOverviewAssets(
                    plugin,
                    status,
                    catalog
                );

            descriptionResult =
                await syncMarketplaceDescription(
                    plugin,
                    status,
                    catalog
                );
        }

        /*
         * Não existe cache de estado do plugin no navegador.
         * A versão do Marketplace é conferida em toda execução; para dados
         * do GitHub, a única camada de cache é o api.php.
         */

        status.set(
            plugin.needsChanges
                ? "Changes needed · verificando Marketplace..."
                : plugin.submittedForReview
                    ? "Submitted for review · verificando Marketplace..."
                    : "Verificando Marketplace..."
        );

        const versionsUrl =
            plugin.submittedForReview
                ? `/plugins/submit/step3/${plugin.id}`
                : `/plugins/${plugin.id}/edit/versions`;

        const versions =
            await marketplaceHtml(
                versionsUrl
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

        if (
            plugin.needsChanges ||
            plugin.submittedForReview
        ) {
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

        /*
         * Support é mantido para todo plugin com repositório válido,
         * independentemente de ser novo, Published, Changes needed,
         * estar atualizado ou estar no cache local.
         */
        let supportResult = null;

        if (!plugin.submittedForReview) {
            status.set(
                "Consultando suporte no GitHub...",
                repository.fullName
            );

            const supportInfo =
                await apiSupport(
                    repository.fullName
                );

            status.set(
                "Atualizando Support...",
                `${supportInfo.repository_url} · issues · ${supportInfo.docs_exists && supportInfo.has_pages ? "GitHub Pages" : "sem Documentation"}`
            );

            supportResult =
                await submitMarketplaceSupport(
                    plugin,
                    repository,
                    supportInfo
                );

            status.set(
                "Support atualizado",
                `${supportResult.repositoryUrl} · ${supportResult.issueUrl} · Documentation: ${supportResult.documentationUrl || "vazia"} · ${supportResult.websiteUrl}`,
                "success"
            );
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
                plugin.component,
                plugin.needsChanges
            );

        status.setDebug(
            "repositoryInfo",
            repositoryInfo
        );

        if (repositoryInfo.cached) {
            status.set(
                "GitHub via cache PHP",
                repository.fullName
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
                    : plugin.submittedForReview
                        ? "Submitted for review · versão atual"
                        : "Atualizado",
                `Marketplace ${marketplace.release} (${marketplace.build}) Â· ` +
                `GitHub ${remoteRelease} (${remoteBuild})`,
                (
                    plugin.needsChanges ||
                    plugin.submittedForReview
                )
                    ? "warning"
                    : "success"
            );

            return {
                state: "current",
                overview:
                    overviewSync?.result ||
                    null,
                description:
                    descriptionResult,
                reviewDetails:
                    reviewDetailsResult,
            };
        }

        status.set(
            plugin.needsChanges
                ? "Changes needed · nova versão encontrada"
                : plugin.submittedForReview
                    ? "Submitted for review · nova versão no GitHub"
                    : "Nova versÃ£o",
            `Marketplace ${marketplace.release} (${marketplace.build}) → ` +
            `GitHub ${remoteRelease} (${remoteBuild})`,
            "warning"
        );

        /*
         * Submitted for review também aceita nova versão. O próprio step3
         * aponta para /plugins/[id]/versions/add/step1; portanto o upload
         * continua pelo mesmo fluxo step1 -> step2 usado nos demais estados.
         */
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
                : plugin.submittedForReview
                    ? "Atualizando versão em revisão..."
                    : "Publicando no Marketplace...",
            `${zip.name} Â· /plugins/${plugin.id}/versions/add/step1 + step2`
        );

        const result =
            await uploadMarketplaceVersion(
                plugin.id,
                zip,
                repositoryInfo
            );

        const repositoryValidation =
            result.repositoryValidation;

        status.set(
            repositoryValidation?.valid
                ? "ZIP enviado · Step2 GitHub OK"
                : "ZIP enviado · Step2: conferir GitHub",
            `${remoteRelease} (${remoteBuild}) · ` +
            (
                repositoryValidation?.message ||
                "validação da URL do GitHub indisponível"
            ),
            repositoryValidation?.valid
                ? "success"
                : "warning"
        );

        /*
         * Não salva no cache de plugin OK aqui. O step2 ainda depende de
         * confirmação manual e marcar como OK faria uma próxima execução
         * ignorar uma versão que ainda não foi efetivamente publicada.
         */
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

                    if (
                        result.result?.url
                    ) {
                        counters.step2Links.push({
                            id:
                                item.plugin.id,
                            component:
                                item.plugin.component,
                            url:
                                result.result.url,
                            repositoryValidation:
                                result.result
                                    .repositoryValidation ||
                                null,
                        });

                        /*
                         * Não espera todos os workers terminarem. O popup
                         * aparece no primeiro Step2 e recebe os próximos
                         * incrementalmente enquanto o processamento continua.
                         */
                        showStep2Popup(
                            counters.step2Links
                        );
                    }
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

            step2Links: [],
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

        showStep2Popup(
            counters.step2Links
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
