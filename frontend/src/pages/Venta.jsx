// ---------------------------------------------------------------------------
// Venta.jsx: pantalla principal para vender.
//   - Catálogo con buscador y filtro por categoría (los productos vienen del backend).
//   - "Recibo": la venta en curso, con cantidades, descuento, totales y cliente.
//   - Guardar la venta para después (queda "abierta" en el backend), o cobrarla.
//   - "Ventas en espera": atender a varios clientes a la vez. Las ventas guardadas aparecen
//     arriba del catálogo y con un toque se cambia de una a otra (la que estaba en pantalla
//     se guarda sola). Se ven desde todos los dispositivos.
//   - Editar un producto sin salir de la venta (nombre, categoría, precio y costo).
//   - Anotar un faltante cuando el cliente pide algo agotado o que no vendemos.
// En el celular se ve UN panel a la vez (catálogo o recibo) para que todo quepa;
// en pantallas grandes se ven los dos lado a lado.
// Props: esAdmin, productos, categorias, clientes, proveedores, descuentos, ventaActual,
//        setVentaActual, setProductos, actualizarProductos, refrescarDatos,
//        mostrarAviso, pedirConfirmacion, irA, irACorregir.
// ---------------------------------------------------------------------------
import { useState, useEffect } from "react";
import Boton from "../components/Boton.jsx";
import Icono from "../components/Icono.jsx";
import Modal from "../components/Modal.jsx";
import EstadoVacio from "../components/EstadoVacio.jsx";
import ModalCobro from "../components/ModalCobro.jsx";
import ModalVentaCerrada from "../components/ModalVentaCerrada.jsx";
import FormularioProducto from "../components/FormularioProducto.jsx";
import FormularioFaltante from "../components/FormularioFaltante.jsx";
import { leerRecurso } from "../api/datos.js";
import { INTERVALO_ACTUALIZACION } from "../config.js";
import { formatearPrecio, formatearHora, aEntero, textoCantidad } from "../utils/formato.js";
import { sonIguales } from "../utils/ids.js";
import { describirItems, calcularTotales, contarUnidades, buscarPorId, nombreDe, reemplazarEnLista, describirDescuento } from "../utils/calculos.js";
import { crearVentaNueva, guardarVentaAbierta, cerrarVenta, ventaParaPantalla } from "../servicios/ventas.js";

function Venta(props) {
  const ventaActual = props.ventaActual;

  // Estados propios de esta pantalla (cada useState devuelve [valor, funciónParaCambiarlo])
  const [busqueda, setBusqueda] = useState(""); // texto del buscador
  const [categoriaFiltro, setCategoriaFiltro] = useState(""); // "" = todas las categorías
  // En el celular: "catalogo" o "venta". Si venimos de retomar una venta guardada, abrimos directo en la venta.
  let panelInicial = "catalogo";
  if (ventaActual.guardada && ventaActual.items.length > 0) {
    panelInicial = "venta";
  }
  const [panel, setPanel] = useState(panelInicial);
  const [productoEditando, setProductoEditando] = useState(null); // producto que se está editando
  const [mostrandoCobro, setMostrandoCobro] = useState(false); // ¿está abierto el cobro?
  const [ventaCerrada, setVentaCerrada] = useState(null); // resultado del último cobro
  const [guardando, setGuardando] = useState(false); // ¿se está guardando la venta abierta?
  // Faltante que se está anotando: null = cerrado; { producto, texto } = formulario abierto
  const [faltante, setFaltante] = useState(null);
  // Ventas en espera: las ventas ABIERTAS guardadas en el backend (por esta caja o por otra)
  const [enEspera, setEnEspera] = useState([]);
  const [cambiandoVenta, setCambiandoVenta] = useState(false); // ¿se está cambiando de venta?

  // ----- Cálculos de la venta en curso (se rehacen en cada cambio) -----
  const lineas = describirItems(ventaActual.items, props.productos);
  // Descuento elegido para esta venta (null si no hay, o si lo eliminaron del catálogo)
  let descuento = null;
  if (ventaActual.descuentoId !== "") {
    const encontradoEnCatalogo = buscarPorId(props.descuentos, ventaActual.descuentoId);
    if (encontradoEnCatalogo) {
      descuento = encontradoEnCatalogo;
    }
  }
  const totales = calcularTotales(lineas, descuento);
  const unidades = contarUnidades(ventaActual.items);

  // ----- Ventas en espera (atender a varios clientes a la vez) -----

  // Lee del backend las ventas abiertas. Si falla no molestamos: se intenta en la próxima vuelta.
  async function leerEnEspera() {
    try {
      const lista = await leerRecurso("ventas", "?estado=abierta");
      setEnEspera(lista);
    } catch (error) {
      console.warn("No se pudieron leer las ventas en espera:", error.message);
    }
  }

  // Al abrir la pantalla leemos las ventas en espera, y luego cada pocos segundos
  // (así aparecen también las que guardó otra caja).
  useEffect(function () {
    leerEnEspera();
    const reloj = setInterval(leerEnEspera, INTERVALO_ACTUALIZACION);
    // Al salir de la pantalla apagamos el reloj
    return function () {
      clearInterval(reloj);
    };
  }, []);

  // Las ventas en espera que se muestran: todas menos la que ya está en pantalla
  const otrasEnEspera = enEspera.filter(function (venta) {
    return !sonIguales(venta.id, ventaActual.id);
  });

  // Cambia a otra venta en espera. Si la venta en pantalla tiene productos, primero se
  // guarda sola (queda en espera) para no perder nada.
  async function cambiarAVenta(ventaElegida) {
    if (cambiandoVenta || guardando) {
      return; // evita toques repetidos
    }

    if (ventaActual.items.length > 0) {
      const problema = revisarVenta();
      if (problema !== "") {
        props.mostrarAviso("Antes de cambiar de venta: " + problema, "error");
        return;
      }
    }

    setCambiandoVenta(true);
    try {
      if (ventaActual.items.length > 0) {
        await guardarVentaAbierta(ventaActual);
      }
      props.setVentaActual(ventaParaPantalla(ventaElegida));
      setPanel("venta");
      await leerEnEspera();
    } catch (error) {
      props.mostrarAviso("No se pudo cambiar de venta: " + error.message, "error");
    } finally {
      setCambiandoVenta(false);
    }
  }

  // ----- Manejo del carrito -----

  // Busca la línea de un producto dentro de la venta (undefined si no está)
  function buscarItem(productoId) {
    return ventaActual.items.find(function (item) {
      return sonIguales(item.productoId, productoId);
    });
  }

  // Reemplaza la lista de líneas de la venta (siempre con una copia nueva)
  function guardarItems(nuevosItems) {
    props.setVentaActual(Object.assign({}, ventaActual, { items: nuevosItems }));
  }

  // Agrega 1 unidad del producto (respetando el stock cuando hay seguimiento de inventario)
  function agregarProducto(producto) {
    const itemExistente = buscarItem(producto.id);

    let cantidadNueva = 1;
    if (itemExistente) {
      cantidadNueva = itemExistente.cantidad + 1;
    }

    // Si el producto lleva inventario y no alcanza, avisamos y no agregamos
    if (producto.seguimientoInventario && cantidadNueva > producto.stock) {
      props.mostrarAviso("Solo quedan " + textoCantidad(producto.stock, "unidad", "unidades") + " de " + producto.nombre + ".", "error");
      return;
    }

    if (itemExistente) {
      fijarCantidad(producto.id, cantidadNueva);
    } else {
      guardarItems(ventaActual.items.concat([{ productoId: producto.id, nombre: producto.nombre, cantidad: 1 }]));
    }
  }

  // Cambia la cantidad de una línea. Si piden más de lo que hay en stock, deja el máximo posible.
  function fijarCantidad(productoId, cantidad) {
    const producto = buscarPorId(props.productos, productoId);

    let cantidadFinal = cantidad;
    if (producto && producto.seguimientoInventario && cantidad > producto.stock) {
      cantidadFinal = producto.stock;
      props.mostrarAviso("Solo quedan " + textoCantidad(producto.stock, "unidad", "unidades") + " de " + producto.nombre + ".", "error");
    }

    const nuevosItems = ventaActual.items.map(function (item) {
      if (sonIguales(item.productoId, productoId)) {
        return { productoId: item.productoId, nombre: item.nombre, cantidad: cantidadFinal };
      }
      return item;
    });
    guardarItems(nuevosItems);
  }

  // Quita una línea de la venta
  function quitarLinea(productoId) {
    const nuevosItems = ventaActual.items.filter(function (item) {
      return !sonIguales(item.productoId, productoId);
    });
    guardarItems(nuevosItems);
  }

  // Botón "−": baja 1; si queda en 0, quita la línea
  function bajarCantidad(linea) {
    if (linea.cantidad <= 1) {
      quitarLinea(linea.productoId);
    } else {
      fijarCantidad(linea.productoId, linea.cantidad - 1);
    }
  }

  // Si dejan la cantidad vacía (0) y salen del campo, volvemos a 1
  function corregirCantidadVacia(linea) {
    if (linea.cantidad < 1) {
      fijarCantidad(linea.productoId, 1);
    }
  }

  // Cambia el cliente asociado a la venta
  function cambiarCliente(evento) {
    props.setVentaActual(Object.assign({}, ventaActual, { clienteId: evento.target.value }));
  }

  // Cambia el descuento de la venta (solo uno por venta; "" = sin descuento)
  function cambiarDescuento(evento) {
    props.setVentaActual(Object.assign({}, ventaActual, { descuentoId: evento.target.value }));
  }

  // ----- Revisiones antes de guardar o cobrar -----

  // Devuelve "" si la venta se puede guardar/cobrar, o el motivo si no
  function revisarVenta() {
    if (ventaActual.items.length === 0) {
      return "Agrega al menos un producto a la venta.";
    }
    for (let i = 0; i < lineas.length; i++) {
      if (lineas[i].cantidad < 1) {
        return "Revisa las cantidades: \"" + lineas[i].nombre + "\" está en 0.";
      }
      if (!lineas[i].producto) {
        return "El producto \"" + lineas[i].nombre + "\" ya no existe en el catálogo. Quítalo de la venta.";
      }
    }
    // Regla: un descuento no puede dejar el total en negativo
    if (totales.descuentoExcede) {
      return "El descuento es mayor que el total de la venta. Quítalo o agrega más productos.";
    }
    return "";
  }

  // ----- Acciones de la venta -----

  // Guarda la venta con estado "abierta" en el backend (no descuenta stock) y deja una venta nueva lista.
  // Así se puede atender a otro cliente mientras el primero decide, y retomarla desde Ventas.
  async function guardarParaDespues() {
    if (guardando) {
      return; // evita envíos duplicados
    }
    const problema = revisarVenta();
    if (problema !== "") {
      props.mostrarAviso(problema, "error");
      return;
    }

    setGuardando(true);
    try {
      await guardarVentaAbierta(ventaActual);
      props.setVentaActual(crearVentaNueva());
      setPanel("catalogo");
      props.mostrarAviso("Venta en espera. Para retomarla, tócala arriba del catálogo (o en Ventas, pestaña Abiertas).", "ok");
      leerEnEspera(); // la venta recién guardada aparece en la franja de ventas en espera
    } catch (error) {
      props.mostrarAviso("No se pudo guardar la venta: " + error.message, "error");
    } finally {
      setGuardando(false);
    }
  }

  // Abre la ventana de cobro (si la venta está lista)
  function abrirCobro() {
    const problema = revisarVenta();
    if (problema !== "") {
      props.mostrarAviso(problema, "error");
      return;
    }
    setMostrandoCobro(true);
  }

  // Lo llama el modal de cobro al confirmar: cierra la venta en el backend y actualiza la pantalla.
  // El backend hace todo en una transacción (venta + inventario). Si algo falla, no queda nada a medias.
  async function cobrarVenta(pago) {
    let resultado;
    try {
      resultado = await cerrarVenta(ventaActual, pago, totales.total);
    } catch (error) {
      // Si falló porque cambió el stock o un precio (otra caja vendió, el administrador editó...),
      // traemos los datos más recientes para que el cajero vea la situación real.
      props.refrescarDatos();
      throw error; // el modal de cobro muestra el mensaje
    }

    // El inventario cambió: el backend devuelve los productos con su stock nuevo
    props.actualizarProductos(resultado.productos);

    setMostrandoCobro(false);
    setVentaCerrada({ venta: resultado.venta, clienteId: pago.clienteId });
    leerEnEspera(); // si la venta cobrada estaba en espera, ya no debe aparecer ahí
    props.setVentaActual(crearVentaNueva());
    setPanel("catalogo");
  }

  // Empieza una venta nueva (pide confirmación si la actual tiene productos)
  function empezarDeNuevo() {
    if (ventaActual.items.length === 0) {
      props.setVentaActual(crearVentaNueva());
      return;
    }
    props.pedirConfirmacion({
      titulo: "¿Empezar una venta nueva?",
      mensaje: "Se descartará lo que llevas en esta venta. Si prefieres conservarla, cancela y toca primero \"Guardar para después\".",
      textoConfirmar: "Sí, empezar de nuevo",
      peligro: true,
      alConfirmar: async function () {
        props.setVentaActual(crearVentaNueva());
        setPanel("catalogo");
      }
    });
  }

  // Después de editar un producto: reemplazamos el producto en el catálogo.
  // Como la venta se calcula con los datos ACTUALES del catálogo, el recibo se actualiza solo.
  function alGuardarProducto(productoNuevo) {
    props.setProductos(function (actuales) {
      return reemplazarEnLista(actuales, productoNuevo);
    });
    setProductoEditando(null);
    props.mostrarAviso("Producto actualizado. Ya se refleja en el catálogo y en la venta.", "ok");
  }

  // ----- Preparación de lo que se dibuja -----

  // Productos que coinciden con el buscador y el filtro de categoría
  const textoBusqueda = busqueda.trim().toLowerCase();
  const productosVisibles = props.productos.filter(function (producto) {
    if (categoriaFiltro !== "" && !sonIguales(producto.categoriaId, categoriaFiltro)) {
      return false;
    }
    if (textoBusqueda === "") {
      return true;
    }
    return producto.nombre.toLowerCase().includes(textoBusqueda) || producto.codigo.toLowerCase().includes(textoBusqueda);
  });

  // Contenido de la lista de productos (o un mensaje si no hay nada que mostrar)
  let listaProductos;
  if (props.productos.length === 0) {
    listaProductos = (
      <EstadoVacio
        icono="caja"
        titulo="Aún no hay productos en el catálogo"
        texto="Crea tu primer producto para empezar a vender."
        textoBoton="Ir a Productos"
        alHacerClic={function () {
          props.irA("productos");
        }}
      />
    );
  } else if (productosVisibles.length === 0) {
    // No hay resultados: quizá el cliente pide algo que no vendemos. Ofrecemos anotarlo como faltante.
    listaProductos = (
      <EstadoVacio
        icono="buscar"
        titulo="No encontramos productos"
        texto="Prueba con otro nombre o quita el filtro. Si el cliente pide algo que no vendemos, anótalo como faltante."
        textoBoton="Anotar como faltante"
        alHacerClic={function () {
          setFaltante({ producto: null, texto: busqueda.trim() });
        }}
      />
    );
  } else {
    listaProductos = (
      <ul className="lista-productos">
        {productosVisibles.map(function (producto) {
          const itemEnVenta = buscarItem(producto.id);
          const agotado = producto.seguimientoInventario && producto.stock <= 0;

          // Etiqueta de stock: solo para productos con seguimiento de inventario
          let textoStock = "";
          let claseStock = "etiqueta";
          if (producto.seguimientoInventario) {
            if (producto.stock <= 0) {
              textoStock = "Agotado";
              claseStock = "etiqueta etiqueta-agotado";
            } else if (producto.stock <= 5) {
              textoStock = "Quedan " + producto.stock;
              claseStock = "etiqueta etiqueta-poco";
            } else {
              textoStock = producto.stock + " en stock";
            }
          }

          return (
            <li className="producto-fila" key={producto.id}>
              <div className="producto-info">
                <p className="producto-nombre">{producto.nombre}</p>
                <p className="producto-detalle">
                  <span>{nombreDe(props.categorias, producto.categoriaId, "Sin categoría")}</span>
                  <span className="producto-codigo">{producto.codigo}</span>
                </p>
                <div className="producto-etiquetas">
                  {textoStock !== "" && <span className={claseStock}>{textoStock}</span>}
                  {itemEnVenta && <span className="etiqueta etiqueta-en-venta">En la venta: {itemEnVenta.cantidad}</span>}
                </div>
                {/* Producto agotado: se puede dejar anotado que un cliente lo pidió */}
                {agotado && (
                  <button
                    type="button"
                    className="enlace"
                    onClick={function () {
                      setFaltante({ producto: producto, texto: "" });
                    }}
                  >
                    Anotar faltante
                  </button>
                )}
              </div>
              <div className="producto-lado">
                <p className="producto-precio">{formatearPrecio(producto.precio)}</p>
                <div className="producto-botones">
                  <button
                    type="button"
                    className="boton-icono"
                    aria-label={"Editar " + producto.nombre}
                    onClick={function () {
                      setProductoEditando(producto);
                    }}
                  >
                    <Icono nombre="editar" />
                  </button>
                  <Boton
                    variante="principal"
                    icono="suma"
                    deshabilitado={agotado}
                    alHacerClic={function () {
                      agregarProducto(producto);
                    }}
                  >
                    Agregar
                  </Boton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  // Contenido del recibo: las líneas de la venta (o una invitación si está vacía)
  let contenidoLineas;
  if (lineas.length === 0) {
    contenidoLineas = (
      <div className="recibo-vacio">
        <p>Tu venta está vacía.</p>
        <p>Toca <strong>Agregar</strong> en un producto para empezar.</p>
      </div>
    );
  } else {
    contenidoLineas = (
      <ul className="recibo-lineas">
        {lineas.map(function (linea) {
          // Si el producto ya no existe, mostramos la línea en rojo con un aviso
          let claseLinea = "recibo-linea";
          if (!linea.producto) {
            claseLinea = "recibo-linea recibo-linea-error";
          }

          // Valor del campo de cantidad: si está en 0 se muestra vacío (mientras la persona escribe)
          let valorCantidad = String(linea.cantidad);
          if (linea.cantidad === 0) {
            valorCantidad = "";
          }

          return (
            <li className={claseLinea} key={linea.productoId}>
              <div className="recibo-linea-info">
                <p className="recibo-linea-nombre">{linea.nombre}</p>
                {linea.producto && <p className="recibo-linea-precio">{formatearPrecio(linea.precio)} c/u</p>}
                {!linea.producto && <p className="recibo-linea-precio">Este producto ya no existe</p>}
              </div>

              <div className="cantidad">
                <button
                  type="button"
                  className="cantidad-boton"
                  aria-label={"Quitar una unidad de " + linea.nombre}
                  onClick={function () {
                    bajarCantidad(linea);
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
                    fijarCantidad(linea.productoId, aEntero(evento.target.value));
                  }}
                  onBlur={function () {
                    corregirCantidadVacia(linea);
                  }}
                />
                <button
                  type="button"
                  className="cantidad-boton"
                  aria-label={"Agregar una unidad de " + linea.nombre}
                  disabled={!linea.producto}
                  onClick={function () {
                    fijarCantidad(linea.productoId, linea.cantidad + 1);
                  }}
                >
                  <Icono nombre="suma" />
                </button>
              </div>

              <p className="recibo-linea-subtotal">{formatearPrecio(linea.subtotal)}</p>
              <button
                type="button"
                className="boton-icono boton-icono-peligro"
                aria-label={"Quitar " + linea.nombre + " de la venta"}
                onClick={function () {
                  quitarLinea(linea.productoId);
                }}
              >
                <Icono nombre="papelera" />
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  // Clase del contenedor: decide qué panel se ve en el celular
  const clasePantalla = "venta-pantalla panel-" + panel;

  // Clase del botón "Todas" del filtro (se ve activo cuando no hay categoría elegida)
  let claseChipTodas = "chip";
  if (categoriaFiltro === "") {
    claseChipTodas = "chip chip-activo";
  }

  // Texto del botón de cobrar: incluye el total cuando ya hay productos
  let textoCobrar = "Cobrar";
  if (lineas.length > 0) {
    textoCobrar = "Cobrar " + formatearPrecio(totales.total);
  }

  // Cliente que se asoció a la venta cerrada (para la factura)
  let clienteDeVentaCerrada = null;
  if (ventaCerrada) {
    const encontrado = buscarPorId(props.clientes, ventaCerrada.clienteId);
    if (encontrado) {
      clienteDeVentaCerrada = encontrado;
    }
  }

  return (
    <div className={clasePantalla}>
      {/* ================= PANEL 1: CATÁLOGO ================= */}
      <section className="venta-catalogo" aria-label="Catálogo de productos">
        {/* Ventas en espera: un botón por cada venta guardada. Tocar uno cambia a esa venta. */}
        {otrasEnEspera.length > 0 && (
          <div className="espera" aria-label="Ventas en espera">
            <p className="espera-titulo">
              <Icono nombre="recibo" />
              {textoCantidad(otrasEnEspera.length, "venta en espera", "ventas en espera")}
            </p>
            <div className="espera-lista">
              {otrasEnEspera.map(function (venta) {
                return (
                  <button
                    type="button"
                    key={venta.id}
                    className="espera-venta"
                    disabled={cambiandoVenta}
                    onClick={function () {
                      cambiarAVenta(venta);
                    }}
                  >
                    <span className="espera-venta-nombre">{nombreDe(props.clientes, venta.clienteId, "Mostrador")}</span>
                    <span className="espera-venta-detalle">
                      {formatearHora(venta.fecha)}, {textoCantidad(venta.items.length, "producto", "productos")}
                    </span>
                    <span className="espera-venta-total">{formatearPrecio(venta.total)}</span>
                  </button>
                );
              })}
            </div>
            {ventaActual.items.length > 0 && <p className="campo-ayuda">Al tocar una, la venta que tienes en pantalla se guarda sola en espera.</p>}
          </div>
        )}

        {/* Buscador */}
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

        {/* Filtro por categoría: botones horizontales que se desplazan */}
        {props.categorias.length > 0 && (
          <div className="chips" role="group" aria-label="Filtrar por categoría">
            <button
              type="button"
              className={claseChipTodas}
              aria-pressed={categoriaFiltro === ""}
              onClick={function () {
                setCategoriaFiltro("");
              }}
            >
              Todas
            </button>
            {props.categorias.map(function (categoria) {
              const activa = sonIguales(categoria.id, categoriaFiltro);
              let claseChip = "chip";
              if (activa) {
                claseChip = "chip chip-activo";
              }
              return (
                <button
                  type="button"
                  key={categoria.id}
                  className={claseChip}
                  aria-pressed={activa}
                  onClick={function () {
                    setCategoriaFiltro(categoria.id);
                  }}
                >
                  {categoria.nombre}
                </button>
              );
            })}
          </div>
        )}

        {listaProductos}
      </section>

      {/* ================= PANEL 2: RECIBO DE LA VENTA ================= */}
      <section className="venta-recibo" aria-label="Venta actual">
        {/* Solo en el celular: botón para volver al catálogo */}
        <button
          type="button"
          className="volver-catalogo"
          onClick={function () {
            setPanel("catalogo");
          }}
        >
          <Icono nombre="atras" />
          Seguir agregando productos
        </button>

        <div className="recibo">
          <div className="recibo-encabezado">
            <h2 className="recibo-titulo">Venta actual</h2>
            {ventaActual.guardada && <span className="etiqueta etiqueta-en-venta">Guardada antes</span>}
          </div>

          {contenidoLineas}

          {/* Totales (solo si hay líneas) */}
          {lineas.length > 0 && (
            <div className="recibo-totales">
              <p>
                <span>Subtotal</span>
                <span>{formatearPrecio(totales.subtotal)}</span>
              </p>
              <p>
                <span>IVA</span>
                <span>{formatearPrecio(totales.iva)}</span>
              </p>
              {descuento && (
                <p className="recibo-descuento">
                  <span>Descuento ({describirDescuento(descuento.tipo, descuento.valor)})</span>
                  <span>− {formatearPrecio(totales.descuento)}</span>
                </p>
              )}
              <p className="recibo-total">
                <span>Total</span>
                <span>{formatearPrecio(totales.total)}</span>
              </p>
            </div>
          )}

          {/* Descuento (opcional, uno por venta). Solo aparece si hay descuentos en el catálogo. */}
          {props.descuentos.length > 0 && (
            <label className="campo recibo-cliente">
              <span className="campo-etiqueta">Descuento (opcional)</span>
              <select className="entrada" value={ventaActual.descuentoId} onChange={cambiarDescuento}>
                <option value="">Sin descuento</option>
                {props.descuentos.map(function (opcion) {
                  return (
                    <option key={opcion.id} value={opcion.id}>
                      {opcion.nombre} ({describirDescuento(opcion.tipo, opcion.valor)})
                    </option>
                  );
                })}
              </select>
            </label>
          )}
          {totales.descuentoExcede && (
            <p className="mensaje-error" role="alert">
              El descuento es mayor que el total de la venta. Quítalo o agrega más productos.
            </p>
          )}

          {/* Cliente (opcional) */}
          <label className="campo recibo-cliente">
            <span className="campo-etiqueta">Cliente (opcional)</span>
            <select className="entrada" value={ventaActual.clienteId} onChange={cambiarCliente}>
              <option value="">Sin cliente (mostrador)</option>
              {props.clientes.map(function (cliente) {
                return (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}
                  </option>
                );
              })}
            </select>
          </label>

          {/* Acciones de la venta */}
          <div className="recibo-acciones">
            <Boton variante="principal" ancho={true} alHacerClic={abrirCobro} deshabilitado={guardando}>
              {textoCobrar}
            </Boton>
            <Boton variante="secundario" ancho={true} alHacerClic={guardarParaDespues} cargando={guardando} textoCargando="Guardando…">
              Guardar para después
            </Boton>
            <Boton variante="suave" ancho={true} alHacerClic={empezarDeNuevo} deshabilitado={guardando}>
              Empezar de nuevo
            </Boton>
          </div>
        </div>
      </section>

      {/* ================= BARRA INFERIOR (solo celular, panel catálogo) ================= */}
      {unidades > 0 && (
        <button
          type="button"
          className="barra-venta"
          onClick={function () {
            setPanel("venta");
          }}
        >
          <span className="barra-venta-info">
            <Icono nombre="carrito" />
            {textoCantidad(unidades, "unidad", "unidades")}
          </span>
          <span className="barra-venta-total">{formatearPrecio(totales.total)}</span>
          <span className="barra-venta-accion">Ver venta</span>
        </button>
      )}

      {/* ================= VENTANAS ================= */}
      {productoEditando && (
        <Modal
          titulo="Editar producto"
          alCerrar={function () {
            setProductoEditando(null);
          }}
        >
          <FormularioProducto
            modo="venta"
            producto={productoEditando}
            categorias={props.categorias}
            alGuardar={alGuardarProducto}
            alCancelar={function () {
              setProductoEditando(null);
            }}
            alIrACategorias={function () {
              setProductoEditando(null);
              props.irA("categorias");
            }}
          />
        </Modal>
      )}

      {/* Formulario para anotar un faltante sin salir de la venta */}
      {faltante && (
        <Modal
          titulo="Anotar faltante"
          alCerrar={function () {
            setFaltante(null);
          }}
        >
          <FormularioFaltante
            productos={props.productos}
            proveedores={props.proveedores}
            productoInicial={faltante.producto}
            textoInicial={faltante.texto}
            alGuardado={function () {
              setFaltante(null);
              props.mostrarAviso("Faltante anotado. Lo encuentras en Más, Faltantes.", "ok");
            }}
            alCancelar={function () {
              setFaltante(null);
            }}
          />
        </Modal>
      )}

      {mostrandoCobro && (
        <ModalCobro
          total={totales.total}
          descuento={totales.descuento}
          nombreDescuento={descuento ? descuento.nombre : ""}
          clientes={props.clientes}
          clienteIdInicial={ventaActual.clienteId}
          alConfirmar={cobrarVenta}
          alCerrar={function () {
            setMostrandoCobro(false);
          }}
          alIrAClientes={function () {
            setMostrandoCobro(false);
            props.irA("clientes");
          }}
        />
      )}

      {ventaCerrada && (
        <ModalVentaCerrada
          venta={ventaCerrada.venta}
          cliente={clienteDeVentaCerrada}
          esAdmin={props.esAdmin}
          alNuevaVenta={function () {
            setVentaCerrada(null);
          }}
          alCorregir={function () {
            // Lleva a la pantalla Ventas con esta venta abierta en modo corrección
            props.irACorregir(ventaCerrada.venta);
          }}
          alCerrar={function () {
            setVentaCerrada(null);
          }}
        />
      )}
    </div>
  );
}

export default Venta;
