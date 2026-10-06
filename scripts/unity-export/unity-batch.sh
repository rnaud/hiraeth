#!/bin/sh
# Run one of the Unity project's batch entry points (unity/Memento/Assets/Memento/Editor/Batch.cs):
#   scripts/unity-export/unity-batch.sh Setup
#   scripts/unity-export/unity-batch.sh Shots -shots views.json -out shots/
#   scripts/unity-export/unity-batch.sh Play -out frames/
#   scripts/unity-export/unity-batch.sh BenchBuild.Android     (Class.Method: another class in Memento.EditorTools)
# UNITY overrides the editor path; LOG the log file (default unity/Memento/Logs/batch-<method>.log).
# Runs without -nographics so cameras render on Metal.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
UNITY=${UNITY:-/Applications/Unity/Hub/Editor/6000.6.4f1/Unity.app/Contents/MacOS/Unity}
METHOD=$1; shift
case $METHOD in *.*) ENTRY=Memento.EditorTools.$METHOD ;; *) ENTRY=Memento.EditorTools.Batch.$METHOD ;; esac
mkdir -p "$ROOT/unity/Memento/Logs"
LOG=${LOG:-$ROOT/unity/Memento/Logs/batch-$METHOD.log}
QUIT=-quit; case $METHOD in Play|BridgeBatch.Run) QUIT= ;; esac   # (these play, and exit themselves)
"$UNITY" -batchmode $QUIT -projectPath "$ROOT/unity/Memento" -executeMethod "$ENTRY" -logFile "$LOG" "$@" > /dev/null 2>&1
STATUS=$?
grep -n "error CS\|Shader error\|Exception\|Memento:" "$LOG" | grep -v Licensing | head -40
exit $STATUS
