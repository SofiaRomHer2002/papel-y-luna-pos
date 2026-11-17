// ---------------------------------------------------------------------------
// ModalCobro.jsx: ventana para cobrar la venta.
//  - Se elige el método de pago (Efectivo, Nequi o Debe).
//  - En EFECTIVO se escribe lo que entrega el cliente y se muestra, bien grande,
//    el CAMBIO que hay que devolverle (o cuánto falta si no alcanza).
//  - En DEBE es obligatorio elegir un cliente.
//  - Si la venta tiene descuento, se muestra cuánto se descontó (el total ya lo incluye).
// Props: total, descuento (pesos descontados), nombreDescuento, clientes, clienteIdInicial,
//        alConfirmar (async), alCerrar, alIrAClientes.
// ---------------------------------------------------------------------------
import { useState } from "react";
import Modal from "./Modal.jsx";
import Boton from "./Boton.jsx";
import Campo from "./Campo.jsx";
import { METODOS_PAGO, BILLETES_RAPIDOS } from "../config.js";
import { formatearPrecio, aEntero } from "../utils/formato.js";

function ModalCobro(props) {
  // Estados del formulario de cobro (useState devuelve la pareja [valor, funciónParaCambiarlo])
  const [metodo, setMetodo] = useState("Efectivo");
  const [recibido, setRecibido] = useState("");
  const [clienteId, setClienteId] = useState(props.clienteIdInicial);
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  // ----- Cálculos que se rehacen en cada cambio de pantalla -----
  const total = props.total;
  const valorRecibido = aEntero(recibido); // lo que escribió, como número
  const cambio = valorRecibido - total; // positivo = hay que devolver; negativo = falta plata

  // Lo que se ve dentro del campo: el número con puntos de miles (100000 se ve como 100.000)
  let textoRecibido = "";
  if (recibido !== "") {
    textoRecibido = valorRecibido.toLocaleString("es-CO");
  }

  // Buscamos si hay algo que impide confirmar y lo escribimos en "problema"
  let problema = "";
  if (metodo === "Efectivo" && valorRecibido < total) {
    problema = "Faltan " + formatearPrecio(total - valorRecibido) + " para completar el pago.";
  }
  if (metodo === "Debe" && clienteId === "") {
    problema = "Para dejar la venta en Debe, elige un cliente.";
  }

  // ----- Acciones -----

  // Escribe en el campo "recibido" solo dígitos (borra letras, puntos, etc.)
  function cambiarRecibido(evento) {
    const numero = aEntero(evento.target.value);
    if (numero === 0) {
      setRecibido(""); // si no hay nada escrito dejamos el campo vacío (se ve el 0 gris de ejemplo)
    } else {
      setRecibido(String(numero));
    }
  }

  // Los botones rápidos ponen un valor de una vez
  function ponerRecibido(valor) {
    setRecibido(String(valor));
  }

  // Confirma el cobro: valida, arma el "pago" y se lo pasa a quien abrió el modal
  async function confirmar() {
    if (trabajando) {
      return; // evita toques repetidos mientras ya se está cobrando
    }
    if (problema !== "") {
      setError(problema);
      return;
    }

    // Armamos el pago según el método elegido. El cambio lo calcula el backend.
    const pago = { metodoPago: metodo, clienteId: clienteId, valorRecibido: 0 };
    if (metodo === "Efectivo") {
      pago.valorRecibido = valorRecibido;
    }

    setError("");
    setTrabajando(true);

    try {
      // Una sola petición: el backend cierra la venta y descuenta el inventario en una transacción
      await props.alConfirmar(pago);
    } catch (falla) {
      // Si algo salió mal (por ejemplo, otro cajero vendió las últimas unidades),
      // mostramos el motivo y dejamos reintentar
      setError(falla.message);
      setTrabajando(false);
    }
  }

  // ----- Pantalla -----

  // Panel del cambio: cambia según lo que haya escrito
  let panelCambio = null;
  if (metodo === "Efectivo") {
    if (valorRecibido === 0) {
      panelCambio = <p className="cambio-pista">Escribe cuánto te entrega el cliente.</p>;
    } else if (valorRecibido < total) {
      panelCambio = (
        <div className="cambio cambio-falta">
          <p className="cambio-titulo">Todavía falta</p>
          <p className="cambio-valor">{formatearPrecio(total - valorRecibido)}</p>
        </div>
      );
    } else if (cambio === 0) {
      panelCambio = (
        <div className="cambio cambio-exacto">
          <p className="cambio-titulo">Pago exacto</p>
          <p className="cambio-valor">No hay cambio</p>
        </div>
      );
    } else {
      panelCambio = (
        <div className="cambio cambio-devolver">
          <p className="cambio-titulo">Devuelve al cliente</p>
          <p className="cambio-valor">{formatearPrecio(cambio)}</p>
        </div>
      );
    }
  }

  // Texto que explica el método de pago elegido
  let notaMetodo = "";
  if (metodo === "Nequi") {
    notaMetodo = "Confirma que el pago llegó a Nequi antes de cobrar.";
  }
  if (metodo === "Debe") {
    notaMetodo = "La venta se cierra y el saldo queda anotado a nombre del cliente.";
  }

  let etiquetaCliente = "Cliente (opcional)";
  if (metodo === "Debe") {
    etiquetaCliente = "Cliente (obligatorio para Debe)";
  }

  return (
    <Modal titulo="Cobrar la venta" alCerrar={props.alCerrar} bloqueado={trabajando}>
      {/* Total a cobrar */}
      <div className="cobro-total">
        <span>Total a cobrar</span>
        <strong>{formatearPrecio(total)}</strong>
      </div>
      {props.descuento > 0 && (
        <p className="cobro-nota">
          Incluye el descuento "{props.nombreDescuento}": − {formatearPrecio(props.descuento)}.
        </p>
      )}

      {/* Método de pago: tres botones grandes, uno ya elegido */}
      <div className="selector-metodo" role="radiogroup" aria-label="Método de pago">
        {METODOS_PAGO.map(function (nombre) {
          let clase = "metodo-opcion";
          if (metodo === nombre) {
            clase = "metodo-opcion metodo-opcion-activa";
          }
          return (
            <button
              type="button"
              key={nombre}
              role="radio"
              aria-checked={metodo === nombre}
              className={clase}
              disabled={trabajando}
              onClick={function () {
                setMetodo(nombre);
                setError("");
              }}
            >
              {nombre}
            </button>
          );
        })}
      </div>

      {/* Solo en efectivo: lo recibido, billetes rápidos y el cambio */}
      {metodo === "Efectivo" && (
        <div className="cobro-efectivo">
          <Campo etiqueta="Valor recibido">
            <input
              className="entrada entrada-grande"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={textoRecibido}
              onChange={cambiarRecibido}
              disabled={trabajando}
            />
          </Campo>

          <div className="billetes">
            <button type="button" className="billete" disabled={trabajando} onClick={function () { ponerRecibido(total); }}>
              Exacto
            </button>
            {BILLETES_RAPIDOS.map(function (billete) {
              // Un billete menor al total no alcanza, así que se deshabilita
              return (
                <button
                  type="button"
                  key={billete}
                  className="billete"
                  disabled={trabajando || billete < total}
                  onClick={function () {
                    ponerRecibido(billete);
                  }}
                >
                  {formatearPrecio(billete)}
                </button>
              );
            })}
          </div>

          {panelCambio}
        </div>
      )}

      {notaMetodo !== "" && <p className="cobro-nota">{notaMetodo}</p>}

      {/* Cliente: opcional, salvo en Debe */}
      <Campo etiqueta={etiquetaCliente}>
        <select
          className="entrada"
          value={clienteId}
          disabled={trabajando}
          onChange={function (evento) {
            setClienteId(evento.target.value);
            setError("");
          }}
        >
          <option value="">Sin cliente (mostrador)</option>
          {props.clientes.map(function (cliente) {
            return (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            );
          })}
        </select>
      </Campo>
      {props.clientes.length === 0 && (
        <p className="cobro-nota">
          Aún no tienes clientes.{" "}
          <button type="button" className="enlace" onClick={props.alIrAClientes}>
            Crear un cliente
          </button>
        </p>
      )}

      {/* Mensajes: lo que falta y el error que haya devuelto el backend */}
      {problema !== "" && error === "" && !trabajando && <p className="mensaje-ayuda">{problema}</p>}
      {error !== "" && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      {trabajando && <p className="mensaje-progreso">Registrando la venta y actualizando el inventario…</p>}

      <div className="acciones-fila">
        <Boton variante="suave" alHacerClic={props.alCerrar} deshabilitado={trabajando}>
          Volver
        </Boton>
        <Boton variante="principal" alHacerClic={confirmar} cargando={trabajando} textoCargando="Cobrando…" deshabilitado={problema !== ""}>
          Confirmar cobro
        </Boton>
      </div>
    </Modal>
  );
}

export default ModalCobro;
