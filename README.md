# Clean Way – Quoting Engine (TypeScript + React)

Cotizador **por hora/día** para **Clean Way** con las reglas operativas nuevas:

- **EPP** siempre lo provee Clean Way (siempre incluido en costo).
- **Insumos**: si el cliente los provee, **no** impactan el costo. Si los provee Clean Way, se aplica **8.5%** sobre el **precio sin insumos** (uplift) para obtener el **precio final**.
- **Horas por turno** se calculan a partir de **hora de entrada** y **hora de salida**. Selección de **turno** (Diurno/Nocturno) aplica recargo nocturno si está definido en POLITICAS.

## Inicio rápido
```bash
npm i
npm run dev
```
Abre `http://localhost:5173/`.

## CLI
```bash
npm run cli -- --personas=6 --in=06:00 --out=14:00 --dias=L-S --turno=Diurno --insumos=si
```

## Datos
Edita `data/catalogs.cleanway.json`:
- `politicas`: `MargenMin_CleanWay`, `CostoAdministrativo%`, `RecargoNocturno`, `FactorInsumosPct` (default 0.085).
- `roles`: costo y prestaciones del rol base "Auxiliar".
- `epp`: lista de EPP con costo, vida útil y uso diario. Siempre se incluye.
- `insumos`: hoy no se usan como insumo directo (la regla es % final), pero se mantienen por si se requiere otra política.

## Modelo
1. **Horas turno** desde `horaEntrada` y `horaSalida` (si salida < entrada, se asume día siguiente).
2. **Laboral día** = personas × horas × CostoHora × (1+Prestaciones) + recargo nocturno si `turno = Nocturno`.
3. **EPP día** = sum[(Costo/Vida) × Uso] × personas (siempre).
4. **Supervisión**: 10% default sobre (laboral + EPP).
5. **Overhead**: `CostoAdministrativo%` sobre costo directo sin insumos.
6. **Precio sin insumos** = Subtotal sin insumos + Margen (margen mínimo).
7. **Insumos**: si Quokka provee, `precioFinal = precioSinInsumos × (1 + 0.085)`.

## TODO
- Días efectivos por semana para proyectar mensual.
- Validaciones por m²-persona y mínimos por horario.
- Exportación PDF con folio y vigencia.
- Hook Salesforce.
