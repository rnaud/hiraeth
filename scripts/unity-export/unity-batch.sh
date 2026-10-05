#!/bin/sh
# Run one of the Unity project's batch entry points (unity/Memento/Assets/Memento/Editor/Batch.cs):
#   scripts/unity-export/unity-batch.sh Setup
#   scripts/unity-export/unity-batch.sh Shots -shots views.json -out shots/
#   scripts/unity-export/unity-batch.sh Play -out frames/
# UNITY overrides the editor path; LOG the log file (default unity/Memento/Logs/batch-<method>.log).
# Runs without -nographics so cameras render on Metal.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
UNITY=${UNITY:-/Applications/Unity/Hub/Editor/6000.6.4f1/Unity.app/Contents/MacOS/Unity}
METHOD=$1; shift
mkdir -p "$ROOT/unity/Memento/Logs"
LOG=${LOG:-$ROOT/unity/Memento/Logs/batch-$METHOD.log}
"$UNITY" -batchmode -quit -projectPath "$ROOT/unity/Memento" -executeMethod "Memento.EditorTools.Batch.$METHOD" -logFile "$LOG" "$@" > /dev/null 2>&1
STATUS=$?
grep -n "error CS\|Shader error\|Exception\|Memento:" "$LOG" | grep -v Licensing | head -40
exit $STATUS
