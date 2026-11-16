# Energy Procurement Intelligence (MVP)

Aplicación web estática para analizar requerimientos de abastecimiento energético y comparar tres estrategias con trazabilidad hacia cotizaciones y fichas técnicas. No requiere Node, una base de datos, servicios pagos ni claves API.

> **FICTICIO — DEMOSTRACIÓN.** Todo el banco incluido es sintético. Los importes, impuestos, fechas, proveedores, plazos y referencias jurisdiccionales no son ofertas comerciales ni validaciones legales.

## Ejecutar localmente

Requiere Python 3.7 o posterior.

```bash
python scripts/import_bank.py
python -m http.server 8000
```

Abre `http://localhost:8000` en un navegador. El proyecto no tiene dependencias externas de runtime.

## Desplegar en Vercel

El repositorio es una aplicación estática. Importa el repositorio en Vercel y conserva la raíz del proyecto como directorio de despliegue. No hay comando de build ni variables de entorno requeridas. `index.html`, `app.js`, `styles.css` y `data/` se sirven como archivos estáticos.

## Flujo funcional implementado

1. Selecciona uno de los cuatro proyectos demo o carga un archivo local `.txt`, `.md` o `.csv`.
2. Revisa/edita el texto, el país y el plazo. El navegador extrae categorías, cantidades simples, capacidad y tensión cuando están presentes. Si el pliego no declara cantidad, la unidad demo es una partida por categoría.
3. Recupera productos y cotizaciones por categoría, jurisdicción y especificaciones técnicas disponibles.
4. Calcula los tiers de optimización de costos, equilibrio costo/tiempo y seguridad de suministro.
5. Consulta brechas, riesgos, detalle del cálculo, ficha técnica y cotización fuente.
6. Imprime o guarda el reporte como PDF desde el diálogo del navegador, o exporta un libro SpreadsheetML compatible con Excel (`.xls`).

El Excel usa XML Spreadsheet 2003 para evitar una biblioteca de terceros. El navegador no puede escribir un PDF silenciosamente; la opción de impresión permite al usuario seleccionar “Guardar como PDF”.

## Datos y estructura

- `data/catalogs/*.json`: fuente canónica cargada por el motor (proveedores, productos y jurisdicciones).
- `data/catalogs/*.csv` y `data/projects/*.csv`: copias originales estructuradas para referencia.
- `data/quotes/Q-DEMO-*.md`: 224 documentos de cotización, enlazados con los IDs del motor.
- `data/quotes.json`: formato normalizado derivado de esos Markdown, generado por `scripts/import_bank.py`; incluye identificador y hash de fuente.
- `data/technical_sheets/EPI-*.md`: fichas fuente asociadas a SKU.
- `data/projects/demo_projects.json`: cuatro escenarios demo.
- `data/README-bank.md`: advertencias del banco original.

Los dos archivos Excel fuente no se fusionaron. Tienen esquemas diferentes; ambos se inspeccionaron en la fase técnica y se mantienen fuera del motor hasta que exista una regla de conciliación aprobada. El `README` de origen dice “tres proyectos”, pero sus JSON/CSV y su Excel consolidado tienen cuatro. El MVP usa los cuatro registros estructurados.

### Revalidar o actualizar datos

Después de cambiar cualquier cotización Markdown, reconstruye el normalizado y valida relaciones:

```bash
python scripts/import_bank.py
python -m unittest discover -s tests -v
```

## Reglas de cálculo

- Los precios de escenario se suman en USD: precio unitario USD × cantidad, más transporte demo, más impuesto demo calculado sobre el subtotal de producto. Cada componente se muestra separado.
- La conversión local aplica el FX snapshot de la cotización y se marca como histórica. No se consulta una tasa externa.
- Una cotización cuenta como vigente documental solo hasta su fecha de vencimiento; aun así, su vigencia documental no prueba que el proveedor mantenga la oferta.
- Al corte de análisis del 15 de noviembre de 2026, la cotización más reciente del banco está fechada el 8 de octubre de 2026 y todas las cotizaciones están vencidas. El motor las usa solo como antecedentes.
- El tiempo de escenario es el máximo de los plazos seleccionados, suponiendo abastecimiento en paralelo.
- Las restricciones de plazo excluyen alternativas que las exceden. La compatibilidad se filtra con parámetros explícitos detectables (capacidad y tensión de transformadores; clase de tensión cuando se declara). La revisión resultante es preliminar, no una aprobación de ingeniería.
- Un costo de escenario con cobertura parcial es solo el subtotal de las partidas encontradas; no se compara contra presupuesto como si incluyera partidas faltantes.
- Los riesgos desconocidos aparecen como pendientes; no se inventa disponibilidad, confiabilidad, importación o certificación.
- Los tiers cambian su función objetivo; no pueden resolver brechas técnicas, de cobertura documental o de plazo obligatorio.

## Persistencia y privacidad

La aplicación no usa API externas. El texto de una licitación se procesa en el navegador y el borrador se conserva en `localStorage` del navegador actual. La persistencia local no sincroniza entre usuarios/dispositivos, no es una copia de seguridad y se puede borrar al limpiar los datos del navegador. El catálogo demo estático es de solo lectura.

## Estado y límites del MVP

Implementado: landing page con el propósito de la plataforma, sistema visual basado en la guía Figma (cyan, slate y verde lima), interfaz adaptable, catálogo navegable de productos/proveedores/cotizaciones, filtros por país, carga local TXT/MD/CSV, extracción heurística editable, motor determinista, comparación de tiers, FX histórico, riesgos, brechas, trazabilidad, etiqueta sintética, módulos regulatorios pendientes, borrador local y exportación/impresión.

Simulado: banco y todos los valores; gravámenes e impuestos demo; referencia FX; costos/tiempos históricos; niveles de confiabilidad cuando estén expresos en una versión de fuente (no se combinan automáticamente desde el Excel alternativo); riesgo de transporte/importación; estimaciones.

Preparado para integrar posteriormente: almacenamiento compartido mediante adaptador de persistencia, OCR/parseo avanzado de PDF/DOCX, datos reales de stock/proveedores, cotizaciones actualizadas, validación regulatoria con fuentes oficiales, servicios de FX y búsqueda vectorial. No hay conexión implementada a esos servicios.

La extracción actual acepta texto plano, Markdown y CSV. No extrae texto de PDF o DOCX; para esos formatos, copia el contenido al cuadro de texto o conviértelo localmente a TXT/MD. La interpretación es heurística y requiere revisión humana. Los pesos de optimización son reglas internas de demostración, no una recomendación comercial calibrada.

## Pruebas

La suite de Python valida conteos, IDs y relaciones de las fuentes. Durante la implementación también se recorrieron en navegador los cuatro proyectos demo y se comprobó que sus asignaciones, cotizaciones y brechas correspondan al banco. En todos los casos los valores estimados son históricos demo; ningún flujo declara stock o una oferta vigente.
