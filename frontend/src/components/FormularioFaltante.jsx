// ---------------------------------------------------------------------------
// FormularioFaltante.jsx: registra un producto que un cliente pidió y no había.
// El producto puede ser uno del catálogo (se elige de las sugerencias) o uno que
// la papelería no vende (se escribe el nombre como texto).
// Un faltante es informativo: no cambia el inventario ni las ventas.
// Props: productos, proveedores, productoInicial (producto del catálogo o null),
//        textoInicial (nombre ya escrito, opcional), alGuardado(faltante), alCancelar.
// ---------------------------------------------------------------------------
import { useState } from "react";
import Boton from "./Boton.jsx";
import Campo from "./Campo.jsx";
import { crearRecurso } from "../api/datos.js";
import { nuevoId } from "../utils/ids.js";
import { aEntero, soloDigitos } from "../utils/formato.js";
import { TIPOS_FALTANTE } from "../config.js";

function FormularioFaltante(props) {
  // Valores iniciales: dependen de si llegó un producto del catálogo o solo un texto
  let nombreInicial = "";
  let productoIdInicial = "";
  let tipoInicial = "inexistente";
  if (props.productoInicial) {
    nombreInicial = props.productoInicial.nombre;
    productoIdInicial = props.productoInicial.id;
    tipoInicial = "agotado";
  } else if (props.textoInicial) {
    nombreInicial = props.textoInicial;
  }

  // El id se genera UNA sola vez al abrir el formulario: si hay que reintentar, no se duplica
  const [idFaltante] = useState(function () {
    return nuevoId();
  });
  const [nombre, setNombre] = useState(nombreInicial); // lo que se ve en el campo "producto"
  const [productoId, setProductoId] = useState(productoIdInicial); // "" = no es del catálogo
  const [tipo, setTipo] = useState(tipoInicial);
  const [cantidad, setCantidad] = useState("1");
  const [proveedorId, setProveedorId] = useState("");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Sugerencias: productos del catálogo que coinciden con lo escrito (máximo 5).
  // Solo se muestran mientras no se haya elegido un producto.
  const textoBusqueda = nombre.trim().toLowerCase();
  let sugerencias = [];
  if (productoId === "" && textoBusqueda.length >= 2) {
    sugerencias = props.productos
      .filter(function (producto) {
        return producto.nombre.toLowerCase().includes(textoBusqueda) || producto.codigo.toLowerCase().includes(textoBusqueda);
      })
      .slice(0, 5);
  }

  // Al escribir en el campo, deja de estar elegido un producto del catálogo
  function cambiarNombre(evento) {
    setNombre(evento.target.value);
    setError("");
    if (productoId !== "") {
      setProductoId("");
      setTipo("inexistente");
    }
  }

  // Al tocar una sugerencia: queda elegido ese producto del catálogo (está agotado)
  function elegirProducto(producto) {
    setNombre(producto.nombre);
    setProductoId(producto.id);
    setTipo("agotado");
    setError("");
  }

  // Se ejecuta al enviar el formulario
  async function guardar(evento) {
    evento.preventDefault();
    if (guardando) {
      return; // evita envíos duplicados
    }

    if (nombre.trim() === "") {
      setError("Escribe qué producto pidió el cliente.");
      return;
    }
    if (aEntero(cantidad) < 1) {
      setError("La cantidad solicitada debe ser de 1 o más.");
      return;
    }

    setError("");
    setGuardando(true);
    try {
      const guardado = await crearRecurso("faltantes", {
        id: idFaltante,
        productoId: productoId,
        descripcion: nombre.trim(),
        cantidad: aEntero(cantidad),
        tipo: tipo,
        proveedorId: proveedorId,
        observacion: observacion.trim()
      });
      props.alGuardado(guardado);
    } catch (falla) {
      setError(falla.message);
      setGuardando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      <fieldset className="grupo" disabled={guardando}>
        <legend>¿Qué pidió el cliente?</legend>
        <Campo etiqueta="Producto" ayuda="Escribe el nombre. Si ya está en el catálogo, tócalo en la lista.">
          <input className="entrada" type="text" value={nombre} onChange={cambiarNombre} placeholder="Ejemplo: Cartulina negra" />
        </Campo>

        {/* Sugerencias del catálogo: tocar una la elige */}
        {sugerencias.length > 0 && (
          <ul className="resultados-busqueda">
            {sugerencias.map(function (producto) {
              // Texto del inventario de la sugerencia
              let textoStock = "Sin control de inventario";
              if (producto.seguimientoInventario) {
                textoStock = "Stock: " + producto.stock;
              }
              return (
                <li key={producto.id}>
                  <button
                    type="button"
                    className="resultado"
                    onClick={function () {
                      elegirProducto(producto);
                    }}
                  >
                    <span>{producto.nombre}</span>
                    <span className="resultado-detalle">{textoStock}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {productoId !== "" && <p className="campo-ayuda">Producto del catálogo.</p>}

        {/* Tipo de faltante: dos botones grandes, uno ya elegido */}
        <div className="selector-metodo selector-doble" role="radiogroup" aria-label="Tipo de faltante">
          {TIPOS_FALTANTE.map(function (opcion) {
            let clase = "metodo-opcion";
            if (tipo === opcion.valor) {
              clase = "metodo-opcion metodo-opcion-activa";
            }
            return (
              <button
                type="button"
                key={opcion.valor}
                role="radio"
                aria-checked={tipo === opcion.valor}
                className={clase}
                onClick={function () {
                  setTipo(opcion.valor);
                }}
              >
                {opcion.etiqueta}
              </button>
            );
          })}
        </div>

        <Campo etiqueta="Cantidad solicitada">
          <input
            className="entrada"
            type="text"
            inputMode="numeric"
            value={cantidad}
            onChange={function (evento) {
              setCantidad(soloDigitos(evento.target.value));
            }}
          />
        </Campo>
      </fieldset>

      <fieldset className="grupo" disabled={guardando}>
        <legend>Datos opcionales</legend>
        <Campo etiqueta="Proveedor que lo podría traer">
          <select
            className="entrada"
            value={proveedorId}
            onChange={function (evento) {
              setProveedorId(evento.target.value);
            }}
          >
            <option value="">Sin proveedor</option>
            {props.proveedores.map(function (proveedor) {
              return (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              );
            })}
          </select>
        </Campo>
        <Campo etiqueta="Observación">
          <input
            className="entrada"
            type="text"
            value={observacion}
            maxLength={200}
            onChange={function (evento) {
              setObservacion(evento.target.value);
            }}
            placeholder="Ejemplo: la necesita para el viernes"
          />
        </Campo>
      </fieldset>

      {error !== "" && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      <div className="acciones-fila">
        <Boton variante="suave" alHacerClic={props.alCancelar} deshabilitado={guardando}>
          Cancelar
        </Boton>
        <Boton tipo="submit" variante="principal" cargando={guardando} textoCargando="Guardando…">
          Registrar faltante
        </Boton>
      </div>
    </form>
  );
}

export default FormularioFaltante;
