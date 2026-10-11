// Which game frame's passes are being drawn (perf.js pinRenderFrame keeps it): `on` between the frame's first pass and
// its last, `n` counting the frames. Something worked out from the scene that three asks for in every pass (a
// skinned machine's bounds, for the passes' sort) can be worked out once a frame by it, and exactly outside the passes.
export const RENDER_FRAME = { n: 0, on: false };
