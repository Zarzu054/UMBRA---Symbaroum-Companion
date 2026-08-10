"""Extract the canonical monster profiles from the bundled Symbaroum PDFs.

The generated TypeScript/JavaScript modules are committed so the application
does not need a PDF parser at runtime. Run from the repository root:

    python scripts/generate-monster-codex.py
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pymupdf


ROOT = Path(__file__).resolve().parents[1]
CODEX_PDF = ROOT / "apps/web/public/books/codice-de-monstruos.pdf"
BASIC_PDF = ROOT / "apps/web/public/books/libro-basico.pdf"
TS_OUTPUT = ROOT / "packages/shared/src/monsterCodexCatalog.generated.ts"
JS_OUTPUT = ROOT / "packages/shared/src/monsterCodexCatalog.generated.js"

BASIC_PROFILE_SPECS = [
    ("ELFO VERNAL", 202), ("elfo estival verde", 202),
    ("ELFO ESTIVAL MADURO", 203), ("ELFO OTOÑAL", 203),
    ("TROLL SAQUEADOR, HAMBRIENTO", 205), ("TROLL SAQUEADOR, SOCIABLE", 205),
    ("TROLL, CACIQUE", 206), ("ARCHITROLL", 206),
    ("CULTISTA, SEGUIDOR", 209), ("CULTISTA, LÍDER", 209),
    ("BANDIDO, SALTEADOR", 209), ("BANDIDO, JEFE", 209),
    ("EXPLORADOR DE LA REINA", 210), ("EXPLORADOR DE LA REINA, CAPITÁN", 210),
    ("CAZAMONSTRUOS, AUTODIDACTA", 212), ("CAZAMONSTRUOS, MANTO NEGRO", 212),
    ("AVENTURERO", 213), ("CAZATESOROS, SAQUEADOR", 213),
    ("GUERRERO DE POBLADO", 214), ("GUERRERO BÁRBARO, GUARDIA DEL CLAN", 214),
    ("MARAÑOSA", 217), ("ARAÑA TRAMPERA", 217),
    ("BAIAGORNO", 218), ("GATO VÍBORA", 218), ("ABOJALÍ", 219),
    ("KANARAN", 221), ("LINDORMA", 221), ("KRANKA", 223),
    ("LIBÉLULA DRAGÓN", 223), ("HUMANO RENACIDO", 224),
    ("ALCE RENACIDO", 224), ("ABOJALÍ RENACIDO", 226),
    ("ABOMINACIÓN PRIMIGENIA", 226), ("DRAGUL", 228),
    ("HIELO FATUO", 228), ("NECROMAGO", 230), ("MORATUMBAS", 231),
]

ATTRIBUTE_PATTERNS = {
    "quick": "Ágil",
    "vigilant": "Atento",
    "accurate": "Diestro",
    "discreet": "Discreto",
    "strong": "Fuerte",
    "cunning": "Inteligente",
    "persuasive": "Persuasivo",
    "resolute": "Tenaz",
}

FIELD_MARKERS = [
    "Conducta",
    "Raza",
    "Desafío",
    "Rasgos",
    "Habilidades",
    "Bendiciones/Cargas",
    "Bendiciones/ Cargas",
    "Armas",
    "Armadura",
    "Defensa",
    "Resistencia",
    "Umbral de dolor",
    "Equipo",
    "Sombra",
    "Tácticas:",
]

EXTENDED_HEADINGS = [
    "ARAK, EMPONZOÑADOR",
    "ARAK, EXALTADO",
    "BESTIAAL, CAZADOR ALADO",
    "BESTIAAL, RASGADOR",
    "BESTIAAL, CENTELLAR",
    "CENTELLA",
    "GUARDIA DEL CLAN CENTELLAR",
    "ABOJALÍ CENTELLAR",
    "COLOSSEO",
    "DESTELLO",
    "DEVORADOR DE RÍO",
    "DRAGÓN",
    "DRAGORMA",
    "ESPINO VIVIENTE, SALVAJE",
    "ESPINO VIVIENTE, FAMILIAR",
    "FUSCO, CAZADOR",
    "FUSCO, LÍDER",
    "GWANN, MATADOR",
    "GWANN",
    "MALTRASGO, SIERVO DE NECROMAGO",
    "MANAGAAL, RETOÑO",
    "MANAGAAL, ADULTO",
    "MARIPOSAS ENJAMBRERAS NOCTURNAS, NUBE ASESINA",
    "MARIPOSAS EMJAMBRERAS NOCTURNAS, ENJAMBRE",
    "MARLO",
    "NEFARANI",
    "PESADILLA",
    "PRÍNCIPE DE LA MUERTE",
    "ROECRÁNEOS, CRÍA",
    "ROECRÁNEOS, MACHACADOR",
    "ROECRÁNEOS, REINA",
    "SAÑA",
    "SAPO REAL, ANCIANO",
    "SAPO REAL, JOVEN",
    "SAUCE VORAZ, VIEJO TRITURADOR",
    "SAUCE VORAZ, RETOÑO ESTRANGULADOR",
    "SERPIENTE MADRE, TUNELADORA",
    "SERPIENTE MADRE, ENGULLIDORA",
    "SOCARRÓN",
    "SOMBRA TROLL",
    "ENJAMBRE DE TERMITAS PURULENTAS",
    "FURIA INSACIABLE",
    "SÍLFIDE RABIOSA",
    "ONDINA ASFIXIANTE",
    "GNOMO GLOTÓN",
]

FAMILY_OVERRIDES = {
    "Guardia del clan centellar": "Centella",
    "Abojalí centellar": "Centella",
    "Dragorma": "Dragón",
    "Furia insaciable": "Terreno vengativo",
    "Sílfide rabiosa": "Terreno vengativo",
    "Ondina asfixiante": "Terreno vengativo",
    "Gnomo glotón": "Terreno vengativo",
    "Enjambre de termitas purulentas": "Termita purulenta",
}

COMPACT_RENAMES = {
    "Bruja, guardiana": "Bruja guardiana",
    "Caballo, entrenado para el combate": "Caballo de combate",
    "Espía de la reina": "Espía de la Reina",
    "Jakaar, entrenado para el combate": "Jakaar de combate",
    "Las termitas peste negra": "Termitas de la peste negra",
    "Trasgo, chamán": "Trasgo chamán",
    "Trasgo, jefe": "Trasgo jefe",
    "Trasgo, miembro de tribu": "Trasgo miembro de la tribu",
}

EXTENDED_RENAMES = {
    "MARIPOSAS EMJAMBRERAS NOCTURNAS, ENJAMBRE": "MARIPOSAS ENJAMBRERAS NOCTURNAS, ENJAMBRE",
}

RACE_OVERRIDES = {
    # This profile shares a page with a sidebar whose heading is interleaved by
    # the PDF text layer between the race and challenge fields.
    "Manto negro veterano": "Humano (ambrio)",
}

EXCLUDED_COMPACT_HEADINGS = {
    "Caballo",
    "Caballo, entrenado para el combate",
}

COMPACT_PROFILE_HEADINGS = {
    "Azote de Prios", "Flagelante", "Liturgista", "Manto negro veterano",
    "Templario veterano", "Teúrgo", "Adepto de la Ordo", "Alquimista de asedio",
    "Artesano de artefactos", "Maestre de la Ordo", "Maestre de rituales", "Magistrado",
    "Novicio de la Ordo", "Alguacil", "Caballero", "Escudero", "Señor",
    "Bruja, guardiana", "Bruja de poblado", "Cazador de monstruos", "Guía rural",
    "Trasgo, chamán", "Trasgo, jefe", "Trasgo, miembro de tribu", "Trasgo guerrero",
    "Arquero", "Espía de la reina", "Infante", "Mozo de labranza", "Oficial", "Pansar",
    "Piquero", "Zapador", "Artesano", "Borracho", "Matón", "Medicus", "Mocoso noble",
    "Perro guardián", "Posadero", "Ratero", "Vendedor de fármacos ambulante",
    "Alce", "Avispón", "Bicho de fuego", "Darak", "Ferbero", "Hada renacida",
    "Jakaar, entrenado para el combate", "Jakaar, salvaje", "Kelder", "Lince feérico",
    "Monje errante", "Osogro", "Perdido", "Araña batalladora", "Araña cazadora",
    "Arbusto asesino", "Espectro", "Gato de sangre", "Gusano corrupto", "Laraña",
    "Lobo gigante", "Señor de la cripta", "Las termitas peste negra", "Anguila martillo",
    "Garoug", "Nene", "Sanguijuela broca", "Skullan", "Vapaya", "Búho espectral",
    "Espectro níveo", "Irasco de roca", "Jabalí pétreo", "Kotka", "Moscas de cristal",
    "Roble de azufre", "Troll de montaña", "Artero", "Ciervo abisal", "Orahaug", "Raskaal",
    "Raya de cueva", "Reptador pálido", "Vearón",
}

NON_PROFILE_HEADINGS = {
    "COMBATE CON LÁTIGO,",
    "SUTILEZA A DOS MANOS,",
    "Divisiones dentro",
    "de la Iglesia del Sol",
    "Armas",
    "y atributos",
    "La elección",
    "de las guardianas",
    "Rango",
    "y habilidades",
    "La decadencia",
    "del ejército",
    "Agentes del reino",
    "Los nobles",
    "de los barrios bajos",
    "Bestias variadas",
    "El reino del",
    "señor de la cripta",
    "Combate acuático",
    "Armadura de jabalí",
    "pétreo",
}


@dataclass(frozen=True)
class Heading:
    name: str
    pdf_page: int
    y: float


def compact_spaces(value: str) -> str:
    value = value.replace("\u00ad", "")
    value = re.sub(r"-\s*\n\s*", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize_lookup(value: str) -> str:
    value = compact_spaces(value).casefold()
    return "".join(
        char for char in unicodedata.normalize("NFD", value)
        if unicodedata.category(char) != "Mn"
    )


def slugify(value: str) -> str:
    normalized = normalize_lookup(value)
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")


def title_name(value: str) -> str:
    value = compact_spaces(value)
    if value != value.upper():
        return value
    words = value.title().split()
    lowered = {"De", "Del", "La", "Las", "El", "Los", "En", "Y"}
    return " ".join(word.lower() if index > 0 and word in lowered else word for index, word in enumerate(words))


def iter_lines(page: pymupdf.Page) -> Iterable[tuple[str, str, float, float]]:
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if not text:
                continue
            first = line["spans"][0]
            yield text, first["font"], float(first["size"]), float(line["bbox"][1])


def page_text_blocks(page: pymupdf.Page) -> list[tuple[float, float, float, float, str]]:
    return [
        (float(block[0]), float(block[1]), float(block[2]), float(block[3]), str(block[4]))
        for block in page.get_text("blocks")
        if len(block) >= 5 and compact_spaces(str(block[4]))
    ]


def tactics_body(value: str) -> str:
    marker = re.search(r"T.cticas:\s*", value, flags=re.IGNORECASE)
    body = value[marker.end():] if marker else value
    body = compact_spaces(body)
    body = re.sub(r"\s+\d{1,3}$", "", body).strip()
    if body and body[-1] not in ".!?…":
        body += "."
    return body


def common_prefix_length(left: str, right: str) -> int:
    left = normalize_lookup(left)
    right = normalize_lookup(right)
    length = 0
    for first, second in zip(left, right):
        if first != second:
            break
        length += 1
    return length


def complete_tactics_from_layout(document: pymupdf.Document, heading: Heading, rough_tactics: str) -> str:
    """Read one complete tactics card from its visual PDF blocks.

    The Códice uses rotated and overlapping cards, so the plain text layer may
    stop after the first line or continue into the next article. The opening
    words extracted from the statistical block identify the correct visual card;
    adjacent overlapping blocks then provide all its remaining lines.
    """
    candidates: list[tuple[int, int, list[tuple[float, float, float, float, str]]]] = []
    for page_index in range(heading.pdf_page, min(len(document), heading.pdf_page + 3)):
        blocks = page_text_blocks(document[page_index])
        for block_index, block in enumerate(blocks):
            if re.search(r"T.cticas:", block[4], flags=re.IGNORECASE):
                candidates.append((page_index, block_index, blocks))
    if not candidates:
        return rough_tactics

    def candidate_score(candidate: tuple[int, int, list[tuple[float, float, float, float, str]]]) -> int:
        _page_index, block_index, blocks = candidate
        return common_prefix_length(tactics_body(blocks[block_index][4]), rough_tactics)

    _page_index, block_index, blocks = max(candidates, key=candidate_score)
    start = blocks[block_index]
    parts = [start[4]]
    current_bottom = start[3]
    following_blocks = [] if compact_spaces(start[4]).rstrip().endswith((".", "!", "?", "…")) else blocks[block_index + 1:]
    for following in following_blocks:
        x0, y0, _x1, y1, text = following
        if y0 < start[1] - 1:
            break
        if abs(x0 - start[0]) > 48 or y0 > current_bottom + 14:
            break
        normalized = normalize_lookup(text)
        if any(normalized.startswith(marker) for marker in (
            "conducta", "raza", "desafio", "rasgos", "habilidades", "armas", "armadura",
            "defensa", "resistencia", "equipo", "sombra", "tacticas"
        )):
            break
        parts.append(text)
        current_bottom = max(current_bottom, y1)

    complete = tactics_body("\n".join(parts))
    return complete or rough_tactics


def extract_basic_book_tactics(document: pymupdf.Document) -> list[str]:
    tactics: list[str] = []
    content_overrides = {
        "ARCHITROLL": "architroll prefiere",
        "HIELO FATUO": "hielos fatuos se ven atraidos",
    }
    for heading_text, page_index in BASIC_PROFILE_SPECS:
        page = document[page_index]
        heading_bbox: tuple[float, float, float, float] | None = None
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                line_text = "".join(span["text"] for span in line["spans"]).strip()
                if normalize_lookup(line_text) == normalize_lookup(heading_text):
                    heading_bbox = tuple(float(value) for value in line["bbox"])
                    break
            if heading_bbox:
                break
        if not heading_bbox:
            raise RuntimeError(f"No se encontró la cabecera del Libro Básico: {heading_text} (p.{page_index})")

        all_tactics_blocks = [
            block for block in page_text_blocks(page)
            if re.search(r"T.cticas:", block[4], flags=re.IGNORECASE)
        ]
        candidates = [block for block in all_tactics_blocks if block[1] >= heading_bbox[1]]
        if not candidates:
            raise RuntimeError(f"No se encontraron las tácticas del Libro Básico: {heading_text} (p.{page_index})")
        expected_content = content_overrides.get(heading_text)
        if expected_content:
            matching = [block for block in all_tactics_blocks if expected_content in normalize_lookup(block[4])]
            if not matching:
                raise RuntimeError(f"No se pudo asociar la táctica de {heading_text} por su contenido")
            selected = matching[0]
        else:
            selected = min(
                candidates,
                key=lambda block: abs(block[0] - heading_bbox[0]) * 8 + (block[1] - heading_bbox[1])
            )
        tactics.append(tactics_body(selected[4]))
    return tactics


def discover_compact_headings(document: pymupdf.Document) -> list[Heading]:
    candidates: list[Heading] = []
    for page_index in range(123, 159):
        page = document[page_index]
        for text, font, size, y in iter_lines(page):
            if font != "SkolarLatin" or abs(size - 9.0) > 0.1:
                continue
            text = compact_spaces(text)
            if text not in COMPACT_PROFILE_HEADINGS:
                continue
            candidates.append(Heading(text, page_index, y))
    return candidates


def locate_extended_headings(document: pymupdf.Document) -> list[Heading]:
    line_index: dict[str, list[Heading]] = {}
    normalized_pages: list[str] = []
    for page_index in range(10, 120):
        normalized_pages.append(normalize_lookup(document[page_index].get_text("text")))
        for text, _font, _size, y in iter_lines(document[page_index]):
            line_index.setdefault(normalize_lookup(text), []).append(Heading(text, page_index, y))

    found: list[Heading] = []
    for expected in EXTENDED_HEADINGS:
        target = normalize_lookup(expected)
        matches = line_index.get(target, [])
        def page_has_profile(page_text: str) -> bool:
            search_from = 0
            while True:
                position = page_text.find(target, search_from)
                if position < 0:
                    return False
                if "conducta" in page_text[position:position + len(target) + 1800]:
                    return True
                search_from = position + len(target)

        matches = [match for match in matches if page_has_profile(normalized_pages[match.pdf_page - 10])]
        if not matches:
            # Some headings wrap into two lines. Fall back to the normalized page text.
            for offset, page_text in enumerate(normalized_pages):
                if page_has_profile(page_text):
                    page_index = offset + 10
                    matches.append(Heading(expected, page_index, 0))
                    break
        if not matches:
            raise RuntimeError(f"No se encontró el perfil extendido: {expected}")
        found.append(matches[0])
    return found


def profile_text(document: pymupdf.Document, heading: Heading) -> str:
    chunks = [document[index].get_text("text") for index in range(heading.pdf_page, min(len(document), heading.pdf_page + 3))]
    text = "\n".join(chunks)
    normalized_text = compact_spaces(text)
    normalized_heading = compact_spaces(heading.name)
    lookup_text = normalize_lookup(normalized_text)
    lookup_heading = normalize_lookup(normalized_heading)
    start = normalized_text.find(normalized_heading)
    search_from = 0
    if start < 0:
        while True:
            candidate = lookup_text.find(lookup_heading, search_from)
            if candidate < 0:
                break
            if "conducta" in lookup_text[candidate:candidate + len(lookup_heading) + 1800] or "raza" in lookup_text[candidate:candidate + len(lookup_heading) + 1800]:
                start = candidate
                break
            search_from = candidate + len(lookup_heading)
    if start < 0:
        raise RuntimeError(f"No se pudo aislar el texto de {heading.name}")

    # Normalization preserves string length for the characters used by headings.
    snippet = normalized_text[start:]
    tactics = snippet.find("Tácticas:")
    if tactics < 0:
        raise RuntimeError(f"No se encontraron las tácticas de {heading.name}")
    profile_end = len(snippet)
    for candidate_heading in [*EXTENDED_HEADINGS, *COMPACT_PROFILE_HEADINGS]:
        if normalize_lookup(candidate_heading) == normalize_lookup(heading.name):
            continue
        candidate_lookup = normalize_lookup(candidate_heading)
        search_from = tactics + len("Tácticas:")
        while True:
            candidate = normalize_lookup(snippet).find(candidate_lookup, search_from)
            if candidate < 0:
                break
            following = normalize_lookup(snippet[candidate:candidate + len(candidate_heading) + 1800])
            if "conducta" in following or "raza" in following:
                profile_end = min(profile_end, candidate)
                break
            search_from = candidate + len(candidate_lookup)
    for trailing_marker in ("Kebrogs de vearón", "SÍ COMO EL HOMBRE"):
        candidate = snippet.find(trailing_marker, tactics)
        if candidate >= 0:
            profile_end = min(profile_end, candidate)
    snippet = snippet[:profile_end]
    tail = snippet[tactics:]
    sentence = re.search(r"Tácticas:\s*(.*?)(?=(?:\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,]{3,}\s+(?:Conducta|Raza))|$)", tail[:1200])
    if sentence:
        return compact_spaces(snippet[:tactics] + sentence.group(0))
    return compact_spaces(snippet[:tactics] + tail[:1000])


def field_value(text: str, marker: str) -> str:
    def marker_pattern(value: str) -> str:
        if value == "Armas":
            attributes = "|".join(ATTRIBUTE_PATTERNS.values())
            return rf"\bArmas,?\s+(?=(?:{attributes}|Ningun))"
        if value == "Rasgos":
            return r"\b(?:Rasgos|Ragos)\s+"
        return re.escape(value).replace(r"\ ", r"\s+")

    current_pattern = marker_pattern(marker)
    attributes = re.search(r"Ágil\s+\d+", text)
    anchor = 0
    if marker in {"Habilidades", "Bendiciones/Cargas", "Bendiciones/ Cargas", "Armas", "Armadura", "Defensa", "Resistencia", "Umbral de dolor", "Equipo", "Sombra", "Tácticas:"}:
        anchor = attributes.end() if attributes else 0
    marker_match = re.search(current_pattern, text[anchor:])
    if not marker_match:
        return ""
    start = anchor + marker_match.end()
    endings = []
    for candidate in FIELD_MARKERS:
        if normalize_lookup(candidate) == normalize_lookup(marker):
            continue
        match = re.search(marker_pattern(candidate), text[start:])
        if match:
            endings.append(match.start())
    next_attributes = re.search(r"Ágil\s+\d+", text[start:])
    if next_attributes:
        endings.append(next_attributes.start())
    end = min(endings) if endings else len(text) - start
    return compact_spaces(text[start:start + end]).strip(" :;,.")


def parse_attributes(text: str) -> dict[str, int]:
    values: dict[str, int] = {}
    for key, label in ATTRIBUTE_PATTERNS.items():
        match = re.search(rf"{label}\s+(\d{{1,2}})", text, flags=re.IGNORECASE)
        values[key] = int(match.group(1)) if match else 10
    return values


def parse_corruption(shadow: str) -> int | None:
    match = re.search(r"corrupci[oó]n:\s*(\d+)", shadow, flags=re.IGNORECASE)
    return int(match.group(1)) if match else None


def parse_integer(value: str) -> int | None:
    match = re.search(r"(?<![A-Za-z])(-?\d+)", value.replace("–", "-").replace("−", "-"))
    return int(match.group(1)) if match else None


PUBLISHED_ATTACK_NAMES = (
    "Lanza de fuego como martillo de guerra", "Daga de fabricación maestra",
    "Bastón de madera tallada", "Garrote con pinchos", "Lanza de fuego portátil",
    "Arma a una mano", "Ataque de barrido", "Dos armas a una mano",
    "Espada a dos manos", "Garras apresadoras", "Garras espectrales", "Golpe de escudo",
    "Hoja de esgrima", "Lanza arrojadiza", "Mandíbulas roedoras",
    "Martillo a dos manos", "Ramas desolladoras", "Ramas espinosas",
    "Ramas firmes", "Ramas nudosas", "Daga de parada", "Daga ritual",
    "Espada bastarda", "Espada oxidada", "Estilete envenenado",
    "Garras de oso", "Hacha a dos manos", "Látigo largo", "Martillo largo",
    "Toque de muerte", "Arco largo", "Arma arrojadiza", "Ataque sin armas",
    "Abrazo aplastante", "Cuchillo arrojadizo", "Hebras miceliales",
    "Tajo terrorífico", "Uñas de hielo", "Alabarda", "Aguijón", "Ballesta",
    "Cabezazo", "Colmillos", "Cuchillo", "Cuernos", "Escalpelo", "Estilete",
    "Mangual", "Mordisco", "Pezuñas", "Picadura", "Tentáculos", "Espada",
    "Garras", "Lanza", "Patas", "Puños y botellas", "Puños", "Zarpas",
    "Arco", "Daga", "Hacha", "Pico", "Vara", "Ahogar",
)

PUBLISHED_ATTACK_PATTERN = re.compile(
    rf"(?<![A-Za-zÀ-ÿ])({'|'.join(re.escape(name) for name in PUBLISHED_ATTACK_NAMES)})\s+(\d+(?:/\d+)?)",
    flags=re.IGNORECASE,
)


def parse_weapon(raw: str) -> list[dict[str, object]]:
    raw = compact_spaces(raw)
    if not raw or normalize_lookup(raw) in {"ninguna", "ninguno"}:
        return []

    attribute = ""
    matches = list(PUBLISHED_ATTACK_PATTERN.finditer(raw))
    if not matches:
        damage_match = re.search(r"(?<![A-Za-z])(\d+)(?![A-Za-z])", raw)
        qualities_match = re.search(r"\(([^)]+)\)", raw)
        name = raw[:damage_match.start()].strip(" ,") if damage_match else raw
        return [{
            "attribute": attribute,
            "name": name or raw,
            "damage": damage_match.group(1) if damage_match else "",
            "qualities": qualities_match.group(1) if qualities_match else "",
            "details": raw,
        }]

    prefix = raw[:matches[0].start()].strip(" /,")
    for label in ATTRIBUTE_PATTERNS.values():
        if normalize_lookup(prefix).endswith(normalize_lookup(label)):
            attribute = label
            break

    weapons: list[dict[str, object]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(raw)
        details = raw[match.start():end].strip(" ,.;")
        qualities_match = re.search(r"\(([^)]+)\)", details)
        weapons.append({
            "attribute": attribute,
            "name": match.group(1).strip(),
            "damage": match.group(2),
            "qualities": qualities_match.group(1) if qualities_match else "",
            "details": details,
        })
    return weapons


def category_from_race(race: str) -> str:
    normalized = normalize_lookup(race)
    if "abominacion" in normalized:
        return "Abominación"
    if "muerto viviente" in normalized:
        return "Muerto viviente"
    if "flora" in normalized:
        return "Flora"
    if any(token in normalized for token in ("fenomeno", "elemental", "espiritu de la naturaleza")):
        return "Fenómeno"
    if any(token in normalized for token in ("ser civilizado", "humano", "trasgo", "troll", "bestiaal", "arak")):
        return "Ser civilizado"
    return "Bestia"


def family_for(name: str) -> str:
    normalized = normalize_lookup(name)
    for candidate, family in FAMILY_OVERRIDES.items():
        if normalize_lookup(candidate) == normalized:
            return family
    return name.split(",", 1)[0].strip()


def extract_family_lore(document: pymupdf.Document, first_profiles: dict[str, Heading]) -> dict[str, str]:
    title_pages: dict[str, tuple[str, int]] = {}
    for page_index in range(10, 120):
        title_parts: list[str] = []
        for text, font, size, _y in iter_lines(document[page_index]):
            if font == "BarloesiusSchrift" and size >= 40:
                title_parts.append(compact_spaces(text))
        if title_parts:
            title = " ".join(title_parts)
            title_pages[normalize_lookup(title)] = (title, page_index)

    aliases = {"Arak": "Araks", "Termita purulenta": "Termita purulenta"}
    lore: dict[str, str] = {}
    for family, first_heading in first_profiles.items():
        title = aliases.get(family, family)
        title_data = title_pages.get(normalize_lookup(title))
        if not title_data:
            continue
        printed_title, title_page = title_data
        chunks = [document[index].get_text("text") for index in range(title_page, first_heading.pdf_page + 1)]
        text = compact_spaces("\n".join(chunks))
        start = text.find(printed_title)
        if start < 0:
            continue
        body = text[start + len(printed_title):]
        heading_position = body.find(first_heading.name)
        if heading_position < 0:
            heading_position = normalize_lookup(body).rfind(normalize_lookup(first_heading.name))
        if heading_position >= 0:
            body = body[:heading_position]
        body = re.sub(r"\bH O R D A S D E L A N O C H E E T E R N A\b", "", body)
        body = re.sub(r"(?:^|\s)\d{1,3}(?:\s|$)", " ", body)
        body = compact_spaces(body).strip(" .")
        if len(body) >= 80:
            lore[family] = body[:3200]
    return lore


def description_from_profile(text: str, heading: str) -> str:
    body = compact_spaces(text)
    start = normalize_lookup(body).find(normalize_lookup(heading))
    if start >= 0:
        body = body[start + len(compact_spaces(heading)):]
    marker_positions = [body.find(marker) for marker in ("Conducta", "Raza") if body.find(marker) >= 0]
    if not marker_positions:
        return ""
    description = compact_spaces(body[:min(marker_positions)]).strip(" .")
    return description[:2400]


def parse_profile(document: pymupdf.Document, heading: Heading, order: int, extended: bool) -> dict[str, object]:
    raw_heading = EXTENDED_RENAMES.get(heading.name, COMPACT_RENAMES.get(heading.name, heading.name))
    name = title_name(raw_heading)
    text = profile_text(document, heading)
    race = RACE_OVERRIDES.get(name, field_value(text, "Raza"))
    published_threat = field_value(text, "Desafío").split(" ", 1)[0]
    traits = field_value(text, "Rasgos")
    abilities = field_value(text, "Habilidades")
    # Sidebars on the Ordo pages are interleaved into the statistical block by
    # the PDF text layer. They begin after the complete abilities list.
    abilities = re.split(
        r"\s+(?:ASÍ HABLÓ AROALETA|\d+\s+A\s+D\s+V\s+E\s+R\s+S\s+A\s+R\s+I\s+O\s+S)\b",
        abilities,
        maxsplit=1,
    )[0]
    blessings = field_value(text, "Bendiciones/Cargas") or field_value(text, "Bendiciones/ Cargas")
    armor = field_value(text, "Armadura")
    defense = field_value(text, "Defensa")
    toughness = field_value(text, "Resistencia")
    pain_threshold = field_value(text, "Umbral de dolor")
    shadow = field_value(text, "Sombra")
    tactics = complete_tactics_from_layout(document, heading, field_value(text, "Tácticas:"))
    weapons_raw = field_value(text, "Armas")
    family = family_for(name)
    description = description_from_profile(text, heading.name)
    if not description:
        description = f"Perfil de {family} publicado en el Códice de monstruos."
    return {
        "id": f"codice-{slugify(name)}",
        "name": name,
        "family": family,
        "variant": name.split(",", 1)[1].strip().capitalize() if "," in name else "",
        "category": category_from_race(race),
        "source": "Códice de monstruos",
        "page": heading.pdf_page - 1,
        "pdfPage": heading.pdf_page + 1,
        "appearanceOrder": order,
        "description": description,
        "conduct": field_value(text, "Conducta"),
        "race": race,
        "publishedThreat": published_threat,
        "traitsText": traits,
        "abilitiesText": abilities,
        "blessingsBurdensText": blessings,
        "attributes": parse_attributes(text),
        "weapons": parse_weapon(weapons_raw),
        "armorText": armor,
        "defense": defense,
        "toughness": toughness,
        "painThreshold": pain_threshold,
        "equipmentText": field_value(text, "Equipo"),
        "shadow": shadow,
        "corruption": parse_corruption(shadow),
        "tactics": tactics,
        "publishedText": text[:5000],
        "profileFormat": "extended" if extended else "compact",
    }


def render_ts(records: list[dict[str, object]]) -> str:
    data = json.dumps(records, ensure_ascii=False, indent=2)
    return f'''// Generated by scripts/generate-monster-codex.py. Do not edit by hand.\n\nexport type CanonicalMonsterProfileData = {{\n  id: string;\n  name: string;\n  family: string;\n  variant: string;\n  category: "Abominación" | "Bestia" | "Fenómeno" | "Flora" | "Muerto viviente" | "Ser civilizado";\n  source: "Códice de monstruos";\n  page: number;\n  pdfPage: number;\n  appearanceOrder: number;\n  description: string;\n  conduct: string;\n  race: string;\n  publishedThreat: string;\n  traitsText: string;\n  abilitiesText: string;\n  blessingsBurdensText: string;\n  attributes: Record<"accurate" | "cunning" | "discreet" | "persuasive" | "quick" | "resolute" | "strong" | "vigilant", number>;\n  weapons: Array<{{ attribute: string; name: string; damage: string; qualities: string; details: string }}>;\n  armorText: string;\n  defense: string;\n  toughness: string;\n  painThreshold: string;\n  equipmentText: string;\n  shadow: string;\n  corruption: number | null;\n  tactics: string;\n  publishedText: string;\n  profileFormat: "extended" | "compact";\n}};\n\nexport const CODEX_MONSTER_PROFILE_DATA: CanonicalMonsterProfileData[] = {data};\n'''


def render_js(records: list[dict[str, object]]) -> str:
    data = json.dumps(records, ensure_ascii=False, indent=2)
    return f"// Generated by scripts/generate-monster-codex.py. Do not edit by hand.\n\nexport const CODEX_MONSTER_PROFILE_DATA = {data};\n"


def render_ts_with_basic_tactics(records: list[dict[str, object]], basic_tactics: list[str]) -> str:
    rendered = render_ts(records)
    basic_data = json.dumps(basic_tactics, ensure_ascii=False, indent=2)
    return rendered.replace(
        "export const CODEX_MONSTER_PROFILE_DATA",
        f"export const BASIC_BOOK_MONSTER_TACTICS: string[] = {basic_data};\n\n"
        "export const CODEX_MONSTER_PROFILE_DATA",
    )


def render_js_with_basic_tactics(records: list[dict[str, object]], basic_tactics: list[str]) -> str:
    rendered = render_js(records)
    basic_data = json.dumps(basic_tactics, ensure_ascii=False, indent=2)
    return rendered.replace(
        "export const CODEX_MONSTER_PROFILE_DATA",
        f"export const BASIC_BOOK_MONSTER_TACTICS = {basic_data};\n\n"
        "export const CODEX_MONSTER_PROFILE_DATA",
    )


def main() -> None:
    document = pymupdf.open(CODEX_PDF)
    basic_document = pymupdf.open(BASIC_PDF)
    basic_tactics = extract_basic_book_tactics(basic_document)
    if len(basic_tactics) != 37:
        raise RuntimeError(f"Se esperaban 37 tácticas del Libro Básico y se encontraron {len(basic_tactics)}")
    extended = locate_extended_headings(document)
    compact = discover_compact_headings(document)
    if len(extended) != 45:
        raise RuntimeError(f"Se esperaban 45 perfiles extendidos y se encontraron {len(extended)}")
    if len(compact) != 86:
        names = ", ".join(entry.name for entry in compact)
        raise RuntimeError(f"Se esperaban 86 perfiles compactos y se encontraron {len(compact)}: {names}")

    records: list[dict[str, object]] = []
    for heading in extended:
        records.append(parse_profile(document, heading, len(records), True))
    for heading in compact:
        records.append(parse_profile(document, heading, len(records), False))

    first_profiles: dict[str, Heading] = {}
    for heading, record in zip(extended, records[:len(extended)]):
        family = str(record["family"])
        if family not in first_profiles or heading.pdf_page < first_profiles[family].pdf_page:
            first_profiles[family] = heading
    family_lore = extract_family_lore(document, first_profiles)
    for record in records[:len(extended)]:
        family = str(record["family"])
        if family in family_lore:
            record["description"] = family_lore[family]

    ids = [str(record["id"]) for record in records]
    if len(ids) != len(set(ids)):
        raise RuntimeError("El catálogo generado contiene identificadores duplicados")

    TS_OUTPUT.write_text(render_ts_with_basic_tactics(records, basic_tactics), encoding="utf-8", newline="\n")
    JS_OUTPUT.write_text(render_js_with_basic_tactics(records, basic_tactics), encoding="utf-8", newline="\n")
    print(
        f"Generados {len(records)} perfiles del Códice "
        f"({len(extended)} extendidos y {len(compact)} compactos) "
        f"y {len(basic_tactics)} tácticas del Libro Básico."
    )


if __name__ == "__main__":
    main()
