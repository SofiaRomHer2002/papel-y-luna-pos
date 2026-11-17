// ---------------------------------------------------------------------------
// GestorEntidad.jsx: pantalla para gestionar categorías, proveedores, clientes o descuentos
// (listar, buscar, crear, editar y eliminar). Es UNA sola pantalla que se adapta
// con la "config" que recibe (ver configEntidades.js), así no repetimos el código cuatro veces.
// Si un registro tiene datos asociados (por ejemplo, una categoría con productos), el backend
// no deja eliminarlo y aquí se muestra el motivo.
// Props: config, lista, setLista, mostrarAviso, pedirConfirmacion.
// ---------------------------------------------------------------------------
import { useState } from "react";
import Boton from "../components/Boton.jsx";
import Icono from "../components/Icono.jsx";
import Modal from "../components/Modal.jsx";
import EstadoVacio from "../components/EstadoVacio.jsx";
import FormularioEntidad from "../components/FormularioEntidad.jsx";
import { eliminarRecurso } from "../api/datos.js";
import { reemplazarEnLista, quitarDeLista } from "../utils/calculos.js";

function GestorEntidad(props) {
  const config = props.config;

  // formulario: null = cerrado; { registro: null } = crear; { registro: {...} } = editar
  const [formulario, setFormulario] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  // Después de guardar (el backend ya confirmó): actualizamos la lista y cerramos el formulario
  function alGuardar(registroGuardado) {
    props.setLista(function (actuales) {
      return reemplazarEnLista(actuales, registroGuardado);
    });
    setFormulario(null);
    props.mostrarAviso("Guardado correctamente.", "ok");
  }

  // Pide confirmación y elimina. Si el registro tiene datos asociados (por ejemplo, una categoría
  // con productos o un cliente con ventas), el BACKEND se niega y explica el motivo:
  // esa regla ya no se revisa aquí, sino en la base de datos, que es quien tiene los datos reales.
  function pedirEliminar(registro) {
    props.pedirConfirmacion({
      titulo: "Eliminar",
      mensaje: "¿Eliminar \"" + registro.nombre + "\"? Esta acción no se puede deshacer.",
      textoConfirmar: "Sí, eliminar",
      peligro: true,
      alConfirmar: async function () {
        try {
          await eliminarRecurso(config.recurso, registro.id);
          props.setLista(function (actuales) {
            return quitarDeLista(actuales, registro.id);
          });
          props.mostrarAviso("Eliminado correctamente.", "ok");
        } catch (error) {
          // Aquí llega, por ejemplo: "No se puede eliminar: este cliente tiene 2 ventas registradas."
          props.mostrarAviso(error.message, "error");
        }
      }
    });
  }

  // Filtramos por el buscador (buscamos en el nombre)
  const textoBusqueda = busqueda.trim().toLowerCase();
  const visibles = props.lista.filter(function (registro) {
    if (textoBusqueda === "") {
      return true;
    }
    return registro.nombre.toLowerCase().includes(textoBusqueda);
  });

  // Contenido de la lista
  let contenido;
  if (props.lista.length === 0) {
    contenido = (
      <EstadoVacio
        icono={config.icono}
        titulo={"Aún no hay " + config.titulo.toLowerCase()}
        texto={config.descripcionVacia}
        textoBoton={config.nuevo}
        alHacerClic={function () {
          setFormulario({ registro: null });
        }}
      />
    );
  } else if (visibles.length === 0) {
    contenido = <EstadoVacio icono="buscar" titulo="No encontramos resultados" texto="Prueba con otro nombre." />;
  } else {
    contenido = (
      <ul className="lista-gestion">
        {visibles.map(function (registro) {
          // Algunas entidades (los descuentos) traen una función que arma un texto de detalle
          let textoDetalle = "";
          if (config.detalle) {
            textoDetalle = config.detalle(registro);
          }

          return (
            <li className="gestion-fila" key={registro.id}>
              <div className="gestion-info">
                <p className="gestion-nombre">{registro.nombre}</p>
                {textoDetalle !== "" && <p className="gestion-detalle">{textoDetalle}</p>}
                {registro.telefono && <p className="gestion-detalle">{registro.telefono}</p>}
                {registro.correo && <p className="gestion-detalle">{registro.correo}</p>}
              </div>
              <div className="gestion-botones">
                <button
                  type="button"
                  className="boton-icono"
                  aria-label={"Editar " + registro.nombre}
                  onClick={function () {
                    setFormulario({ registro: registro });
                  }}
                >
                  <Icono nombre="editar" />
                </button>
                <button
                  type="button"
                  className="boton-icono boton-icono-peligro"
                  aria-label={"Eliminar " + registro.nombre}
                  onClick={function () {
                    pedirEliminar(registro);
                  }}
                >
                  <Icono nombre="papelera" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  // Título del formulario según sea crear o editar
  let tituloFormulario = config.nuevo;
  if (formulario && formulario.registro) {
    tituloFormulario = config.editar;
  }

  return (
    <div className="pagina">
      <div className="pagina-barra">
        <div className="buscador">
          <Icono nombre="buscar" />
          <input
            className="buscador-entrada"
            type="search"
            placeholder="Buscar por nombre"
            aria-label={"Buscar en " + config.titulo.toLowerCase()}
            value={busqueda}
            onChange={function (evento) {
              setBusqueda(evento.target.value);
            }}
          />
        </div>
        <Boton
          variante="principal"
          icono="suma"
          alHacerClic={function () {
            setFormulario({ registro: null });
          }}
        >
          Nuevo
        </Boton>
      </div>

      {contenido}

      {formulario && (
        <Modal
          titulo={tituloFormulario}
          alCerrar={function () {
            setFormulario(null);
          }}
        >
          <FormularioEntidad
            config={config}
            registro={formulario.registro}
            alGuardar={alGuardar}
            alCancelar={function () {
              setFormulario(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default GestorEntidad;
