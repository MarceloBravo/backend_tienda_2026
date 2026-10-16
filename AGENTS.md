# Directrices de Desarrollo y Arquitectura (AGENTS.md)

Este documento define las reglas obligatorias de arquitectura, diseño y calidad de código que debes seguir al proponer, refactorizar o escribir código en este proyecto.

## 1. Arquitectura y Patrones
- **Backend (Javascript / node js):** 
  - Aplicar estrictamente **Patron MVC** 
  - En módulos tradicionales o más simples donde aplique, respetar el patrón **MVC**.

## 2. Principios de Diseño y Calidad
- **Principios SOLID:** Respetar rigurosamente cada uno de los 5 principios (SRP, OCP, LSP, ISP, DIP).
- **Clean Code:** 
  - Nombres descriptivos y significativos para clases, métodos y variables.
  - Funciones pequeñas con una única responsabilidad (Small Functions).
  - Evitar duplicación de código (Principio DRY).
- **Patrones de Diseño (GoF):** Priorizar el uso de patrones de diseño adecuados al problema (ej. *Builder, Factory, Strategy, Observer, Adapter*) en lugar de soluciones monolíticas o procedurales.

## 3. Documentación de Código
- Es **obligatorio** incluir documentación formal en todas las clases, interfaces y métodos públicos:
  - **Javascript:** JSDoc completo describiendo parámetros, retornos y excepciones (`@param`, `@return`, `@throws`).

## 4. Restricciones Técnicas
- No generar código comentado obsoleto; si se refactoriza, eliminar lo anterior.
- Asegurar el manejo adecuado de excepciones.