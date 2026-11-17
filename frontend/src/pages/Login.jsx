// ---------------------------------------------------------------------------
// Login.jsx: pantalla de inicio de sesión. Es lo primero que se ve si no hay
// una sesión activa. Envía usuario y contraseña al backend; si son correctos,
// avisa a App.jsx con el usuario (que trae su rol: administrador o cajero).
// Props: alEntrar(usuario), aviso (texto opcional, por ejemplo "Tu sesión terminó").
// ---------------------------------------------------------------------------
import { useState } from "react";
import Boton from "../components/Boton.jsx";
import Campo from "../components/Campo.jsx";
import { iniciarSesion } from "../servicios/sesion.js";
import { NOMBRE_NEGOCIO, TIPO_NEGOCIO } from "../config.js";

function Login(props) {
  // Estados del formulario (cada useState devuelve [valor, funciónParaCambiarlo])
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false); // ¿mostrar la contraseña escrita?
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);

  // Se ejecuta al enviar el formulario (botón Entrar o tecla Enter)
  async function entrar(evento) {
    evento.preventDefault(); // evita que el navegador recargue la página
    if (entrando) {
      return; // evita envíos duplicados
    }

    if (usuario.trim() === "" || clave === "") {
      setError("Escribe tu usuario y tu contraseña.");
      return;
    }

    setError("");
    setEntrando(true);
    try {
      const usuarioActivo = await iniciarSesion(usuario.trim(), clave);
      props.alEntrar(usuarioActivo); // App.jsx cambia a la aplicación
    } catch (falla) {
      setError(falla.message);
      setEntrando(false);
    }
  }

  // El campo de la contraseña cambia de tipo para mostrarla u ocultarla
  let tipoClave = "password";
  if (verClave) {
    tipoClave = "text";
  }

  return (
    <div className="login">
      <div className="login-caja">
        <header className="login-cabecera">
          <img className="login-logo" src={import.meta.env.BASE_URL + "logo-papel-y-luna.png"} alt="Logo de Papel y Luna" />
          <h1 className="login-negocio">{NOMBRE_NEGOCIO}</h1>
          <p className="login-tipo">{TIPO_NEGOCIO}</p>
        </header>

        {/* Aviso que llega de App.jsx (por ejemplo, cuando la sesión venció) */}
        {props.aviso && <p className="mensaje-ayuda">{props.aviso}</p>}

        <form className="formulario" onSubmit={entrar} noValidate>
          <Campo etiqueta="Usuario">
            <input
              className="entrada"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              value={usuario}
              disabled={entrando}
              onChange={function (evento) {
                setUsuario(evento.target.value);
                setError("");
              }}
            />
          </Campo>

          <Campo etiqueta="Contraseña">
            <input
              className="entrada"
              type={tipoClave}
              autoComplete="current-password"
              value={clave}
              disabled={entrando}
              onChange={function (evento) {
                setClave(evento.target.value);
                setError("");
              }}
            />
          </Campo>

          <label className="casilla">
            <input
              type="checkbox"
              checked={verClave}
              onChange={function (evento) {
                setVerClave(evento.target.checked);
              }}
            />
            <span>Mostrar la contraseña</span>
          </label>

          {error !== "" && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}

          <Boton tipo="submit" variante="principal" ancho={true} icono="candado" cargando={entrando} textoCargando="Entrando…">
            Iniciar sesión
          </Boton>
        </form>
      </div>
    </div>
  );
}

export default Login;
