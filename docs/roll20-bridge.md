# UMBRA20 MVP

La integraci?n actual de UMBRA con Roll20 se resuelve con una extensi?n m?nima de Chrome llamada `UMBRA20`, ubicada en `apps/roll20-extension`.

## Qué hace

- Escucha las tiradas estructuradas que UMBRA genera desde campañas.
- Detecta si existe una pestaña válida de Roll20 abierta.
- Inserta y envía el texto de la tirada al chat de Roll20.
- Devuelve estado a UMBRA:
  - bridge disponible
  - pestaña Roll20 detectada
  - texto insertado o enviado

## Qué no hace

- No calcula reglas.
- No interpreta fichas de Roll20.
- No sincroniza personajes.
- No implementa una mesa virtual.

## Instalación local

1. Abre `chrome://extensions`.
2. Activa `Developer mode`.
3. Pulsa `Load unpacked`.
4. Selecciona `apps/roll20-extension`.
5. Deja abiertas:
   - una pestaña de UMBRA (`localhost:5173`)
   - una mesa de Roll20 (`https://app.roll20.net/editor/...`)

## Flujo

1. En campañas selecciona `Destino de tiradas = Roll20` o `Ambos`.
2. Ejecuta una acción desde chat o hoja.
3. UMBRA prepara el texto y lo manda al bridge.
4. La extensión lo inserta y lo intenta enviar en el chat de Roll20.

## Limitaciones actuales

- El DOM de Roll20 puede cambiar.
- Los selectores del chat son heurísticos; si Roll20 cambia, habrá que ajustar `roll20-bridge.js`.
- Ahora mismo la extensión usa la primera pestaña de Roll20 abierta.

## Siguiente mejora razonable

- Añadir selector de modo `insertar` o `enviar`.
- Añadir selección explícita de la pestaña Roll20 destino cuando haya varias abiertas.
- Añadir un pequeño panel de extensión para depuración de estado.
