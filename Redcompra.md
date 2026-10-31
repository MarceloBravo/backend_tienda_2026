[Frontend]                     [Backend API]                  [Transbank Webpay (Develop)]
    |                               |                                      |
    |-- 1. Iniciar Pago ----------->|                                      |
    |   (Monto, Orden de Compra)    |-- 2. Crear Transacción (SDK) ------->|
    |                               |<-- Retorna Token + URL de Redirección-|
    |<-- 3. Retorna Token y URL ----|                                      |
    |                                                                      |
    |-- 4. Redirige al usuario (Formulario Transbank Sandbox) ------------>|
    |                                                                      |
    |   [Usuario simula pago con tarjeta de prueba Redcompra en Sandbox]   |
    |                                                                      |
    |<-- 5. Redirige (POST/GET) con "token_ws" a tu URL de Retorno --------|
    |                                                                      |
    |-- 6. Envía token_ws --------->|                                      |
    |                               |-- 7. Confirmar/Commit Transacción -->|
    |<-- 8. Muestra Resultado <-----|<-- Retorna Voucher / Estado OK ------|

    Paso a Paso Detallado
1. Solicitud de Inicio de Pago (Frontend -> Backend)
El usuario hace clic en "Pagar con Redcompra" en tu interfaz de React.

El Frontend envía una petición al Backend (por ejemplo, POST /api/payment/init) con los datos necesarios:

Monto de la compra (en CLP, sin decimales).

Orden de compra única (ej. O-12345).

ID de sesión del usuario.

URL de retorno (a donde Transbank redirigirá al usuario tras el intento de pago).

2. Creación de la Transacción en el SDK (Backend -> Transbank)
El Backend recibe la solicitud y utiliza el SDK oficial de Transbank (Node.js, PHP, etc.) configurado en modo Integration / Development (con las credenciales de prueba CCK / ApiKey de Transbank).

El Backend ejecuta el método de creación (ej. new WebpayPlus.Transaction().create(...)).

Transbank procesa la petición y responde al Backend con dos datos críticos:

token: Un identificador único de la transacción (string largo).

url: La URL de la pasarela de Transbank para el ambiente de integración ([https://webpay3gint.transbank.cl/](https://webpay3gint.transbank.cl/)...).

3. Respuesta al Frontend (Backend -> Frontend)
El Backend responde al Frontend con el token y la url recibidos.

4. Redirección al Portal de Transbank (Frontend)
El Frontend toma la url y el token y redirige al usuario. En Webpay Plus, esto típicamente se hace creando un formulario HTML dinámico oculto y haciendo un submit, o redirigiendo la ventana.

Nota: En modo Develop, al llegar a la pasarela de Transbank, verás una pantalla de prueba donde podrás seleccionar Redcompra, ingresar tarjetas de prueba generadas por el sistema y simular una respuesta Exitosa o Rechazada.

5. Retorno del Usuario (Transbank -> Frontend / Backend)
Una vez que el usuario finaliza (o cancela) el flujo en el simulador de Transbank, Transbank redirige al navegador del usuario de vuelta a tu aplicación (a la URL de retorno configurada, ej. /pago/resultado).

La redirección incluye un parámetro en la URL o por POST llamado token_ws.

El Frontend captura este token_ws y se lo envía inmediatamente a tu Backend (ej. POST /api/payment/commit con el token_ws en el body).

6. Confirmación de la Transacción - Commit (Backend -> Transbank)
El Backend recibe el token_ws desde el Frontend.

El Backend se comunica con los servidores de Transbank ejecutando el método de confirmación (ej. new WebpayPlus.Transaction().commit(token_ws)). Este paso es obligatorio y de seguridad, ya que valida que la transacción realmente se haya efectuado de forma íntegra y no haya sido alterada en el navegador.

7. Respuesta de Transbank y Voucher (Transbank -> Backend)
Transbank valida el token y responde al Backend con el voucher o detalle de la transacción:

Estado (AUTHORIZED, FAILED, etc.).

Monto.

Código de autorización.

Tipo de tarjeta (VD para Débito / Redcompra).

Últimos 4 dígitos de la tarjeta, etc.

8. Respuesta Final al Frontend (Backend -> Frontend)
El Backend procesa esta respuesta (actualiza el estado de la orden en tu base de datos MySQL, por ejemplo).

Devuelve al Frontend el resultado final del pago para que la interfaz muestre una pantalla de Éxito (Voucher) o Fracaso/Rechazo.

Consideraciones Clave para Desarrollo (Develop)
Credenciales de Integración: Asegúrate de inicializar el SDK con el ambiente de pruebas de Transbank (Integration / Environment.Integration) y las credenciales oficiales de prueba proporcionadas en su documentación para desarrolladores (Comercio 597055555532 y su respectiva ApiKey de integración).

Tarjetas de Prueba Redcompra: En el entorno de Develop, al elegir Redcompra, el simulador te permitirá usar tarjetas de débito de prueba que simulan escenarios de éxito o rechazo (fondos insuficientes, clave errónea, etc.).

CORS y Redirecciones: Al probar localmente (ej. Frontend en localhost:3000 y Backend en localhost:5000), asegúrate de configurar correctamente los encabezados CORS y de que las URLs de retorno apunten correctamente a tu entorno de desarrollo.