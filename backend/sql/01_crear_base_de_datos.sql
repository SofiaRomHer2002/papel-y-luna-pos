-- ---------------------------------------------------------------------------
-- 01_crear_base_de_datos.sql: crea el usuario y la base de datos VACÍA en PostgreSQL.
-- Se ejecuta UNA sola vez, como administrador de PostgreSQL (usuario "postgres"):
--
--     psql -U postgres -f sql/01_crear_base_de_datos.sql
--
-- (o se pegan estas dos instrucciones en pgAdmin > Query Tool).
-- Después, las TABLAS las crea Django con:   python manage.py migrate
-- y los usuarios y el catálogo inicial con:  python manage.py inicializar_datos
--
-- El nombre, el usuario y la contraseña deben ser los mismos del archivo backend/.env
-- ---------------------------------------------------------------------------

-- Usuario con el que el backend se conecta a la base de datos
CREATE USER papelyluna WITH PASSWORD 'papelyluna';

-- Base de datos del punto de venta. Su dueño es el usuario de arriba.
CREATE DATABASE papelyluna OWNER papelyluna ENCODING 'UTF8';
