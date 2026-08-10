function isAllowedPdfSource(source) {
    if (source.startsWith("/") && !source.startsWith("//"))
        return true;
    if (!source.startsWith("blob:"))
        return false;
    try {
        const blobOrigin = new URL(source.slice(5)).origin;
        return typeof window === "undefined" || blobOrigin === window.location.origin;
    }
    catch {
        return false;
    }
}
export function buildPdfViewerUrl(source, page = 1) {
    const params = new URLSearchParams({ pdf: source });
    params.set("page", String(Math.max(1, Math.trunc(page) || 1)));
    return `/?${params.toString()}`;
}
export function getPdfViewerRequest(search) {
    const params = new URLSearchParams(search);
    const source = params.get("pdf")?.trim() ?? "";
    if (!source || !isAllowedPdfSource(source))
        return null;
    const requestedPage = Number(params.get("page"));
    return {
        source,
        page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
    };
}
