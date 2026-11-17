// ---------------------------------------------------------------------------
// FormularioProducto.jsx: formulario para crear o editar un producto.
// Se usa en dos lugares:
//   modo "completo": en la pantalla Productos (se edita todo, incluido el inventario)
//   modo "venta": desde el flujo de venta (solo nombre, categoría, precio y costo;
//                 el stock se ajusta desde Productos, como pide el documento)
// Props: modo, producto (null = crear), categorias, alGuardar(registro),
//        alCancelar, alIrACategorias.
// ---------------------------------------------------------------------------
import { useState } from "react";
import Boton from "./Boton.jsx";
import Campo from "./Campo.jsx";
import EstadoVacio from "./EstadoVacio.jsx";
import { crearRecurso, actualizarRecurso } from "../api/datos.js";
import { nuevoId } from "../utils/ids.js";
import { aEntero, soloDigitos } from "../utils/formato.js";
import { validarProducto } from "../utils/validaciones.js";

function FormularioProducto(props) {
  const producto = props.producto;

  // Valores iniciales: si estamos editando, salen del producto; si estamos creando, vacíos.
  // Todo se guarda como TEXTO porque eso es lo que entregan los <input>.
  let nombreInicial = "";
  let categoriaInicial = "";
  let precioInicial = "";
  let costoInicial = "";
  let seguimientoInicial = true;
  let stockInicial = "";
  if (producto) {
    nombreInicial = producto.nombre;
    categoriaInicial = producto.categoriaId;
    precioInicial = String(producto.precio);
    costoInicial = String(producto.costo);
    seguimientoInicial = producto.seguimientoInventario;
    if (producto.seguimientoInventario) {
      stockInicial = String(producto.stock);
    }
  }

  // Un useState por cada campo (cada uno devuelve la pareja [valor, funciónParaCambiarlo])
  const [nombre, setNombre] = useState(nombreInicial);
  const [categoriaId, setCategoriaId] = useState(categoriaInicial);
  const [precio, setPrecio] = useState(precioInicial);
  const [costo, setCosto] = useState(costoInicial);
  const [seguimiento, setSeguimiento] = useState(seguimientoInicial);
  const [stock, setStock] = useState(stockInicial);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Sin categorías no se puede crear un producto: la categoría se SELECCIONA, no se escribe
  if (props.categorias.length === 0) {
    return (
      <EstadoVacio
        icono="carpeta"
        titulo="Primero crea una categoría"
        texto="Cada producto pertenece a una categoría que ya exista. Crea al menos una y vuelve."
        textoBoton="Ir a Categorías"
        alHacerClic={props.alIrACategorias}
      />
    );
  }

  // Se ejecuta al enviar el formulario (botón Guardar o tecla Enter)
  async function guardar(evento) {
    evento.preventDefault(); // evita que el navegador recargue la página
    if (guardando) {
      return; // evita envíos duplicados
    }

    // 1. Validamos lo que escribió la persona
    const problema = validarProducto(
      { nombre: nombre, categoriaId: categoriaId, precio: precio, costo: costo, seguimiento: seguimiento, stock: stock },
      props.categorias,
      props.modo
    );
    if (problema !== "") {
      setError(problema);
      return;
    }

    setError("");
    setGuardando(true);

    try {
      let guardado;

      if (producto) {
        // EDITAR: enviamos solo los campos que este formulario puede cambiar
        const cambios = {
          id: producto.id,
          nombre: nombre.trim(),
          categoriaId: categoriaId,
          precio: aEntero(precio),
          costo: aEntero(costo)
        };
        if (props.modo === "completo") {
          cambios.seguimientoInventario = seguimiento;
          if (seguimiento) {
            cambios.stock = aEntero(stock);
          } else {
            cambios.stock = 0; // sin seguimiento: el stock no se usa
          }
        }
        guardado = await actualizarRecurso("productos", cambios);
      } else {
        // CREAR: el id se genera aquí; el código (PL-14, PL-15...) ahora lo asigna el backend,
        // así dos personas creando productos a la vez no reciben el mismo código
        const nuevo = {
          id: nuevoId(),
          nombre: nombre.trim(),
          categoriaId: categoriaId,
          precio: aEntero(precio),
          costo: aEntero(costo),
          seguimientoInventario: seguimiento,
          stock: 0
        };
        if (seguimiento) {
          nuevo.stock = aEntero(stock);
        }
        guardado = await crearRecurso("productos", nuevo);
      }

      // El backend confirmó: avisamos a la pantalla que nos abrió (ella cierra el formulario)
      props.alGuardar(guardado);
    } catch (falla) {
      setError(falla.message);
      setGuardando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      {/* SECCIÓN 1: datos básicos */}
      <fieldset className="grupo" disabled={guardando}>
        <legend>Datos del producto</legend>
        <Campo etiqueta="Nombre">
          <input
            className="entrada"
            type="text"
            value={nombre}
            onChange={function (evento) {
              setNombre(evento.target.value);
            }}
            placeholder="Ejemplo: Cuaderno cuadriculado"
          />
        </Campo>
        <Campo etiqueta="Categoría">
          <select
            className="entrada"
            value={categoriaId}
            onChange={function (evento) {
              setCategoriaId(evento.target.value);
            }}
          >
            <option value="">Elige una categoría</option>
            {props.categorias.map(function (categoria) {
              return (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              );
            })}
          </select>
        </Campo>
      </fieldset>

      {/* SECCIÓN 2: precios (dinero en pesos enteros) */}
      <fieldset className="grupo" disabled={guardando}>
        <legend>Precios</legend>
        <div className="fila-doble">
          <Campo etiqueta="Precio de venta">
            <input
              className="entrada"
              type="text"
              inputMode="numeric"
              value={precio}
              onChange={function (evento) {
                setPrecio(soloDigitos(evento.target.value));
              }}
              placeholder="0"
            />
          </Campo>
          <Campo etiqueta="Costo (lo que pagas)">
            <input
              className="entrada"
              type="text"
              inputMode="numeric"
              value={costo}
              onChange={function (evento) {
                setCosto(soloDigitos(evento.target.value));
              }}
              placeholder="0"
            />
          </Campo>
        </div>
      </fieldset>

      {/* SECCIÓN 3: inventario (solo en el modo completo) */}
      {props.modo === "completo" && (
        <fieldset className="grupo" disabled={guardando}>
          <legend>Inventario</legend>
          <label className="casilla">
            <input
              type="checkbox"
              checked={seguimiento}
              onChange={function (evento) {
                setSeguimiento(evento.target.checked);
              }}
            />
            <span>Llevar control de inventario de este producto</span>
          </label>
          {seguimiento && (
            <Campo etiqueta="Unidades disponibles (stock)">
              <input
                className="entrada"
                type="text"
                inputMode="numeric"
                value={stock}
                onChange={function (evento) {
                  setStock(soloDigitos(evento.target.value));
                }}
                placeholder="0"
              />
            </Campo>
          )}
          {!seguimiento && <p className="campo-ayuda">Sin control de inventario, el producto siempre se puede vender y su stock no cambia.</p>}
        </fieldset>
      )}

      {props.modo === "venta" && <p className="campo-ayuda">El stock se ajusta desde la pantalla Productos.</p>}

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
          Guardar producto
        </Boton>
      </div>
    </form>
  );
}

export default FormularioProducto;
