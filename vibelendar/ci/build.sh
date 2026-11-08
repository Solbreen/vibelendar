#!/bin/sh
set -eu

: "${CI_PROJECT_DIR:?CI_PROJECT_DIR is missing}"
: "${CI_REGISTRY:?CI_REGISTRY is missing}"
: "${CI_REGISTRY_IMAGE:?CI_REGISTRY_IMAGE is missing}"
: "${CI_REGISTRY_USER:?CI_REGISTRY_USER is missing}"
: "${CI_REGISTRY_PASSWORD:?CI_REGISTRY_PASSWORD is missing}"
: "${CI_COMMIT_SHA:?CI_COMMIT_SHA is missing}"
: "${CI_JOB_ID:?CI_JOB_ID is missing}"
: "${KUBECONFIG_VIBELENDAR:?KUBECONFIG_VIBELENDAR is missing}"
command -v kubectl >/dev/null

namespace=vibelendar
build_pod="vibelendar-build-$CI_JOB_ID"
app_image="$CI_REGISTRY_IMAGE/vibelendar:$CI_COMMIT_SHA-$CI_JOB_ID"
umask 077
build_work_dir="$(mktemp -d)"
export KUBECONFIG="$build_work_dir/kubeconfig"
pod_created=false

cleanup() {
  result=$?
  trap - EXIT
  if [ "$pod_created" = true ]; then
    if [ "$result" -ne 0 ]; then
      kubectl -n "$namespace" --request-timeout=20s describe pod "$build_pod" || true
    fi
    kubectl -n "$namespace" --request-timeout=20s delete pod "$build_pod" --ignore-not-found --wait=false || true
  fi
  rm -f "$build_work_dir/config.json" "$build_work_dir/context.tar" "$build_work_dir/pod.yaml" "$build_work_dir/kubeconfig"
  rmdir "$build_work_dir" 2>/dev/null || true
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

rm -f "$CI_PROJECT_DIR/.vibelendar-build.env"
printf '%s\n' "$KUBECONFIG_VIBELENDAR" > "$KUBECONFIG"
if ! kubectl config view -o json >/dev/null 2>&1; then
  printf '%s' "$KUBECONFIG_VIBELENDAR" | base64 -d > "$KUBECONFIG"
fi
kubectl config view -o json >/dev/null

if [ -n "${KUBE_CONTEXT:-}" ]; then
  kubectl config use-context "$KUBE_CONTEXT"
fi
test -n "$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')"

for verb in create get list watch delete; do
  if ! kubectl -n "$namespace" auth can-i "$verb" pods --quiet; then
    printf 'KUBECONFIG_VIBELENDAR: required permission %s pods in namespace %s\n' "$verb" "$namespace" >&2
    exit 1
  fi
done

for verb in get create; do
  if ! kubectl -n "$namespace" auth can-i "$verb" pods --subresource=exec --quiet; then
    printf 'KUBECONFIG_VIBELENDAR: required permission %s pods/exec in namespace %s\n' "$verb" "$namespace" >&2
    exit 1
  fi
done

git -C "$CI_PROJECT_DIR" archive --format=tar "${CI_COMMIT_SHA}:vibelendar" > "$build_work_dir/context.tar"

registry_auth="$(printf '%s:%s' "$CI_REGISTRY_USER" "$CI_REGISTRY_PASSWORD" | base64 | tr -d '\n')"
printf '{"auths":{"%s":{"auth":"%s"}}}\n' "$CI_REGISTRY" "$registry_auth" > "$build_work_dir/config.json"
unset registry_auth

cat > "$build_work_dir/pod.yaml" <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: $build_pod
  namespace: $namespace
  labels:
    app.kubernetes.io/name: vibelendar-builder
spec:
  restartPolicy: Never
  activeDeadlineSeconds: 1500
  terminationGracePeriodSeconds: 5
  automountServiceAccountToken: false
  nodeSelector:
    kubernetes.io/os: linux
    kubernetes.io/arch: amd64
  securityContext:
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
  containers:
    - name: buildkit
      image: dockerhub.pr.cz/moby/buildkit:v0.34.1-rootless
      command: [sh, -c, "exec sleep 1500"]
      env:
        - name: BUILDKITD_FLAGS
          value: --oci-worker-no-process-sandbox --oci-worker-snapshotter=native
        - name: DOCKER_CONFIG
          value: /tmp/registry
      securityContext:
        seccompProfile:
          type: Unconfined
        appArmorProfile:
          type: Unconfined
      resources:
        requests:
          cpu: 250m
          memory: 512Mi
        limits:
          cpu: "2"
          memory: 4Gi
      volumeMounts:
        - name: workspace
          mountPath: /workspace
        - name: buildkit-data
          mountPath: /home/user/.local/share/buildkit
  volumes:
    - name: workspace
      emptyDir: {}
    - name: buildkit-data
      emptyDir: {}
EOF

kubectl create -f "$build_work_dir/pod.yaml"
pod_created=true

kubectl -n "$namespace" wait \
  --for=condition=Ready "pod/$build_pod" --timeout=240s

kubectl -n "$namespace" exec -i "$build_pod" -- \
  tar -xf - -C /workspace < "$build_work_dir/context.tar"

kubectl -n "$namespace" exec -i "$build_pod" -- \
  sh -c 'umask 077; mkdir -p "$DOCKER_CONFIG"; cat > "$DOCKER_CONFIG/config.json"' \
  < "$build_work_dir/config.json"

kubectl -n "$namespace" exec "$build_pod" -- \
  buildctl-daemonless.sh build \
  --progress=plain \
  --frontend dockerfile.v0 \
  --local context=/workspace \
  --local dockerfile=/workspace \
  --output "type=image,name=$app_image,push=true"

printf 'VIBELENDAR_IMAGE=%s\n' "$app_image" > "$CI_PROJECT_DIR/.vibelendar-build.env"
