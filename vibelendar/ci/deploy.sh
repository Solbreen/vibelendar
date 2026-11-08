#!/bin/sh
set -eu

: "${CI_PROJECT_DIR:?CI_PROJECT_DIR is missing}"
: "${CI_REGISTRY:?CI_REGISTRY is missing}"
: "${VIBELENDAR_IMAGE:?VIBELENDAR_IMAGE is missing}"
: "${KUBE_CONFIG:?KUBE_CONFIG is missing}"
: "${REGISTRY_PULL_USER:?REGISTRY_PULL_USER is missing}"
: "${REGISTRY_PULL_PASSWORD:?REGISTRY_PULL_PASSWORD is missing}"

test -s "$KUBE_CONFIG"
export KUBECONFIG="$KUBE_CONFIG"

if [ -n "${KUBE_CONTEXT:-}" ]; then
  kubectl config use-context "$KUBE_CONTEXT"
fi

namespace='vibelendar'
manifests="$CI_PROJECT_DIR/vibelendar/k8s"
deploy_work_dir="$(mktemp -d)"

cleanup() {
  rm -f \
    "$deploy_work_dir/config.json" \
    "$deploy_work_dir/secret.yaml" \
    "$deploy_work_dir/rendered/10-configmap.yaml" \
    "$deploy_work_dir/rendered/30-deployment.yaml" \
    "$deploy_work_dir/rendered/40-service.yaml"

  rmdir "$deploy_work_dir/rendered" "$deploy_work_dir" 2>/dev/null || true
}
trap cleanup EXIT

umask 077
mkdir "$deploy_work_dir/rendered"

registry_auth="$(
  printf '%s:%s' "$REGISTRY_PULL_USER" "$REGISTRY_PULL_PASSWORD" |
    base64 |
    tr -d '\n'
)"

printf '{"auths":{"%s":{"auth":"%s"}}}\n' \
  "$CI_REGISTRY" "$registry_auth" \
  > "$deploy_work_dir/config.json"

unset registry_auth

kubectl -n "$namespace" create secret generic registry-credentials \
  --type=kubernetes.io/dockerconfigjson \
  --from-file=".dockerconfigjson=$deploy_work_dir/config.json" \
  --dry-run=client \
  -o yaml > "$deploy_work_dir/secret.yaml"

kubectl -n "$namespace" apply \
  -f "$deploy_work_dir/secret.yaml"

cp "$manifests/10-configmap.yaml" \
  "$deploy_work_dir/rendered/10-configmap.yaml"

cp "$manifests/40-service.yaml" \
  "$deploy_work_dir/rendered/40-service.yaml"

kubectl set image --local \
  -f "$manifests/30-deployment.yaml" \
  "*=$VIBELENDAR_IMAGE" \
  -o yaml > "$deploy_work_dir/rendered/30-deployment.yaml"

kubectl -n "$namespace" apply \
  --dry-run=server \
  -f "$deploy_work_dir/rendered"

kubectl -n "$namespace" apply \
  -f "$deploy_work_dir/rendered"

if ! kubectl -n "$namespace" rollout status \
  deployment/vibelendar \
  --timeout=600s; then

  kubectl -n "$namespace" get pods,svc -o wide || true

  kubectl -n "$namespace" describe pods \
    -l app.kubernetes.io/name=vibelendar || true

  kubectl -n "$namespace" logs deployment/vibelendar \
    --all-containers=true \
    --tail=100 || true

  exit 1
fi

kubectl -n "$namespace" get service vibelendar \
  -o jsonpath='http://10.12.93.147:{.spec.ports[0].nodePort}{"\n"}'
