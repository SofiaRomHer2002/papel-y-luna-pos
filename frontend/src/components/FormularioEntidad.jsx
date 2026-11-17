// ---------------------------------------------------------------------------
// FormularioEntidad.jsx: formulario para crear o editar una categoría, un proveedor,
// un cliente o un descuento. Es UN solo formulario que se adapta con la "config" de cada
// pantalla (qué recurso es y qué campos tiene), así no repetimos el mismo código.
// Tipos de campo: texto, teléfono, correo, "numero" (solo dígitos) y "select" (lista de opciones).
// Props: config, registro (null = crear), alGuardar(registro), alCancelar.
// ---------------------------------------------------------------------------
import { useState } from "react";
import Boton from "./Boton.jsx";
import Campo from "./Campo.jsx";
import { crearRecurso, actualizarRecurso } from "../api/datos.js";
import { nuevoId } from "../utils/ids.js";
import { validarEntidad } from "../utils/validaciones.js";
import { aEntero, soloDigitos } from "../utils/formato.js";

function FormularioEntidad(props) {
  const config = props.config;
  const registro = props.registro;

  // Armamos los valores iniciales: un texto por cada campo de la config
  const valoresIniciales = {};
  config.campos.forEach(function (campo) {
    if (registro) {
      // String(...) porque los <input> trabajan con texto (el valor de un descuento llega como número)
      valoresIniciales[campo.clave] = String(registro[campo.clave]);
    } else if (campo.tipo === "select") {
      // En las listas dejamos elegida la primera opción
      valoresIniciales[campo.clave] = campo.opciones[0].valor;
    } else {
      valoresIniciales[campo.clave] = "";
    }
  });

  const [valores, setValores] = useState(valoresIniciales);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Se ejecuta al enviar el formulario
  async function guardar(evento) {
    evento.preventDefault();
    if (guardando) {
      return; // evita envíos duplicados
    }

    // 1. Validamos
    let problema = validarEntidad(valores, config.campos);
    // Algunas entidades tienen una regla propia (los descuentos: el porcentaje no pasa de 100)
    if (problema === "" && config.validarExtra) {
      problema = config.validarExtra(valores);
    }
    if (problema !== "") {
      setError(problema);
      return;
    }

    // 2. Limpiamos los espacios sobrantes de cada texto (los campos "numero" se envían como número)
    const datos = {};
    config.campos.forEach(function (campo) {
      const texto = String(valores[campo.clave]).trim();
      if (campo.tipo === "numero") {
        datos[campo.clave] = aEntero(texto);
      } else {
        datos[campo.clave] = texto;
      }
    });

    setError("");
    setGuardando(true);

    try {
      let guardado;
      if (registro) {
        datos.id = registro.id; // al actualizar enviamos el id y los campos
        guardado = await actualizarRecurso(config.recurso, datos);
      } else {
        datos.id = nuevoId(); // al crear, el id se genera aquí
        guardado = await crearRecurso(config.recurso, datos);
      }
      props.alGuardar(guardado);
    } catch (falla) {
      setError(falla.message);
      setGuardando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={guardar} noValidate>
      <fieldset className="grupo" disabled={guardando}>
        <legend>{config.leyenda}</legend>
        {config.campos.map(function (campo) {
          // Un solo "cambiar" sirve para todos los campos: [campo.clave] usa el nombre del campo como llave
          function cambiar(evento) {
            let valor = evento.target.value;
            if (campo.tipo === "numero") {
              valor = soloDigitos(valor); // en los campos numéricos solo se aceptan dígitos
            }
            setValores(Object.assign({}, valores, { [campo.clave]: valor }));
          }

          // Campo de lista: la persona ELIGE una opción en vez de escribir
          if (campo.tipo === "select") {
            return (
              <Campo key={campo.clave} etiqueta={campo.etiqueta} ayuda={campo.ayuda}>
                <select className="entrada" value={valores[campo.clave]} onChange={cambiar}>
                  {campo.opciones.map(function (opcion) {
                    return (
                      <option key={opcion.valor} value={opcion.valor}>
                        {opcion.etiqueta}
                      </option>
                    );
                  })}
                </select>
              </Campo>
            );
          }

          // Campo numérico: es un texto que solo deja escribir dígitos (teclado numérico en el celular)
          if (campo.tipo === "numero") {
            return (
              <Campo key={campo.clave} etiqueta={campo.etiqueta} ayuda={campo.ayuda}>
                <input className="entrada" type="text" inputMode="numeric" value={valores[campo.clave]} onChange={cambiar} placeholder={campo.ejemplo} />
              </Campo>
            );
          }

          // Los demás campos (texto, teléfono y correo)
          return (
            <Campo key={campo.clave} etiqueta={campo.etiqueta} ayuda={campo.ayuda}>
              <input className="entrada" type={campo.tipo} value={valores[campo.clave]} onChange={cambiar} placeholder={campo.ejemplo} />
            </Campo>
          );
        })}
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
          Guardar
        </Boton>
      </div>
    </form>
  );
}

export default FormularioEntidad;
