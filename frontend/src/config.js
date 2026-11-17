// ---------------------------------------------------------------------------
// config.js: constantes fijas de la aplicación.
// Estas NO son datos del negocio (productos, ventas, clientes... viven en la base de datos del backend).
// Son reglas fijas que el documento de la entrega permite dejar como constantes.
// ---------------------------------------------------------------------------

// Nombre y tipo de negocio que se muestran en el encabezado y en la factura
export const NOMBRE_NEGOCIO = "Papel y Luna";
export const TIPO_NEGOCIO = "Papelería y miscelánea";

// Porcentaje de IVA que se suma al subtotal (19% = 0.19), igual que en el MVP 1
export const TASA_IVA = 0.19;
// El mismo IVA como número entero (19), para calcular con enteros igual que el backend
export const TASA_IVA_PORCENTAJE = 19;

// Métodos de pago: el documento permite dejarlos como constantes de la aplicación
export const METODOS_PAGO = ["Efectivo", "Nequi", "Debe"];

// Billetes que aparecen como botones rápidos al cobrar en efectivo
export const BILLETES_RAPIDOS = [10000, 20000, 50000, 100000];

// Cuánto tiempo (en milisegundos) se queda visible un aviso en pantalla
export const DURACION_AVISO = 5000;

// Cuánto esperamos la respuesta del backend antes de rendirnos (en milisegundos)
// El primer acceso al servicio Free de Render puede tardar cerca de un minuto.
export const TIEMPO_MAXIMO_ESPERA = 90000;

// Cada cuánto se vuelve a leer el catálogo del backend (en milisegundos).
// Así, si otra caja vende o el administrador cambia un precio, esta pantalla se entera sola.
export const INTERVALO_ACTUALIZACION = 15000;

// Tipos de descuento y de faltante (los valores son los que guarda la base de datos)
export const TIPOS_DESCUENTO = [
  { valor: "porcentual", etiqueta: "Porcentaje (%)" },
  { valor: "fijo", etiqueta: "Valor fijo ($)" }
];
export const TIPOS_FALTANTE = [
  { valor: "agotado", etiqueta: "Agotado" },
  { valor: "inexistente", etiqueta: "No lo vendemos" }
];
