# Configuracion Supabase

1. Abre el SQL Editor del proyecto Supabase conectado en `.env.local`.
2. Ejecuta `supabase/migrations/202606010001_full_fuel_control.sql`.
3. Agrega `SUPABASE_SERVICE_ROLE_KEY` al entorno privado del servidor para habilitar el ingreso por perfil y las altas y bajas de cuentas desde el panel admin. No uses el prefijo `NEXT_PUBLIC_`.
4. Agrega las credenciales privadas de Cloudinary descritas abajo.
5. Reinicia el servidor Next.js despues de agregar las variables.

La migracion conserva los datos existentes, agrega `service_stations` y `fuel_records`, aplica RLS y define las RPC requeridas. Tambien corrige instalaciones antiguas donde `fuel_orders.galones` quedo obligatorio: una orden pendiente todavia no tiene galones reales.

El despachador crea la orden sin definir galones. El operario registra manualmente los galones suministrados, el valor total de la factura, la foto del tablero y la foto de la factura al ejecutar la orden.

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
- Confirma que existen las RPC `create_fuel_order`, `expire_fuel_orders`, `execute_fuel_order`, `delete_fuel_record` y `set_admin_pin`.
- Inicia sesion como administrador y crea una estacion, un operario, un despachador y una moto.
