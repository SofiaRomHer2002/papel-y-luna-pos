// ---------------------------------------------------------------------------
// FormularioCompra.jsx: formulario para registrar una compra a un proveedor.
// Se elige el proveedor y la fecha, se agregan productos con su cantidad y costo,
// y al registrar: UNA petición al backend guarda la compra, suma el stock
// y actualiza el costo de cada producto (todo dentro de una transacción).
// Props: productos, proveedores, alRegistrada(resultado), alCancelar, alIrAProveedores.
// ---------------------------------------------------------------------------
import { useState } from "react";
import Boton from "./Boton.jsx";
import Campo from "./Campo.jsx";
import EstadoVacio from "./EstadoVacio.jsx";
import Icono from "./Icono.jsx";
import { registrarCompra } from "../servicios/compras.js";
import { nuevoId, sonIguales } from "../utils/ids.js";
import { buscarPorId } from "../utils/calculos.js";
import { formatearPrecio, aEntero, soloDigitos, fechaDeHoyParaInput, fechaIsoDesdeInput } from "../utils/formato.js";

function FormularioCompra(props) {
  // El id de la compra se genera UNA sola vez al abrir el formulario (función dentro de useState:
  // React la ejecuta solo la primera vez). Así, si hay que reintentar, no se duplica la compra.
  const [idCompra] = useState(function () {
    return nuevoId();
  });
  const [proveedorId, setProveedorId] = useState("");
  const [fecha, setFecha] = useState(fechaDeHoyParaInput());
  const [lineas, setLineas] = useState([]); // cada línea: { productoId, nombre, cantidad (texto), costo (texto) }
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Sin proveedores no se puede registrar una compra: toda compra se asocia a un proveedor
  if (props.proveedores.length === 0) {
    return (
      <EstadoVacio
        icono="camion"
        titulo="Primero crea un proveedor"
        texto="Toda compra se asocia a un proveedor. Crea uno y vuelve para registrar la compra."
        textoBoton="Ir a Proveedores"
        alHacerClic={props.alIrAProveedores}
      />
    );
  }

  // ----- Manejo de las líneas -----

  // Agrega un producto a la compra (si ya estaba, le suma 1 a la cantidad)
  function agregarProducto(producto) {
    setError(""); // al corregir, desaparece el mensaje de error anterior
    const yaEsta = lineas.find(function (linea) {
      return sonIguales(linea.productoId, producto.id);
    });

    if (yaEsta) {
      cambiarLinea(producto.id, "cantidad", String(aEntero(yaEsta.cantidad) + 1));
    } else {
      // Copiamos la lista y agregamos la línea nueva (el costo empieza con el costo actual del producto)
      const nuevas = lineas.concat([
        { productoId: producto.id, nombre: producto.nombre, cantidad: "1", costo: String(producto.costo) }
      ]);
      setLineas(nuevas);
    }
    setBusqueda("");
  }

  // Cambia un campo (cantidad o costo) de la línea de ese producto
  function cambiarLinea(productoId, campo, valor) {
    const nuevas = lineas.map(function (linea) {
      if (sonIguales(linea.productoId, productoId)) {
        const copia = Object.assign({}, linea);
        copia[campo] = soloDigitos(valor);
        return copia;
      }
      return linea;
    });
    setLineas(nuevas);
  }

  // Quita la línea de ese producto
  function quitarLinea(productoId) {
    const nuevas = lineas.filter(function (linea) {
      return !sonIguales(linea.productoId, productoId);
    });
    setLineas(nuevas);
  }

  // ----- Cálculos -----

  // Total de la compra: suma cantidad x costo de cada línea
  let total = 0;
  lineas.forEach(function (linea) {
    total = total + aEntero(linea.cantidad) * aEntero(linea.costo);
  });

  // Productos que coinciden con lo que escribió en el buscador (máximo 6 resultados)
  const textoBusqueda = busqueda.trim().toLowerCase();
  let resultados = [];
  if (textoBusqueda !== "") {
    resultados = props.productos
      .filter(function (producto) {
        return producto.nombre.toLowerCase().includes(textoBusqueda) || producto.codigo.toLowerCase().includes(textoBusqueda);
      })
      .slice(0, 6);
  }

  // ----- Registrar -----
  async function registrar(evento) {
    evento.preventDefault();
    if (guardando) {
      return; // evita envíos duplicados
    }

    // Validaciones
    if (proveedorId === "") {
      setError("Elige el proveedor de la compra.");
      return;
    }
    if (lineas.length === 0) {
      setError("Agrega al menos un producto a la compra.");
      return;
    }
    for (let i = 0; i < lineas.length; i++) {
      if (aEntero(lineas[i].cantidad) < 1) {
        setError("La cantidad de \"" + lineas[i].nombre + "\" debe ser de 1 o más.");
        return;
      }
      if (lineas[i].costo === "") {
        setError("Escribe el costo de \"" + lineas[i].nombre + "\".");
        return;
      }
    }

    setError("");
    setGuardando(true);

    // Convertimos los textos a números para el backend
    const lineasNumericas = lineas.map(function (linea) {
      return { productoId: linea.productoId, nombre: linea.nombre, cantidad: aEntero(linea.cantidad), costo: aEntero(linea.costo) };
    });

    try {
      const resultado = await registrarCompra({ id: idCompra, proveedorId: proveedorId, fecha: fechaIsoDesdeInput(fecha), lineas: lineasNumericas });
      props.alRegistrada(resultado);
    } catch (falla) {
      setError(falla.message);
      setGuardando(false);
    }
  }

  // Una fila editable por cada producto de la compra
  const filas = lineas.map(function (linea) {
    const producto = buscarPorId(props.productos, linea.productoId);
    let notaStock = "";
    if (producto && !producto.seguimientoInventario) {
      notaStock = "Sin control de inventario: solo se actualiza el costo.";
    }
    return (
      <li className="linea-compra" key={linea.productoId}>
        <div className="linea-compra-nombre">
          <p>{linea.nombre}</p>
          {notaStock !== "" && <p className="campo-ayuda">{notaStock}</p>}
        </div>
        <div className="linea-compra-campos">
          <Campo etiqueta="Cantidad">
            <input
              className="entrada"
              type="text"
              inputMode="numeric"
              value={linea.cantidad}
              disabled={guardando}
              onChange={function (evento) {
                cambiarLinea(linea.productoId, "cantidad", evento.target.value);
              }}
            />
          </Campo>
          <Campo etiqueta="Costo unitario">
            <input
              className="entrada"
              type="text"
              inputMode="numeric"
              value={linea.costo}
              disabled={guardando}
              onChange={function (evento) {
                cambiarLinea(linea.productoId, "costo", evento.target.value);
              }}
            />
          </Campo>
        </div>
        <div className="linea-compra-pie">
          <span className="linea-compra-subtotal">{formatearPrecio(aEntero(linea.cantidad) * aEntero(linea.costo))}</span>
          <button
            type="button"
            className="boton-icono boton-icono-peligro"
            aria-label={"Quitar " + linea.nombre}
            disabled={guardando}
            onClick={function () {
              quitarLinea(linea.productoId);
            }}
          >
            <Icono nombre="papelera" />
          </button>
        </div>
      </li>
    );
  });

  return (
    <form className="formulario" onSubmit={registrar} noValidate>
      {/* SECCIÓN 1: proveedor y fecha */}
      <fieldset className="grupo" disabled={guardando}>
        <legend>Proveedor y fecha</legend>
        <Campo etiqueta="Proveedor">
          <select
            className="entrada"
            value={proveedorId}
            onChange={function (evento) {
              setProveedorId(evento.target.value);
              setError("");
            }}
          >
            <option value="">Elige un proveedor</option>
            {props.proveedores.map(function (proveedor) {
              return (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              );
            })}
          </select>
        </Campo>
        <Campo etiqueta="Fecha de la compra">
          <input
            className="entrada"
            type="date"
            value={fecha}
            max={fechaDeHoyParaInput()}
            onChange={function (evento) {
              setFecha(evento.target.value);
            }}
          />
        </Campo>
      </fieldset>

      {/* SECCIÓN 2: productos de la compra */}
      <fieldset className="grupo" disabled={guardando}>
        <legend>Productos comprados</legend>
        <Campo etiqueta="Buscar producto para agregar">
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

        {/* Resultados de la búsqueda: tocar uno lo agrega a la compra */}
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
                    <span className="resultado-detalle">Costo actual {formatearPrecio(producto.costo)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {textoBusqueda !== "" && resultados.length === 0 && <p className="campo-ayuda">No encontramos productos con ese nombre.</p>}

        {lineas.length === 0 && <p className="campo-ayuda">Aún no agregas productos. Búscalos arriba.</p>}
        {lineas.length > 0 && <ul className="lineas-compra">{filas}</ul>}
      </fieldset>

      <div className="cobro-total">
        <span>Total de la compra</span>
        <strong>{formatearPrecio(total)}</strong>
      </div>

      {error !== "" && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      {guardando && <p className="mensaje-progreso">Registrando la compra y actualizando el inventario…</p>}

      <div className="acciones-fila">
        <Boton variante="suave" alHacerClic={props.alCancelar} deshabilitado={guardando}>
          Cancelar
        </Boton>
        <Boton tipo="submit" variante="principal" cargando={guardando} textoCargando="Registrando…">
          Registrar compra
        </Boton>
      </div>
    </form>
  );
}

export default FormularioCompra;
