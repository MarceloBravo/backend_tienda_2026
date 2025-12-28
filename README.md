# Backend de Gestión de Formularios y Validación de Datos

## Descripción
Esta es una aplicación backend para la aplicación de Formularios y Validación de Datos.
(TalentOps Mes 2, semana 4, día 4), 

Backend desarrollado en Node.js utilizando Express.js y MySQL.

## Requisitos
- Node.js
- MySQL

## Instalación y Configuración

1. **Instalar dependencias:**
   ```
   npm install
   ```

2. **Configurar variables de entorno:**
   - Copia el archivo `.env.ejemplo` a `.env`.
   - Edita el archivo `.env` con tus configuraciones específicas (como credenciales de base de datos, puerto, etc.).

3. **Inicializar la base de datos:**
   La aplicación requiere una base de datos MySQL. Ejecuta el siguiente comando para inicializarla:
   ```
   node db\init-database.js
   ```

4. **Ejecutar la aplicación:**
   ```
   node app.js
   ```

## Uso
Una vez que la aplicación esté ejecutándose, estará disponible en el puerto configurado en las variables de entorno (generalmente 3000 o similar).