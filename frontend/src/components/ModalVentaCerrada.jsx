// ---------------------------------------------------------------------------
// ModalVentaCerrada.jsx: confirmación después de cobrar. Muestra el resultado
// (y el cambio a devolver si fue en efectivo) y deja ver la factura o empezar otra venta.
// El administrador ve además el botón "Corregir" (por si se equivocó al cobrar).
// Props: venta (la venta cerrada), cliente, esAdmin, alNuevaVenta, alCorregir, alCerrar.
// ---------------------------------------------------------------------------
import { useState } from "react";
import Modal from "./Modal.jsx";
import Boton from "./Boton.jsx";
import Factura from "./Factura.jsx";
import Icono from "./Icono.jsx";
import { formatearPrecio, codigoCorto } from "../utils/formato.js";

function ModalVentaCerrada(props) {
  const venta = props.venta;

  // verFactura = true cambia el contenido del modal para mostrar la factura
  const [verFactura, setVerFactura] = useState(false);

  // Si piden ver la factura, mostramos la factura con un botón para volver
  if (verFactura) {
    return (
      <Modal titulo="Factura" alCerrar={props.alCerrar} ancho="amplio">
        <Factura venta={venta} cliente={props.cliente} />
        <div className="acciones-fila no-imprimir">
          <Boton variante="suave" icono="atras" alHacerClic={function () { setVerFactura(false); }}>
            Volver
          </Boton>
          <Boton variante="principal" alHacerClic={props.alNuevaVenta}>
            Nueva venta
          </Boton>
        </div>
      </Modal>
    );
  }

  // Mensaje principal según cómo se pagó
  let resumenPago = "Pagado con " + venta.metodoPago + ".";
  if (venta.metodoPago === "Debe") {
    resumenPago = "Quedó a crédito (Debe).";
  }

  return (
    <Modal titulo="Venta cerrada" alCerrar={props.alCerrar}>
      <div className="exito">
        <span className="exito-icono">
          <Icono nombre="check" />
        </span>
        <p className="exito-titulo">¡Listo, venta registrada!</p>
        <p className="exito-texto">
          {codigoCorto(venta.id)}: {formatearPrecio(venta.total)}. {resumenPago}
        </p>
      </div>

      {/* El cambio se muestra enorme: es lo último que el cajero necesita ver */}
      {venta.metodoPago === "Efectivo" && venta.cambio > 0 && (
        <div className="cambio cambio-devolver">
          <p className="cambio-titulo">Devuelve al cliente</p>
          <p className="cambio-valor">{formatearPrecio(venta.cambio)}</p>
        </div>
      )}
      {venta.metodoPago === "Efectivo" && venta.cambio === 0 && (
        <div className="cambio cambio-exacto">
          <p className="cambio-titulo">Pago exacto</p>
          <p className="cambio-valor">No hay cambio</p>
        </div>
      )}

      {venta.descuentoMonto > 0 && (
        <p className="cobro-nota">
          Se aplicó el descuento "{venta.descuentoNombre}": − {formatearPrecio(venta.descuentoMonto)}.
        </p>
      )}

      <div className="acciones-fila">
        {/* Corregir: solo el administrador (el backend también lo exige) */}
        {props.esAdmin && (
          <Boton variante="suave" icono="editar" alHacerClic={props.alCorregir}>
            Corregir
          </Boton>
        )}
        <Boton variante="suave" icono="recibo" alHacerClic={function () { setVerFactura(true); }}>
          Ver factura
        </Boton>
        <Boton variante="principal" alHacerClic={props.alNuevaVenta}>
          Nueva venta
        </Boton>
      </div>
    </Modal>
  );
}

export default ModalVentaCerrada;
