// ---------------------------------------------------------------------------
// ModalReembolso.jsx: ventana para reembolsar productos de una venta cerrada
// (solo administrador).
//  - Se elige cuántas unidades de cada producto se devuelven (parcial) o se toca
//    "Reembolsar todo" (total).
//  - Por cada producto se indica si vuelve o no al inventario.
//  - El valor a devolver se recalcula solo y respeta el descuento de la venta.
// Props: venta, alReembolsada(resultado) y alCerrar.
// ---------------------------------------------------------------------------
import { useState } from "react";
import Modal from "./Modal.jsx";
import Boton from "./Boton.jsx";
import Icono from "./Icono.jsx";
import { reembolsarVenta } from "../servicios/ventas.js";
import { nuevoId } from "../utils/ids.js";
import { formatearPrecio, textoCantidad } from "../utils/formato.js";

function ModalReembolso(props) {
  const venta = props.venta;

  // Una línea por cada producto que todavía tiene unidades sin reembolsar.
  // (La función dentro de useState se ejecuta solo la primera vez.)
  const [lineas, setLineas] = useState(function () {
    const iniciales = [];
    venta.items.forEach(function (item) {
      const disponible = item.cantidad - item.cantidadReembolsada;
      if (disponible > 0) {
        iniciales.push({
          detalleId: item.detalleId,
          nombre: item.nombre,
          precio: item.precio,
          disponible: disponible, // máximo que se puede reembolsar
          cantidad: 0, // cuántas unidades se van a reembolsar ahora
          retorna: true // ¿el producto vuelve al inventario?
        });
      }
    });
    return iniciales;
  });

  // El id del reembolso se genera UNA sola vez: si hay que reintentar, no se registra doble
  const [idReembolso] = useState(function () {
    return nuevoId();
  });
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [hecho, setHecho] = useState(null); // el reembolso ya registrado (para la confirmación)

  // ----- Cálculos que se rehacen en cada cambio -----

  // Valor a devolver por una línea: la parte del TOTAL pagado que corresponde a esas unidades.
  // venta.total ya incluye el IVA y el descuento, así el descuento se respeta de forma proporcional.
  // (El backend hace este mismo cálculo y el suyo es el que queda guardado.)
  function valorDeLinea(linea) {
    if (venta.subtotal === 0) {
      return 0;
    }
    return Math.round((linea.precio * linea.cantidad * venta.total) / venta.subtotal);
  }

  let totalReembolso = 0;
  let unidades = 0;
  let todoElegido = true; // ¿se eligieron todas las unidades disponibles?
  lineas.forEach(function (linea) {
    totalReembolso = totalReembolso + valorDeLinea(linea);
    unidades = unidades + linea.cantidad;
    if (linea.cantidad < linea.disponible) {
      todoElegido = false;
    }
  });

  // Si con esto se devuelve toda la venta, el valor es exactamente lo que falta por devolver
  // (evita diferencias de un peso por el redondeo)
  if (todoElegido && lineas.length > 0) {
    totalReembolso = venta.total - venta.totalReembolsado;
  }

  // ----- Acciones -----

  // Cambia un dato (cantidad o retorna) de una línea
  function cambiarLinea(detalleId, campo, valor) {
    const nuevas = lineas.map(function (linea) {
      if (linea.detalleId === detalleId) {
        const copia = Object.assign({}, linea);
        copia[campo] = valor;
        return copia;
      }
      return linea;
    });
    setLineas(nuevas);
    setError("");
  }

  // Botón "Reembolsar todo": pone cada línea en su máximo
  function elegirTodo() {
    const nuevas = lineas.map(function (linea) {
      return Object.assign({}, linea, { cantidad: linea.disponible });
    });
    setLineas(nuevas);
    setError("");
  }

  // Confirma el reembolso en el backend
  async function confirmar() {
    if (trabajando) {
      return; // evita toques repetidos
    }
    if (unidades === 0) {
      setError("Elige al menos una unidad para reembolsar.");
      return;
    }

    // Solo se envían las líneas con cantidad mayor que cero
    const items = [];
    lineas.forEach(function (linea) {
      if (linea.cantidad > 0) {
        items.push({ detalleId: linea.detalleId, cantidad: linea.cantidad, retornaInventario: linea.retorna });
      }
    });

    setError("");
    setTrabajando(true);
    try {
      const resultado = await reembolsarVenta(venta.id, idReembolso, items);
      props.alReembolsada(resultado); // la pantalla de Ventas actualiza la venta y el inventario

      // Buscamos en la respuesta el reembolso que acabamos de registrar
      const registrado = resultado.venta.reembolsos.find(function (reembolso) {
        return reembolso.id === idReembolso;
      });
      if (registrado) {
        setHecho(registrado); // muestra la confirmación con el valor a devolver
      } else {
        props.alCerrar();
      }
    } catch (falla) {
      setError(falla.message);
    } finally {
      setTrabajando(false);
    }
  }

  // ----- Pantalla de confirmación (después de registrar) -----
  if (hecho) {
    return (
      <Modal titulo="Reembolso registrado" alCerrar={props.alCerrar}>
        <div className="exito">
          <span className="exito-icono">
            <Icono nombre="check" />
          </span>
          <p className="exito-titulo">¡Listo, reembolso registrado!</p>
          <p className="exito-texto">El inventario ya se actualizó con los productos que volvieron.</p>
        </div>
        <div className="cambio cambio-devolver">
          <p className="cambio-titulo">Devuelve al cliente</p>
          <p className="cambio-valor">{formatearPrecio(hecho.total)}</p>
        </div>
        <div className="acciones-fila">
          <Boton variante="principal" alHacerClic={props.alCerrar}>
            Volver a la venta
          </Boton>
        </div>
      </Modal>
    );
  }

  // ----- Pantalla para elegir qué se reembolsa -----
  return (
    <Modal titulo="Reembolsar productos" alCerrar={props.alCerrar} bloqueado={trabajando} ancho="amplio">
      <p className="campo-ayuda">Elige cuántas unidades devuelve el cliente y si el producto vuelve al inventario.</p>

      <div className="acciones-fila acciones-izquierda">
        <Boton variante="secundario" icono="devolver" alHacerClic={elegirTodo} deshabilitado={trabajando}>
          Reembolsar todo
        </Boton>
      </div>

      <ul className="lineas-compra">
        {lineas.map(function (linea) {
          return (
            <li className="linea-compra" key={linea.detalleId}>
              <div className="linea-compra-nombre">
                <p>{linea.nombre}</p>
                <p className="campo-ayuda">
                  {formatearPrecio(linea.precio)} c/u. Se pueden reembolsar {textoCantidad(linea.disponible, "unidad", "unidades")}.
                </p>
              </div>

              <div className="reembolso-controles">
                {/* Cantidad a reembolsar: botones − y + entre 0 y el máximo disponible */}
                <div className="cantidad">
                  <button
                    type="button"
                    className="cantidad-boton"
                    aria-label={"Reembolsar una unidad menos de " + linea.nombre}
                    disabled={trabajando || linea.cantidad <= 0}
                    onClick={function () {
                      cambiarLinea(linea.detalleId, "cantidad", linea.cantidad - 1);
                    }}
                  >
                    <Icono nombre="resta" />
                  </button>
                  <span className="cantidad-numero cantidad-fija">{linea.cantidad}</span>
                  <button
                    type="button"
                    className="cantidad-boton"
                    aria-label={"Reembolsar una unidad más de " + linea.nombre}
                    disabled={trabajando || linea.cantidad >= linea.disponible}
                    onClick={function () {
                      cambiarLinea(linea.detalleId, "cantidad", linea.cantidad + 1);
                    }}
                  >
                    <Icono nombre="suma" />
                  </button>
                </div>

                {/* ¿Vuelve al inventario? Solo importa si se va a reembolsar algo de esta línea */}
                <label className="casilla">
                  <input
                    type="checkbox"
                    checked={linea.retorna}
                    disabled={trabajando || linea.cantidad === 0}
                    onChange={function (evento) {
                      cambiarLinea(linea.detalleId, "retorna", evento.target.checked);
                    }}
                  />
                  <span>Vuelve al inventario</span>
                </label>
              </div>

              <div className="linea-compra-pie">
                <span className="linea-compra-subtotal">{formatearPrecio(valorDeLinea(linea))}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {venta.descuentoMonto > 0 && <p className="campo-ayuda">Esta venta tuvo descuento: el valor a devolver ya lo tiene en cuenta de forma proporcional.</p>}

      <div className="cobro-total">
        <span>Total a devolver</span>
        <strong>{formatearPrecio(totalReembolso)}</strong>
      </div>

      {error !== "" && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      <div className="acciones-fila">
        <Boton variante="suave" alHacerClic={props.alCerrar} deshabilitado={trabajando}>
          Cancelar
        </Boton>
        <Boton variante="principal" alHacerClic={confirmar} cargando={trabajando} textoCargando="Registrando…" deshabilitado={unidades === 0}>
          Confirmar reembolso
        </Boton>
      </div>
    </Modal>
  );
}

export default ModalReembolso;
