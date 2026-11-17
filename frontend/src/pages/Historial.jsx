// ---------------------------------------------------------------------------
// Historial.jsx: lista de ventas que vienen del backend.
//   - Dos pestañas para separar la información: "Abiertas" (guardadas para después)
//     y "Cerradas" (ya cobradas).
//   - Al tocar una venta se ve su detalle.
//   - Las cerradas tienen factura (imprimir / PDF); las abiertas se pueden retomar.
//   - Entrega final: el ADMINISTRADOR puede corregir una venta cerrada y reembolsar
//     productos. La lista y el detalle muestran si una venta fue corregida o tiene reembolsos.
// Props: esAdmin, productos, clientes, descuentos, ventaActual, setVentaActual,
//        ventaPorCorregir, limpiarVentaPorCorregir, actualizarProductos, refrescarDatos,
//        irA, mostrarAviso, pedirConfirmacion.
// ---------------------------------------------------------------------------
import { useState, useEffect } from "react";
import Boton from "../components/Boton.jsx";
import Modal from "../components/Modal.jsx";
import Factura from "../components/Factura.jsx";
import EstadoVacio from "../components/EstadoVacio.jsx";
import EsqueletoLista from "../components/EsqueletoLista.jsx";
import Icono from "../components/Icono.jsx";
import CorreccionVenta from "../components/CorreccionVenta.jsx";
import ModalReembolso from "../components/ModalReembolso.jsx";
import { leerRecurso } from "../api/datos.js";
import { INTERVALO_ACTUALIZACION } from "../config.js";
import { ventaParaPantalla } from "../servicios/ventas.js";
import { formatearPrecio, formatearFecha, codigoCorto, textoCantidad } from "../utils/formato.js";
import { sonIguales } from "../utils/ids.js";
import { buscarPorId, nombreDe, reemplazarEnLista, describirDescuento } from "../utils/calculos.js";

function Historial(props) {
  // Estados de esta pantalla (cada useState devuelve [valor, funciónParaCambiarlo])
  const [ventas, setVentas] = useState([]); // todas las ventas leídas del backend
  const [cargando, setCargando] = useState(true); // ¿estamos esperando al backend?
  const [error, setError] = useState(""); // mensaje si falló la lectura
  const [pestana, setPestana] = useState("cerrada"); // "cerrada" o "abierta"
  // Venta que se está viendo en detalle. Si llegamos desde "Corregir" (justo después de cobrar),
  // empezamos con esa venta ya abierta.
  const [seleccionada, setSeleccionada] = useState(props.ventaPorCorregir);
  const [verFactura, setVerFactura] = useState(false); // ¿está abierta la factura?
  const [corrigiendo, setCorrigiendo] = useState(props.ventaPorCorregir !== null); // ¿está abierto el formulario de corrección?
  const [reembolsando, setReembolsando] = useState(false); // ¿está abierta la ventana de reembolso?
  const [correccionLista, setCorreccionLista] = useState(false); // ¿mostrar la confirmación de "venta corregida"?

  // Al abrir la pantalla ya usamos la venta que venía para corregir: la "soltamos" en App.jsx
  // para que no vuelva a abrirse sola la próxima vez. (Lista vacía = se ejecuta una sola vez.)
  const limpiarVentaPorCorregir = props.limpiarVentaPorCorregir;
  useEffect(
    function () {
      limpiarVentaPorCorregir();
    },
    [limpiarVentaPorCorregir]
  );

  // "version" cuenta las veces que pedimos leer el backend: cada vez que sube, el efecto de abajo
  // vuelve a ejecutarse y lee de nuevo. Así "Actualizar" y "Reintentar" solo tienen que subirla.
  const [version, setVersion] = useState(0);

  // useEffect se ejecuta cuando aparece la pantalla y cada vez que cambia "version"
  useEffect(
    function () {
      // Lee las ventas del backend (GET /ventas); al terminar, apaga el estado de carga
      async function leerVentas() {
        try {
          const lista = await leerRecurso("ventas");
          setVentas(lista);
        } catch (falla) {
          setError(falla.message);
        } finally {
          setCargando(false);
        }
      }
      leerVentas();
    },
    [version]
  );

  // Actualización en tiempo real: cada pocos segundos se vuelve a leer la lista en silencio.
  // Así las ventas que cobra otra caja aparecen solas, sin tocar "Actualizar".
  useEffect(function () {
    async function leerEnSilencio() {
      try {
        const lista = await leerRecurso("ventas");
        setVentas(lista);
      } catch (falla) {
        console.warn("No se pudo actualizar la lista de ventas:", falla.message);
      }
    }
    const reloj = setInterval(leerEnSilencio, INTERVALO_ACTUALIZACION);
    // Al salir de la pantalla apagamos el reloj
    return function () {
      clearInterval(reloj);
    };
  }, []);

  // Para volver a leer (botón Actualizar o Reintentar): mostramos "cargando" y subimos la versión
  function recargarVentas() {
    setCargando(true);
    setError("");
    setVersion(version + 1);
  }

  // ----- Retomar una venta abierta -----

  // Pone la venta guardada en la pantalla de Venta para seguir editándola
  function ponerEnPantalla(venta) {
    props.setVentaActual(ventaParaPantalla(venta));
    props.irA("venta");
    props.mostrarAviso("Venta retomada: puedes seguir editándola.", "info");
  }

  // Si ya hay otra venta con productos en pantalla, pedimos confirmación antes de reemplazarla
  function retomar(venta) {
    const hayOtraEnPantalla = props.ventaActual.items.length > 0 && !sonIguales(props.ventaActual.id, venta.id);

    if (hayOtraEnPantalla) {
      props.pedirConfirmacion({
        titulo: "¿Retomar esta venta?",
        mensaje: "Tienes otra venta en pantalla. Si continúas, se descartarán sus cambios sin guardar.",
        textoConfirmar: "Sí, retomar",
        peligro: true,
        alConfirmar: async function () {
          ponerEnPantalla(venta);
        }
      });
    } else {
      ponerEnPantalla(venta);
    }
  }

  // ----- Corrección y reembolso (solo administrador) -----

  // Reemplaza una venta en la lista y en el detalle con su versión más reciente
  function ponerVentaActualizada(ventaNueva) {
    setVentas(function (actuales) {
      return reemplazarEnLista(actuales, ventaNueva);
    });
    setSeleccionada(ventaNueva);
  }

  // Lo llama el formulario de corrección cuando el backend confirma
  function alCorregida(resultado) {
    ponerVentaActualizada(resultado.venta);
    props.actualizarProductos(resultado.productos); // el inventario cambió por la diferencia
    setCorrigiendo(false);
    setCorreccionLista(true); // muestra la confirmación con las acciones siguientes
  }

  // Lo llama la ventana de reembolso cuando el backend confirma
  function alReembolsada(resultado) {
    ponerVentaActualizada(resultado.venta);
    props.actualizarProductos(resultado.productos); // subió el stock de lo que volvió al inventario
  }

  // Texto corto del estado de reembolso de una venta ("" si no tiene)
  function textoReembolso(venta) {
    if (venta.estadoReembolso === "parcial") {
      return "Reembolso parcial";
    }
    if (venta.estadoReembolso === "total") {
      return "Reembolso total";
    }
    return "";
  }

  // ----- Preparar la lista -----

  // Separamos por estado y ordenamos de la más reciente a la más antigua (el texto ISO se ordena bien)
  function ventasDeEstado(estado) {
    return ventas
      .filter(function (venta) {
        return venta.estado === estado;
      })
      .sort(function (a, b) {
        if (a.fecha < b.fecha) {
          return 1;
        }
        if (a.fecha > b.fecha) {
          return -1;
        }
        return 0;
      });
  }

  const abiertas = ventasDeEstado("abierta");
  const cerradas = ventasDeEstado("cerrada");

  let ventasMostradas = cerradas;
  if (pestana === "abierta") {
    ventasMostradas = abiertas;
  }

  // ================= DETALLE DE UNA VENTA =================
  if (seleccionada) {
    const venta = seleccionada;
    const cliente = buscarPorId(props.clientes, venta.clienteId);

    let textoCliente = "Cliente de mostrador";
    if (cliente) {
      textoCliente = cliente.nombre;
    }

    // ----- Formulario de corrección (ocupa la pantalla en vez del detalle) -----
    if (corrigiendo) {
      return (
        <div className="pagina">
          <button
            type="button"
            className="volver-catalogo volver-visible"
            onClick={function () {
              setCorrigiendo(false);
            }}
          >
            <Icono nombre="atras" />
            Volver a la venta sin corregir
          </button>
          <div className="detalle">
            <h2 className="detalle-titulo">Corregir venta {codigoCorto(venta.id)}</h2>
            <CorreccionVenta
              venta={venta}
              productos={props.productos}
              clientes={props.clientes}
              descuentos={props.descuentos}
              alCorregida={alCorregida}
              alCancelar={function () {
                setCorrigiendo(false);
              }}
            />
          </div>
        </div>
      );
    }

    // Reglas para los botones del administrador
    const tieneReembolsos = venta.reembolsos.length > 0;
    const todoReembolsado = venta.estadoReembolso === "total";

    return (
      <div className="pagina">
        <button
          type="button"
          className="volver-catalogo volver-visible"
          onClick={function () {
            setSeleccionada(null);
          }}
        >
          <Icono nombre="atras" />
          Volver a la lista
        </button>

        <div className="detalle">
          <div className="detalle-cabecera">
            <div>
              <h2 className="detalle-titulo">Venta {codigoCorto(venta.id)}</h2>
              <p className="detalle-fecha">{formatearFecha(venta.fecha)}</p>
            </div>
            {venta.estado === "abierta" && <span className="etiqueta etiqueta-poco">Abierta</span>}
            <div className="detalle-etiquetas">
              {venta.estado === "cerrada" && <span className="etiqueta etiqueta-ok">Cerrada</span>}
              {venta.corregida && <span className="etiqueta etiqueta-poco">Corregida</span>}
              {tieneReembolsos && <span className="etiqueta etiqueta-agotado">{textoReembolso(venta)}</span>}
            </div>
          </div>

          {/* Marca de corrección: quién corrigió la venta y cuándo */}
          {venta.corregida && (
            <p className="marca-correccion">
              <Icono nombre="editar" />
              Corregida por {venta.corregidaPor} el {formatearFecha(venta.corregidaEn)}
            </p>
          )}

          <dl className="detalle-datos">
            <div>
              <dt>Cliente</dt>
              <dd>{textoCliente}</dd>
            </div>
            {venta.estado === "cerrada" && (
              <div>
                <dt>Método de pago</dt>
                <dd>{venta.metodoPago}</dd>
              </div>
            )}
            {venta.estado === "cerrada" && venta.metodoPago === "Efectivo" && (
              <div>
                <dt>Recibido</dt>
                <dd>{formatearPrecio(venta.valorRecibido)}</dd>
              </div>
            )}
            {venta.estado === "cerrada" && venta.metodoPago === "Efectivo" && (
              <div>
                <dt>Cambio devuelto</dt>
                <dd>{formatearPrecio(venta.cambio)}</dd>
              </div>
            )}
            {venta.usuario !== "" && (
              <div>
                <dt>Atendió</dt>
                <dd>{venta.usuario}</dd>
              </div>
            )}
          </dl>

          <ul className="detalle-lineas">
            {venta.items.map(function (linea, posicion) {
              return (
                <li key={posicion}>
                  <span>
                    {linea.cantidad} x {linea.nombre}
                    {linea.cantidadReembolsada > 0 && <span className="detalle-lineas-nota">Reembolsadas: {linea.cantidadReembolsada}</span>}
                  </span>
                  <span>{formatearPrecio(linea.precio * linea.cantidad)}</span>
                </li>
              );
            })}
          </ul>

          <div className="recibo-totales">
            <p>
              <span>Subtotal</span>
              <span>{formatearPrecio(venta.subtotal)}</span>
            </p>
            <p>
              <span>IVA</span>
              <span>{formatearPrecio(venta.iva)}</span>
            </p>
            {venta.descuentoMonto > 0 && (
              <p className="recibo-descuento">
                <span>
                  Descuento: {venta.descuentoNombre} ({describirDescuento(venta.descuentoTipo, venta.descuentoValor)})
                </span>
                <span>− {formatearPrecio(venta.descuentoMonto)}</span>
              </p>
            )}
            <p className="recibo-total">
              <span>Total</span>
              <span>{formatearPrecio(venta.total)}</span>
            </p>
            {tieneReembolsos && (
              <p className="recibo-descuento">
                <span>Total reembolsado</span>
                <span>− {formatearPrecio(venta.totalReembolsado)}</span>
              </p>
            )}
          </div>

          {/* Reembolsos de la venta: fecha, quién lo hizo y qué se devolvió */}
          {tieneReembolsos && (
            <div className="reembolsos">
              <h3 className="pagina-subtitulo">Reembolsos</h3>
              <ul className="detalle-lineas">
                {venta.reembolsos.map(function (reembolso) {
                  return (
                    <li className="reembolso-fila" key={reembolso.id}>
                      <span>
                        {formatearFecha(reembolso.fecha)}, por {reembolso.usuario}
                        {reembolso.items.map(function (linea, posicion) {
                          // Texto que dice si el producto volvió o no al inventario
                          let destino = "no volvió al inventario";
                          if (linea.retornaInventario) {
                            destino = "volvió al inventario";
                          }
                          return (
                            <span className="detalle-lineas-nota" key={posicion}>
                              {linea.cantidad} x {linea.nombre} ({destino})
                            </span>
                          );
                        })}
                      </span>
                      <span>− {formatearPrecio(reembolso.total)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="acciones-fila">
            {venta.estado === "cerrada" && (
              <Boton
                variante="principal"
                icono="recibo"
                alHacerClic={function () {
                  setVerFactura(true);
                }}
              >
                Ver factura
              </Boton>
            )}
            {/* Corregir y reembolsar: solo el administrador (el backend también lo exige) */}
            {venta.estado === "cerrada" && props.esAdmin && (
              <Boton
                variante="secundario"
                icono="editar"
                deshabilitado={tieneReembolsos}
                alHacerClic={function () {
                  props.refrescarDatos(); // traemos el stock más reciente antes de corregir
                  setCorrigiendo(true);
                }}
              >
                Corregir
              </Boton>
            )}
            {venta.estado === "cerrada" && props.esAdmin && (
              <Boton
                variante="secundario"
                icono="devolver"
                deshabilitado={todoReembolsado}
                alHacerClic={function () {
                  setReembolsando(true);
                }}
              >
                Reembolsar
              </Boton>
            )}
            {venta.estado === "abierta" && (
              <Boton
                variante="principal"
                alHacerClic={function () {
                  retomar(venta);
                }}
              >
                Retomar venta
              </Boton>
            )}
          </div>
        </div>

        {verFactura && (
          <Modal
            titulo="Factura"
            ancho="amplio"
            alCerrar={function () {
              setVerFactura(false);
            }}
          >
            <Factura venta={venta} cliente={cliente} />
          </Modal>
        )}

        {/* Notas que explican por qué un botón está apagado */}
        {venta.estado === "cerrada" && props.esAdmin && tieneReembolsos && !todoReembolsado && (
          <p className="campo-ayuda">Una venta con reembolsos ya no se puede corregir, pero sí se pueden reembolsar las unidades que quedan.</p>
        )}
        {venta.estado === "cerrada" && props.esAdmin && todoReembolsado && <p className="campo-ayuda">Esta venta ya fue reembolsada por completo.</p>}

        {reembolsando && (
          <ModalReembolso
            venta={venta}
            alReembolsada={alReembolsada}
            alCerrar={function () {
              setReembolsando(false);
            }}
          />
        )}

        {/* Confirmación después de corregir, con las acciones siguientes */}
        {correccionLista && (
          <Modal
            titulo="Venta corregida"
            alCerrar={function () {
              setCorreccionLista(false);
            }}
          >
            <div className="exito">
              <span className="exito-icono">
                <Icono nombre="check" />
              </span>
              <p className="exito-titulo">¡Listo, venta corregida!</p>
              <p className="exito-texto">
                {codigoCorto(venta.id)}: el total quedó en {formatearPrecio(venta.total)} y el inventario ya se ajustó.
              </p>
            </div>
            <div className="acciones-fila">
              <Boton
                variante="suave"
                icono="atras"
                alHacerClic={function () {
                  setCorreccionLista(false);
                  setSeleccionada(null);
                }}
              >
                Volver al historial
              </Boton>
              <Boton
                variante="suave"
                icono="recibo"
                alHacerClic={function () {
                  setCorreccionLista(false);
                  setVerFactura(true);
                }}
              >
                Ver factura
              </Boton>
              <Boton
                variante="principal"
                alHacerClic={function () {
                  props.irA("venta");
                }}
              >
                Nueva venta
              </Boton>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ================= LISTA DE VENTAS =================

  // Contenido según el estado: cargando, error, vacío o lista
  let contenido;
  if (cargando) {
    contenido = <EsqueletoLista filas={5} />;
  } else if (error !== "") {
    contenido = (
      <div className="estado-error" role="alert">
        <Icono nombre="alerta" />
        <p className="estado-error-titulo">No pudimos cargar las ventas</p>
        <p>{error}</p>
        <Boton variante="principal" icono="recargar" alHacerClic={recargarVentas}>
          Reintentar
        </Boton>
      </div>
    );
  } else if (ventasMostradas.length === 0) {
    if (pestana === "abierta") {
      contenido = <EstadoVacio icono="recibo" titulo="No hay ventas abiertas" texto="Cuando guardes una venta para después, aparecerá aquí para retomarla." />;
    } else {
      contenido = <EstadoVacio icono="recibo" titulo="Aún no hay ventas cerradas" texto="Las ventas que cobres aparecerán aquí con su factura." textoBoton="Ir a vender" alHacerClic={function () { props.irA("venta"); }} />;
    }
  } else {
    contenido = (
      <ul className="lista-ventas">
        {ventasMostradas.map(function (venta) {
          // Texto de la segunda línea: cliente y método de pago
          let detalle = nombreDe(props.clientes, venta.clienteId, "Cliente de mostrador");
          if (venta.estado === "cerrada") {
            detalle = detalle + ", " + venta.metodoPago;
          }

          return (
            <li key={venta.id}>
              <button
                type="button"
                className="venta-fila"
                onClick={function () {
                  setSeleccionada(venta);
                }}
              >
                <span className="venta-fila-textos">
                  <span className="venta-fila-titulo">{formatearFecha(venta.fecha)}</span>
                  <span className="venta-fila-detalle">{detalle}</span>
                  <span className="venta-fila-detalle">{textoCantidad(venta.items.length, "producto", "productos")}</span>
                  {/* Marcas visibles en el historial: corregida y con reembolsos */}
                  {(venta.corregida || venta.estadoReembolso !== "ninguno") && (
                    <span className="venta-fila-marcas">
                      {venta.corregida && <span className="etiqueta etiqueta-poco">Corregida</span>}
                      {venta.estadoReembolso !== "ninguno" && <span className="etiqueta etiqueta-agotado">{textoReembolso(venta)}</span>}
                    </span>
                  )}
                </span>
                <span className="venta-fila-total">{formatearPrecio(venta.total)}</span>
                <Icono nombre="siguiente" />
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  // Clases de las pestañas (la activa se resalta)
  let clasePestanaCerradas = "pestana";
  let clasePestanaAbiertas = "pestana";
  if (pestana === "cerrada") {
    clasePestanaCerradas = "pestana pestana-activa";
  } else {
    clasePestanaAbiertas = "pestana pestana-activa";
  }

  return (
    <div className="pagina">
      <div className="pagina-barra">
        <div className="pestanas" role="tablist" aria-label="Estado de la venta">
          <button
            type="button"
            role="tab"
            aria-selected={pestana === "cerrada"}
            className={clasePestanaCerradas}
            onClick={function () {
              setPestana("cerrada");
            }}
          >
            Cerradas <span className="pestana-numero">{cerradas.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pestana === "abierta"}
            className={clasePestanaAbiertas}
            onClick={function () {
              setPestana("abierta");
            }}
          >
            Abiertas <span className="pestana-numero">{abiertas.length}</span>
          </button>
        </div>
        <button type="button" className="boton-icono" aria-label="Actualizar la lista de ventas" disabled={cargando} onClick={recargarVentas}>
          <Icono nombre="recargar" />
        </button>
      </div>

      {contenido}
    </div>
  );
}

export default Historial;
