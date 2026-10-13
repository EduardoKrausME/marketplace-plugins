(() => {

    "use strict";

    // Loaded on demand only when the user selects: media.

    const bridge = window.__marketplaceActionBridge__;

    if (!bridge || typeof bridge.register !== "function") {

        throw new Error("Marketplace shared api.js must load first.");

    }

    const {
        CONFIG,
        sleep,
        marketplaceErrorMessage,
        marketplaceFetch,
        marketplaceHtml,
        apiCatalog,
    } = bridge.common;



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
                originalName: screenshot.originalName || filename,
                catalogId: screenshot.id ?? null,
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

    function publishedAssetName(asset) {
        return normalizeAssetFilename(asset?.originalName || asset?.filename);
    }

    function marketplaceCatalogNames(asset) {
        return [
            asset?.filename,
            asset?.originalName,
            asset?.marketplaceOriginalName,
            asset?.file?.name,
        ].map(normalizeAssetFilename).filter(Boolean);
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

        /*
         * FilePond can be imported into the Marketplace's Stimulus bundle
         * rather than exposed as window.FilePond. Resolve the controller's
         * live instance before falling back to its visible remove buttons.
         */
        if (!pond) {
            const applications = [
                frameWindow.Stimulus,
                frameWindow.application,
                frameWindow.stimulusApplication,
            ].filter(Boolean);
            const hosts = [root, browser, pondScope].filter(Boolean);
            for (const app of applications) {
                if (pond || typeof app.getControllerForElementAndIdentifier !== "function") {
                    continue;
                }
                for (const host of hosts) {
                    const controller = app.getControllerForElementAndIdentifier(host, "filepond");
                    const candidate = controller?.pond || controller?.filepond ||
                        controller?.filePond || controller?.instance ||
                        controller?.filePondInstance;
                    if (candidate &&
                        typeof candidate.getFiles === "function" &&
                        typeof candidate.removeFile === "function") {
                        pond = candidate;
                        break;
                    }
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
        if (pond && typeof pond.removeFile === "function") {
            // Use FilePond's item reference (not the Marketplace numeric ID)
            // so its configured server.remove callback runs for local files.
            for (const file of [...(pond.getFiles?.() || [])]) {
                pond.removeFile(file, {remove: true});
            }
        } else if (pond && typeof pond.removeFiles === "function") {
            pond.removeFiles();
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

    function prepareMarketplaceScreenshots(screenshotInput, screenshots, onUpload = null) {
        if (!screenshots.length) {
            throw new Error("No catalog screenshots were provided.");
        }

        const expected = screenshots.map((item) =>
            normalizeAssetFilename(item.filename || item.file?.name)
        );
        if (expected.some((name) => !name) ||
            new Set(expected).size !== expected.length) {
            throw new Error("Missing or duplicate screenshot filenames: " + expected.join(", "));
        }

        const declaredMax = Number(
            screenshotInput.getAttribute("data-filepond-max-files-value")
        );
        const maxFiles = Number.isFinite(declaredMax) && declaredMax > 0
            ? declaredMax
            : 10;
        if (screenshots.length > maxFiles) {
            throw new Error(
                "The catalog has " + screenshots.length + " screenshots, but the " +
                "Marketplace allows " + maxFiles + ". No gallery was changed."
            );
        }

        // This DOM metadata is only used for reporting. Always perform a
        // fresh server GET before deciding whether uploads are safe.
        const previousScreenshotFiles = getFilePondExistingFiles(screenshotInput);
        const existingScreenshotNames = new Set(
            previousScreenshotFiles.map((item) =>
                publishedAssetName(item)
            ).filter(Boolean)
        );
        const obsoleteScreenshotNames = previousScreenshotFiles.map((item) =>
            String(item?.originalName || item?.filename || "").trim()
        ).filter(Boolean);

        for (const [index, screenshot] of screenshots.entries()) {
            onUpload?.(index + 1, screenshots.length, screenshot);
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

    function buildMarketplaceAssetFormData(form, groups, mediaFields = []) {
        const formData = new FormData(form);

        // Existing FilePond controls may supply empty File placeholders or
        // stale hidden tokens. Don't resubmit them by accident.
        for (const fieldName of new Set([
            ...mediaFields, ...groups.map((group) => group.fieldName)
        ])) {
            const baseName = fieldName.replace(/\[\]$/, "");
            formData.delete(baseName);
            formData.delete(baseName + "[]");
        }

        for (const { fieldName, files } of groups) {

            if (!files.length) {
                throw new Error("No files to upload for " + fieldName);
            }

            for (const file of files) {
                if (!file?.name || !Number.isFinite(file.size) || file.size <= 0) {
                    throw new Error("Invalid catalog file for " + fieldName);
                }
                formData.append(fieldName, file, file.name);
            }

            const actual = formData.getAll(fieldName);
            if (actual.length !== files.length ||
                actual.some((value, index) =>
                    typeof value === "string" ||
                    value.name !== files[index].name ||
                    value.size !== files[index].size
                )) {
                throw new Error(
                    "Multipart payload is incomplete for " + fieldName +
                    ": expected " + files.length + ", found " + actual.length
                );
            }
        }

        return formData;
    }

    function marketplaceGalleryDiff(published, catalog) {
        const expected = catalog.map((asset) => ({
            name: normalizeAssetFilename(asset.filename || asset.file?.name),
            names: marketplaceCatalogNames(asset),
            size: asset.file?.size,
            id: asset.catalogId ?? asset.id ?? null,
            asset,
        }));
        const actual = published.map((asset) => ({
            name: publishedAssetName(asset),
            size: Number(asset.size),
            id: asset.id ?? null,
            asset,
        }));
        const used = new Set();
        const extra = [];
        for (const item of actual) {
            const match = expected.findIndex((entry, index) =>
                !used.has(index) &&
                (entry.names.includes(item.name) ||
                    (entry.id != null && item.id != null &&
                        String(entry.id) === String(item.id))) &&
                (!Number.isFinite(item.size) || item.size <= 0 ||
                    entry.size === item.size)
            );
            if (match < 0) {
                extra.push(item);
            } else {
                used.add(match);
            }
        }
        const missing = expected.filter((entry, index) => !used.has(index))
            .map((entry) => entry.asset);
        return {
            same: extra.length === 0 && missing.length === 0,
            expected, actual, extra, missing,
        };
    }

    async function readMarketplaceAssetState(pageUrl, rootId) {
        // Always ask the server for fresh HTML after an attempted deletion.
        const response = await marketplaceFetch(pageUrl, {cache: "no-store"});
        const html = await response.text();
        const input = new DOMParser().parseFromString(
            html, "text/html"
        ).getElementById(rootId);
        if (!input) {
            throw new Error(rootId + ": Marketplace asset field was not returned.");
        }
        const raw = input.getAttribute("data-filepond-existing-files-value") ??
            input.dataset?.filepondExistingFilesValue;
        if (typeof raw !== "string" || !raw.trim()) {
            throw new Error(
                rootId + ": cannot inspect published assets; " +
                "upload blocked to avoid duplicating images."
            );
        }
        let files;
        try {
            files = JSON.parse(raw);
        } catch (_) {
            throw new Error(rootId + ": invalid published-assets JSON.");
        }
        if (!Array.isArray(files)) {
            throw new Error(rootId + ": published assets must be an array.");
        }
        return files;
    }

    async function verifyEmptyMarketplaceAssets(pageUrl, rootId) {
        const first = await readMarketplaceAssetState(pageUrl, rootId);
        if (first.length) {
            return first;
        }
        await sleep(350);
        return readMarketplaceAssetState(pageUrl, rootId);
    }

    function findMarketplaceFilePond(iframe, rootId) {
        const frame = iframe.contentWindow;
        const doc = iframe.contentDocument;
        const root = doc?.getElementById(rootId);
        if (!frame || !root) {
            throw new Error(rootId + ": FilePond input is unavailable.");
        }
        const browser = findFilePondBrowser(root) || root;
        const scope = getFilePondScope(root, browser);
        const candidates = [
            browser, root, scope,
            browser.closest?.(".filepond--root"),
            ...Array.from(scope?.querySelectorAll?.("input[type=file]") || []),
        ].filter(Boolean);

        const API = frame.FilePond;
        if (typeof API?.find === "function") {
            for (const candidate of candidates) {
                try {
                    const pond = API.find(candidate);
                    if (pond?.getFiles && pond?.removeFile) return {pond, scope};
                } catch (_) {}
            }
        }
        for (const app of [
            frame.Stimulus, frame.application, frame.stimulusApplication,
        ].filter(Boolean)) {
            if (typeof app.getControllerForElementAndIdentifier !== "function") continue;
            for (const candidate of candidates) {
                const controller = app.getControllerForElementAndIdentifier(
                    candidate, "filepond"
                );
                const pond = controller?.pond || controller?.filepond ||
                    controller?.filePond || controller?.instance ||
                    controller?.filePondInstance;
                if (pond?.getFiles && pond?.removeFile) return {pond, scope};
            }
        }
        return {pond: null, scope};
    }

    function marketplaceFilePondItemMatches(item, serverAsset, strict = false) {
        const source = item?.source || item?.serverId ||
            item?.file?.source || "";
        const sourceText = String(
            typeof source === "object" ?
                (source.url || source.id || "") : source
        );
        const serverId = String(serverAsset.id ?? "");
        const stored = normalizeAssetFilename(serverAsset.filename);
        const storedFromSource = normalizeAssetFilename(
            sourceText.split("?")[0].split("/").pop()
        );
        if (sourceText && serverId && sourceText === serverId) return true;
        if (stored && sourceText && storedFromSource === stored) return true;
        if (serverAsset.url && sourceText &&
            sourceText.split("?")[0] === String(serverAsset.url).split("?")[0]) {
            return true;
        }
        if (strict) return false;
        // Fallback only when this is the unique matching visible item or
        // one of several interchangeable exact-name duplicates.
        return publishedAssetName(serverAsset) === normalizeAssetFilename(
            item?.filename || item?.file?.name
        ) && (!serverAsset.size || !item?.file?.size ||
            Number(serverAsset.size) === Number(item.file.size));
    }

    async function removeMarketplaceFilePondAsset(iframe, rootId, serverAsset) {
        let context = findMarketplaceFilePond(iframe, rootId);
        if (!context.pond) {
            // Stimulus sometimes attaches FilePond after the iframe's load.
            for (let i = 0; i < 8 && !context.pond; i++) {
                await sleep(150);
                context = findMarketplaceFilePond(iframe, rootId);
            }
        }
        const {pond, scope} = context;
        if (pond) {
            const items = Array.from(pond.getFiles());
            const exact = items.filter((item) =>
                marketplaceFilePondItemMatches(item, serverAsset, true)
            );
            const nameMatches = exact.length ? [] : items.filter((item) =>
                marketplaceFilePondItemMatches(item, serverAsset)
            );
            // When the server reports a surplus duplicate, any matching
            // copy of that exact originalName and byte size is interchangeable.
            // Choose one per pass; persisted reconciliation will stop when
            // only the catalog's expected copy remains.
            const chosen = exact[0] || nameMatches[nameMatches.length - 1] || null;
            if (chosen) {
                // Passing the FilePond item reference is documented; the
                // numeric Marketplace screenshot ID is not a FilePond ID.
                await Promise.resolve(pond.removeFile(chosen, {remove: true}));
                return "filepond-api";
            }
        }

        // DOM fallback only when the target has a unique matching file label.
        // Idle placeholders (no active button) are reported, never assumed
        // removed or skipped as successful.
        const matches = Array.from(
            scope?.querySelectorAll?.(".filepond--item") || []
        ).filter((item) => {
            const label = item.querySelector(".filepond--file-info-main")
                ?.textContent?.trim() || "";
            return normalizeAssetFilename(label) === publishedAssetName(serverAsset);
        });
        if (matches.length) {
            const button = matches[matches.length - 1].querySelector(
                ".filepond--action-remove-item"
            );
            if (button && !button.disabled) {
                button.click();
                return "filepond-button";
            }
        }
        throw new Error(
            rootId + ": cannot identify a removable FilePond item for " +
            (serverAsset.originalName || serverAsset.filename) +
            " (Marketplace ID " + (serverAsset.id ?? "?") + "). " +
            "The Marketplace removal endpoint is not available."
        );
    }

    async function clearPersistedMarketplaceAssets(
        iframe, pageUrl, rootId, catalog = []
    ) {
        let saved = await readMarketplaceAssetState(pageUrl, rootId);
        let lastError = "";
        for (let pass = 0; pass < 3; pass++) {
            const extras = marketplaceGalleryDiff(saved, catalog).extra;
            if (!extras.length) return saved;
            const frame = pass === 0 ? iframe : await createSetupIframe(pageUrl);
            try {
                for (const extra of extras) {
                    const current = await readMarketplaceAssetState(pageUrl, rootId);
                    const stillExtra = marketplaceGalleryDiff(current, catalog)
                        .extra.find((asset) =>
                            String(asset.id ?? asset.name) ===
                            String(extra.id ?? extra.name)
                        );
                    if (!stillExtra) continue;
                    try {
                        const method = await removeMarketplaceFilePondAsset(
                            frame, rootId, stillExtra.asset
                        );
                        console.info("[Marketplace] Remove requested",
                            rootId, stillExtra.id, method);
                    } catch (error) {
                        lastError = marketplaceErrorMessage(error);
                        console.warn("[Marketplace] Remove failed",
                            rootId, stillExtra.id, lastError);
                    }
                    // Check the actual server records, not DOM item counts.
                    await sleep(550);
                    saved = await readMarketplaceAssetState(pageUrl, rootId);
                }
            } finally {
                if (pass > 0) frame.remove();
            }
            saved = await readMarketplaceAssetState(pageUrl, rootId);
        }
        const extras = marketplaceGalleryDiff(saved, catalog).extra;
        if (extras.length) {
            throw new Error(
                rootId + ": unable to remove " + extras.length +
                " extra image(s): " + extras.map((item) =>
                    item.name + " (Marketplace ID " + (item.id ?? "?") + ")"
                ).join(", ") + ". Upload blocked; continuing with next plugin." +
                (lastError ? " FilePond: " + lastError : "")
            );
        }
        return saved;
    }

    async function verifyCatalogGallery(pageUrl, rootId, catalog) {
        let observed = "";
        for (let attempt = 0; attempt < 3; attempt++) {
            const current = await readMarketplaceAssetState(pageUrl, rootId);
            const diff = marketplaceGalleryDiff(current, catalog);
            observed = diff.actual.map((item) =>
                item.name + (item.size > 0 ? " (" + item.size + " bytes)" : "")
            ).join(", ") || "(empty)";
            if (diff.same) return;
            if (attempt < 2) await sleep(700);
        }
        throw new Error(rootId + ": gallery differs from plugins.json. Expected " +
            catalog.map((item) => item.filename || item.file?.name).join(", ") +
            "; found " + observed);
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
             * O ícone não é enviado enquanto o servidor ainda registrar
             * algum ícone anterior. Esta verificação acontece antes do POST.
             */
            progress(
                4,
                "preparando substituição do ícone",
                setupIcon.file?.name || setupIcon.path || ""
            );

            progress(
                5,
                "ícone preparado para POST",
                `${setupIcon.file?.name || "ícone"} · ${setupIcon.file?.size || 0} bytes`
            );

            let iconUpdated = false;

            /*
             * Os bytes atuais do catálogo serão enviados via multipart,
             * após a remoção dos registros previamente armazenados.
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
            } = prepareMarketplaceScreenshots(
                screenshotsInput,
                setupScreenshots,
                (index, total, screenshot) => progress(
                    7, "preparando screenshots",
                    `${index}/${total} · ${screenshot.filename || screenshot.file?.name}`
                )
            );

            // Only discard mismatched/duplicate images; retain matching
            // archived images, including local_kopere_proctoring's new-2.png.
            const previousIconFiles = await readMarketplaceAssetState(
                overviewUrl, "plugin_edit_overview_form_icon"
            );
            const existingServerScreenshots = await readMarketplaceAssetState(
                overviewUrl, "plugin_edit_overview_form_screenshots"
            );
            const expectedIcon = [{filename: setupIcon.file.name, file: setupIcon.file}];
            let screenshotDiff = marketplaceGalleryDiff(
                existingServerScreenshots, setupScreenshots
            );
            let iconDiff = marketplaceGalleryDiff(previousIconFiles, expectedIcon);
            progress(7, "comparando com plugins.json",
                existingServerScreenshots.length + " publicada(s), " +
                setupScreenshots.length + " esperada(s)");
            if (screenshotDiff.extra.length) {
                const saved = await clearPersistedMarketplaceAssets(
                    iframe, overviewUrl, "plugin_edit_overview_form_screenshots",
                    setupScreenshots
                );
                screenshotDiff = marketplaceGalleryDiff(saved, setupScreenshots);
            }
            if (iconDiff.extra.length) {
                const saved = await clearPersistedMarketplaceAssets(
                    iframe, overviewUrl, "plugin_edit_overview_form_icon", expectedIcon
                );
                iconDiff = marketplaceGalleryDiff(saved, expectedIcon);
            }
            if (screenshotDiff.extra.length || iconDiff.extra.length) {
                throw new Error("Extra Marketplace images remain; upload blocked.");
            }
            const missingScreenshots = screenshotDiff.missing;
            const missingIcons = iconDiff.missing;
            const shouldUploadScreenshots = missingScreenshots.length > 0;
            const shouldUploadIcon = missingIcons.length > 0;
            iconUpdated = shouldUploadIcon;

            console.log(
                `[Marketplace] Assets do Overview: ${plugin.component}`,
                {
                    iconUpdated,
                    existingScreenshots:
                        [
                            ...existingScreenshotNames,
                        ],
                    deletedScreenshots: existingServerScreenshots
                        .filter((item) => !screenshotDiff.actual.some((saved) =>
                            String(saved.id) === String(item.id)))
                        .map((item) => item.originalName || item.filename),
                    screenshotsReset: shouldUploadScreenshots,
                    uploadedScreenshots: missingScreenshots.map((item) => item.filename),
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

            const fileGroups = [];
            if (shouldUploadIcon) {
                fileGroups.push({
                    fieldName: "plugin_edit_overview_form[icon]",
                    files: missingIcons.map((item) => item.file),
                });
            }
            if (shouldUploadScreenshots) {
                fileGroups.push({
                    fieldName: "plugin_edit_overview_form[screenshots][]",
                    files: missingScreenshots.map((item) => item.file),
                });
            }
            const formData = buildMarketplaceAssetFormData(form, fileGroups, [
                "plugin_edit_overview_form[icon]",
                "plugin_edit_overview_form[screenshots][]",
            ]);

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
             * O POST inclui apenas os arquivos divergentes do catálogo,
             * preservando os campos já corretos e o token CSRF.
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

            await verifyCatalogGallery(
                overviewUrl, "plugin_edit_overview_form_screenshots", setupScreenshots
            );
            await verifyCatalogGallery(
                overviewUrl, "plugin_edit_overview_form_icon", expectedIcon
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
                deletedScreenshotNames: existingServerScreenshots
                    .filter((item) => !screenshotDiff.actual.some((saved) =>
                        String(saved.id) === String(item.id)))
                    .map((item) => item.originalName || item.filename),
                screenshotsReset: shouldUploadScreenshots,
                screenshotPaths: shouldUploadScreenshots
                    ? screenshotsToUpload.map((screenshot) => screenshot.path)
                    : [],
                uploadedScreenshotNames: missingScreenshots.map((item) => item.filename),
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
            } = prepareMarketplaceScreenshots(
                screenshotsInput,
                setupScreenshots,
                (index, total, screenshot) => progress(
                    "preparando screenshot",
                    `${index}/${total}: ${screenshot.filename || screenshot.file?.name}`
                )
            );

            const publishedReviewScreenshots = await readMarketplaceAssetState(
                reviewUrl, "plugin_update_form_screenshots"
            );
            let reviewDiff = marketplaceGalleryDiff(
                publishedReviewScreenshots, setupScreenshots
            );
            if (reviewDiff.extra.length) {
                progress("excluindo imagens excedentes",
                    reviewDiff.extra.length + " arquivo(s)");
                const saved = await clearPersistedMarketplaceAssets(
                    iframe, reviewUrl, "plugin_update_form_screenshots",
                    setupScreenshots
                );
                reviewDiff = marketplaceGalleryDiff(saved, setupScreenshots);
            }
            if (reviewDiff.extra.length) {
                throw new Error("Review gallery still contains extra images; upload blocked.");
            }
            const missingScreenshots = reviewDiff.missing;
            const shouldUploadScreenshots = missingScreenshots.length > 0;

            /*
             * O FormData preserva os demais campos da página, mas recebe
             * screenshots novas explicitamente para não depender do estado
             * interno/visual do FilePond.
             */
            const formData = buildMarketplaceAssetFormData(
                form,
                shouldUploadScreenshots
                    ? [{
                        fieldName: "plugin_update_form[screenshots][]",
                        files: missingScreenshots.map((item) => item.file),
                    }]
                    : [],
                ["plugin_update_form[screenshots][]"]
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

            await verifyCatalogGallery(
                reviewUrl, "plugin_update_form_screenshots", setupScreenshots
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
                deletedScreenshotNames: publishedReviewScreenshots
                    .filter((item) => !reviewDiff.actual.some((saved) =>
                        String(saved.id) === String(item.id)))
                    .map((item) => item.originalName || item.filename),
                screenshotsReset: shouldUploadScreenshots,
                uploadedScreenshotNames: missingScreenshots.map((item) => item.filename),
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
                overviewResult.iconUpdated
                    ? "ícone substituído"
                    : "ícone já sincronizado",
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

    async function inspectPlugin(plugin, status) {

            status.set("Lendo plugins.json para mídia e descrição...", plugin.component);
            const catalog = await apiCatalog(plugin.component);

            if (plugin.submittedForReview) {
                // Step3 exposes only description and screenshots while in review.
                const reviewDetails = await syncMarketplaceReviewDetails(
                    plugin, status, catalog
                );
                return { state: "assets", reviewDetails };
            }

            const overview = await syncMarketplaceOverviewAssets(
                plugin, status, catalog
            );
            const description = await syncMarketplaceDescription(
                plugin, status, catalog
            );
            if (!description.ok) {
                throw new Error("Description was not synchronized: " + description.error);
            }
            return { state: "assets", overview: overview.result, description };
    }

    bridge.register("media", { inspectPlugin });

})();

