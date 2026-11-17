// ---------------------------------------------------------------------------
// Productos.jsx: CRUD de productos (listar, buscar, crear, editar y eliminar con confirmación).
// Los cambios se envían al backend; la lista de la pantalla se actualiza cuando el backend confirma.
// Roles: el ADMINISTRADOR puede crear, editar y eliminar. El CAJERO solo consulta
// (por eso no ve los botones); la edición rápida la hace desde la pantalla de venta.
// Props: esAdmin, productos, setProductos, categorias, mostrarAviso, pedirConfirmacion, irA.
// ---------------------------------------------------------------------------
import { useState } from "react";
import Boton from "../components/Boton.jsx";
import Icono from "../components/Icono.jsx";
import Modal from "../components/Modal.jsx";
import EstadoVacio from "../components/EstadoVacio.jsx";
import FormularioProducto from "../components/FormularioProducto.jsx";
import { eliminarRecurso } from "../api/datos.js";
import { formatearPrecio } from "../utils/formato.js";
import { nombreDe, reemplazarEnLista, quitarDeLista } from "../utils/calculos.js";

function Productos(props) {
  // formulario: null = cerrado; { producto: null } = crear; { producto: {...} } = editar
  const [formulario, setFormulario] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  // Después de guardar (el backend ya confirmó): actualizamos la lista y cerramos el formulario
  function alGuardar(productoGuardado) {
    props.setProductos(function (actuales) {
      return reemplazarEnLista(actuales, productoGuardado);
    });
    setFormulario(null);
    props.mostrarAviso("Producto guardado correctamente.", "ok");
  }

  // Pide confirmación y, si la persona acepta, elimina el producto en el backend
  function pedirEliminar(producto) {
    props.pedirConfirmacion({
      titulo: "Eliminar producto",
      mensaje: "¿Eliminar \"" + producto.nombre + "\"? Esta acción no se puede deshacer. Las ventas ya cerradas conservan sus datos.",
      textoConfirmar: "Sí, eliminar",
      peligro: true,
      alConfirmar: async function () {
        try {
          await eliminarRecurso("productos", producto.id);
          props.setProductos(function (actuales) {
            return quitarDeLista(actuales, producto.id);
          });
          props.mostrarAviso("Producto eliminado.", "ok");
        } catch (error) {
          props.mostrarAviso("No se pudo eliminar el producto: " + error.message, "error");
        }
      }
    });
  }

  // Filtramos por lo que escribieron en el buscador
  const textoBusqueda = busqueda.trim().toLowerCase();
  const visibles = props.productos.filter(function (producto) {
    if (textoBusqueda === "") {
      return true;
    }
    return producto.nombre.toLowerCase().includes(textoBusqueda) || producto.codigo.toLowerCase().includes(textoBusqueda);
  });

  // Contenido de la lista
  let contenido;
  if (props.productos.length === 0) {
    contenido = (
      <EstadoVacio
        icono="caja"
        titulo="Aún no tienes productos"
        texto="El administrador crea los productos para poder venderlos."
        textoBoton={props.esAdmin ? "Crear producto" : ""}
        alHacerClic={function () {
          setFormulario({ producto: null });
        }}
      />
    );
  } else if (visibles.length === 0) {
    contenido = <EstadoVacio icono="buscar" titulo="No encontramos productos" texto="Prueba con otro nombre o código." />;
  } else {
    contenido = (
      <ul className="lista-gestion">
        {visibles.map(function (producto) {
          // Texto del inventario según tenga o no seguimiento
          let textoStock = "Sin control de inventario";
          if (producto.seguimientoInventario) {
            textoStock = "Stock: " + producto.stock;
          }

          return (
            <li className="gestion-fila" key={producto.id}>
              <div className="gestion-info">
                <p className="gestion-nombre">{producto.nombre}</p>
                <p className="gestion-detalle">
                  <span>{nombreDe(props.categorias, producto.categoriaId, "Sin categoría")}</span>
                  <span className="producto-codigo">{producto.codigo}</span>
                </p>
                <p className="gestion-detalle">
                  Venta {formatearPrecio(producto.precio)}, costo {formatearPrecio(producto.costo)}
                </p>
                <p className="gestion-detalle">{textoStock}</p>
              </div>
              {/* Editar y eliminar: solo el administrador */}
              {props.esAdmin && (
              <div className="gestion-botones">
                <button
                  type="button"
                  className="boton-icono"
                  aria-label={"Editar " + producto.nombre}
                  onClick={function () {
                    setFormulario({ producto: producto });
                  }}
                >
                  <Icono nombre="editar" />
                </button>
                <button
                  type="button"
                  className="boton-icono boton-icono-peligro"
                  aria-label={"Eliminar " + producto.nombre}
                  onClick={function () {
                    pedirEliminar(producto);
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

  // Título del formulario según sea crear o editar
  let tituloFormulario = "Nuevo producto";
  if (formulario && formulario.producto) {
    tituloFormulario = "Editar producto";
  }

  return (
    <div className="pagina">
      <div className="pagina-barra">
        <div className="buscador">
          <Icono nombre="buscar" />
          <input
            className="buscador-entrada"
            type="search"
            placeholder="Buscar por nombre o código"
            aria-label="Buscar producto"
            value={busqueda}
            onChange={function (evento) {
              setBusqueda(evento.target.value);
            }}
          />
        </div>
        {props.esAdmin && (
          <Boton
            variante="principal"
            icono="suma"
            alHacerClic={function () {
              setFormulario({ producto: null });
            }}
          >
            Nuevo
          </Boton>
        )}
      </div>

      {!props.esAdmin && <p className="campo-ayuda">Aquí consultas precios y existencias. Para cambiar un precio rápido, usa el lápiz del producto en la pantalla Vender.</p>}

      {contenido}

      {formulario && (
        <Modal
          titulo={tituloFormulario}
          ancho="amplio"
          alCerrar={function () {
            setFormulario(null);
          }}
        >
          <FormularioProducto
            modo="completo"
            producto={formulario.producto}
            categorias={props.categorias}
            alGuardar={alGuardar}
            alCancelar={function () {
              setFormulario(null);
            }}
            alIrACategorias={function () {
              setFormulario(null);
              props.irA("categorias");
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default Productos;
