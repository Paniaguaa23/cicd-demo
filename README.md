# Demo CI/CD — GitHub Actions + Amazon ECR + Amazon ECS Fargate

Proyecto de la investigación **Tema 5: Automatización del despliegue de aplicaciones mediante CI/CD** (Cómputo en la Nube, UNICAES).

Cada cambio integrado en `main` se **prueba, se empaqueta en una imagen Docker, se publica en ECR, se despliega en *staging*** y, tras una **aprobación manual**, la misma imagen se **promueve a *demo***. Un flujo aparte permite **revertir a una versión anterior**.

```
feature/*  ──PR──▶  main ──▶ CI (lint + Jest + build) ──▶ imagen :sha en ECR
                                                     ──▶ staging (ALB :8080) ──▶ prueba de humo
                                                     ──▶ ⏸ aprobación ──▶ demo (ALB :80) ──▶ prueba de humo
Rollback (manual) ──▶ imagen :sha anterior ──▶ staging o demo
```

## Estructura

| Ruta | Para qué sirve |
|---|---|
| `src/` | App web Node.js + Express (página, `/health`, `/api/info`, `/api/tareas`) |
| `tests/` | Pruebas automáticas con Jest + Supertest |
| `Dockerfile` | Imagen multi-etapa, usuario sin privilegios |
| `infra/cloudformation.yml` | VPC, ECR, ALB, ECS Fargate (staging y demo), logs, rol OIDC |
| `.github/workflows/ci.yml` | Integración continua en ramas y Pull Requests |
| `.github/workflows/cd.yml` | Construcción, despliegue en staging y promoción a demo |
| `.github/workflows/rollback.yml` | Recuperación de una versión anterior |
| `scripts/` | Despliegue en ECS y prueba de humo (los usan los workflows) |

## Puesta en marcha (una sola vez, ~20 min)

### 1. Repositorio
1. Crear un repositorio en GitHub (ej. `cicd-demo`) y subir este contenido a la rama `main`.
2. Agregar a los compañeros como colaboradores.

### 2. Infraestructura en AWS
En la consola de AWS → **CloudFormation → Create stack → Upload a template file** → `infra/cloudformation.yml`.

- **Stack name:** `cicd-demo`
- **GitHubOrg:** su usuario u organización de GitHub
- **GitHubRepo:** nombre exacto del repositorio
- **CreateOidcProvider:** `true` (use `false` si en **IAM → Identity providers** ya existe `token.actions.githubusercontent.com`)
- Marcar *I acknowledge that AWS CloudFormation might create IAM resources with custom names*.

Al terminar (≈5 min), abrir la pestaña **Outputs** y copiar `GitHubDeployRoleArn`, `StagingUrl` y `DemoUrl`.

> Use la región **us-east-1**. Si usa otra, cree la variable `AWS_REGION` del paso 3.

### 3. Configuración en GitHub (Settings del repositorio)
- **Secrets and variables → Actions → New repository secret:** `AWS_ROLE_ARN` = valor de `GitHubDeployRoleArn`.
- *(Opcional)* **Variables:** `AWS_REGION` y `STACK_NAME` si cambiaron los valores por defecto.
- **Environments:** crear `staging` y `demo`. En `demo` activar **Required reviewers** y agregar a uno o dos integrantes. En ambos, *Deployment branches* → solo `main`.
- **Branches → Add rule** para `main`: *Require a pull request before merging* y *Require status checks* → **Lint, pruebas y build de imagen** (aparece después de la primera ejecución del CI).

### 4. Primer despliegue
**Actions → CD → Run workflow**. Al llegar a *Promover a demo*, aprobar con **Review deployments**. Abrir `DemoUrl`: el encabezado verde indica entorno *demo*; el naranja (`StagingUrl`), *staging*.

## Guion de la demostración práctica (5–7 min)

1. **Mostrar el estado actual:** abrir `DemoUrl` y señalar la versión (SHA) del encabezado.
2. **Crear una rama:** `git checkout -b feature/nuevo-mensaje`.
3. **Cambiar el código:** en `src/app.js` modificar la constante `MENSAJE`, por ejemplo `'Hola UNICAES — versión 2'`.
4. **Enviar el cambio:** `git commit -am "Cambia mensaje de bienvenida" && git push -u origin feature/nuevo-mensaje` y abrir el Pull Request. Mostrar el check **CI** en verde.
5. **(Opcional) Romper una prueba** para mostrar que el pipeline bloquea el cambio: cambiar el `expect(res.status).toBe(200)` por `201`, hacer push, ver el CI en rojo y revertirlo.
6. **Integrar:** *Merge* del PR. En **Actions → CD** mostrar las etapas: CI → imagen en ECR → staging → pausa de aprobación.
7. **Validar staging:** abrir `StagingUrl` con el mensaje nuevo; en demo sigue la versión anterior.
8. **Promover:** aprobar el despliegue a `demo` y refrescar `DemoUrl`.
9. **Rollback:** **Actions → Rollback → Run workflow**, entorno `demo`, versión vacía. Al terminar, `DemoUrl` vuelve al mensaje anterior.
10. **Evidencias:** mostrar el *Summary* de cada ejecución, el artefacto de cobertura, las imágenes etiquetadas en **ECR** (con resultado del escaneo) y los logs en **CloudWatch → /ecs/cicd-demo**.

## Pruebas en local

```bash
npm ci
npm test          # pruebas + cobertura
npm start         # http://localhost:3000
docker build -t cicd-demo . && docker run -p 3000:3000 -e APP_ENV=staging cicd-demo
```

## Seguridad de credenciales
- No hay llaves de acceso en el repositorio: GitHub Actions obtiene **credenciales temporales** mediante **OIDC**.
- El rol solo puede asumirse desde la rama `main` y los entornos `staging`/`demo` de **este** repositorio, con permisos mínimos (ECR del proyecto, los dos servicios ECS y `PassRole` del rol de ejecución).
- Etiquetas de imagen **inmutables** y escaneo de vulnerabilidades al publicar.

## Costos y limpieza
Mientras el stack existe se paga el ALB y dos tareas Fargate pequeñas (del orden de 1 USD por día en us-east-1, cubierto por créditos). **Después de la exposición**, eliminar el stack en CloudFormation (borra también las imágenes de ECR).

## Solución de problemas
| Síntoma | Causa probable |
|---|---|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | `GitHubOrg`/`GitHubRepo` no coinciden con el repositorio, o falta `id-token: write` |
| El job de demo no avanza | Está esperando la aprobación en *Review deployments* |
| `ECS revirtió el despliegue` | La nueva versión no pasó el health check (`/health`); revisar logs en CloudWatch |
| Error al crear el proveedor OIDC | Ya existe en la cuenta: volver a crear el stack con `CreateOidcProvider=false` |
