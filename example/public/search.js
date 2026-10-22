// Recherche Pagefind : l'interface est chargée à la première ouverture de la boîte de dialogue
const openButton = document.querySelector("#search-open");
const dialog = document.querySelector("#search-dialog");
const closeButton = document.querySelector("#search-close");

const load = (tag, attributes) => new Promise((resolve, reject) => {
    document.head.append(Object.assign(document.createElement(tag), attributes, { onload: resolve, onerror: reject }));
});

if (openButton && dialog instanceof HTMLDialogElement && closeButton) {
    let ready;

    openButton.addEventListener("click", async () => {
        dialog.showModal();
        ready ??= Promise.all([
            load("link", { rel: "stylesheet", href: "/pagefind/pagefind-ui.css" }),
            load("script", { src: "/pagefind/pagefind-ui.js" }),
        ]).then(() => new PagefindUI({ element: "#search", showSubResults: false, showImages: false, autofocus: true }));

        try {
            await ready;
        } catch {
            ready = undefined;
            document.querySelector("#search").textContent = "La recherche est momentanément indisponible.";
        }
    });

    closeButton.addEventListener("click", () => dialog.close());
}
