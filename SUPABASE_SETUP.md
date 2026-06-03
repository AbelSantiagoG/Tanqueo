# Configuracion Supabase

1. Abre el SQL Editor del proyecto Supabase conectado en `.env.local`.
2. Ejecuta `supabase/migrations/202606010001_full_fuel_control.sql`.
3. Agrega `SUPABASE_SERVICE_ROLE_KEY` al entorno privado del servidor para habilitar el ingreso por perfil y las altas y bajas de cuentas desde el panel admin. No uses el prefijo `NEXT_PUBLIC_`.
4. Agrega las credenciales privadas de Cloudinary descritas abajo.
5. Reinicia el servidor Next.js despues de agregar las variables.

La migracion conserva los datos existentes, agrega `service_stations` y `fuel_records`, aplica RLS y define las RPC requeridas. Tambien corrige instalaciones antiguas donde `fuel_orders.galones` quedo obligatorio: una orden pendiente todavia no tiene galones reales.

El despachador crea la orden sin definir galones. El operario registra manualmente los galones suministrados, el valor total de la factura, la foto del tablero, la foto del nivel del tanque y la foto de la factura al ejecutar la orden.

Puedes ejecutar nuevamente la migracion completa si ya habias aplicado una version anterior. Las operaciones son idempotentes y migran la estacion configurada anteriormente a la nueva lista de estaciones.

## Actualizacion requerida para estaciones

Si la aplicacion muestra el aviso `Supabase esta pendiente de actualizacion` o errores relacionados con `service_stations` y `station_id`, el proyecto remoto todavia usa el esquema anterior.

1. Abre `supabase/migrations/202606010001_full_fuel_control.sql`.
2. Copia su contenido completo en `Supabase > SQL Editor`.
3. Ejecuta el script.
4. Recarga la aplicacion en el navegador.

No ejecutes `npm run build` mientras `npm run dev` este abierto: ambos comandos escriben en `.next` y pueden dejar manifests incompletos durante el desarrollo.

## Evidencias en Cloudinary

Agrega estas variables a `.env.local` con los valores de tu cuenta Cloudinary:

```dotenv
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=tanqueo/evidencias
```

`CLOUDINARY_FOLDER` es opcional. Si ya tienes una carpeta creada, escribe su ruta en esa variable. No uses el prefijo `NEXT_PUBLIC_`: la firma de subida se genera exclusivamente en el servidor.

## Actualizacion incremental del 2 de junio de 2026

Para agregar la edicion de ordenes pendientes o vencidas y la tercera evidencia fotografica, ejecuta solamente:

```text
supabase/migrations/202606020001_order_edits_tank_photo.sql
```

Este script es adicional. No reemplaza ni modifica `202606010001_full_fuel_control.sql`.

## Actualizacion incremental del 3 de junio de 2026

Para acelerar listados, dashboard, ordenes e historial, ejecuta solamente:

```text
supabase/migrations/202606030001_performance_indexes.sql
```

Este script solo agrega indices idempotentes. No cambia tablas, datos, RLS ni funciones existentes.

Para que el dashboard muestre historicos exactos sin descargar todos los registros al navegador, ejecuta tambien:

```text
supabase/migrations/202606030002_dashboard_history_rpc.sql
```

Este script agrega la RPC `get_dashboard_history()`, que calcula totales y agrupaciones directamente en Supabase.

## Aviso automatico al cerrar o ejecutar una orden

La aplicacion intenta avisar al administrador en este orden: WhatsApp, correo y SMS. Las credenciales son privadas del servidor. Agrega solo los canales que vayas a usar:

```dotenv
ADMIN_NOTIFICATION_PHONE=+573001234567
ADMIN_NOTIFICATION_EMAIL=admin@empresa.com

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_API_KEY=
TWILIO_API_KEY_SECRET=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_CONTENT_SID=
TWILIO_SMS_FROM=

RESEND_API_KEY=
RESEND_FROM=ASUCAP <notificaciones@empresa.com>
```

`ADMIN_NOTIFICATION_PHONE` debe usar formato internacional. Si omites `ADMIN_NOTIFICATION_PHONE` o `ADMIN_NOTIFICATION_EMAIL`, se usan el telefono y el correo guardados en `Configuracion > Empresa`.

En el Sandbox de WhatsApp deja `TWILIO_WHATSAPP_CONTENT_SID` vacio: la aplicacion enviara un `Body` libre. Configura esa variable solamente cuando tengas una plantilla de contenido aprobada. Reinicia `npm run dev` despues de modificar `.env.local`.

Para verificar el Sandbox sin cerrar una orden, inicia sesion como administrador o despachador y ejecuta una solicitud autenticada:

```powershell
curl.exe -X POST http://localhost:3000/api/notifications/test -H "Authorization: Bearer TOKEN_DE_SESION"
```

El endpoint temporal `POST /api/notifications/test` envia el texto de prueba al numero configurado en `ADMIN_NOTIFICATION_PHONE`. Si Twilio acepta el mensaje, devuelve su `sid`. El servidor registra el intento y cualquier error de Twilio sin imprimir secretos.

Para produccion, configura un remitente aprobado y una plantilla aprobada de WhatsApp en Twilio mediante `TWILIO_WHATSAPP_CONTENT_SID`. Consulta la [API de mensajes de Twilio](https://www.twilio.com/docs/messaging/api/message-resource) y la [API de correos de Resend](https://resend.com/docs/api-reference/emails).

## Primer administrador

Si todavia no existe una cuenta administradora:

1. Crea un usuario en `Authentication > Users`.
2. Copia su UUID.
3. Ejecuta:

```sql
insert into public.profiles (id, full_name, role, email)
values ('UUID_DEL_USUARIO', 'Administrador', 'admin', 'correo@empresa.com')
on conflict (id) do update
set full_name = excluded.full_name, role = excluded.role, email = excluded.email;
```

## Verificacion rapida

- Confirma que `.env.local` contiene las credenciales privadas de Cloudinary.
- Confirma que existe la tabla `service_stations`.
- Confirma que existen las RPC `create_fuel_order`, `update_fuel_order`, `expire_fuel_orders`, `execute_fuel_order`, `delete_fuel_record` y `set_admin_pin`.
- Inicia sesion como administrador y crea una estacion, un operario, un despachador y una moto.
