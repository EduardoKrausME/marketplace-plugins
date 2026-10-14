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
        "2026-10-14.02-screenshot-fallback";

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

    async function worker(queue, counters, operation) {
        while (queue.length) {
            const item = queue.shift();
            if (!item) {
                continue;
            }

            let status = null;
            try {
                // A malformed status row must not abort queue construction.
                status = addStatusRow(item.plugin);

                const result = await operation.inspectPlugin(item.plugin, status);

                if (result.state === "uploaded") {
                    counters.uploaded++;

                    if (result.result?.url) {
                        counters.step2Links.push({
                            id: item.plugin.id,
                            component: item.plugin.component,
                            url: result.result.url,
                            repositoryValidation:
                                result.result.repositoryValidation || null,
                        });

                        // Popup errors must not invalidate an uploaded plugin.
                        try {
                            operation.showStep2Popup?.(counters.step2Links);
                        } catch (popupError) {
                            console.error(
                                "[Marketplace] Unable to display Step2 popup:",
                                popupError
                            );
                        }
                    }
                }

                if (result.state === "setup") {
                    counters.setup++;
                }
                if (result.state === "assets") {
                    counters.assets++;
                }
                if (result.state === "current") {
                    counters.current++;
                }
                if (result.state === "outdated") {
                    counters.outdated++;
                }
                if (result.state === "skipped") {
                    counters.skipped++;
                }
            } catch (error) {
                counters.errors++;

                const message = marketplaceErrorMessage(error);
                let debug = {};
                try {
                    debug = status?.getDebugContext?.() || {};
                } catch (debugError) {
                    console.error("[Marketplace] Error reading debug context:", debugError);
                }

                // Keep a queryable failure record for the entire batch.
                counters.failures.push({
                    id: item.plugin.id,
                    component: item.plugin.component,
                    phase: debug.status || "initializing",
                    message,
                    details: debug.details || "",
                });

                try {
                    logMarketplaceError(error, {
                        plugin: item.plugin,
                        debug,
                    });
                } catch (loggingError) {
                    console.error(
                        "[Marketplace] Unable to log plugin error:",
                        loggingError,
                        item.plugin.component,
                        message
                    );
                }

                try {
                    // Leave the failed plugin's status visible on the page.
                    if (!status) {
                        status = addStatusRow(item.plugin);
                    }
                    status.set("Erro", message, "error");
                } catch (statusError) {
                    console.error(
                        "[Marketplace] Unable to show plugin error status:",
                        item.plugin.component,
                        statusError
                    );
                }
            } finally {
                counters.done++;
                console.log(
                    `[Marketplace] ${counters.done}/${counters.total}` +
                    ` | enviados=${counters.uploaded}` +
                    ` | mídias=${counters.assets}` +
                    ` | configurados=${counters.setup}` +
                    ` | atuais=${counters.current}` +
                    ` | ignorados=${counters.skipped}` +
                    ` | erros=${counters.errors}`
                );
            }

            // The next item runs whether the current one succeeded or failed.
            await sleep(CONFIG.delayBetweenPluginsMs);
        }
    }

    function chooseMarketplaceAction() {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.id = "marketplace-action-popup";
            overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px";
            const dialog = document.createElement("div");
            dialog.setAttribute("role", "dialog");
            dialog.setAttribute("aria-modal", "true");
            dialog.setAttribute("aria-labelledby", "marketplace-action-title");
            dialog.style.cssText = "width:min(600px,100%);max-height:90vh;overflow:auto;background:#fff;color:#212529;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.35);padding:26px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
            const title = document.createElement("h2");
            title.id = "marketplace-action-title";
            title.textContent = "O que deseja atualizar?";
            title.style.cssText = "font-size:22px;margin:0 0 8px";
            const help = document.createElement("p");
            help.textContent = "Selecione uma operação. A outra não será executada.";
            help.style.cssText = "margin:0 0 20px;color:#6c757d;font-size:14px";
            const options = document.createElement("div");
            options.style.cssText = "display:grid;gap:12px";
            const buttons = [];
            let finished = false;

            function finish(action) {
                if (finished) return;
                finished = true;
                document.removeEventListener("keydown", handleKeys, true);
                overlay.remove();
                resolve(action);
            }
            function makeButton(action, label, description) {
                const button = document.createElement("button");
                button.type = "button";
                button.style.cssText = "display:block;width:100%;text-align:left;padding:15px 18px;border:1px solid #ced4da;border-radius:9px;background:#f8f9fa;color:#212529;cursor:pointer;font:inherit";
                const name = document.createElement("strong");
                name.textContent = label;
                name.style.cssText = "display:block;font-size:16px;margin-bottom:6px";
                const detail = document.createElement("span");
                detail.textContent = description;
                detail.style.cssText = "display:block;font-size:13px;color:#495057;line-height:1.45";
                button.append(name, detail);
                button.addEventListener("click", () => finish(action));
                options.appendChild(button);
                buttons.push(button);
            }

            makeButton(
                "releases",
                "Atualizar plugins com base no release",
                "Verifica as versões e envia novos ZIPs. Não altera ícones, screenshots, descrição ou Support."
            );
            makeButton(
                "media",
                "Atualizar ícones, screenshots e descrição",
                "Sincroniza os dados do catálogo sem enviar ZIPs e sem alterar Support."
            );

            const footer = document.createElement("div");
            footer.style.cssText = "display:flex;justify-content:flex-end;margin-top:20px";
            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.textContent = "Cancelar";
            cancel.style.cssText = "background:#fff;border:1px solid #ced4da;border-radius:7px;padding:8px 15px;cursor:pointer";
            cancel.addEventListener("click", () => finish(null));
            footer.appendChild(cancel);
            dialog.append(title, help, options, footer);
            overlay.appendChild(dialog);

            function handleKeys(event) {
                if (event.key === "Escape") {
                    event.preventDefault();
                    finish(null);
                } else if (event.key === "Tab") {
                    const focusable = [...buttons, cancel];
                    const index = focusable.indexOf(document.activeElement);
                    if (event.shiftKey && index <= 0) {
                        event.preventDefault();
                        focusable[focusable.length - 1].focus();
                    } else if (!event.shiftKey && index === focusable.length - 1) {
                        event.preventDefault();
                        focusable[0].focus();
                    }
                }
            }
            overlay.addEventListener("click", event => {
                if (event.target === overlay) finish(null);
            });
            document.addEventListener("keydown", handleKeys, true);
            document.body.appendChild(overlay);
            buttons[0].focus();
        });
    }


    // The startup script exposes these operations to the selected module only.
    const MARKETPLACE_MODULE_SOURCE = document.currentScript?.src || CONFIG.apiUrl;
    const SHARED_ACTION_SERVICES = Object.freeze({
        CONFIG,
        sleep,
        marketplaceErrorMessage,
        marketplaceFetch,
        marketplaceHtml,
        apiCatalog,
    });

    function loadMarketplaceModule(action) {
        const fileNames = {
            releases: "releases.js",
            media: "media.js",
        };
        if (!Object.hasOwn(fileNames, action)) {
            return Promise.reject(new Error("Invalid Marketplace action: " + action));
        }

        const url = new URL(fileNames[action], MARKETPLACE_MODULE_SOURCE);
        url.searchParams.set("build", SCRIPT_BUILD);
        const bridgeName = "__marketplaceActionBridge__";

        return new Promise((resolve, reject) => {
            if (window[bridgeName]) {
                reject(new Error("Marketplace module loader is already in use."));
                return;
            }

            let registered = null;
            let settled = false;
            const script = document.createElement("script");
            script.src = url.toString();
            script.async = true;

            const timeout = setTimeout(() => finish(
                new Error("Timeout loading Marketplace module: " + url)
            ), 30000);

            function finish(error = null) {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (window[bridgeName] === bridgeAPI) {
                    delete window[bridgeName];
                }
                script.remove();
                if (error) reject(error);
                else resolve(registered);
            }

            const bridgeAPI = Object.freeze({
                common: SHARED_ACTION_SERVICES,
                register(name, handler) {
                    if (name !== action || registered) {
                        throw new Error("Unexpected Marketplace module: " + name);
                    }
                    if (!handler || typeof handler.inspectPlugin !== "function") {
                        throw new Error("Marketplace module is missing inspectPlugin.");
                    }
                    registered = handler;
                },
            });

            window[bridgeName] = bridgeAPI;
            script.addEventListener("load", () => {
                finish(registered ? null : new Error(
                    "Module loaded without registering its action: " + url
                ));
            }, { once: true });
            script.addEventListener("error", () => {
                finish(new Error("Failed to load Marketplace module: " + url));
            }, { once: true });

            document.head.appendChild(script);
        });
    }



    async function main() {
        if (window.top !== window.self) {
            return;
        }

        // Prevent two injections of the script from concurrently updating the
        // same plugin in this tab; a completed run releases the lock.
        if (window.__marketplacePluginBatchRunning__) {
            console.warn("[Marketplace] A batch is already running. Duplicate invocation skipped.");
            return;
        }
        window.__marketplacePluginBatchRunning__ = true;
        try {
            if (document.readyState === "loading") {
                await new Promise(resolve => {
                    document.addEventListener("DOMContentLoaded", resolve, {once:true});
                });
            }
            const action = await chooseMarketplaceAction();
            if (!action) {
                console.info("[Marketplace] Cancelado; nenhum plugin processado.");
                return;
            }
            console.info("[Marketplace] Operação selecionada:", action);
            const operation = await loadMarketplaceModule(action);
            const plugins = getDashboardPlugins();

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

            assets: 0,

            setup: 0,

            current: 0,

            outdated: 0,

            skipped: 0,

            errors: 0,

            failures: [],
            step2Links: [],
        };

        // Failed items remain available for inspection after the batch.
        window.marketplacePluginErrors = counters.failures;

        const queue = plugins.map((plugin) => ({ plugin }));

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
                    counters,
                    operation
                )
            );
        }

        const outcomes = await Promise.allSettled(workers);
        for (const outcome of outcomes) {
            if (outcome.status === "rejected") {
                console.error("[Marketplace] Worker stopped unexpectedly:", outcome.reason);
            }
        }

        console.log("[Marketplace] Finalizado", counters);
        if (counters.failures.length) {
            console.warn(
                `[Marketplace] ${counters.failures.length} plugin(s) com erro; ` +
                "os demais itens foram processados."
            );
            console.table(counters.failures);
        }

        if (counters.step2Links.length) {
            try {
                operation.showStep2Popup?.(counters.step2Links);
            } catch (popupError) {
                console.error("[Marketplace] Unable to show Step2 summary:", popupError);
            }
        }
        } finally {
            window.__marketplacePluginBatchRunning__ = false;
        }
    }


    main().catch((error) => {
        console.error("[Marketplace]", error);
    });
})();
