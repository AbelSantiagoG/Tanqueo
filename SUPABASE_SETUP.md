# Configuracion Supabase

1. Abre el SQL Editor del proyecto Supabase conectado en `.env.local`.
2. Ejecuta `supabase/migrations/202606010001_full_fuel_control.sql`.
3. Agrega `SUPABASE_SERVICE_ROLE_KEY` al entorno privado del servidor para habilitar altas y bajas de cuentas desde el panel admin. No uses el prefijo `NEXT_PUBLIC_`.
4. Reinicia el servidor Next.js despues de agregar la variable.

La migracion conserva los datos existentes, agrega `service_stations` y `fuel_records`, crea el bucket publico `evidencias-tanqueo`, aplica RLS y define las RPC requeridas. Tambien corrige instalaciones antiguas donde `fuel_orders.galones` quedo obligatorio: una orden pendiente todavia no tiene galones reales.

El despachador crea la orden indicando los galones autorizados. El operario registra manualmente los galones realmente suministrados y el valor total de la factura al ejecutar la orden.

Puedes ejecutar nuevamente la migracion completa si ya habias aplicado una version anterior. Las operaciones son idempotentes y migran la estacion configurada anteriormente a la nueva lista de estaciones.

## Actualizacion requerida para estaciones

Si la aplicacion muestra el aviso `Supabase esta pendiente de actualizacion` o errores relacionados con `service_stations` y `station_id`, el proyecto remoto todavia usa el esquema anterior.

1. Abre `supabase/migrations/202606010001_full_fuel_control.sql`.
2. Copia su contenido completo en `Supabase > SQL Editor`.
3. Ejecuta el script.
4. Recarga la aplicacion en el navegador.

No ejecutes `npm run build` mientras `npm run dev` este abierto: ambos comandos escriben en `.next` y pueden dejar manifests incompletos durante el desarrollo.

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

- Confirma que Storage contiene el bucket `evidencias-tanqueo`.
- Confirma que existe la tabla `service_stations`.
- Confirma que existen las RPC `create_fuel_order`, `expire_fuel_orders`, `execute_fuel_order`, `delete_fuel_record` y `set_admin_pin`.
- Inicia sesion como administrador y crea una estacion, un operario, un despachador y una moto.
