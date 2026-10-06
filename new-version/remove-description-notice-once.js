(() => {
    "use strict";

    const CONFIG = {
        apiUrl: "https://eduardokraus.com/marketplace-plugins/new-version/api.php",
        concurrency: 2,
        delayBetweenPluginsMs: 500,
    };

    if (window.__marketplaceRemoveDescriptionNoticeOnce) {
        console.warn("[Marketplace] Este script já foi executado nesta página.");
        return;
    }

    window.__marketplaceRemoveDescriptionNoticeOnce = true;

    const sleep = (ms) =>
        new Promise((resolve) => setTimeout(resolve, ms));

    async function marketplaceFetch(url, options = {}) {
        const response = await fetch(url, {
            credentials: "include",
            redirect: "follow",
            ...options,
        });

        if (!response.ok) {
            throw new Error(
                "Marketplace HTTP " + response.status + " em " + url
            );
        }

        return response;
    }

    async function marketplaceHtml(url) {
        const response = await marketplaceFetch(url);
        const html = await response.text();

        return {
            response,
            html,
            document: new DOMParser().parseFromString(
                html,
                "text/html"
            ),
        };
    }

    async function apiCatalog(component) {
        const url = new URL(CONFIG.apiUrl);

        url.searchParams.set("action", "catalog");
        url.searchParams.set("component", component);

        const response = await fetch(url.toString(), {
            cache: "no-store",
        });

        let data;

        try {
            data = await response.json();
        } catch (_) {
            throw new Error(
                "Catalog retornou JSON inválido para " +
                component +
                " (HTTP " +
                response.status +
                ")"
            );
        }

        if (!response.ok) {
            throw new Error(
                (data && data.error) ||
                "Catalog HTTP " +
                response.status +
                " para " +
                component
            );
        }

        if (
            !data ||
            data.component !== component ||
            typeof data.description_html !== "string" ||
            !data.description_html.trim()
        ) {
            throw new Error(
                "description_html não encontrado para " +
                component
            );
        }

        return data;
    }

    function getDashboardPlugins() {
        const plugins = new Map();

        for (const row of document.querySelectorAll("table tbody tr")) {
            const cells = row.querySelectorAll("td");

            if (cells.length < 2) {
                continue;
            }

            const componentCell = cells[1];

            const component =
                (componentCell.querySelector("span") &&
                    componentCell.querySelector("span").textContent.trim()) ||
                componentCell.textContent.trim();

            if (!component) {
                continue;
            }

            const links = [
                ...row.querySelectorAll(
                    "a[href^='/plugins/']"
                ),
            ];

            let id = null;

            for (const link of links) {
                const match =
                    link
                        .getAttribute("href")
                        ?.match(
                            /^\/plugins\/(\d+)(?:\/|$)/
                        );

                if (match) {
                    id = Number(match[1]);
                    break;
                }
            }

            if (!id) {
                continue;
            }

            plugins.set(id, {
                id,
                component,
            });
        }

        return [...plugins.values()];
    }

    function getFormErrors(documentObject) {
        return [
            ...documentObject.querySelectorAll(
                [
                    ".alert-danger",
                    ".alert-error",
                    ".form-error-message",
                    "[aria-invalid='true'] + .invalid-feedback",
                ].join(",")
            ),
        ]
            .map((element) =>
                element.textContent.trim()
            )
            .filter(Boolean);
    }

    async function updateDescription(plugin) {
        const descriptionUrl =
            "/plugins/" +
            plugin.id +
            "/edit/description";

        console.log(
            "[Marketplace] " +
            plugin.component +
            ": lendo " +
            descriptionUrl
        );

        const results =
            await Promise.all([
                apiCatalog(plugin.component),
                marketplaceHtml(descriptionUrl),
            ]);

        const catalog =
            results[0];

        const page =
            results[1];

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
                "Formulário, textarea ou token da Description não encontrado."
            );
        }

        /*
         * Grava SOMENTE o HTML vindo do catálogo.
         * Não chama buildMarketplaceDescriptionHtml(),
         * portanto o notice não é adicionado.
         */
        const html =
            String(
                catalog.description_html
            ).trim();

        if (
            String(
                descriptionInput.value || ""
            ).trim() === html
        ) {
            console.log(
                "[Marketplace] " +
                plugin.component +
                ": já está sem o notice."
            );

            return {
                state: "unchanged",
            };
        }

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
                    method: "POST",
                    body: formData,
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

        const errors =
            getFormErrors(
                resultDocument
            );

        if (errors.length) {
            throw new Error(
                "Description: " +
                errors.join(" | ")
            );
        }

        const resultTextarea =
            resultDocument.querySelector(
                "#plugin_edit_description_form_description"
            );

        if (
            resultTextarea &&
            !String(
                resultTextarea.value || ""
            ).trim()
        ) {
            throw new Error(
                "O Marketplace devolveu a Description vazia após salvar."
            );
        }

        console.log(
            "[Marketplace] " +
            plugin.component +
            ": Description atualizada sem notice."
        );

        return {
            state: "updated",
            url: response.url,
            htmlLength: html.length,
        };
    }

    async function worker(queue, counters) {
        while (queue.length) {
            const plugin =
                queue.shift();

            if (!plugin) {
                return;
            }

            try {
                const result =
                    await updateDescription(
                        plugin
                    );

                if (
                    result.state ===
                    "updated"
                ) {
                    counters.updated++;
                } else {
                    counters.unchanged++;
                }
            } catch (error) {
                counters.errors++;

                console.error(
                    "[Marketplace] " +
                    plugin.component +
                    " (#" +
                    plugin.id +
                    "):",
                    error
                );
            }

            counters.done++;

            console.log(
                "[Marketplace] " +
                counters.done +
                "/" +
                counters.total +
                " | atualizados=" +
                counters.updated +
                " | já corretos=" +
                counters.unchanged +
                " | erros=" +
                counters.errors
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
            console.warn(
                "[Marketplace] Nenhum plugin encontrado na tabela desta página."
            );
            return;
        }

        console.log(
            "[Marketplace] " +
            plugins.length +
            " plugins encontrados. Iniciando correção única das Descriptions."
        );

        const counters = {
            total: plugins.length,
            done: 0,
            updated: 0,
            unchanged: 0,
            errors: 0,
        };

        const queue =
            [...plugins];

        const concurrency =
            Math.max(
                1,
                Math.min(
                    CONFIG.concurrency,
                    plugins.length
                )
            );

        await Promise.all(
            Array.from(
                {
                    length:
                        concurrency,
                },
                () =>
                    worker(
                        queue,
                        counters
                    )
            )
        );

        console.log(
            "[Marketplace] Correção finalizada:",
            counters
        );
    }

    main().catch((error) => {
        console.error(
            "[Marketplace] Erro geral:",
            error
        );
    });
})();
