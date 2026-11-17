// ---------------------------------------------------------------------------
// Reportes.jsx: reportes básicos (solo administrador). Cuatro pestañas:
//   "ventas"    -> ventas totales por rango de fechas (con desglose por método de pago y por día)
//   "productos" -> productos más vendidos en el rango
//   "compras"   -> compras registradas en el rango
//   "faltantes" -> faltantes frecuentes y lo pendiente por pedir a cada proveedor
// El rango mínimo es de 1 día (desde = hasta). Los cálculos los hace el backend;
// esta pantalla solo pide el reporte y lo dibuja.
// ---------------------------------------------------------------------------
import { useState, useEffect } from "react";
import Boton from "../components/Boton.jsx";
import Icono from "../components/Icono.jsx";
import EstadoVacio from "../components/EstadoVacio.jsx";
import EsqueletoLista from "../components/EsqueletoLista.jsx";
import { leerReportePorFechas, leerReporteFaltantes, leerFaltantesPorProveedor } from "../servicios/reportes.js";
import { formatearPrecio, formatearFecha, formatearDia, textoCantidad, fechaDeHoyParaInput, fechaHaceDiasParaInput } from "../utils/formato.js";

// Las pestañas: id = nombre interno, etiqueta = lo que se lee
const PESTANAS = [
  { id: "ventas", etiqueta: "Ventas" },
  { id: "productos", etiqueta: "Más vendidos" },
  { id: "compras", etiqueta: "Compras" },
  { id: "faltantes", etiqueta: "Faltantes" }
];

function Reportes() {
  // Estados de esta pantalla (cada useState devuelve [valor, funciónParaCambiarlo])
  const [pestana, setPestana] = useState("ventas");
  const [desde, setDesde] = useState(fechaDeHoyParaInput()); // empieza mostrando el día de hoy
  const [hasta, setHasta] = useState(fechaDeHoyParaInput());
  // resultado guarda de qué pestaña son los datos, para no dibujar los de otra pestaña por error
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0); // sube al tocar "Actualizar"

  // ¿El rango de fechas está bien? ("hasta" no puede ser anterior a "desde")
  const rangoValido = desde !== "" && hasta !== "" && desde <= hasta;

  // Se ejecuta al abrir la pantalla y cada vez que cambia la pestaña, una fecha o la versión
  useEffect(
    function () {
      // Pide al backend el reporte de la pestaña elegida
      async function leerReporte() {
        try {
          let datos;
          if (pestana === "ventas") {
            datos = await leerReportePorFechas("ventas", desde, hasta);
          } else if (pestana === "productos") {
            datos = await leerReportePorFechas("productos-vendidos", desde, hasta);
          } else if (pestana === "compras") {
            datos = await leerReportePorFechas("compras", desde, hasta);
          } else {
            // Faltantes: dos consultas a la vez (frecuentes y pendientes por proveedor)
            const respuestas = await Promise.all([leerReporteFaltantes(), leerFaltantesPorProveedor()]);
            datos = { frecuentes: respuestas[0], porProveedor: respuestas[1] };
          }
          setResultado({ pestana: pestana, datos: datos });
          setError("");
        } catch (falla) {
          setError(falla.message);
        } finally {
          setCargando(false);
        }
      }

      // Los reportes por fechas solo se piden si el rango es válido
      if (pestana !== "faltantes" && !rangoValido) {
        return;
      }
      leerReporte();
    },
    [pestana, desde, hasta, version, rangoValido]
  );

  // Cambia de pestaña mostrando el estado de carga
  function cambiarPestana(nueva) {
    if (nueva !== pestana) {
      setCargando(true);
      setPestana(nueva);
    }
  }

  // Botones rápidos: ponen el rango de una vez (hoy, últimos 7 días, últimos 30 días)
  function ponerRango(diasAtras) {
    setCargando(true);
    setDesde(fechaHaceDiasParaInput(diasAtras));
    setHasta(fechaDeHoyParaInput());
    setVersion(version + 1); // así el reporte se vuelve a pedir aunque las fechas ya fueran esas
  }

  // Botón "Actualizar": vuelve a pedir el mismo reporte
  function actualizar() {
    setCargando(true);
    setVersion(version + 1);
  }

  // ----- Dibujo de cada reporte -----

  // Reporte de ventas: tarjetas con los totales y dos tablas
  function dibujarVentas(datos) {
    if (datos.cantidadVentas === 0) {
      return <EstadoVacio icono="recibo" titulo="No hubo ventas en esas fechas" texto="Prueba con otro rango de fechas." />;
    }
    return (
      <div className="reporte">
        <div className="tarjetas">
          <div className="tarjeta tarjeta-principal">
            <p className="tarjeta-titulo">Total vendido</p>
            <p className="tarjeta-valor">{formatearPrecio(datos.totalVendido)}</p>
            <p className="tarjeta-nota">{textoCantidad(datos.cantidadVentas, "venta cerrada", "ventas cerradas")}</p>
          </div>
          <div className="tarjeta">
            <p className="tarjeta-titulo">Reembolsado</p>
            <p className="tarjeta-valor">{formatearPrecio(datos.totalReembolsado)}</p>
            <p className="tarjeta-nota">Devuelto a clientes</p>
          </div>
          <div className="tarjeta">
            <p className="tarjeta-titulo">Venta neta</p>
            <p className="tarjeta-valor">{formatearPrecio(datos.totalNeto)}</p>
            <p className="tarjeta-nota">Vendido menos reembolsado</p>
          </div>
          <div className="tarjeta">
            <p className="tarjeta-titulo">Descuentos</p>
            <p className="tarjeta-valor">{formatearPrecio(datos.totalDescuentos)}</p>
            <p className="tarjeta-nota">Otorgados en las ventas</p>
          </div>
        </div>

        <h3 className="pagina-subtitulo">Por método de pago</h3>
        <div className="tabla-caja">
          <table className="tabla">
            <thead>
              <tr>
                <th>Método</th>
                <th className="tabla-numero">Ventas</th>
                <th className="tabla-numero">Total</th>
              </tr>
            </thead>
            <tbody>
              {datos.porMetodoPago.map(function (fila) {
                return (
                  <tr key={fila.metodoPago}>
                    <td>{fila.metodoPago}</td>
                    <td className="tabla-numero">{fila.cantidad}</td>
                    <td className="tabla-numero">{formatearPrecio(fila.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="pagina-subtitulo">Por día</h3>
        <div className="tabla-caja">
          <table className="tabla">
            <thead>
              <tr>
                <th>Día</th>
                <th className="tabla-numero">Ventas</th>
                <th className="tabla-numero">Total</th>
              </tr>
            </thead>
            <tbody>
              {datos.porDia.map(function (fila) {
                return (
                  <tr key={fila.dia}>
                    <td>{formatearDia(fila.dia)}</td>
                    <td className="tabla-numero">{fila.cantidad}</td>
                    <td className="tabla-numero">{formatearPrecio(fila.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Reporte de productos más vendidos: lista ordenada con una barra proporcional
  function dibujarProductos(datos) {
    if (datos.length === 0) {
      return <EstadoVacio icono="caja" titulo="No se vendieron productos en esas fechas" texto="Prueba con otro rango de fechas." />;
    }

    // El primero de la lista es el más vendido: su barra ocupa el 100 % y las demás se comparan con él
    let maximo = datos[0].unidadesNetas;
    if (maximo < 1) {
      maximo = 1;
    }

    return (
      <div className="reporte">
        <ol className="ranking">
          {datos.map(function (fila, posicion) {
            // Ancho de la barra en porcentaje (nunca menor que 0)
            let ancho = Math.round((fila.unidadesNetas * 100) / maximo);
            if (ancho < 0) {
              ancho = 0;
            }
            return (
              <li className="ranking-fila" key={posicion}>
                <div className="ranking-textos">
                  <span className="ranking-nombre">
                    {posicion + 1}. {fila.nombre}
                  </span>
                  <span className="ranking-valor">{textoCantidad(fila.unidadesNetas, "unidad", "unidades")}</span>
                </div>
                <div className="ranking-barra">
                  <div className="ranking-relleno" style={{ width: ancho + "%" }}></div>
                </div>
                <p className="gestion-detalle">
                  Vendió {formatearPrecio(fila.ingresos)} sin IVA.
                  {fila.reembolsadas > 0 && " Se reembolsaron " + textoCantidad(fila.reembolsadas, "unidad", "unidades") + "."}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  // Reporte de compras: tarjetas, desglose por proveedor y lista de compras
  function dibujarCompras(datos) {
    if (datos.cantidadCompras === 0) {
      return <EstadoVacio icono="camion" titulo="No hubo compras en esas fechas" texto="Prueba con otro rango de fechas." />;
    }
    return (
      <div className="reporte">
        <div className="tarjetas">
          <div className="tarjeta tarjeta-principal">
            <p className="tarjeta-titulo">Total comprado</p>
            <p className="tarjeta-valor">{formatearPrecio(datos.totalComprado)}</p>
            <p className="tarjeta-nota">{textoCantidad(datos.cantidadCompras, "compra registrada", "compras registradas")}</p>
          </div>
        </div>

        <h3 className="pagina-subtitulo">Por proveedor</h3>
        <div className="tabla-caja">
          <table className="tabla">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th className="tabla-numero">Compras</th>
                <th className="tabla-numero">Total</th>
              </tr>
            </thead>
            <tbody>
              {datos.porProveedor.map(function (fila) {
                return (
                  <tr key={fila.proveedor}>
                    <td>{fila.proveedor}</td>
                    <td className="tabla-numero">{fila.cantidad}</td>
                    <td className="tabla-numero">{formatearPrecio(fila.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="pagina-subtitulo">Compras del periodo</h3>
        <div className="tabla-caja">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th className="tabla-numero">Productos</th>
                <th className="tabla-numero">Total</th>
              </tr>
            </thead>
            <tbody>
              {datos.compras.map(function (fila) {
                return (
                  <tr key={fila.id}>
                    <td>{formatearFecha(fila.fecha)}</td>
                    <td>{fila.proveedor}</td>
                    <td className="tabla-numero">{fila.productos}</td>
                    <td className="tabla-numero">{formatearPrecio(fila.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Reporte de faltantes: los más pedidos y lo pendiente agrupado por proveedor
  function dibujarFaltantes(datos) {
    if (datos.frecuentes.length === 0) {
      return <EstadoVacio icono="lista" titulo="Aún no se han registrado faltantes" texto="Cuando el equipo anote productos que pidieron y no había, aquí verás cuáles se piden más." />;
    }
    return (
      <div className="reporte">
        <h3 className="pagina-subtitulo">Faltantes más pedidos</h3>
        <p className="campo-ayuda">Los nombres parecidos se cuentan juntos (por ejemplo, "cofia" y "cofias").</p>
        <div className="tabla-caja">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="tabla-numero">Veces</th>
                <th className="tabla-numero">Unidades</th>
                <th>Última vez</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {datos.frecuentes.map(function (fila, posicion) {
                let claseEstado = "etiqueta etiqueta-ok";
                let textoEstado = "Resuelto";
                if (fila.estado === "pendiente") {
                  claseEstado = "etiqueta etiqueta-poco";
                  textoEstado = "Pendiente";
                }
                return (
                  <tr key={posicion}>
                    <td>{fila.producto}</td>
                    <td className="tabla-numero">{fila.solicitudes}</td>
                    <td className="tabla-numero">{fila.unidades}</td>
                    <td>{formatearFecha(fila.ultimaFecha)}</td>
                    <td>
                      <span className={claseEstado}>{textoEstado}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="pagina-subtitulo">Para la próxima compra</h3>
        <p className="campo-ayuda">Faltantes pendientes, agrupados por el proveedor que los podría traer.</p>
        {datos.porProveedor.length === 0 && <p className="campo-ayuda">No hay faltantes pendientes. ¡Todo resuelto!</p>}
        {datos.porProveedor.map(function (grupo) {
          return (
            <div className="grupo-proveedor" key={grupo.proveedorId}>
              <p className="grupo-proveedor-titulo">
                <Icono nombre="camion" />
                {grupo.proveedor}
              </p>
              <ul className="detalle-lineas">
                {grupo.productos.map(function (producto, posicion) {
                  return (
                    <li key={posicion}>
                      <span>{producto.producto}</span>
                      <span>
                        {textoCantidad(producto.unidades, "unidad", "unidades")} en {textoCantidad(producto.solicitudes, "solicitud", "solicitudes")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  // ----- Contenido según el estado: rango inválido, cargando, error o el reporte -----
  let contenido;
  if (pestana !== "faltantes" && !rangoValido) {
    contenido = (
      <p className="mensaje-error" role="alert">
        Revisa las fechas: "Hasta" no puede ser anterior a "Desde".
      </p>
    );
  } else if (cargando) {
    contenido = <EsqueletoLista filas={4} />;
  } else if (error !== "") {
    contenido = (
      <div className="estado-error" role="alert">
        <Icono nombre="alerta" />
        <p className="estado-error-titulo">No pudimos cargar el reporte</p>
        <p>{error}</p>
        <Boton variante="principal" icono="recargar" alHacerClic={actualizar}>
          Reintentar
        </Boton>
      </div>
    );
  } else if (!resultado || resultado.pestana !== pestana) {
    // Todavía no llegan los datos de esta pestaña
    contenido = <EsqueletoLista filas={4} />;
  } else if (pestana === "ventas") {
    contenido = dibujarVentas(resultado.datos);
  } else if (pestana === "productos") {
    contenido = dibujarProductos(resultado.datos);
  } else if (pestana === "compras") {
    contenido = dibujarCompras(resultado.datos);
  } else {
    contenido = dibujarFaltantes(resultado.datos);
  }

  return (
    <div className="pagina">
      {/* Pestañas: qué reporte ver */}
      <div className="pagina-barra">
        <div className="pestanas pestanas-reporte" role="tablist" aria-label="Tipo de reporte">
          {PESTANAS.map(function (opcion) {
            let clase = "pestana";
            if (pestana === opcion.id) {
              clase = "pestana pestana-activa";
            }
            return (
              <button
                type="button"
                role="tab"
                key={opcion.id}
                aria-selected={pestana === opcion.id}
                className={clase}
                onClick={function () {
                  cambiarPestana(opcion.id);
                }}
              >
                {opcion.etiqueta}
              </button>
            );
          })}
        </div>
        <button type="button" className="boton-icono" aria-label="Actualizar el reporte" disabled={cargando} onClick={actualizar}>
          <Icono nombre="recargar" />
        </button>
      </div>

      {/* Rango de fechas (los reportes de faltantes no lo usan) */}
      {pestana !== "faltantes" && (
        <div className="filtros">
          <label className="campo">
            <span className="campo-etiqueta">Desde</span>
            <input
              className="entrada"
              type="date"
              value={desde}
              max={fechaDeHoyParaInput()}
              onChange={function (evento) {
                setCargando(true);
                setDesde(evento.target.value);
              }}
            />
          </label>
          <label className="campo">
            <span className="campo-etiqueta">Hasta</span>
            <input
              className="entrada"
              type="date"
              value={hasta}
              max={fechaDeHoyParaInput()}
              onChange={function (evento) {
                setCargando(true);
                setHasta(evento.target.value);
              }}
            />
          </label>
          <div className="chips filtros-rapidos" role="group" aria-label="Rangos rápidos">
            <button type="button" className="chip" onClick={function () { ponerRango(0); }}>
              Hoy
            </button>
            <button type="button" className="chip" onClick={function () { ponerRango(6); }}>
              Últimos 7 días
            </button>
            <button type="button" className="chip" onClick={function () { ponerRango(29); }}>
              Últimos 30 días
            </button>
          </div>
        </div>
      )}

      {contenido}
    </div>
  );
}

export default Reportes;
