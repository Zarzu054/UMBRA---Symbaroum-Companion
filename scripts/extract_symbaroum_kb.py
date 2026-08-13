from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
OUT_DIR = ROOT / "data" / "knowledge"


KEYWORD_GROUPS: Dict[str, List[str]] = {
    "atributos": ["atributo", "discreto", "preciso", "rapido", "resolutivo", "persuasivo", "vigilante", "tenaz"],
    "resolucion": ["tirada", "prueba", "d20", "modificador", "exito", "fallo"],
    "combate": ["combate", "ataque", "defensa", "armadura", "danio", "iniciativa"],
    "corrupcion": ["corrupcion", "temporal", "permanente", "mancha", "abominacion"],
    "magia": ["misterio", "ritual", "poder", "hechizo", "tradicion", "artefacto"],
    "talentos": ["habilidad", "talento", "principiante", "adepto", "maestro"],
    "equipo": ["arma", "escudo", "armadura", "equipo", "objeto", "reliquia"],
    "bestiario": ["criatura", "monstruo", "bestia", "abominacion", "no muerto"],
    "aventura": ["aventura", "escena", "acto", "trama", "encuentro", "pnj"],
}


@dataclass
class BookSummary:
    path: str
    kind: str
    pages: int
    extracted_pages: int
    total_chars: int
    top_signals: Dict[str, int]


def normalize_text(text: str) -> str:
    text = text.lower()
    text = text.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def book_kind(path: Path) -> str:
    s = str(path).lower()
    if "rule books" in s:
        return "rule_book"
    if "adventure books" in s:
        return "adventure_book"
    return "other"


def extract_book(path: Path) -> tuple[BookSummary, List[dict]]:
    reader = PdfReader(str(path))
    page_samples: List[dict] = []
    signals = Counter()
    total_chars = 0
    extracted_pages = 0

    for idx, page in enumerate(reader.pages, start=1):
        raw = page.extract_text() or ""
        norm = normalize_text(raw)
        if not norm:
            continue

        extracted_pages += 1
        total_chars += len(norm)

        for group, words in KEYWORD_GROUPS.items():
            hits = 0
            for w in words:
                hits += len(re.findall(rf"\b{re.escape(w)}\b", norm))
            if hits:
                signals[group] += hits

        # Keep short samples per book/page as traceability anchors.
        if len(page_samples) < 25 and len(norm) > 160:
            snippet = norm[:360]
            page_samples.append(
                {
                    "page": idx,
                    "snippet": snippet,
                }
            )

    summary = BookSummary(
        path=str(path.relative_to(ROOT)),
        kind=book_kind(path),
        pages=len(reader.pages),
        extracted_pages=extracted_pages,
        total_chars=total_chars,
        top_signals=dict(signals.most_common(8)),
    )
    return summary, page_samples


def render_markdown(summaries: List[BookSummary], global_signals: Dict[str, int]) -> str:
    total_books = len(summaries)
    total_pages = sum(b.pages for b in summaries)
    total_extracted = sum(b.extracted_pages for b in summaries)

    lines: List[str] = []
    lines.append("# Baseline de Reglas de Symbaroum (Analisis Automatico)")
    lines.append("")
    lines.append("Documento generado automaticamente desde los PDFs locales en `docs/`.")
    lines.append("Sirve como base de trabajo para modelar la app segun Symbaroum original.")
    lines.append("")
    lines.append("## Cobertura")
    lines.append("")
    lines.append(f"- Libros detectados: **{total_books}**")
    lines.append(f"- Paginas totales: **{total_pages}**")
    lines.append(f"- Paginas con texto extraido: **{total_extracted}**")
    lines.append("")
    lines.append("## Senales globales detectadas")
    lines.append("")
    for key, value in sorted(global_signals.items(), key=lambda x: x[1], reverse=True):
        lines.append(f"- {key}: {value}")
    lines.append("")
    lines.append("## Libros analizados")
    lines.append("")
    for b in summaries:
        lines.append(f"- `{b.path}` ({b.kind})")
        lines.append(f"  - paginas: {b.pages}, extraidas: {b.extracted_pages}, caracteres: {b.total_chars}")
        if b.top_signals:
            top = ", ".join([f"{k}={v}" for k, v in b.top_signals.items()])
            lines.append(f"  - senales: {top}")
        else:
            lines.append("  - senales: sin texto util extraido (posible PDF escaneado)")
    lines.append("")
    lines.append("## Proximo paso recomendado")
    lines.append("")
    lines.append("- Crear entidades de compendio: reglas, poderes, rasgos, equipo, criaturas, rituales, estados.")
    lines.append("- Parsear por secciones y paginas para trazabilidad exacta al libro.")
    lines.append("- Implementar buscador semantico + filtros por libro/pagina/tipo.")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pdf_paths = sorted(DOCS_DIR.rglob("*.pdf"))

    summaries: List[BookSummary] = []
    samples_by_book: Dict[str, List[dict]] = {}
    global_signals = defaultdict(int)

    for path in pdf_paths:
        summary, samples = extract_book(path)
        summaries.append(summary)
        samples_by_book[summary.path] = samples
        for key, value in summary.top_signals.items():
            global_signals[key] += value

    index_payload = {
        "books": [summary.__dict__ for summary in summaries],
    }
    signals_payload = {
        "global_signals": dict(global_signals),
        "samples": samples_by_book,
    }

    (OUT_DIR / "symbaroum_library_index.json").write_text(
        json.dumps(index_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (OUT_DIR / "symbaroum_rule_signals.json").write_text(
        json.dumps(signals_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (ROOT / "docs" / "SYMBAROUM_REGLAS_BASELINE_ES.md").write_text(
        render_markdown(summaries, dict(global_signals)),
        encoding="utf-8",
    )

    print(f"Procesados {len(summaries)} PDFs.")
    print(f"Salida: {OUT_DIR}")


if __name__ == "__main__":
    main()
