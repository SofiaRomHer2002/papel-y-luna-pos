// ---------------------------------------------------------------------------
// Factura.jsx: la factura (documento equivalente) de una venta cerrada.
// Se puede imprimir o guardar como PDF con el botón "Imprimir / guardar PDF"
// (el navegador ofrece "Guardar como PDF" como impresora).
// Los estilos de impresión (impresion.css) dejan visible SOLO esta factura.
// En la entrega final también muestra: el descuento aplicado, la marca de "venta
// corregida" (quién y cuándo) y los reembolsos que tenga la venta.
// Props: venta (con items) y cliente (el registro del cliente, o null si no hay).
// ---------------------------------------------------------------------------
import { NOMBRE_NEGOCIO, TIPO_NEGOCIO, TASA_IVA_PORCENTAJE } from "../config.js";
import { describirDescuento } from "../utils/calculos.js";
import { formatearPrecio, formatearFecha, codigoCorto } from "../utils/formato.js";
import Boton from "./Boton.jsx";

function Factura(props) {
  const venta = props.venta;
  const cliente = props.cliente;

  // Texto del estado de reembolso (si la venta tiene)
  let textoReembolso = "";
  if (venta.estadoReembolso === "parcial") {
    textoReembolso = "Esta venta tiene un reembolso parcial";
  }
  if (venta.estadoReembolso === "total") {
    textoReembolso = "Esta venta fue reembolsada en su totalidad";
  }

  // Texto del cliente (si no hay, es una venta de mostrador)
  let textoCliente = "Cliente de mostrador";
  if (cliente) {
    textoCliente = cliente.nombre;
  }

  // Una fila de la tabla por cada línea de la venta
  const filas = venta.items.map(function (linea, posicion) {
    return (
      <tr key={posicion}>
        <td>{linea.nombre}</td>
        <td className="factura-numero">{linea.cantidad}</td>
        <td className="factura-numero">{formatearPrecio(linea.precio)}</td>
        <td className="factura-numero">{formatearPrecio(linea.precio * linea.cantidad)}</td>
      </tr>
    );
  });

  return (
    <div>
      {/* Esta parte es la que se imprime */}
      <article className="factura-imprimible">
        <header className="factura-cabecera">
          <img className="factura-logo" src={import.meta.env.BASE_URL + "logo-papel-y-luna.png"} alt="" />
          <h2 className="factura-negocio">{NOMBRE_NEGOCIO}</h2>
          <p>{TIPO_NEGOCIO}</p>
          <p className="factura-tipo">Documento equivalente a factura</p>
        </header>

        {/* Marca de corrección: visible en la factura, con quién corrigió y cuándo */}
        {venta.corregida && (
          <p className="factura-marca">
            Venta corregida por {venta.corregidaPor} el {formatearFecha(venta.corregidaEn)}
          </p>
        )}

        <dl className="factura-datos">
          <div>
            <dt>Venta</dt>
            <dd>{codigoCorto(venta.id)}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{formatearFecha(venta.fecha)}</dd>
          </div>
          <div>
            <dt>Cliente</dt>
            <dd>{textoCliente}</dd>
          </div>
          <div>
            <dt>Pago</dt>
            <dd>{venta.metodoPago}</dd>
          </div>
        </dl>

        <table className="factura-tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="factura-numero">Cant.</th>
              <th className="factura-numero">Precio</th>
              <th className="factura-numero">Subtotal</th>
            </tr>
          </thead>
          <tbody>{filas}</tbody>
        </table>

        <div className="factura-totales">
          <p>
            <span>Subtotal</span>
            <span>{formatearPrecio(venta.subtotal)}</span>
          </p>
          <p>
            <span>IVA ({TASA_IVA_PORCENTAJE}%)</span>
            <span>{formatearPrecio(venta.iva)}</span>
          </p>
          {/* El descuento solo aparece si la venta tuvo uno */}
          {venta.descuentoMonto > 0 && (
            <p>
              <span>
                Descuento: {venta.descuentoNombre} ({describirDescuento(venta.descuentoTipo, venta.descuentoValor)})
              </span>
              <span>− {formatearPrecio(venta.descuentoMonto)}</span>
            </p>
          )}
          <p className="factura-total">
            <span>Total</span>
            <span>{formatearPrecio(venta.total)}</span>
          </p>
          {/* Si se pagó en efectivo, mostramos lo recibido y el cambio devuelto */}
          {venta.metodoPago === "Efectivo" && (
            <p>
              <span>Recibido</span>
              <span>{formatearPrecio(venta.valorRecibido)}</span>
            </p>
          )}
          {venta.metodoPago === "Efectivo" && (
            <p>
              <span>Cambio</span>
              <span>{formatearPrecio(venta.cambio)}</span>
            </p>
          )}
          {venta.metodoPago === "Debe" && <p className="factura-nota">Venta a crédito: el saldo queda a cargo del cliente.</p>}
        </div>

        {/* Reembolsos de la venta: fecha, quién lo hizo, qué se devolvió y cuánto */}
        {venta.reembolsos.length > 0 && (
          <div className="factura-reembolsos">
            <p className="factura-marca">{textoReembolso}</p>
            {venta.reembolsos.map(function (reembolso) {
              return (
                <div className="factura-reembolso" key={reembolso.id}>
                  <p>
                    Reembolso del {formatearFecha(reembolso.fecha)}, por {reembolso.usuario}
                  </p>
                  {reembolso.items.map(function (linea, posicion) {
                    return (
                      <p className="factura-reembolso-linea" key={posicion}>
                        <span>
                          {linea.cantidad} x {linea.nombre}
                        </span>
                        <span>− {formatearPrecio(linea.valor)}</span>
                      </p>
                    );
                  })}
                </div>
              );
            })}
            <p className="factura-total">
              <span>Total reembolsado</span>
              <span>− {formatearPrecio(venta.totalReembolsado)}</span>
            </p>
          </div>
        )}

        {venta.usuario !== "" && <p className="factura-nota">Atendió: {venta.usuario}</p>}
        <p className="factura-gracias">¡Gracias por tu compra!</p>
      </article>

      {/* Este botón no se imprime (la clase no-imprimir lo oculta al imprimir) */}
      <div className="acciones-fila no-imprimir">
        <Boton variante="principal" icono="impresora" alHacerClic={function () { window.print(); }}>
          Imprimir / guardar PDF
        </Boton>
      </div>
    </div>
  );
}

export default Factura;
