import { formatCurrency, formatDate } from "@/lib/fuel-utils"
import type { CompanySettings, FuelOrder, OrderPhoto } from "@/lib/types"

function escapeHtml(value?: string | number | null) {
  return String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

export function printFuelOrder(order: FuelOrder, settings?: CompanySettings | null, photos: OrderPhoto[] = []) {
  const popup = window.open("", "_blank")
  if (!popup) throw new Error("El navegador bloqueo la ventana de impresion")
  const station = order.station

  const photoHtml = photos.length
    ? `<div class="photos">${photos.map((photo) => `<div><img src="${escapeHtml(photo.photo_url)}" alt="${escapeHtml(photo.tipo)}"><small>${escapeHtml(photo.tipo)}</small></div>`).join("")}</div>`
    : ""

  popup.document.write(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(order.num)}</title>
<style>
@page{size:letter landscape;margin:.35in}body{font-family:Arial,sans-serif;color:#1a2035;margin:0;font-size:11px}
.sheet{border:1px solid #dde1ea;padding:18px}.head{display:flex;justify-content:space-between;gap:18px;border-bottom:2px solid #1a2f6e;padding-bottom:12px}
.company,.station{flex:1}.station{text-align:right}.logo{height:40px;max-width:150px;object-fit:contain;margin-bottom:5px}.station .logo{margin-left:auto}.title{background:#1a56db;color:white;border-radius:8px;padding:10px 16px;text-align:center}
.title b{display:block;font-size:20px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.box{background:#f4f6fa;border-radius:8px;padding:10px}
.box strong{display:block;font-size:15px;margin-top:4px}.execution{background:#e6f7ef;border:1px solid #0ea768;border-radius:8px;padding:10px;margin-bottom:12px}
.notes{background:#fef3c7;border:1px solid #d97706;border-radius:8px;padding:9px;margin-bottom:12px}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:25px;margin-top:32px;text-align:center}
.signature{border-top:1px solid #1a2035;padding-top:5px;font-size:9px}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.photos img{height:85px;width:100%;object-fit:cover;border-radius:6px}
.photos small{display:block;text-align:center;text-transform:uppercase}.footer{text-align:center;color:#6b7590;font-size:8px;margin-top:14px}
</style></head><body><div class="sheet">
<div class="head"><div class="company"><img class="logo" src="/asucap-logo.png" alt="Logo empresa"><b>${escapeHtml(settings?.emp_nombre || "Empresa")}</b><div>NIT: ${escapeHtml(settings?.emp_nit)}</div><div>${escapeHtml(settings?.emp_dir)}</div><div>${escapeHtml(settings?.emp_tel)} ${escapeHtml(settings?.emp_ciudad)}</div></div>
<div class="title">ORDEN DE SUMINISTRO<b>${escapeHtml(order.num)}</b><span>${escapeHtml(order.estado.toUpperCase())}</span></div>
<div class="station">${station?.logo_url ? `<img class="logo" src="${escapeHtml(station.logo_url)}" alt="Logo estacion">` : ""}<b>${escapeHtml(station?.nombre || "Estacion de Servicio")}</b><div>NIT: ${escapeHtml(station?.nit)}</div><div>${escapeHtml(station?.direccion)}</div><div>${escapeHtml(station?.telefono)}</div></div></div>
<div class="grid"><div class="box">OPERARIO<strong>${escapeHtml(order.profiles?.full_name)}</strong><div>CC: ${escapeHtml(order.profiles?.cedula)}</div></div>
<div class="box">MOTO / PLACA<strong>${escapeHtml(order.vehicles?.placa)}</strong><div>${escapeHtml(order.vehicles?.marca)} ${escapeHtml(order.vehicles?.modelo)}</div></div>
<div class="box">GALONES SUMINISTRADOS<strong>${order.galones ? `${escapeHtml(order.galones)} gal` : "Por registrar"}</strong><div>${escapeHtml(station?.combustible || "Combustible")}</div></div></div>
<div>Emision: <b>${formatDate(order.fecha_emision)}</b> | Vencimiento: <b>${formatDate(order.fecha_vencimiento)}</b> | Despachador: <b>${escapeHtml(order.despachador?.full_name)}</b></div>
${order.estado !== "pendiente" && order.galones ? `<div class="execution"><b>DATOS DE EJECUCION</b><div>${escapeHtml(order.galones)} gal | ${formatCurrency(order.valor_total)} | KM ${escapeHtml(order.kilometraje_actual)} | Rendimiento ${escapeHtml(order.rendimiento_real)} km/gal</div></div>` : ""}
${order.observaciones ? `<div class="notes"><b>Observaciones:</b> ${escapeHtml(order.observaciones)}</div>` : ""}
${photoHtml}
<div class="signatures"><div class="signature">Firma despachador</div><div class="signature">Firma operario</div><div class="signature">Firma y sello estacion</div></div>
<div class="footer">Sistema Control de Tanqueo | Generado ${new Date().toLocaleString("es-CO")}</div>
</div><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800)}<\/script></body></html>`)
  popup.document.close()
}
