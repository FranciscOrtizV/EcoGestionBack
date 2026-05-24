# Manual técnico — Eco Gestión Backend

API REST del sistema **Eco Gestión**, desarrollada con **NestJS 11** y **PostgreSQL**. Este documento describe requisitos, versiones recomendadas y pasos para levantar el proyecto en entorno local.

---

## 1. Descripción general

| Aspecto | Detalle |
|--------|---------|
| Nombre del proyecto | `eco-gestion-back` |
| Framework | [NestJS](https://nestjs.com/) 11.x |
| Lenguaje | TypeScript 5.7 |
| Base de datos | PostgreSQL 14.x |
| ORM | TypeORM 0.3.x |
| Autenticación | JWT (access + refresh) con Passport |
| Prefijo global de rutas | `/api` |
| Puerto por defecto | `3000` (configurable con `PORT`) |

Módulos principales expuestos por la API: `auth`, `usuarios`, `vehiculos`, `zonas`, `puntos-recoleccion`, `rutas`, `asignacion-rutas`, `ejecucion-rutas`, `tipos-incidencias`.

---

## 2. Requisitos previos (software)

### Obligatorios

| Software | Versión recomendada | Notas |
|----------|---------------------|--------|
| **Node.js** | **20 LTS** o **22 LTS** | NestJS 11 y las dependencias actuales requieren Node moderno. Se probó con Node 22.x. |
| **npm** | **10+** (incluido con Node) | Gestor de paquetes usado en el proyecto (`package-lock.json`). |
| **PostgreSQL** | **14.x** | Coincide con la imagen definida en `docker-compose.yaml` (`postgres:14.3`). |
| **Git** | Cualquier versión reciente | Para clonar el repositorio. |

### Recomendados (desarrollo local)

| Software | Versión | Uso |
|----------|---------|-----|
| **Docker Desktop** | 20.10+ | Levantar PostgreSQL sin instalarlo en el SO. |
| **Docker Compose** | v2 (integrado en Docker Desktop) | Orquestar el contenedor de base de datos. |
| **Cliente HTTP** | — | Postman, Insomnia o `curl` para probar endpoints. |

### Opcionales

- **Visual Studio Code** (o Cursor) con extensiones TypeScript / ESLint.
- En Windows, si `npm install` falla al compilar **bcrypt**, instalar [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con workload *Desktop development with C++*.

### Verificar instalación

```bash
node -v    # Debe mostrar v20.x o v22.x
npm -v     # Debe mostrar 10.x o superior
docker -v  # Si usas Docker para la BD
```

---

## 3. Stack y versiones del proyecto

Versiones declaradas en `package.json` (pueden resolverse parches menores vía `npm install`):

| Componente | Versión en proyecto |
|------------|---------------------|
| @nestjs/core y módulos Nest | ^11.0.x |
| TypeScript | ^5.7.3 |
| TypeORM | ^0.3.28 |
| pg (driver PostgreSQL) | ^8.20.0 |
| passport / passport-jwt | ^0.7.0 / ^4.0.1 |
| bcrypt | ^6.0.0 |
| class-validator / class-transformer | ^0.15.1 / ^0.5.1 |
| Jest (tests) | ^30.0.0 |

**Imagen Docker de PostgreSQL:** `postgres:14.3` (ver `docker-compose.yaml`).

---

## 4. Variables de entorno

Copiar la plantilla y completar los valores:

```bash
cp .env.template .env
```

### Variables requeridas

| Variable | Descripción | Ejemplo (desarrollo) |
|----------|-------------|----------------------|
| `DB_HOST` | Host de PostgreSQL | `localhost` |
| `DB_PORT` | Puerto de PostgreSQL | `5432` |
| `DB_NAME` | Nombre de la base de datos | `ecogestion` |
| `DB_USERNAME` | Usuario de PostgreSQL | `postgres` |
| `DB_PASSWORD` | Contraseña de PostgreSQL | *(valor seguro)* |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT | Cadena larga y aleatoria |
| `JWT_ACCESS_EXPIRES` | Expiración del access token | `3h` |
| `JWT_REFRESH_EXPIRES` | Expiración del refresh token | `4h` |

### Variable opcional

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto HTTP del servidor Nest | `3000` |

> **Importante:** El archivo `.env` está en `.gitignore`. No subir credenciales al repositorio.

Los mismos valores `DB_PASSWORD` y `DB_NAME` deben usarse en Docker Compose (el servicio `db` los lee del `.env`).

---

## 5. Base de datos

### Opción A — PostgreSQL con Docker (recomendado)

Desde la raíz del proyecto, con el `.env` configurado:

```bash
docker compose up -d
```

Esto levanta el contenedor `ecogestiondb` en el puerto **5432** y persiste datos en la carpeta local `postgres/` (ignorada por Git).

Detener el contenedor:

```bash
docker compose down
```

### Opción B — PostgreSQL instalado en el equipo

1. Crear una base de datos con el nombre definido en `DB_NAME`.
2. Crear usuario/contraseña acordes a `DB_USERNAME` y `DB_PASSWORD`.
3. Ajustar `DB_HOST` y `DB_PORT` en `.env`.

### Esquema de tablas

En `src/app.module.ts`, **`synchronize` está desactivado** (comentado). La aplicación **no crea ni actualiza tablas automáticamente**.

Debes contar con:

- Un script SQL o dump provisto por el equipo, **o**
- Habilitar temporalmente `synchronize: true` **solo en desarrollo** (no recomendado en producción), **o**
- Incorporar migraciones TypeORM en el futuro.

Sin esquema previo, la API fallará al conectar o al ejecutar consultas.

---

## 6. Instalación y ejecución

### 6.1 Clonar e instalar dependencias

```bash
git clone <URL_DEL_REPOSITORIO>
cd eco-gestion-back
npm install
```

### 6.2 Configurar entorno

1. Crear `.env` desde `.env.template`.
2. Levantar PostgreSQL (Docker o local).
3. Asegurar que el esquema de la BD exista.

### 6.3 Modo desarrollo (con recarga en caliente)

```bash
npm run start:dev
```

La API quedará disponible en:

```
http://localhost:3000/api
```

Ejemplos de rutas públicas:

- `POST /api/auth/register` — registro de usuario
- `POST /api/auth/login` — inicio de sesión
- `POST /api/auth/refresh` — renovar tokens

Rutas protegidas requieren header `Authorization: Bearer <access_token>`.

### 6.4 Otros comandos npm

| Comando | Descripción |
|---------|-------------|
| `npm run start` | Inicia sin watch |
| `npm run start:debug` | Modo debug con watch |
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Ejecuta build de producción |
| `npm run lint` | ESLint con corrección automática |
| `npm run test` | Tests unitarios |
| `npm run test:e2e` | Tests end-to-end |
| `npm run test:cov` | Cobertura de tests |

### 6.5 Producción (referencia)

```bash
npm run build
npm run start:prod
```

Definir `NODE_ENV=production` y variables de entorno seguras en el servidor o plataforma de despliegue.

---

## 7. Comportamiento de la API

- **CORS:** habilitado globalmente (`main.ts`).
- **Validación:** `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`.
- **Roles del sistema:** `ADMIN`, `SUPERVISOR`, `PLANIFICADOR`, `CONDUCTOR` (ver `RolesValidosEnum`).

---

## 8. Estructura relevante del repositorio

```
eco-gestion-back/
├── src/
│   ├── main.ts              # Bootstrap, prefijo /api, CORS, validación
│   ├── app.module.ts        # Config TypeORM y módulos
│   ├── auth/                # Login, registro, JWT
│   └── ...                  # Módulos de dominio
├── test/                    # Tests e2e
├── docker-compose.yaml      # PostgreSQL 14.3
├── .env.template            # Plantilla de variables
├── package.json
└── docs/
    └── MANUAL_TECNICO.md    # Este documento
```

---

## 9. Solución de problemas frecuentes

| Problema | Posible causa | Acción |
|--------|---------------|--------|
| `ECONNREFUSED` en puerto 5432 | PostgreSQL no está levantado | `docker compose up -d` o iniciar servicio local |
| Error de autenticación en BD | `.env` no coincide con Docker/Postgres | Revisar `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` |
| Puerto 5432 en uso | Otra instancia de Postgres | Cambiar puerto en `docker-compose.yaml` y `DB_PORT` |
| `relation "..." does not exist` | Esquema no creado | Aplicar script SQL o estrategia de migraciones |
| Fallo al instalar `bcrypt` (Windows) | Falta toolchain de compilación | Instalar Build Tools de Visual Studio |
| 401 en rutas protegidas | Token inválido o expirado | Login de nuevo o usar `/api/auth/refresh` |

---

## 10. Calidad y análisis estático

El proyecto incluye configuración para **SonarCloud** (`sonar-project.properties`). Es independiente del arranque local de la API.

---

## 11. Checklist rápido

- [ ] Node.js 20+ instalado
- [ ] Repositorio clonado
- [ ] `npm install` sin errores
- [ ] Archivo `.env` completo
- [ ] PostgreSQL 14 en ejecución
- [ ] Esquema de base de datos aplicado
- [ ] `npm run start:dev` ejecutándose
- [ ] `POST http://localhost:3000/api/auth/login` responde correctamente

---

*Documento generado a partir de la configuración del repositorio `eco-gestion-back`. Actualizar si cambian versiones en `package.json` o `docker-compose.yaml`.*
