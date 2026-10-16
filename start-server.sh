#!/bin/bash

# Script de inicio optimizado para Oracle Free Tier (1GB RAM)

echo "🚀 Iniciando backend en Oracle Free Tier..."

# Configuración de Node.js para baja memoria
export NODE_OPTIONS="--max-old-space-size=512"
export NODE_ENV=production

# Ir al directorio de la aplicación
cd /opt/backend

# Verificar si el proceso ya está corriendo
if pgrep -f "node server.js" > /dev/null; then
    echo "⚠️  El servidor ya está corriendo. Deteniendo..."
    pkill -f "node server.js"
    sleep 2
fi

# Iniciar servidor con límite de recursos
echo "📦 Iniciando servidor con optimización de memoria..."
nohup node --max-old-space-size=512 server.js > server.log 2>&1 &

# Esperar y verificar
sleep 3

if pgrep -f "node server.js" > /dev/null; then
    echo "✅ Servidor iniciado exitosamente"
    echo "📊 Estado del servidor:"
    ps aux | grep "node server.js" | grep -v grep
    echo "🌐 Servidor disponible en: http://161.153.207.202:3000"
else
    echo "❌ Error al iniciar el servidor"
    echo "📋 Logs:"
    tail -20 server.log
    exit 1
fi
