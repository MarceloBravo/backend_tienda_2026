#!/bin/bash

# Script para inicializar base de datos en Oracle Free Tier

echo "🔧 Configurando base de datos MySQL..."

# Variables de conexión
DB_USER="root"
DB_PASSWORD="tu_mysql_password"  # Reemplazar con tu password real
DB_NAME="tienda"

# Verificar si MySQL está corriendo
if ! sudo systemctl status mysql > /dev/null 2>&1; then
    echo "🚀 Iniciando MySQL..."
    sudo systemctl start mysql
    sudo systemctl enable mysql
fi

# Crear tablas desde el archivo SQL
if [ -f "db/database.sql" ]; then
    echo "📊 Creando tablas desde database.sql..."
    mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME < db/database.sql
    echo "✅ Tablas creadas exitosamente"
else
    echo "❌ Archivo db/database.sql no encontrado"
    exit 1
fi

# Verificar tablas creadas
echo "🔍 Verificando tablas creadas:"
mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SHOW TABLES;"

echo "🎉 Base de datos configurada correctamente"
