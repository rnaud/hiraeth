#!/bin/bash
# The Unity bridge's Linux player on the Steam Deck (docs/systems/performance.md, "The Steam Deck, round 6"): a player
# copied to the Deck (BridgeBuild.Linux, or the unity-linux release's tar.gz unpacked), run in gamescope's headless
# backend at 1280 × 800 (X11 as in Gaming Mode, nothing on the screen), muted, in a profile of its own, at the bench's
# views; its bench JSON, its metrics log and its pictures fetched back to this Mac.
#   scripts/bench/deck-unity.sh put <dir with memento-js.x86_64 | .tar.gz> <name>      copy a player over
#   scripts/bench/deck-unity.sh run <name> <level> <views.json> <out dir here> [player args…]
#   scripts/bench/deck-unity.sh stop | ls | rm <name>
# REFRESH: gamescope's refresh rate (default 90, the OLED's Gaming Mode; 60 for the 60 Hz rows). The player's own
# arguments follow (-bench 6 -split -metrics are always passed; -vsync 1, -no-grd, -shadow-lists, … for the levers).
# The player's data (persistentDataPath: prewarm.txt, unity.log, Player.log) goes to
# ~/.local/share/moebius-bench-unity/config (XDG_CONFIG_HOME), never the player's own game or saves. Only our own unit
# (memento-unity-bench) is started and stopped.
DECK=${DECK:-deck@steamdeck.local}
BASE=.local/share/moebius-bench-games
PROF=.local/share/moebius-bench-unity
ENVS='export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus'
case "$1" in
  put)
    src=$2; name=$3
    ssh -o BatchMode=yes "$DECK" "rm -rf $BASE/$name && mkdir -p $BASE/$name $PROF"
    if [ -f "$src" ]; then ssh -o BatchMode=yes "$DECK" "tar xzf - -C $BASE/$name --strip-components=1" < "$src"
    else COPYFILE_DISABLE=1 tar czf - --no-mac-metadata --no-xattrs --exclude '*_BackUpThisFolder_ButDontShipItWithYourGame' --exclude '*_BurstDebugInformation_DoNotShip' -C "$src" . | ssh -o BatchMode=yes "$DECK" "tar xzf - -C $BASE/$name"; fi
    ssh -o BatchMode=yes "$DECK" "rm -rf $BASE/$name/*_BackUpThisFolder_ButDontShipItWithYourGame; du -sh $BASE/$name" ;;
  run)
    name=$2; level=$3; views=$4; out=$5; shift 5
    scp -q "$views" "$DECK:$PROF/views.json"
    ssh -o BatchMode=yes "$DECK" "$ENVS
      rm -rf $PROF/out && mkdir -p $PROF/out $PROF/config
      cd ~/$BASE/$name
      systemd-run --user --unit=memento-unity-bench --collect -p RuntimeMaxSec=1200 --working-directory=\$HOME/$BASE/$name \
        gamescope --backend headless -W 1280 -H 800 -w 1280 -h 800 -r ${REFRESH:-90} -- \
        env XDG_CONFIG_HOME=\$HOME/$PROF/config PWD=\$HOME/$PROF ${PLAYER_ENV:-} ./memento-js.x86_64 -screen-fullscreen 1 -screen-width 1280 -screen-height 800 \
          -logFile \$HOME/$PROF/out/player.log -mute -metrics -level $level -views \$HOME/$PROF/views.json -bench 6 -split -limit 900 -out \$HOME/$PROF/out $*
      for i in \$(seq 1 300); do systemctl --user is-active -q memento-unity-bench || break; sleep 3; done
      systemctl --user stop memento-unity-bench 2>/dev/null; true"
    mkdir -p "$out"
    scp -q "$DECK:$PROF/out/*" "$out/" 2>/dev/null
    ssh -o BatchMode=yes "$DECK" "cat \"$PROF/config/unity3d/rnaud/Hiraeth JS/unity.log\"" > "$out/unity.log" 2>/dev/null
    ls "$out" ;;
  stop) ssh -o BatchMode=yes "$DECK" "$ENVS; systemctl --user stop memento-unity-bench 2>/dev/null; true"; echo stopped ;;
  ls) ssh -o BatchMode=yes "$DECK" "du -sh $BASE/* 2>/dev/null" ;;
  rm) ssh -o BatchMode=yes "$DECK" "rm -rf $BASE/$2" ;;
  *) echo "usage: $0 put <dir|tar.gz> <name> | run <name> <level> <views.json> <out> [args] | stop | ls | rm <name>"; exit 1 ;;
esac
