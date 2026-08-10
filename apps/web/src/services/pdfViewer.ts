export type PdfViewerRequest = {
  source: string;
  page: number;
};

function isAllowedPdfSource(source: string): boolean {
  if (source.startsWith("/") && !source.startsWith("//")) return true;
  if (!source.startsWith("blob:")) return false;

  try {
    const blobOrigin = new URL(source.slice(5)).origin;
    return typeof window === "undefined" || blobOrigin === window.location.origin;
  } catch {
    return false;
  }
}

export function buildPdfViewerUrl(source: string, page = 1): string {
  const params = new URLSearchParams({ pdf: source });
  params.set("page", String(Math.max(1, Math.trunc(page) || 1)));
  return `/?${params.toString()}`;
}

export function getPdfViewerRequest(search: string): PdfViewerRequest | null {
  const params = new URLSearchParams(search);
  const source = params.get("pdf")?.trim() ?? "";
  if (!source || !isAllowedPdfSource(source)) return null;

  const requestedPage = Number(params.get("page"));
  return {
    source,
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  };
}
