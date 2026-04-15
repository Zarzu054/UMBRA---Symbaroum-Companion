const FIELD_LABELS = {
    name: "Nombre",
    summary: "Resumen",
    setting: "Ambientación",
    notes: "Notas",
    sharedNotes: "Notas compartidas",
    email: "Correo",
    password: "Contraseña",
    currentPassword: "Contraseña actual",
    newPassword: "Nueva contraseña",
    confirmPassword: "Confirmación de contraseña",
    title: "Título",
    label: "Categoría",
    content: "Contenido",
    faction: "Facción",
    depth: "Nivel",
    type: "Tipo",
    source: "Fuente",
    sourceFilter: "Fuente",
    category: "Categoría",
    threat: "Peligro",
    search: "Búsqueda",
    query: "Búsqueda",
    aliases: "Alias",
    tags: "Etiquetas",
    personalidad: "Personalidad",
    formaDeActuar: "Forma de actuar",
    motivaciones: "Motivaciones",
    notesOnly: "Notas",
    detailLevel: "Nivel de detalle"
};
function normalizeFieldName(path) {
    if (!path) {
        return "Campo";
    }
    const raw = Array.isArray(path) ? path[path.length - 1] : path.split(".").pop() ?? path;
    return FIELD_LABELS[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}
function normalizeValidationMessage(message) {
    const raw = (message ?? "").trim();
    const lower = raw.toLowerCase();
    if (!raw) {
        return "Valor inválido.";
    }
    if (lower.includes("required") || lower.includes("expected") && lower.includes("received undefined")) {
        return "Este campo es obligatorio.";
    }
    if (lower.includes("invalid email")) {
        return "Introduce un correo válido.";
    }
    if (lower.includes("invalid enum")) {
        return "Selecciona una opción válida.";
    }
    if (lower.includes("expected number") || lower.includes("received nan")) {
        return "Introduce un número válido.";
    }
    const minChars = raw.match(/at least (\d+) character/i);
    if (minChars) {
        return `Debe tener al menos ${minChars[1]} caracteres.`;
    }
    const maxChars = raw.match(/at most (\d+) character/i);
    if (maxChars) {
        return `Debe tener como máximo ${maxChars[1]} caracteres.`;
    }
    const minItems = raw.match(/at least (\d+) item/i);
    if (minItems) {
        return `Debe incluir al menos ${minItems[1]} elementos.`;
    }
    const maxItems = raw.match(/at most (\d+) item/i);
    if (maxItems) {
        return `Debe incluir como máximo ${maxItems[1]} elementos.`;
    }
    if (lower.includes("too small")) {
        return "El valor es demasiado pequeño.";
    }
    if (lower.includes("too big")) {
        return "El valor es demasiado grande.";
    }
    if (lower.includes("invalid")) {
        return "El valor no es válido.";
    }
    return raw.endsWith(".") ? raw : `${raw}.`;
}
function isTechnicalMessage(message) {
    return /(zod|string must|invalid enum|expected number|received nan|required|too small|too big|character\(s\))/i.test(message);
}
function getStatusFallback(status) {
    switch (status) {
        case 400:
            return "Revisa los datos introducidos e inténtalo de nuevo.";
        case 401:
            return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
        case 403:
            return "No tienes permisos para realizar esta acción.";
        case 404:
            return "No se ha encontrado el recurso solicitado.";
        case 409:
            return "No se ha podido completar la acción por un conflicto con los datos actuales.";
        case 422:
            return "Revisa los datos introducidos e inténtalo de nuevo.";
        case 429:
            return "Has realizado demasiadas acciones seguidas. Espera un momento e inténtalo otra vez.";
        default:
            if (status >= 500) {
                return "Se ha producido un error interno. Inténtalo de nuevo en unos instantes.";
            }
            return `No se ha podido completar la solicitud (${status}).`;
    }
}
export async function readFriendlyApiError(response) {
    try {
        const payload = (await response.json());
        const details = Array.isArray(payload.details) ? payload.details : [];
        if (details.length > 0) {
            return details
                .map((detail) => `${normalizeFieldName(detail.path)}: ${normalizeValidationMessage(detail.message)}`)
                .join("\n");
        }
        const message = payload.message ?? payload.error ?? "";
        if (message && !isTechnicalMessage(message)) {
            return message;
        }
        return getStatusFallback(response.status);
    }
    catch {
        return getStatusFallback(response.status);
    }
}
