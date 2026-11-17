// ---------------------------------------------------------------------------
// CorreccionVenta.jsx: formulario para corregir una venta CERRADA (solo administrador).
// Permite cambiar productos, cantidades, cliente, método de pago y descuento.
// Los totales se recalculan solos en cada cambio. Al guardar, el backend:
//   - conserva el mismo id de la venta y la marca como corregida (quién y cuándo),
//   - ajusta el inventario según la DIFERENCIA entre la venta original y la corregida,
//   - rechaza la corrección si algún producto quedaría con stock negativo.
// Props: venta, productos, clientes, descuentos, alCorregida(resultado), alCancelar.
// ---------------------------------------------------------------------------
import { useState } from "react";
import Boton from "./Boton.jsx";
import Campo from "./Campo.jsx";
import Icono from "./Icono.jsx";
import { corregirVenta } from "../servicios/ventas.js";
import { METODOS_PAGO } from "../config.js";
import { sonIguales } from "../utils/ids.js";
import { buscarPorId, calcularTotales, describirDescuento } from "../utils/calculos.js";
import { formatearPrecio, aEntero, codigoCorto } from "../utils/formato.js";

function CorreccionVenta(props) {
  const venta = props.venta;

  // Líneas de la venta que se están editando. Empiezan como una copia de las originales.
  // "original" guarda cuántas unidades tenía la venta antes de corregir (0 si el producto es nuevo).
  const [lineas, setLineas] = useState(function () {
    return venta.items.map(function (item) {
      return {
        detalleId: item.detalleId,
        productoId: item.productoId,
        nombre: item.nombre,
        precio: item.precio,
        cantidad: item.cantidad,
        original: item.cantidad
      };
    });
  });

  // Valor recibido inicial: solo aplica si la venta se pagó en efectivo
  let recibidoInicial = "";
  if (venta.metodoPago === "Efectivo") {
    recibidoInicial = String(venta.valorRecibido);
  }

  // Descuento inicial: "actual" significa "dejar el descuento que ya tenía la venta"
  let descuentoInicial = "";
  if (venta.descuentoNombre !== "") {
    descuentoInicial = "actual";
  }

  const [clienteId, setClienteId] = useState(venta.clienteId);
  const [metodo, setMetodo] = useState(venta.metodoPago);
  const [recibido, setRecibido] = useState(recibidoInicial);
  const [descuentoElegido, setDescuentoElegido] = useState(descuentoInicial); // "", "actual" o el id de un descuento
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // ----- Cálculos que se rehacen en cada cambio -----

  // Descuento con el que se calcula el total
  let descuento = null;
  if (descuentoElegido === "actual") {
    descuento = { tipo: venta.descuentoTipo, valor: venta.descuentoValor };
  } else if (descuentoElegido !== "") {
    descuento = buscarPorId(props.descuentos, descuentoElegido);
  }

  // Subtotal de cada línea y totales de la venta corregida
  const lineasConSubtotal = lineas.map(function (linea) {
    return { subtotal: linea.precio * linea.cantidad };
  });
  const totales = calcularTotales(lineasConSubtotal, descuento);
  const valorRecibido = aEntero(recibido);

  // Cuántas unidades como máximo puede llevar una línea:
  // lo que hay en stock MÁS lo que esta misma venta ya tenía (porque esas unidades ya se descontaron)
  function maximoDeLinea(linea) {
    const producto = buscarPorId(props.productos, linea.productoId);
    if (!producto) {
      return linea.original; // el producto ya no existe: no se puede aumentar
    }
    if (!producto.seguimientoInventario) {
      return 99999; // sin control de inventario no hay límite
    }
    return producto.stock + linea.original;
  }

  // Buscamos si hay algo que impide guardar y lo escribimos en "problema"
  let problema = "";
  if (lineas.length === 0) {
    problema = "La venta debe tener al menos un producto.";
  }
  lineas.forEach(function (linea) {
    if (linea.cantidad < 1) {
      problema = "Revisa las cantidades: \"" + linea.nombre + "\" está en 0.";
    }
  });
  if (totales.descuentoExcede) {
    problema = "El descuento es mayor que el total de la venta. Elige otro o quítalo.";
  }
  if (problema === "" && metodo === "Efectivo" && valorRecibido < totales.total) {
    problema = "El valor recibido no alcanza: faltan " + formatearPrecio(totales.total - valorRecibido) + ".";
  }
  if (problema === "" && metodo === "Debe" && clienteId === "") {
    problema = "Para dejar la venta en Debe, elige un cliente.";
  }

  // ----- Manejo de las líneas -----

  // Cambia la cantidad de una línea (sin pasar del máximo permitido por el stock)
  function fijarCantidad(lineaCambiada, cantidad) {
    const maximo = maximoDeLinea(lineaCambiada);
    let cantidadFinal = cantidad;
    if (cantidad > maximo) {
      cantidadFinal = maximo;
      setError("De \"" + lineaCambiada.nombre + "\" solo se pueden poner hasta " + maximo + " (por el stock disponible).");
    } else {
      setError("");
    }

    const nuevas = lineas.map(function (linea) {
      if (linea === lineaCambiada) {
        return Object.assign({}, linea, { cantidad: cantidadFinal });
      }
      return linea;
    });
    setLineas(nuevas);
  }

  // Quita una línea de la venta (sus unidades volverán al inventario al guardar)
  function quitarLinea(lineaQuitada) {
    const nuevas = lineas.filter(function (linea) {
      return linea !== lineaQuitada;
    });
    setLineas(nuevas);
    setError("");
  }

  // Agrega un producto del catálogo (si ya está en la venta, le suma 1)
  function agregarProducto(producto) {
    setBusqueda("");
    const yaEsta = lineas.find(function (linea) {
      return sonIguales(linea.productoId, producto.id);
    });
    if (yaEsta) {
      fijarCantidad(yaEsta, yaEsta.cantidad + 1);
      return;
    }
    if (producto.seguimientoInventario && producto.stock < 1) {
      setError("No queda stock de \"" + producto.nombre + "\".");
      return;
    }
    // Producto nuevo en la venta: entra con el precio actual del catálogo
    setLineas(lineas.concat([{ detalleId: null, productoId: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 1, original: 0 }]));
    setError("");
  }

  // Productos que coinciden con el buscador (máximo 6)
  const textoBusqueda = busqueda.trim().toLowerCase();
  let resultados = [];
  if (textoBusqueda !== "") {
    resultados = props.productos
      .filter(function (producto) {
        return producto.nombre.toLowerCase().includes(textoBusqueda) || producto.codigo.toLowerCase().includes(textoBusqueda);
      })
      .slice(0, 6);
  }

  // ----- Guardar la corrección -----
  async function guardar(evento) {
    evento.preventDefault();
    if (guardando) {
      return; // evita envíos duplicados
    }
    if (problema !== "") {
      setError(problema);
      return;
    }

    // Armamos lo que se envía al backend
    const correccion = {
      items: lineas.map(function (linea) {
        return { detalleId: linea.detalleId, productoId: linea.productoId, cantidad: linea.cantidad };
      }),
      clienteId: clienteId,
      metodoPago: metodo,
      valorRecibido: valorRecibido,
      descuentoId: "",
      conservarDescuento: false
    };
    if (descuentoElegido === "actual") {
      correccion.conservarDescuento = true; // dejar el descuento que ya tenía
    } else {
      correccion.descuentoId = descuentoElegido;
    }

    setError("");
    setGuardando(true);
    try {
      const resultado = await corregirVenta(venta.id, correccion);
      props.alCorregida(resultado);
    } catch (falla) {
      // Por ejemplo: "No se puede corregir la venta: no hay stock suficiente de ..."
      setError(falla.message);
      setGuardando(false);
    }
  }

  let etiquetaCliente = "Cliente (opcional)";
  if (metodo === "Debe") {
    etiquetaCliente = "Cliente (obligatorio para Debe)";
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      <p className="campo-ayuda">
        Estás corrigiendo la venta {codigoCorto(venta.id)}. Conserva su número y quedará marcada como corregida. El inventario se ajusta solo con la diferencia.
      </p>

      {/* SECCIÓN 1: productos y cantidades */}
      <fieldset className="grupo" disabled={guardando}>
        <legend>Productos de la venta</legend>

        {lineas.length === 0 && <p className="campo-ayuda">La venta quedó sin productos. Agrega al menos uno.</p>}
        {lineas.length > 0 && (
          <ul className="lineas-compra">
            {lineas.map(function (linea, posicion) {
              // Nota que explica qué cambió en esta línea
              let nota = "";
              if (linea.original === 0) {
                nota = "Producto agregado en la corrección.";
              } else if (linea.cantidad !== linea.original) {
                nota = "Antes: " + linea.original + ".";
              }

              // Valor del campo: si está en 0 se muestra vacío (mientras la persona escribe)
              let valorCantidad = String(linea.cantidad);
              if (linea.cantidad === 0) {
                valorCantidad = "";
              }

              return (
                <li className="linea-compra" key={posicion}>
                  <div className="linea-compra-nombre">
                    <p>{linea.nombre}</p>
                    <p className="campo-ayuda">
                      {formatearPrecio(linea.precio)} c/u. {nota}
                    </p>
                  </div>

                  <div className="reembolso-controles">
                    <div className="cantidad">
                      <button
                        type="button"
                        className="cantidad-boton"
                        aria-label={"Quitar una unidad de " + linea.nombre}
                        disabled={linea.cantidad <= 1}
                        onClick={function () {
                          fijarCantidad(linea, linea.cantidad - 1);
                        }}
                      >
                        <Icono nombre="resta" />
                      </button>
                      <input
                        className="cantidad-numero"
                        type="text"
                        inputMode="numeric"
                        aria-label={"Cantidad de " + linea.nombre}
                        value={valorCantidad}
                        onChange={function (evento) {
                          fijarCantidad(linea, aEntero(evento.target.value));
                        }}
                      />
                      <button
                        type="button"
                        className="cantidad-boton"
                        aria-label={"Agregar una unidad de " + linea.nombre}
                        onClick={function () {
                          fijarCantidad(linea, linea.cantidad + 1);
                        }}
                      >
                        <Icono nombre="suma" />
                      </button>
                    </div>
                  </div>

                  <div className="linea-compra-pie">
                    <span className="linea-compra-subtotal">{formatearPrecio(linea.precio * linea.cantidad)}</span>
                    <button
                      type="button"
                      className="boton-icono boton-icono-peligro"
                      aria-label={"Quitar " + linea.nombre + " de la venta"}
                      onClick={function () {
                        quitarLinea(linea);
                      }}
                    >
                      <Icono nombre="papelera" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Campo etiqueta="Agregar otro producto">
          <input
            className="entrada"
            type="search"
            value={busqueda}
            placeholder="Escribe el nombre o el código"
            onChange={function (evento) {
              setBusqueda(evento.target.value);
            }}
          />
        </Campo>
        {resultados.length > 0 && (
          <ul className="resultados-busqueda">
            {resultados.map(function (producto) {
              return (
                <li key={producto.id}>
                  <button
                    type="button"
                    className="resultado"
                    onClick={function () {
                      agregarProducto(producto);
                    }}
                  >
                    <span>{producto.nombre}</span>
                    <span className="resultado-detalle">{formatearPrecio(producto.precio)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {textoBusqueda !== "" && resultados.length === 0 && <p className="campo-ayuda">No encontramos productos con ese nombre.</p>}
      </fieldset>

      {/* SECCIÓN 2: descuento y cliente */}
      <fieldset className="grupo" disabled={guardando}>
        <legend>Descuento y cliente</legend>
        <Campo etiqueta="Descuento (solo uno por venta)">
          <select
            className="entrada"
            value={descuentoElegido}
            onChange={function (evento) {
              setDescuentoElegido(evento.target.value);
              setError("");
            }}
          >
            <option value="">Sin descuento</option>
            {venta.descuentoNombre !== "" && (
              <option value="actual">
                {venta.descuentoNombre} ({describirDescuento(venta.descuentoTipo, venta.descuentoValor)}), el que ya tenía
              </option>
            )}
            {props.descuentos.map(function (opcion) {
              // El descuento que ya tiene la venta aparece arriba como "el que ya tenía": no lo repetimos
              if (venta.descuentoNombre !== "" && sonIguales(opcion.id, venta.descuentoId)) {
                return null;
              }
              return (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.nombre} ({describirDescuento(opcion.tipo, opcion.valor)})
                </option>
              );
            })}
          </select>
        </Campo>
        <Campo etiqueta={etiquetaCliente}>
          <select
            className="entrada"
            value={clienteId}
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
      </fieldset>

      {/* SECCIÓN 3: método de pago */}
      <fieldset className="grupo" disabled={guardando}>
        <legend>Método de pago</legend>
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
        {metodo === "Efectivo" && (
          <Campo etiqueta="Valor recibido" ayuda="Si el total cambió, ajusta lo que entregó el cliente para calcular el cambio.">
            <input
              className="entrada"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={recibido}
              onChange={function (evento) {
                const numero = aEntero(evento.target.value);
                if (numero === 0) {
                  setRecibido("");
                } else {
                  setRecibido(String(numero));
                }
                setError("");
              }}
            />
          </Campo>
        )}
      </fieldset>

      {/* Totales recalculados automáticamente */}
      <div className="recibo-totales">
        <p>
          <span>Subtotal</span>
          <span>{formatearPrecio(totales.subtotal)}</span>
        </p>
        <p>
          <span>IVA</span>
          <span>{formatearPrecio(totales.iva)}</span>
        </p>
        {totales.descuento > 0 && (
          <p className="recibo-descuento">
            <span>Descuento</span>
            <span>− {formatearPrecio(totales.descuento)}</span>
          </p>
        )}
        <p className="recibo-total">
          <span>Total corregido</span>
          <span>{formatearPrecio(totales.total)}</span>
        </p>
        <p>
          <span>Total anterior</span>
          <span>{formatearPrecio(venta.total)}</span>
        </p>
        {metodo === "Efectivo" && valorRecibido >= totales.total && (
          <p>
            <span>Cambio</span>
            <span>{formatearPrecio(valorRecibido - totales.total)}</span>
          </p>
        )}
      </div>

      {problema !== "" && error === "" && <p className="mensaje-ayuda">{problema}</p>}
      {error !== "" && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      <div className="acciones-fila">
        <Boton variante="suave" alHacerClic={props.alCancelar} deshabilitado={guardando}>
          Cancelar
        </Boton>
        <Boton tipo="submit" variante="principal" cargando={guardando} textoCargando="Guardando…" deshabilitado={problema !== ""}>
          Guardar corrección
        </Boton>
      </div>
    </form>
  );
}

export default CorreccionVenta;
