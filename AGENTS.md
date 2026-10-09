# Hiraeth project rules

Read `CLAUDE.md` for the project's working rules and documentation map.

## Download hygiene

- Use task-specific temporary folders for downloads and intermediate exports. If a browser saves into
  `~/Downloads`, immediately move the task's files into a temporary folder after identifying them.
  Preserve accepted source assets in the project; do not leave working copies in Downloads or remove
  unrelated user files as part of task cleanup.

## Silent browser review

- Keep cinematics and other game previews muted when opening, replaying or testing
  them in the internal browser. Verify music, effects and dialogue are muted before
  playback; a "Sound off" label alone is insufficient. Only unmute when the user
  explicitly asks to hear the preview.
- Apply review mute when constructing the audio system, before world loading can
  start playback. Verify reloads with an audible saved gameplay preference; a
  later playback hook or temporary progress store cannot prevent startup sound.

## Reference generation

- Always use **Midjourney** for character, environment, object, currency, ship and other visual references.
  Do not substitute the built-in image generator or another service unless the user explicitly requests it.
- Open Midjourney in the **visible internal Codex browser** and operate it there. Do not use the user's
  external Chrome windows for this workflow. Keep the Midjourney tab open for review.
- Generate options in Midjourney so the user can heart/favourite the ones they like. Wait for their
  selections before downloading or saving references into the repository or integrating them into the game.
