import { effectiveOrderStatus, formatCurrency, formatDate } from "@/lib/fuel-utils"
import type { CompanySettings, FuelOrder, OrderPhoto } from "@/lib/types"

function escapeHtml(value?: string | number | null) {
  return String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function safeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*]+/g, "-")
}

function waitForImages(root: ParentNode) {
  const images = Array.from(root.querySelectorAll("img"))
  return Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve()
    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true })
      image.addEventListener("error", () => resolve(), { once: true })
    })
  }))
}

function buildFuelOrderDocument(order: FuelOrder, settings?: CompanySettings | null) {
  const status = effectiveOrderStatus(order)
  const station = order.station
  const companyLogo = new URL("/asucap-logo.png", window.location.origin).href
  const stationLogo = station?.logo_url
    ? `<img src="${escapeHtml(station.logo_url)}" alt="Logo estacion" style="display:block;height:45px;max-width:130px;margin:0 0 4px auto;object-fit:contain">`
    : `<div style="display:flex;width:45px;height:45px;margin:0 0 4px auto;align-items:center;justify-content:center;border:2px solid #0ea768;border-radius:8px;background:#e6f7ef;color:#0a7c4d;font-size:21px">&#9981;</div>`
  const isExecuted = Boolean(order.galones && status !== "pendiente" && status !== "vencida")
  const statusLabel = status === "ejecutada" || status === "verificado"
    ? `<div style="margin-top:2px;color:#0a7c4d;font-size:8px;font-weight:700">&#9745; ORDEN EJECUTADA</div>`
    : status === "vencida"
      ? `<div style="margin-top:2px;color:#d13b32;font-size:8px;font-weight:700">ORDEN VENCIDA</div>`
      : `<div style="margin-top:2px;color:#d97706;font-size:8px;font-weight:700">ORDEN ${escapeHtml(status.toUpperCase())}</div>`

  return `<div id="fuel-order-document" style="box-sizing:border-box;width:8.5in;height:5.5in;overflow:hidden;background:#fff;padding:.32in .42in;color:#1a2035;font-family:Arial,sans-serif">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:8px">
      <div style="flex:1">
        <img src="${companyLogo}" alt="ASUCAP San Jorge" style="display:block;height:45px;max-width:145px;margin-bottom:4px;object-fit:contain">
        <div style="font-size:12px;font-weight:900">${escapeHtml(settings?.emp_nombre || "ASUCAP")}</div>
        <div style="font-size:8px;color:#6b7590">NIT: ${escapeHtml(settings?.emp_nit)}</div>
        <div style="font-size:8px;color:#6b7590">${escapeHtml(settings?.emp_dir)}</div>
        <div style="font-size:8px;color:#6b7590">${escapeHtml(settings?.emp_tel)} ${settings?.emp_ciudad ? `- ${escapeHtml(settings.emp_ciudad)}` : ""}</div>
      </div>
      <div style="flex:1;padding:3px 8px;text-align:center">
        <div style="color:#9ca3af;font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Orden de suministro</div>
        <div style="color:#737b8c;font-size:20px;font-weight:900;letter-spacing:1px">${escapeHtml(order.num)}</div>
        <div style="margin-top:8px;color:#6b7590;font-size:8px">Emision: ${formatDate(order.fecha_emision)}</div>
        <div style="color:#d97706;font-size:8px;font-weight:700">Vence: ${formatDate(order.fecha_vencimiento)}</div>
        ${statusLabel}
      </div>
      <div style="flex:1;text-align:right">
        ${stationLogo}
        <div style="font-size:12px;font-weight:900">${escapeHtml(station?.nombre || "Estacion de Servicio")}</div>
        <div style="font-size:8px;color:#6b7590">NIT: ${escapeHtml(station?.nit)}</div>
        <div style="font-size:8px;color:#6b7590">${escapeHtml(station?.direccion)}</div>
        <div style="font-size:8px;color:#6b7590">${escapeHtml(station?.telefono)}</div>
      </div>
    </div>
    <div style="margin-bottom:9px;border-top:3px solid #1a2f6e"></div>
    <div style="display:flex;gap:12px;margin-bottom:9px">
      <div style="flex:1;padding:8px 10px">
        <div style="margin-bottom:5px;color:#6b7590;font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Operario</div>
        <div style="font-size:14px;font-weight:900">${escapeHtml(order.profiles?.full_name)}</div>
        <div style="font-size:8px;color:#6b7590">CC: ${escapeHtml(order.profiles?.cedula)}</div>
        <div style="font-size:8px;color:#6b7590">Despachador: ${escapeHtml(order.despachador?.full_name)}</div>
      </div>
      <div style="flex:1;padding:8px 10px">
        <div style="margin-bottom:5px;color:#6b7590;font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Moto / Placa</div>
        <div style="font-size:20px;font-weight:900;letter-spacing:2px">${escapeHtml(order.vehicles?.placa)}</div>
        <div style="font-size:8px;color:#6b7590">${escapeHtml(order.vehicles?.marca)} ${escapeHtml(order.vehicles?.modelo)}</div>
        <div style="font-size:8px;color:#6b7590">Cap: ${escapeHtml(order.vehicles?.capacidad_tanque)} gal - ${escapeHtml(order.vehicles?.color)}</div>
      </div>
      <div style="flex:1;padding:8px 10px;text-align:center">
        <div style="margin-bottom:3px;color:#9ca3af;font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Galones suministrados</div>
        <div style="color:#9ca3af;font-size:36px;font-weight:900;line-height:1">${isExecuted ? escapeHtml(order.galones) : "-"}</div>
        <div style="margin-top:3px;color:#9ca3af;font-size:8px">${escapeHtml(station?.combustible || "Combustible")}</div>
      </div>
    </div>
    ${isExecuted ? `<div style="margin-bottom:9px;padding:8px 11px;border:1.5px solid #0ea768;border-radius:8px;background:#f2fbf7">
      <div style="margin-bottom:4px;color:#0a7c4d;font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase">&#9745; Datos de ejecucion</div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:8px">
        <span><strong>Fecha:</strong> ${formatDate(order.fecha_ejecucion)}</span>
        <span><strong>Gal reales:</strong> ${escapeHtml(order.galones)}</span>
        <span><strong>Valor:</strong> ${formatCurrency(order.valor_total)}</span>
        <span><strong>KM:</strong> ${Number(order.kilometraje_actual || 0).toLocaleString("es-CO")}</span>
        ${order.rendimiento_real ? `<span><strong>Rendimiento:</strong> ${escapeHtml(order.rendimiento_real)} km/gal</span>` : ""}
        ${order.gps_lat && order.gps_lng ? `<span><strong>GPS:</strong> ${escapeHtml(order.gps_lat)}, ${escapeHtml(order.gps_lng)}</span>` : ""}
      </div>
    </div>` : ""}
    ${order.observaciones ? `<div style="margin-bottom:8px;padding:6px 9px;border:1px solid #d97706;border-radius:6px;background:#fef3c7;font-size:8px"><strong>Observaciones:</strong> ${escapeHtml(order.observaciones)}</div>` : ""}
    <div style="margin-bottom:8px;padding:7px 9px;border-radius:6px;background:#f4f6fa;color:#525b70;font-size:7px;line-height:1.35">
      <strong>INSTRUCCIONES:</strong> La presente orden es valida para el vehiculo y operario indicados hasta la fecha de vencimiento senalada. La estacion de servicio debe verificar la placa del vehiculo y la cedula del operario antes de suministrar combustible. El operario debe registrar los galones suministrados y la factura al finalizar el tanqueo.
    </div>
    <div style="display:flex;gap:14px">
      <div style="flex:1;text-align:center"><div style="height:21px;margin-bottom:3px;border-bottom:1.5px solid #1a2035"></div><div style="font-size:7px;font-weight:700;text-transform:uppercase">${escapeHtml(order.despachador?.full_name || "Despachador")}</div><div style="color:#6b7590;font-size:7px">Firma despachador</div></div>
      <div style="flex:1;text-align:center"><div style="height:21px;margin-bottom:3px;border-bottom:1.5px solid #1a2035"></div><div style="font-size:7px;font-weight:700;text-transform:uppercase">${escapeHtml(order.profiles?.full_name || "Operario")}</div><div style="color:#6b7590;font-size:7px">Firma operario - CC: ${escapeHtml(order.profiles?.cedula)}</div></div>
      <div style="flex:1;text-align:center"><div style="height:21px;margin-bottom:3px;border-bottom:1.5px solid #1a2035"></div><div style="font-size:7px;font-weight:700;text-transform:uppercase">Estacion de servicio</div><div style="color:#6b7590;font-size:7px">Firma y sello estacion</div></div>
    </div>
    <div style="margin-top:8px;padding-top:4px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:6px;text-align:center">ASUCAP - Sistema Control de Tanqueo - Codigo: ${escapeHtml(order.id.slice(-8).toUpperCase())} - Generado: ${new Date().toLocaleString("es-CO")}</div>
  </div>`
}

export function printFuelOrder(order: FuelOrder, settings?: CompanySettings | null, _photos: OrderPhoto[] = []) {
  void _photos
  const popup = window.open("", "_blank")
  if (!popup) throw new Error("El navegador bloqueo la ventana de impresion.")
  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(order.num)}</title><style>@page{size:8.5in 5.5in;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{margin:0;background:#fff}</style></head><body>${buildFuelOrderDocument(order, settings)}</body></html>`)
  popup.document.close()
  popup.addEventListener("afterprint", () => popup.close(), { once: true })
  void waitForImages(popup.document).then(() => {
    popup.focus()
    popup.print()
  })
}

export async function downloadFuelOrderPdf(order: FuelOrder, settings?: CompanySettings | null) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ])
  const frame = document.createElement("iframe")
  frame.title = "Documento PDF temporal"
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:8.5in;height:5.5in;border:0"
  document.body.appendChild(frame)

  try {
    const frameDocument = frame.contentDocument
    if (!frameDocument) throw new Error("No fue posible preparar el documento.")
    frameDocument.open()
    frameDocument.write(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style></head><body>${buildFuelOrderDocument(order, settings)}</body></html>`)
    frameDocument.close()
    await waitForImages(frameDocument)
    const documentElement = frameDocument.querySelector<HTMLElement>("#fuel-order-document")
    if (!documentElement) throw new Error("No fue posible preparar el documento.")
    const canvas = await html2canvas(documentElement, { backgroundColor: "#ffffff", scale: 2, useCORS: true })
    const pdf = new jsPDF({ orientation: "landscape", unit: "in", format: [8.5, 5.5], compress: true })
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 8.5, 5.5, undefined, "FAST")
    pdf.save(`${safeFileName(order.num)}.pdf`)
  } finally {
    frame.remove()
  }
}
