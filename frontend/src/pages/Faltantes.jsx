// ---------------------------------------------------------------------------
// Faltantes.jsx: productos que un cliente pidió y no había (agotados o que la
// papelería no vende). Sirve para decidir qué pedir en las próximas compras.
//   - Registrar un faltante (administrador y cajero).
//   - Listar y filtrar por tipo, proveedor y estado. Los filtros los aplica el BACKEND:
//     cada cambio vuelve a pedir la lista con los filtros en la dirección.
//   - Marcar como resuelto, volver a pendiente o eliminar (solo administrador).
// Props: esAdmin, productos, proveedores, mostrarAviso, pedirConfirmacion.
// ---------------------------------------------------------------------------
import { useState, useEffect } from "react";
import Boton from "../components/Boton.jsx";
import Icono from "../components/Icono.jsx";
import Modal from "../components/Modal.jsx";
import EstadoVacio from "../components/EstadoVacio.jsx";
import EsqueletoLista from "../components/EsqueletoLista.jsx";
import FormularioFaltante from "../components/FormularioFaltante.jsx";
import { leerRecurso, actualizarRecurso, eliminarRecurso } from "../api/datos.js";
import { formatearFecha, textoCantidad } from "../utils/formato.js";
import { nombreDe, reemplazarEnLista, quitarDeLista } from "../utils/calculos.js";
import { TIPOS_FALTANTE } from "../config.js";

function Faltantes(props) {
  // Estados de esta pantalla (cada useState devuelve [valor, funciónParaCambiarlo])
  const [faltantes, setFaltantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mostrandoFormulario, setMostrandoFormulario] = useState(false);
  const [trabajandoId, setTrabajandoId] = useState(""); // id del faltante que se está cambiando

  // Filtros ("" = todos). Empezamos viendo los pendientes, que son los que importan para comprar.
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");

  // "version" sube cada vez que queremos volver a leer (botón Actualizar o Reintentar)
  const [version, setVersion] = useState(0);

  // Se ejecuta al abrir la pantalla y cada vez que cambia un filtro o la versión
  useEffect(
    function () {
      // Lee los faltantes del backend con los filtros elegidos
      async function leerFaltantes() {
        // Armamos la parte de la dirección con los filtros: ?estado=pendiente&tipo=agotado...
        const filtros = "?estado=" + filtroEstado + "&tipo=" + filtroTipo + "&proveedorId=" + filtroProveedor;
        try {
          const lista = await leerRecurso("faltantes", filtros);
          setFaltantes(lista);
          setError("");
        } catch (falla) {
          setError(falla.message);
        } finally {
          setCargando(false);
        }
      }
      leerFaltantes();
    },
    [filtroEstado, filtroTipo, filtroProveedor, version]
  );

  // Vuelve a leer la lista mostrando el estado de carga
  function recargar() {
    setCargando(true);
    setVersion(version + 1);
  }

  // Cuando el formulario registra un faltante: cerramos y volvemos a leer la lista
  // (así se respeta el filtro que esté puesto)
  function alGuardado() {
    setMostrandoFormulario(false);
    props.mostrarAviso("Faltante registrado.", "ok");
    recargar();
  }

  // Cambia el estado de un faltante (resuelto o pendiente). Solo administrador.
  async function cambiarEstado(faltante, estadoNuevo) {
    if (trabajandoId !== "") {
      return; // ya hay un cambio en marcha
    }
    setTrabajandoId(faltante.id);
    try {
      const actualizado = await actualizarRecurso("faltantes", { id: faltante.id, estado: estadoNuevo });

      // Si hay un filtro de estado y el faltante ya no coincide, lo sacamos de la lista
      if (filtroEstado !== "" && actualizado.estado !== filtroEstado) {
        setFaltantes(function (actuales) {
          return quitarDeLista(actuales, actualizado.id);
        });
      } else {
        setFaltantes(function (actuales) {
          return reemplazarEnLista(actuales, actualizado);
        });
      }

      if (estadoNuevo === "resuelto") {
        props.mostrarAviso("Faltante marcado como resuelto.", "ok");
      } else {
        props.mostrarAviso("El faltante volvió a pendiente.", "info");
      }
    } catch (falla) {
      props.mostrarAviso("No se pudo cambiar el faltante: " + falla.message, "error");
    } finally {
      setTrabajandoId("");
    }
  }

  // Pide confirmación y elimina un faltante registrado por error. Solo administrador.
  function pedirEliminar(faltante) {
    props.pedirConfirmacion({
      titulo: "Eliminar faltante",
      mensaje: "¿Eliminar el faltante de \"" + faltante.descripcion + "\"? Úsalo solo si se registró por error.",
      textoConfirmar: "Sí, eliminar",
      peligro: true,
      alConfirmar: async function () {
        try {
          await eliminarRecurso("faltantes", faltante.id);
          setFaltantes(function (actuales) {
            return quitarDeLista(actuales, faltante.id);
          });
          props.mostrarAviso("Faltante eliminado.", "ok");
        } catch (falla) {
          props.mostrarAviso("No se pudo eliminar: " + falla.message, "error");
        }
      }
    });
  }

  // Devuelve el texto de un tipo de faltante ("agotado" -> "Agotado")
  function etiquetaTipo(tipo) {
    const opcion = TIPOS_FALTANTE.find(function (posible) {
      return posible.valor === tipo;
    });
    if (opcion) {
      return opcion.etiqueta;
    }
    return tipo;
  }

  // ----- Contenido según el estado: cargando, error, vacío o lista -----
  let contenido;
  if (cargando) {
    contenido = <EsqueletoLista filas={4} />;
  } else if (error !== "") {
    contenido = (
      <div className="estado-error" role="alert">
        <Icono nombre="alerta" />
        <p className="estado-error-titulo">No pudimos cargar los faltantes</p>
        <p>{error}</p>
        <Boton variante="principal" icono="recargar" alHacerClic={recargar}>
          Reintentar
        </Boton>
      </div>
    );
  } else if (faltantes.length === 0) {
    contenido = (
      <EstadoVacio
        icono="lista"
        titulo="No hay faltantes con esos filtros"
        texto="Cuando un cliente pida algo agotado o que no vendes, anótalo aquí para tenerlo en cuenta en la próxima compra."
        textoBoton="Registrar faltante"
        alHacerClic={function () {
          setMostrandoFormulario(true);
        }}
      />
    );
  } else {
    contenido = (
      <ul className="lista-gestion">
        {faltantes.map(function (faltante) {
          const resuelto = faltante.estado === "resuelto";

          // Etiqueta del estado: verde si está resuelto, ámbar si sigue pendiente
          let claseEstado = "etiqueta etiqueta-poco";
          let textoEstado = "Pendiente";
          if (resuelto) {
            claseEstado = "etiqueta etiqueta-ok";
            textoEstado = "Resuelto";
          }

          return (
            <li className="gestion-fila" key={faltante.id}>
              <div className="gestion-info">
                <p className="gestion-nombre">{faltante.descripcion}</p>
                <div className="producto-etiquetas">
                  <span className={claseEstado}>{textoEstado}</span>
                  <span className="etiqueta">{etiquetaTipo(faltante.tipo)}</span>
                  <span className="etiqueta">Pidieron {textoCantidad(faltante.cantidad, "unidad", "unidades")}</span>
                </div>
                <p className="gestion-detalle">
                  {formatearFecha(faltante.fecha)}, anotó {faltante.usuario}
                </p>
                <p className="gestion-detalle">Proveedor: {nombreDe(props.proveedores, faltante.proveedorId, "sin asignar")}</p>
                {faltante.observacion !== "" && <p className="gestion-detalle">Nota: {faltante.observacion}</p>}
                {resuelto && <p className="gestion-detalle">Resuelto el {formatearFecha(faltante.resueltoEn)}</p>}
              </div>

              {/* Acciones: solo el administrador */}
              {props.esAdmin && (
                <div className="gestion-botones gestion-botones-columna">
                  {!resuelto && (
                    <Boton
                      variante="secundario"
                      icono="check"
                      cargando={trabajandoId === faltante.id}
                      alHacerClic={function () {
                        cambiarEstado(faltante, "resuelto");
                      }}
                    >
                      Resuelto
                    </Boton>
                  )}
                  {resuelto && (
                    <Boton
                      variante="suave"
                      cargando={trabajandoId === faltante.id}
                      alHacerClic={function () {
                        cambiarEstado(faltante, "pendiente");
                      }}
                    >
                      Reabrir
                    </Boton>
                  )}
                  <button
                    type="button"
                    className="boton-icono boton-icono-peligro"
                    aria-label={"Eliminar el faltante de " + faltante.descripcion}
                    onClick={function () {
                      pedirEliminar(faltante);
                    }}
                  >
                    <Icono nombre="papelera" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="pagina">
      <div className="pagina-barra">
        <h2 className="pagina-subtitulo">Productos que pidieron y no había</h2>
        <div className="pagina-barra-acciones">
          <button type="button" className="boton-icono" aria-label="Actualizar la lista de faltantes" disabled={cargando} onClick={recargar}>
            <Icono nombre="recargar" />
          </button>
          <Boton
            variante="principal"
            icono="suma"
            alHacerClic={function () {
              setMostrandoFormulario(true);
            }}
          >
            Registrar
          </Boton>
        </div>
      </div>

      {/* Filtros: estado, tipo y proveedor */}
      <div className="filtros">
        <label className="campo">
          <span className="campo-etiqueta">Estado</span>
          <select
            className="entrada"
            value={filtroEstado}
            onChange={function (evento) {
              setCargando(true);
              setFiltroEstado(evento.target.value);
            }}
          >
            <option value="pendiente">Pendientes</option>
            <option value="resuelto">Resueltos</option>
            <option value="">Todos</option>
          </select>
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Tipo</span>
          <select
            className="entrada"
            value={filtroTipo}
            onChange={function (evento) {
              setCargando(true);
              setFiltroTipo(evento.target.value);
            }}
          >
            <option value="">Todos</option>
            {TIPOS_FALTANTE.map(function (opcion) {
              return (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              );
            })}
          </select>
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Proveedor</span>
          <select
            className="entrada"
            value={filtroProveedor}
            onChange={function (evento) {
              setCargando(true);
              setFiltroProveedor(evento.target.value);
            }}
          >
            <option value="">Todos</option>
            <option value="ninguno">Sin proveedor</option>
            {props.proveedores.map(function (proveedor) {
              return (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {contenido}

      {mostrandoFormulario && (
        <Modal
          titulo="Registrar faltante"
          alCerrar={function () {
            setMostrandoFormulario(false);
          }}
        >
          <FormularioFaltante
            productos={props.productos}
            proveedores={props.proveedores}
            productoInicial={null}
            textoInicial=""
            alGuardado={alGuardado}
            alCancelar={function () {
              setMostrandoFormulario(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default Faltantes;
