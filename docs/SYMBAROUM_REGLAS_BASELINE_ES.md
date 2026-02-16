# Baseline de Reglas de Symbaroum (Analisis Automatico)

Documento generado automaticamente desde los PDFs locales en `docs/`.
Sirve como base de trabajo para modelar la app segun Symbaroum original.

## Cobertura

- Libros detectados: **18**
- Paginas totales: **1970**
- Paginas con texto extraido: **1932**

## Senales globales detectadas

- combate: 3765
- equipo: 2979
- resolucion: 2796
- corrupcion: 2599
- talentos: 2390
- magia: 2239
- atributos: 2138
- bestiario: 1094
- aventura: 956

## Libros analizados

- `docs\Adventure books\Aventuras 1.pdf` (adventure_book)
  - paginas: 26, extraidas: 26, caracteres: 85179
  - senales: resolucion=88, corrupcion=62, combate=47, equipo=44, atributos=43, bestiario=36, talentos=35, magia=25
- `docs\Adventure books\Aventuras en la ciudad.pdf` (adventure_book)
  - paginas: 42, extraidas: 39, caracteres: 146855
  - senales: magia=62, aventura=42, equipo=34, combate=29, talentos=27, corrupcion=23, atributos=19, resolucion=18
- `docs\Adventure books\La corona de cobre.pdf` (adventure_book)
  - paginas: 82, extraidas: 72, caracteres: 247835
  - senales: aventura=157, resolucion=150, corrupcion=135, magia=115, equipo=102, combate=97, bestiario=88, atributos=85
- `docs\Adventure books\La Tierra Prometida.pdf` (adventure_book)
  - paginas: 25, extraidas: 25, caracteres: 85719
  - senales: combate=102, atributos=92, equipo=88, resolucion=64, aventura=46, corrupcion=45, magia=31, talentos=25
- `docs\Adventure books\Localizaciones de aventura.pdf` (adventure_book)
  - paginas: 37, extraidas: 36, caracteres: 125076
  - senales: combate=58, resolucion=46, talentos=44, equipo=40, magia=33, corrupcion=28, atributos=25, aventura=18
- `docs\Adventure books\Symbaroum - TdE1_Fuerte Espina.pdf` (adventure_book)
  - paginas: 178, extraidas: 175, caracteres: 649641
  - senales: combate=289, resolucion=275, corrupcion=261, talentos=241, atributos=205, equipo=204, magia=186, aventura=163
- `docs\Adventure books\Symbaroum - TdE2_Karvosti.pdf` (adventure_book)
  - paginas: 154, extraidas: 151, caracteres: 549147
  - senales: resolucion=270, combate=228, talentos=199, equipo=192, atributos=153, corrupcion=145, magia=145, aventura=138
- `docs\Adventure books\Symbaroum - TdE3_Yndaros.pdf` (adventure_book)
  - paginas: 178, extraidas: 175, caracteres: 638993
  - senales: combate=240, corrupcion=218, equipo=174, talentos=167, resolucion=161, magia=144, aventura=136, atributos=109
- `docs\Adventure books\Symbaroum - TdE4_Symbar.pdf` (adventure_book)
  - paginas: 242, extraidas: 239, caracteres: 782686
  - senales: corrupcion=332, resolucion=304, talentos=282, combate=239, magia=228, equipo=205, aventura=160, atributos=156
- `docs\Adventure books\Symbaroum - TdE5_The_Haunted_Waste.pdf` (adventure_book)
  - paginas: 178, extraidas: 177, caracteres: 634847
  - senales: magia=47, resolucion=4
- `docs\Hoja personaje editable.pdf` (other)
  - paginas: 2, extraidas: 2, caracteres: 1178
  - senales: corrupcion=7, atributos=6, equipo=6, combate=4
- `docs\Libro Basico.pdf` (other)
  - paginas: 268, extraidas: 263, caracteres: 767822
  - senales: combate=739, equipo=598, resolucion=479, atributos=419, corrupcion=417, talentos=391, magia=380, bestiario=243
- `docs\Rule books\Códice de monstruos.pdf` (rule_book)
  - paginas: 192, extraidas: 189, caracteres: 455527
  - senales: combate=618, bestiario=424, equipo=401, atributos=356, talentos=351, corrupcion=320, resolucion=158, magia=149
- `docs\Rule books\Guía Avanzada del jugador.pdf` (rule_book)
  - paginas: 140, extraidas: 137, caracteres: 421258
  - senales: combate=471, equipo=415, resolucion=374, magia=352, talentos=329, corrupcion=267, atributos=169, bestiario=87
- `docs\Rule books\Guía del jugador.pdf` (rule_book)
  - paginas: 94, extraidas: 94, caracteres: 257485
  - senales: combate=390, resolucion=301, equipo=297, talentos=293, magia=244, atributos=165, corrupcion=142, bestiario=67
- `docs\Rule books\Guía DM.pdf` (rule_book)
  - paginas: 70, extraidas: 70, caracteres: 203360
  - senales: combate=203, corrupcion=188, equipo=170, bestiario=139, atributos=136, resolucion=96, aventura=92, magia=66
- `docs\Rule books\Mundo de symbaroum.pdf` (rule_book)
  - paginas: 58, extraidas: 58, caracteres: 187472
  - senales: magia=31, combate=11, bestiario=10, equipo=9, corrupcion=9, resolucion=8, talentos=6, aventura=4
- `docs\Rule books\Symbaroum_Errata_v1.14.pdf` (rule_book)
  - paginas: 4, extraidas: 4, caracteres: 9022
  - senales: magia=1

## Proximo paso recomendado

- Crear entidades de compendio: reglas, poderes, rasgos, equipo, criaturas, rituales, estados.
- Parsear por secciones y paginas para trazabilidad exacta al libro.
- Implementar buscador semantico + filtros por libro/pagina/tipo.
