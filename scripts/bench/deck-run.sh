#!/bin/bash
# The game on the Steam Deck for scripts/bench/deck-worlds.mjs: started over ssh in Desktop Mode (Plasma's
# Wayland, as a player there) or nested in gamescope (X11, as in Gaming Mode), muted, with remote
# debugging on the Deck's 9222 and an ssh tunnel to it on this Mac's PORT (default 5310).
#   scripts/bench/deck-run.sh start [desktop|gamescope|headless] [GAME_DIR_ON_DECK]   stop
# headless: gamescope's headless backend (X11 as in Gaming Mode, nothing on the screen): for a Deck left in
# Gaming Mode, where there is no Plasma to nest in. GPU=vulkan|gl|software: ANGLE's backend (MOEBIUS_GPU).
# REFRESH: gamescope's refresh rate (default 60; Gaming Mode on the OLED runs at 90).
# GAME_DIR_ON_DECK: a built game (dist/) copied to the Deck, served instead of the installed one
# (MOEBIUS_GAME), to measure a change before it ships. Only our own unit (memento-bench) is started and
# stopped; Steam, the session and the system's settings are left as they are.
DECK=${DECK:-deck@steamdeck.local}
PORT=${PORT:-5310}
case "$1" in
  start)
    kind=${2:-desktop}
    game=${3:-}
    ssh -o BatchMode=yes "$DECK" "export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
      B=\$(readlink -f ~/.local/share/moebius-deck/current)/moebius
      G='${game:+MOEBIUS_GAME=$game} ${GPU:+MOEBIUS_GPU=$GPU}'
      A='--mute-audio --disable-audio-output --remote-debugging-port=9222'
      if [ $kind = headless ]; then
        systemd-run --user --unit=memento-bench --collect -p RuntimeMaxSec=7200 \
          gamescope --backend headless -W 1280 -H 800 -w 1280 -h 800 -r ${REFRESH:-60} -- env XDG_CURRENT_DESKTOP=gamescope \$G \$B \$A
      elif [ $kind = gamescope ]; then
        systemd-run --user --unit=memento-bench --collect -p RuntimeMaxSec=7200 env DISPLAY=:0 WAYLAND_DISPLAY=wayland-0 \
          gamescope -W 1280 -H 800 -w 1280 -h 800 -r ${REFRESH:-60} -- env XDG_CURRENT_DESKTOP=gamescope \$G \$B \$A
      else
        systemd-run --user --unit=memento-bench --collect -p RuntimeMaxSec=7200 env DISPLAY=:0 WAYLAND_DISPLAY=wayland-0 XDG_CURRENT_DESKTOP=KDE \$G \$B \$A
      fi"
    pkill -f "ssh -o BatchMode=yes -f -N -L $PORT:127.0.0.1:9222" 2>/dev/null
    ssh -o BatchMode=yes -f -N -L "$PORT:127.0.0.1:9222" -o ServerAliveInterval=10 -o ServerAliveCountMax=3 "$DECK"   # (the tunnel ends when the Deck sleeps: the run stops)
    echo "started ($kind), tunnel on $PORT" ;;
  stop)
    ssh -o BatchMode=yes "$DECK" 'export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus; systemctl --user stop memento-bench 2>/dev/null; true'
    pkill -f "ssh -o BatchMode=yes -f -N -L $PORT:127.0.0.1:9222" 2>/dev/null
    echo stopped ;;
  *) echo "usage: $0 start [desktop|gamescope|headless] [game dir on the Deck] | stop"; exit 1 ;;
esac
