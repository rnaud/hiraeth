#!/bin/sh
# GitHub Actions only (.github/workflows/unity-android.yml, docs/systems/unity.md "Building in GitHub Actions"):
# the Unity editor image (GameCI's, 5-8 GB) kept on the runner's large temporary disk (/mnt) and pulled in the
# background while the job checks out, bundles and restores its caches; the root disk keeps the project.
#   scripts/unity-ci-docker.sh start unityci/editor:ubuntu-6000.6.4f1-android-3
#   scripts/unity-ci-docker.sh wait       (before the first GameCI step: the pull's end, its log if it failed)
# Without room on /mnt, Docker stays where it is and the preinstalled SDKs the job never uses are removed first
# (what jlumbroso/free-disk-space does, in a minute or two), so the image fits.
set -eu
STATE=${RUNNER_TEMP:-/tmp}/unity-image
free() { df --output=avail -BG "$1" 2>/dev/null | tail -1 | tr -dc 0-9; }
case ${1:?start or wait} in
start)
  IMAGE=${2:?the image}
  df -h / /mnt 2>/dev/null || true
  if [ "$(free /mnt || echo 0)" -ge "${MNT_MIN_GB:-40}" ]; then
    sudo systemctl stop docker docker.socket
    cfg=$(sudo cat /etc/docker/daemon.json 2>/dev/null || echo '{}')
    echo "$cfg" | jq '. + {"data-root": "/mnt/docker"}' | sudo tee /etc/docker/daemon.json > /dev/null
    sudo mkdir -p /mnt/docker
    sudo systemctl start docker
  fi
  echo "Docker's data in $(docker info -f '{{.DockerRootDir}}')"
  # (the project and its Library stay on /: room for them, and for the image when Docker is there too)
  WANT=${ROOT_MIN_GB:-25}; [ "$(docker info -f '{{.DockerRootDir}}')" = /mnt/docker ] && WANT=${ROOT_MIN_GB:-15}
  if [ "$(free /)" -lt "$WANT" ]; then
    sudo rm -rf /usr/local/lib/android /usr/share/dotnet /opt/ghc /usr/local/.ghcup
    docker image prune -a -f > /dev/null 2>&1 || true
  fi
  df -h /
  mkdir -p "$STATE"; rm -f "$STATE/done"
  nohup sh -c "docker pull -q '$IMAGE' > '$STATE/log' 2>&1; echo \$? > '$STATE/done'" > /dev/null 2>&1 &
  echo "pulling $IMAGE in the background"
  ;;
wait)
  t=0
  until [ -f "$STATE/done" ]; do sleep 5; t=$((t + 5)); done
  echo "the image after $t s more"
  [ "$(cat "$STATE/done")" = 0 ] || { cat "$STATE/log"; exit 1; }
  ;;
esac
