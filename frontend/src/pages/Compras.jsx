// ---------------------------------------------------------------------------
// Compras.jsx: registrar compras a proveedores, listarlas y ver su detalle.
// Tiene tres "modos" dentro de la misma pantalla (para separar la información):
//   "lista"   -> las compras ya registradas (vienen del backend)
//   "detalle" -> una compra con sus productos
//   "nueva"   -> el formulario para registrar una compra
// Esta pantalla es solo del administrador (el backend también lo exige).
// Props: productos, actualizarProductos, proveedores, mostrarAviso, irA.
// ---------------------------------------------------------------------------
import { useState, useEffect } from "react";
import Boton from "../components/Boton.jsx";
import Icono from "../components/Icono.jsx";
import EstadoVacio from "../components/EstadoVacio.jsx";
import EsqueletoLista from "../components/EsqueletoLista.jsx";
import FormularioCompra from "../components/FormularioCompra.jsx";
import { leerRecurso } from "../api/datos.js";
import { formatearPrecio, formatearFecha, textoCantidad } from "../utils/formato.js";
import { nombreDe, reemplazarEnLista } from "../utils/calculos.js";

function Compras(props) {
  // Estados de esta pantalla (cada useState devuelve [valor, funciónParaCambiarlo])
  const [modo, setModo] = useState("lista");
  const [compras, setCompras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [seleccionada, setSeleccionada] = useState(null);

  // "version" cuenta las veces que pedimos leer el backend: cada vez que sube, el efecto de abajo
  // vuelve a ejecutarse y lee de nuevo. Así "Actualizar" y "Reintentar" solo tienen que subirla.
  const [version, setVersion] = useState(0);

  // useEffect se ejecuta cuando aparece la pantalla y cada vez que cambia "version"
  useEffect(
    function () {
      // Lee las compras del backend (GET /compras); al terminar, apaga el estado de carga
      async function leerCompras() {
        try {
          const lista = await leerRecurso("compras");
          setCompras(lista);
        } catch (falla) {
          setError(falla.message);
        } finally {
          setCargando(false);
        }
      }
      leerCompras();
    },
    [version]
  );

  // Para volver a leer (botón Actualizar o Reintentar): mostramos "cargando" y subimos la versión
  function recargarCompras() {
    setCargando(true);
    setError("");
    setVersion(version + 1);
  }

  // Cuando el formulario registra la compra (el backend ya guardó la compra, el stock y los costos)
  function alRegistrada(resultado) {
    // 1. Ponemos los productos con stock y costo actualizados en el catálogo de la aplicación
    props.actualizarProductos(resultado.productos);

    // 2. Agregamos la compra a la lista y mostramos su detalle
    setCompras(function (actuales) {
      return reemplazarEnLista(actuales, resultado.compra);
    });
    setSeleccionada(resultado.compra);
    setModo("detalle");
    props.mostrarAviso("Compra registrada. El inventario y los costos se actualizaron.", "ok");
  }

  // ================= MODO: FORMULARIO NUEVA COMPRA =================
  if (modo === "nueva") {
    return (
      <div className="pagina">
        <button
          type="button"
          className="volver-catalogo volver-visible"
          onClick={function () {
            setModo("lista");
          }}
        >
          <Icono nombre="atras" />
          Volver a las compras
        </button>
        <div className="detalle">
          <h2 className="detalle-titulo">Registrar compra</h2>
          <FormularioCompra
            productos={props.productos}
            proveedores={props.proveedores}
            alRegistrada={alRegistrada}
            alCancelar={function () {
              setModo("lista");
            }}
            alIrAProveedores={function () {
              props.irA("proveedores");
            }}
          />
        </div>
      </div>
    );
  }

  // ================= MODO: DETALLE DE UNA COMPRA =================
  if (modo === "detalle" && seleccionada) {
    const compra = seleccionada;
    return (
      <div className="pagina">
        <button
          type="button"
          className="volver-catalogo volver-visible"
          onClick={function () {
            setModo("lista");
          }}
        >
          <Icono nombre="atras" />
          Volver a las compras
        </button>
        <div className="detalle">
          <div className="detalle-cabecera">
            <div>
              <h2 className="detalle-titulo">Compra del {formatearFecha(compra.fecha)}</h2>
              <p className="detalle-fecha">{nombreDe(props.proveedores, compra.proveedorId, "Proveedor eliminado")}</p>
            </div>
          </div>

          <ul className="detalle-lineas">
            {compra.items.map(function (linea, posicion) {
              return (
                <li key={posicion}>
                  <span>
                    {linea.cantidad} x {linea.nombre}
                    <span className="detalle-lineas-nota">a {formatearPrecio(linea.costo)} c/u</span>
                  </span>
                  <span>{formatearPrecio(linea.costo * linea.cantidad)}</span>
                </li>
              );
            })}
          </ul>

          <div className="recibo-totales">
            <p className="recibo-total">
              <span>Total de la compra</span>
              <span>{formatearPrecio(compra.total)}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ================= MODO: LISTA DE COMPRAS =================

  // Ordenamos de la más reciente a la más antigua (copiamos con slice para no modificar el estado)
  const ordenadas = compras.slice().sort(function (a, b) {
    if (a.fecha < b.fecha) {
      return 1;
    }
    if (a.fecha > b.fecha) {
      return -1;
    }
    return 0;
  });

  // Contenido según el estado: cargando, error, vacío o lista
  let contenido;
  if (cargando) {
    contenido = <EsqueletoLista filas={4} />;
  } else if (error !== "") {
    contenido = (
      <div className="estado-error" role="alert">
        <Icono nombre="alerta" />
        <p className="estado-error-titulo">No pudimos cargar las compras</p>
        <p>{error}</p>
        <Boton variante="principal" icono="recargar" alHacerClic={recargarCompras}>
          Reintentar
        </Boton>
      </div>
    );
  } else if (ordenadas.length === 0) {
    contenido = (
      <EstadoVacio
        icono="camion"
        titulo="Aún no has registrado compras"
        texto="Cuando le compres mercancía a un proveedor, regístrala aquí y el inventario se actualiza solo."
        textoBoton="Registrar compra"
        alHacerClic={function () {
          setModo("nueva");
        }}
      />
    );
  } else {
    contenido = (
      <ul className="lista-ventas">
        {ordenadas.map(function (compra) {
          return (
            <li key={compra.id}>
              <button
                type="button"
                className="venta-fila"
                onClick={function () {
                  setSeleccionada(compra);
                  setModo("detalle");
                }}
              >
                <span className="venta-fila-textos">
                  <span className="venta-fila-titulo">{formatearFecha(compra.fecha)}</span>
                  <span className="venta-fila-detalle">{nombreDe(props.proveedores, compra.proveedorId, "Proveedor eliminado")}</span>
                  <span className="venta-fila-detalle">{textoCantidad(compra.items.length, "producto", "productos")}</span>
                </span>
                <span className="venta-fila-total">{formatearPrecio(compra.total)}</span>
                <Icono nombre="siguiente" />
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="pagina">
      <div className="pagina-barra">
        <h2 className="pagina-subtitulo">Compras registradas</h2>
        <div className="pagina-barra-acciones">
          <button type="button" className="boton-icono" aria-label="Actualizar la lista de compras" disabled={cargando} onClick={recargarCompras}>
            <Icono nombre="recargar" />
          </button>
          <Boton
            variante="principal"
            icono="suma"
            alHacerClic={function () {
              setModo("nueva");
            }}
          >
            Nueva
          </Boton>
        </div>
      </div>

      {contenido}
    </div>
  );
}

export default Compras;
