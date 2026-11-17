// ---------------------------------------------------------------------------
// App.jsx: componente RAÍZ. Es el único que guarda el estado compartido:
//   - el usuario que inició sesión (y con él, su rol),
//   - los datos del backend (productos, categorías, clientes, proveedores y descuentos),
//   - la venta en curso (para que no se pierda al cambiar de pantalla),
//   - los avisos y el cuadro de confirmación,
//   - la pantalla actual ("vista").
// Las pantallas reciben lo que necesitan por props y avisan los cambios con funciones.
// ---------------------------------------------------------------------------
import { useState, useEffect } from "react";
import Encabezado from "./components/Encabezado.jsx";
import BarraNavegacion from "./components/BarraNavegacion.jsx";
import Avisos from "./components/Avisos.jsx";
import DialogoConfirmar from "./components/DialogoConfirmar.jsx";
import Cargando from "./components/Cargando.jsx";
import EsqueletoLista from "./components/EsqueletoLista.jsx";
import Boton from "./components/Boton.jsx";
import Icono from "./components/Icono.jsx";
import Login from "./pages/Login.jsx";
import Venta from "./pages/Venta.jsx";
import Historial from "./pages/Historial.jsx";
import Productos from "./pages/Productos.jsx";
import Compras from "./pages/Compras.jsx";
import Mas from "./pages/Mas.jsx";
import GestorEntidad from "./pages/GestorEntidad.jsx";
import Faltantes from "./pages/Faltantes.jsx";
import Reportes from "./pages/Reportes.jsx";
import { CONFIG_CATEGORIAS, CONFIG_PROVEEDORES, CONFIG_CLIENTES, CONFIG_DESCUENTOS } from "./pages/configEntidades.js";
import { leerRecurso } from "./api/datos.js";
import { registrarAvisoSesionVencida } from "./api/api.js";
import { recuperarSesion, cerrarSesion, esAdministrador } from "./servicios/sesion.js";
import { crearVentaNueva } from "./servicios/ventas.js";
import { reemplazarEnLista, contarUnidades } from "./utils/calculos.js";
import { nuevoId } from "./utils/ids.js";
import { DURACION_AVISO, INTERVALO_ACTUALIZACION } from "./config.js";

// Título que se muestra en el encabezado según la pantalla
const TITULOS = {
  venta: "Nueva venta",
  historial: "Ventas",
  productos: "Productos",
  compras: "Compras",
  mas: "Más opciones",
  categorias: "Categorías",
  proveedores: "Proveedores",
  clientes: "Clientes",
  descuentos: "Descuentos",
  faltantes: "Faltantes",
  reportes: "Reportes"
};

// Pantallas que SOLO puede abrir el administrador (matriz de permisos de la guía).
// El backend también lo revisa: esto es para no mostrar pantallas que darían error.
const VISTAS_DE_ADMINISTRADOR = ["compras", "categorias", "proveedores", "descuentos", "reportes"];

// Pantallas que viven dentro de "Más" (muestran el botón para volver a ese menú)
const VISTAS_DE_MAS = ["categorias", "proveedores", "clientes", "descuentos", "faltantes", "reportes"];

function App() {
  // ----- Sesión -----
  const [usuario, setUsuario] = useState(null); // null = nadie ha iniciado sesión
  const [revisandoSesion, setRevisandoSesion] = useState(true); // ¿estamos comprobando el token guardado?
  const [avisoLogin, setAvisoLogin] = useState(""); // texto que se muestra en la pantalla de login

  // ----- Estado de la aplicación (cada useState devuelve [valor, funciónParaCambiarlo]) -----
  const [vista, setVista] = useState("venta"); // pantalla actual

  // Datos que vienen del backend. Nada de esto está escrito a mano en el código.
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [descuentos, setDescuentos] = useState([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [errorDatos, setErrorDatos] = useState("");

  // La venta en curso vive aquí para no perderse al cambiar de pantalla
  const [ventaActual, setVentaActual] = useState(crearVentaNueva());

  // Venta que la pantalla Ventas debe abrir directo en modo corrección
  // (cuando el administrador toca "Corregir" justo después de cobrar)
  const [ventaPorCorregir, setVentaPorCorregir] = useState(null);

  // Avisos cortos y cuadro de confirmación
  const [avisos, setAvisos] = useState([]);
  const [confirmacion, setConfirmacion] = useState(null);

  const esAdmin = esAdministrador(usuario);

  // ----- Sesión: recuperar la que estaba guardada -----

  // Este efecto corre UNA vez, al abrir la aplicación (por eso la lista de dependencias está vacía)
  useEffect(function () {
    // Si api.js recibe un 401 (sesión vencida), nos avisa aquí para volver al login
    registrarAvisoSesionVencida(function () {
      setUsuario(null);
      setAvisoLogin("Tu sesión terminó. Inicia sesión de nuevo para continuar.");
    });

    // Si hay un token guardado y sigue vigente, entramos sin pedir la contraseña otra vez
    async function revisarSesionGuardada() {
      const usuarioGuardado = await recuperarSesion();
      setUsuario(usuarioGuardado);
      setRevisandoSesion(false);
    }
    revisarSesionGuardada();
  }, []);

  // Cuando el login sale bien: guardamos el usuario y empezamos en la pantalla de venta
  function alEntrar(usuarioActivo) {
    setAvisoLogin("");
    setCargandoDatos(true);
    setErrorDatos("");
    setVista("venta");
    setUsuario(usuarioActivo);
  }

  // Cierra la sesión y deja todo limpio para el siguiente usuario.
  // Las ventas guardadas NO se pierden: están en la base de datos.
  async function salir() {
    await cerrarSesion();
    setUsuario(null);
    setVentaActual(crearVentaNueva());
    setVentaPorCorregir(null);
    setAvisos([]);
    setAvisoLogin("");
  }

  // Botón "Cerrar sesión": si hay una venta en pantalla sin guardar, primero preguntamos
  function pedirSalir() {
    if (ventaActual.items.length === 0) {
      salir();
      return;
    }
    pedirConfirmacion({
      titulo: "¿Cerrar sesión?",
      mensaje: "Tienes una venta en pantalla. Si sales ahora se pierde lo que no hayas guardado. Para conservarla, cancela y toca \"Guardar para después\".",
      textoConfirmar: "Sí, cerrar sesión",
      peligro: true,
      alConfirmar: salir
    });
  }

  // ----- Carga de datos desde el backend -----

  // "versionCarga" cuenta las veces que pedimos leer el backend: cada vez que sube, el efecto de
  // abajo vuelve a ejecutarse. Así el botón "Reintentar" solo tiene que subirla.
  const [versionCarga, setVersionCarga] = useState(0);

  // Lee las cinco listas a la vez (Promise.all lanza las lecturas juntas y espera a que todas terminen)
  async function leerCatalogos() {
    const resultados = await Promise.all([
      leerRecurso("productos"),
      leerRecurso("categorias"),
      leerRecurso("clientes"),
      leerRecurso("proveedores"),
      leerRecurso("descuentos")
    ]);
    setProductos(resultados[0]);
    setCategorias(resultados[1]);
    setClientes(resultados[2]);
    setProveedores(resultados[3]);
    setDescuentos(resultados[4]);
  }

  // Carga inicial: se ejecuta cuando alguien inicia sesión y cada vez que cambia "versionCarga"
  useEffect(
    function () {
      if (!usuario) {
        return; // sin sesión no se puede leer nada
      }
      async function cargarDatosIniciales() {
        try {
          await leerCatalogos();
        } catch (error) {
          setErrorDatos(error.message);
        } finally {
          setCargandoDatos(false);
        }
      }
      cargarDatosIniciales();
    },
    [usuario, versionCarga]
  );

  // Actualización en silencio: vuelve a leer el catálogo sin mostrar "cargando".
  // Si falla (por ejemplo, se fue el internet un momento) no molestamos: se intenta en la próxima vuelta.
  async function refrescarDatos() {
    try {
      await leerCatalogos();
    } catch (error) {
      console.warn("No se pudo actualizar el catálogo:", error.message);
    }
  }

  // Actualización en tiempo real: mientras haya sesión, el catálogo se vuelve a leer cada
  // pocos segundos y también al volver a la pestaña. Así, cuando otra caja vende o el
  // administrador cambia un precio o registra una compra, todas las pantallas se enteran.
  useEffect(
    function () {
      if (!usuario) {
        return;
      }
      const reloj = setInterval(refrescarDatos, INTERVALO_ACTUALIZACION);
      window.addEventListener("focus", refrescarDatos);

      // La función que devolvemos apaga el reloj cuando se cierra la sesión
      return function () {
        clearInterval(reloj);
        window.removeEventListener("focus", refrescarDatos);
      };
    },
    [usuario]
  );

  // Botón "Reintentar": mostramos "cargando" otra vez y subimos la versión para que el efecto lea de nuevo
  function reintentarCarga() {
    setCargandoDatos(true);
    setErrorDatos("");
    setVersionCarga(versionCarga + 1);
  }

  // Cuando una venta, compra, corrección o reembolso cambia el stock, el backend devuelve los
  // productos actualizados: los ponemos en el catálogo de la pantalla sin tener que leer todo de nuevo.
  function actualizarProductos(productosCambiados) {
    setProductos(function (actuales) {
      let nuevos = actuales;
      productosCambiados.forEach(function (productoNuevo) {
        nuevos = reemplazarEnLista(nuevos, productoNuevo);
      });
      return nuevos;
    });
  }

  // ----- Avisos y confirmaciones (reemplazan a alert y confirm) -----

  // Quita un aviso de la lista
  function quitarAviso(id) {
    setAvisos(function (actuales) {
      return actuales.filter(function (aviso) {
        return aviso.id !== id;
      });
    });
  }

  // Muestra un aviso (tipo: "ok", "error" o "info") que desaparece solo después de unos segundos
  function mostrarAviso(texto, tipo) {
    const id = nuevoId();
    // Usamos la forma con función para partir siempre de la lista más reciente
    setAvisos(function (actuales) {
      return actuales.concat([{ id: id, texto: texto, tipo: tipo }]);
    });
    setTimeout(function () {
      quitarAviso(id);
    }, DURACION_AVISO);
  }

  // Abre el cuadro de confirmación con las opciones que le pasen (titulo, mensaje, alConfirmar...)
  function pedirConfirmacion(opciones) {
    setConfirmacion(opciones);
  }

  // ----- Navegación -----

  // Cambia de pantalla. Si un cajero intenta abrir una pantalla de administrador, no lo dejamos.
  function irA(nuevaVista) {
    if (!esAdmin && VISTAS_DE_ADMINISTRADOR.indexOf(nuevaVista) !== -1) {
      mostrarAviso("Esa sección es solo para el administrador.", "error");
      return;
    }
    setVista(nuevaVista);
  }

  // Lleva a la pantalla Ventas con una venta lista para corregir
  function irACorregir(venta) {
    setVentaPorCorregir(venta);
    setVista("historial");
  }

  // ----- Qué pantalla mostrar -----

  // 1. Mientras comprobamos si había una sesión guardada
  if (revisandoSesion) {
    return (
      <div className="login">
        <Cargando texto="Abriendo Papel y Luna…" />
      </div>
    );
  }

  // 2. Sin sesión: pantalla de inicio de sesión
  if (!usuario) {
    return <Login alEntrar={alEntrar} aviso={avisoLogin} />;
  }

  // 3. Con sesión: la aplicación
  let contenido;

  if (cargandoDatos) {
    // Mientras llegan los datos mostramos la ruedita y filas "fantasma" animadas
    contenido = (
      <div className="pagina">
        <Cargando texto="Trayendo tu catálogo…" />
        <EsqueletoLista filas={5} />
      </div>
    );
  } else if (errorDatos !== "") {
    contenido = (
      <div className="estado-error" role="alert">
        <Icono nombre="alerta" />
        <p className="estado-error-titulo">No pudimos cargar tus datos</p>
        <p>{errorDatos}</p>
        <Boton variante="principal" icono="recargar" alHacerClic={reintentarCarga}>
          Reintentar
        </Boton>
      </div>
    );
  } else if (vista === "venta") {
    contenido = (
      <Venta
        esAdmin={esAdmin}
        productos={productos}
        categorias={categorias}
        clientes={clientes}
        proveedores={proveedores}
        descuentos={descuentos}
        ventaActual={ventaActual}
        setVentaActual={setVentaActual}
        setProductos={setProductos}
        actualizarProductos={actualizarProductos}
        refrescarDatos={refrescarDatos}
        mostrarAviso={mostrarAviso}
        pedirConfirmacion={pedirConfirmacion}
        irA={irA}
        irACorregir={irACorregir}
      />
    );
  } else if (vista === "historial") {
    contenido = (
      <Historial
        esAdmin={esAdmin}
        productos={productos}
        clientes={clientes}
        descuentos={descuentos}
        ventaActual={ventaActual}
        setVentaActual={setVentaActual}
        ventaPorCorregir={ventaPorCorregir}
        limpiarVentaPorCorregir={function () {
          setVentaPorCorregir(null);
        }}
        actualizarProductos={actualizarProductos}
        refrescarDatos={refrescarDatos}
        irA={irA}
        mostrarAviso={mostrarAviso}
        pedirConfirmacion={pedirConfirmacion}
      />
    );
  } else if (vista === "productos") {
    contenido = (
      <Productos
        esAdmin={esAdmin}
        productos={productos}
        setProductos={setProductos}
        categorias={categorias}
        mostrarAviso={mostrarAviso}
        pedirConfirmacion={pedirConfirmacion}
        irA={irA}
      />
    );
  } else if (vista === "compras") {
    contenido = <Compras productos={productos} actualizarProductos={actualizarProductos} proveedores={proveedores} mostrarAviso={mostrarAviso} irA={irA} />;
  } else if (vista === "mas") {
    contenido = (
      <Mas
        irA={irA}
        esAdmin={esAdmin}
        usuario={usuario}
        alSalir={pedirSalir}
        cantidades={{ categorias: categorias.length, proveedores: proveedores.length, clientes: clientes.length, descuentos: descuentos.length }}
      />
    );
  } else if (vista === "categorias") {
    contenido = <GestorEntidad config={CONFIG_CATEGORIAS} lista={categorias} setLista={setCategorias} mostrarAviso={mostrarAviso} pedirConfirmacion={pedirConfirmacion} />;
  } else if (vista === "proveedores") {
    contenido = <GestorEntidad config={CONFIG_PROVEEDORES} lista={proveedores} setLista={setProveedores} mostrarAviso={mostrarAviso} pedirConfirmacion={pedirConfirmacion} />;
  } else if (vista === "clientes") {
    contenido = <GestorEntidad config={CONFIG_CLIENTES} lista={clientes} setLista={setClientes} mostrarAviso={mostrarAviso} pedirConfirmacion={pedirConfirmacion} />;
  } else if (vista === "descuentos") {
    contenido = <GestorEntidad config={CONFIG_DESCUENTOS} lista={descuentos} setLista={setDescuentos} mostrarAviso={mostrarAviso} pedirConfirmacion={pedirConfirmacion} />;
  } else if (vista === "faltantes") {
    contenido = <Faltantes esAdmin={esAdmin} productos={productos} proveedores={proveedores} mostrarAviso={mostrarAviso} pedirConfirmacion={pedirConfirmacion} />;
  } else if (vista === "reportes") {
    contenido = <Reportes />;
  }

  // Las pantallas que se abren desde "Más" muestran un botón para volver a ese menú
  const esPantallaDeMas = VISTAS_DE_MAS.indexOf(vista) !== -1;

  return (
    <div className="aplicacion">
      <Encabezado titulo={TITULOS[vista]} usuario={usuario} alSalir={pedirSalir} />

      <BarraNavegacion vista={vista} alCambiar={irA} esAdmin={esAdmin} unidadesEnVenta={contarUnidades(ventaActual.items)} />

      <main className="contenido">
        {esPantallaDeMas && (
          <button
            type="button"
            className="volver-catalogo volver-visible"
            onClick={function () {
              setVista("mas");
            }}
          >
            <Icono nombre="atras" />
            Volver a Más opciones
          </button>
        )}

        {contenido}
      </main>

      <Avisos avisos={avisos} alQuitar={quitarAviso} />

      {confirmacion && (
        <DialogoConfirmar
          confirmacion={confirmacion}
          alCerrar={function () {
            setConfirmacion(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
