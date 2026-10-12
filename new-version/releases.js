(() => {

    "use strict";

    // Loaded on demand only when the user selects: releases.

    const bridge = window.__marketplaceActionBridge__;

    if (!bridge || typeof bridge.register !== "function") {

        throw new Error("Marketplace shared api.js must load first.");

    }

    const { CONFIG, marketplaceErrorMessage, marketplaceFetch, marketplaceHtml, apiCatalog } = bridge.common;

    const openedStep2Urls = new Set();

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

    async function inspectPlugin(plugin, status) {
        if (plugin.needsSetup) {
            status.set("Ignorado", "Plugin aguarda configuração inicial; nenhuma versão enviada.", "warning");
            return { state: "skipped" };
        }

        // Releases only need the catalog to resolve certain repository URLs.
        const catalog = (
            plugin.needsChanges || plugin.submittedForReview
        ) ? await apiCatalog(plugin.component) : null;

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

            return { state: "current" };
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

    bridge.register("releases", { inspectPlugin, showStep2Popup });

})();

