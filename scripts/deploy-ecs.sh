#!/usr/bin/env bash
# Despliega una imagen en un servicio de ECS Fargate (staging o demo).
# Uso: deploy-ecs.sh <entorno> <uri-de-imagen> <version>
# Requiere: credenciales AWS ya configuradas (OIDC), jq y las variables STACK_NAME y AWS_REGION.
set -euo pipefail

ENTORNO="$1"
IMAGEN="$2"
VERSION="$3"

salida() {
  aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

CLUSTER="$(salida ClusterName)"
if [ "$ENTORNO" = "demo" ]; then
  SERVICIO="$(salida DemoServiceName)"; URL="$(salida DemoUrl)"
else
  SERVICIO="$(salida StagingServiceName)"; URL="$(salida StagingUrl)"
fi

echo "Entorno: $ENTORNO | Cluster: $CLUSTER | Servicio: $SERVICIO"
echo "Imagen:  $IMAGEN"

# 1) Tomar la definición de tarea actual del servicio como base.
TD_ACTUAL="$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICIO" \
  --query 'services[0].taskDefinition' --output text)"
aws ecs describe-task-definition --task-definition "$TD_ACTUAL" --query taskDefinition > td-actual.json

# 2) Cambiar la imagen, quitar el comando temporal e inyectar la versión.
jq --arg img "$IMAGEN" --arg ver "$VERSION" --arg env "$ENTORNO" '
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities,
      .registeredAt, .registeredBy, .deregisteredAt)
  | .containerDefinitions[0].image = $img
  | del(.containerDefinitions[0].command)
  | .containerDefinitions[0].environment =
      ((.containerDefinitions[0].environment // [])
        | map(select(.name != "APP_VERSION" and .name != "APP_ENV"))
        + [{name:"APP_VERSION", value:$ver}, {name:"APP_ENV", value:$env}])
' td-actual.json > td-nueva.json

# 3) Registrar la nueva revisión y actualizar el servicio (despliegue rolling).
TD_NUEVA="$(aws ecs register-task-definition --cli-input-json file://td-nueva.json \
  --query 'taskDefinition.taskDefinitionArn' --output text)"
echo "Nueva definición de tarea: $TD_NUEVA"

aws ecs update-service --cluster "$CLUSTER" --service "$SERVICIO" \
  --task-definition "$TD_NUEVA" --output text --query 'service.serviceName' >/dev/null

# 4) Esperar a que el servicio quede estable (el circuit breaker revierte si falla).
echo "Esperando estabilidad del servicio..."
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICIO"

DESPLEGADA="$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICIO" \
  --query 'services[0].taskDefinition' --output text)"
if [ "$DESPLEGADA" != "$TD_NUEVA" ]; then
  echo "::error::ECS revirtió el despliegue (circuit breaker). Activa: $DESPLEGADA"
  exit 1
fi

{
  echo "url=$URL"
  echo "task_definition=$TD_NUEVA"
} >> "${GITHUB_OUTPUT:-/dev/null}"

echo "Despliegue en $ENTORNO completado: $URL"
