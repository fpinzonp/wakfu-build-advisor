# Tymador: dominio híbrido CaC + distancia

## Intención
La pasiva de clase del Tymador (innata, siempre activa) convierte todo su dominio de melé en
distancia y viceversa según cómo pegue en cada momento. Por eso, para el Tymador, cualquier punto
de dominio CaC o distancia vale lo mismo: su dominio útil es la suma de ambos. El optimizador hoy
solo cuenta uno según el rol y descarta piezas que al Tymador sí le sirven.

## Objetivos
- En los roles de daño (`melee`, `dist`) del Tymador, el dominio cuenta como
  `efectivo + dominio melé + dominio distancia` (más el término de espalda que ya tiene `melee`).
- Siempre activo, sin depender del mazo.

## No objetivos
- No se crea un rol nuevo "híbrido" ni se toca equipos, aptitudes o selectores de rol.
- No se cambia el simulador de daño.
- Por ahora solo el Tymador lleva la marca (según Francisco es la única clase con esto).

## Enfoques considerados
1. **Marca en la clase (elegido):** `hybridMastery: true` en `CLASSES` para el Tymador; el
   optimizador la consulta. Cambio mínimo, reutilizable si otra clase lo necesita.
2. Rol nuevo "híbrido": mismo resultado con mucho más alcance (equipos, aptitudes, UI). Descartado.

## Diseño
- `game.ts`: campo opcional `hybridMastery?: boolean` en la clase; `true` en Tymador.
- `optimizer.ts`: `derive` recibe `classId`; si la clase tiene `hybridMastery` y el rol es de daño,
  suma el dominio del otro tipo (distancia en `melee`, melé en `dist`).
- Tests: una pieza con dominio distancia sube el puntaje del Tymador melé; para Yopuka no cambia.
