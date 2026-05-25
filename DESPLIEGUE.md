# Guía de Despliegue: Mock Interview Copilot en GCP

Este documento contiene la guía paso a paso para configurar tu entorno en **Google Cloud Platform (GCP)**, ejecutar la aplicación de forma local para validación y desplegarla en un entorno 100% serverless en **Cloud Run** con escalado a cero.

---

## 1. Configuración de GCP e IAM

### 1.1. Activar APIs Requeridas

Para que la aplicación interactúe con los servicios serverless y de Inteligencia Artificial, debes activar las siguientes APIs en tu proyecto de GCP.

Ejecuta el siguiente comando en tu terminal local (asegúrate de haber iniciado sesión previamente con `gcloud auth login`):

```bash
# Habilitar servicios de IA, Persistencia NoSQL, Artifact Registry, compilador y Cloud Run
gcloud services enable \
    aiplatform.googleapis.com \
    firestore.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com
```

### 1.2. Crear una Service Account para Desarrollo Local

Para interactuar con la base de datos Firestore y Vertex AI de forma segura desde tu máquina local sin hardcodear llaves o credenciales en el código:

```bash
# 1. Configurar el ID de tu proyecto de GCP
PROJECT_ID="nombre-de-tu-proyecto-en-gcp"
gcloud config set project $PROJECT_ID

# 2. Definir el nombre de la Service Account
SA_NAME="mock-interview-sa"

# 3. Crear la Service Account
gcloud iam service-accounts create $SA_NAME \
    --description="Service Account para desarrollo local de Mock Interview Copilot" \
    --display-name="Mock Interview Local SA"

# 4. Asignar rol mínimo para leer y escribir en Firestore (Datastore User)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/datastore.user"

# 5. Asignar rol mínimo para usar Vertex AI Gemini (Vertex AI User)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# 6. Crear y exportar la llave en formato JSON
gcloud iam service-accounts keys create ./gcp-key.json \
    --iam-account="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
```

> [!WARNING]
> El archivo `gcp-key.json` se guardará en la raíz del proyecto. Este archivo contiene llaves privadas de acceso. **NUNCA lo subas a un repositorio de Git**. El archivo ya ha sido agregado preventivamente a tu `.dockerignore` y `.gitignore`.

---

## 2. Configuración de Cloud Firestore (NoSQL)

Para almacenar las sesiones de chat de forma nativa y stateless, crearemos una base de datos específica para este laboratorio:
1. Ve a la consola de GCP y navega a **Firestore**.
2. Haz clic en **Crear base de datos**.
3. Selecciona **Modo Nativo (Native Mode)** (Requerido de forma obligatoria por el SDK).
4. Elige una ubicación geográfica cercana (por ejemplo, `us-central1`).
5. En el campo **ID de la base de datos**, selecciona la opción de nombre personalizado e ingresa exactamente: **`copilot-db`**.
6. Haz clic en **Crear**. Las colecciones y subcolecciones se crearán automáticamente al realizar la primera simulación.

> [!NOTE]
> **Nombre de Base de Datos**: Hemos configurado el código para que, por defecto, busque una base de datos llamada `copilot-db`. Si decides usar otro nombre diferente, deberás exportar la variable de entorno `FIRESTORE_DB_ID` con tu nombre personalizado tanto localmente como en tu despliegue de Cloud Run.

---

## 3. Ejecución y Validación en Entorno Local

Para correr el servidor de desarrollo local de Next.js heredando de forma segura las credenciales de la Service Account:

```bash
# 1. Definir la ruta de las credenciales de Google
export GOOGLE_APPLICATION_CREDENTIALS="./gcp-key.json"

# 2. Definir el ID del proyecto de GCP
export GCP_PROJECT_ID="nombre-de-tu-proyecto-en-gcp"

# 3. Instalar dependencias locales
npm install

# 4. Iniciar el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador. Puedes interactuar con la aplicación y comprobar cómo se crean los registros de sesión y mensajes en tiempo real en la consola de Firestore.

---

## 4. Despliegue en Cloud Run (100% Serverless)

En producción (Cloud Run), **no utilizaremos el archivo JSON `gcp-key.json`**. Cloud Run resolverá las llamadas de autenticación usando la identidad del servicio nativa (`[numero-proyecto]-compute@developer.gserviceaccount.com` o una cuenta de servicio personalizada).

### 4.1. Configuración de Permisos en la Nube

Asegúrate de que la Service Account utilizada por tu servicio de Cloud Run tenga los permisos IAM mínimos. Puedes asignarlos rápidamente corriendo:

```bash
PROJECT_ID="nombre-de-tu-proyecto-en-gcp"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Asignar permisos a la Service Account de cómputo por defecto de Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/aiplatform.user"
```

### 4.2. Compilación y Despliegue

Compilaremos la imagen Docker optimizada directamente en la nube usando Cloud Build (para evitar instalar Docker localmente) y la desplegaremos en un contenedor administrado por Cloud Run:

```bash
# 1. Definir variables
REGION="us-central1"
REPO_NAME="mock-interview-repo"
IMAGE_NAME="interview-copilot"

# 2. Crear repositorio en Artifact Registry para almacenar la imagen Docker
gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Repositorio Docker para Mock Interview Copilot"

# 3. Compilar la imagen Docker en la nube usando Cloud Build
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/${IMAGE_NAME}:latest

# 4. Desplegar en Cloud Run (Escalado automático de 0 a 5 instancias)
gcloud run deploy interview-copilot \
    --image=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/${IMAGE_NAME}:latest \
    --platform=managed \
    --region=$REGION \
    --allow-unauthenticated \
    --min-instances=0 \
    --max-instances=5 \
    --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID,FIRESTORE_DB_ID=copilot-db"
```

- Al recibir la primera petición, Cloud Run levantará un contenedor en menos de 1.5 segundos gracias a la optimización multi-etapa y el modo standalone de Next.js implementado en tu [Dockerfile](file:///Users/daniel/cloudia/Dockerfile).

---

## 5. Solución de Problemas (Troubleshooting)

### 5.1. Error: Publisher Model `.../gemini-2.5-flash` was not found or your project does not have access to it

Este error (Código 404 `NOT_FOUND`) ocurre habitualmente en proyectos de GCP nuevos. Aunque la API de Vertex AI esté activa, el modelo específico de Gemini debe ser habilitado o aceptado en la galería del proyecto.

**Solución paso a paso para el estudiante:**

1. Abre tu consola web de **Google Cloud Platform (GCP)**.
2. En el buscador superior, escribe y accede a **Vertex AI**.
3. En el menú lateral izquierdo de Vertex AI, haz clic en **Model Garden** (Galería de Modelos).
4. Escribe **Gemini 2.5 Flash** en la barra de búsqueda de Model Garden.
5. Selecciona la tarjeta oficial de **Gemini 2.5 Flash**.
6. Haz clic en el botón **Habilitar (Enable)** o acepta los términos del servicio de Vertex AI/Modelos Fundacionales si es la primera vez que los utilizas en este proyecto.
7. Vuelve a recargar tu aplicación en el entorno local (`npm run dev`). La sesión se creará y conectará exitosamente con el modelo en la nube.

### 5.2. Error: FAILED_PRECONDITION: The Cloud Firestore API is not available for Firestore in Datastore Mode database

Este error ocurre cuando el proyecto de GCP ya tiene una base de datos activa por defecto (`(default)`) configurada en **Modo Datastore** en lugar de **Modo Nativo**. GCP no permite cambiar el modo de la base de datos por defecto una vez creada.

**Solución paso a paso para el estudiante:**

1. Ve a la consola web de GCP y navega a **Firestore**.
2. En la parte superior de la pantalla de Firestore, haz clic en el selector de base de datos (donde dice `(default)`) y selecciona **Crear base de datos**.
3. Configura los siguientes parámetros:
   - **ID de la base de datos**: Introduce un nombre personalizado (ejemplo: `copilot-db`).
   - **Modo**: Selecciona obligatoriamente **Modo Nativo (Native Mode)**.
   - **Ubicación**: Selecciona tu región preferida (ejemplo: `us-central1`).
4. Haz clic en **Crear**.
5. En tu terminal de desarrollo local, exporta el ID de la nueva base de datos antes de iniciar el servidor:
   ```bash
   export FIRESTORE_DB_ID="copilot-db"
   ```
6. Al desplegar en Cloud Run, actualiza la variable en el flag de despliegue:
   ```bash
   --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID,FIRESTORE_DB_ID=copilot-db"
   ```
