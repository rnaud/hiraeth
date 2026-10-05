using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The hoverbike (src/bike.js, src/story/desert-bike.js): Marrow hid it under a tarp in a
    /// hollow; pull the tarp back, wake it with the backpack's fluid, then ride. It floats on a
    /// hover spring 0.9 m over whatever is below, banks into turns and pitches with the ground.
    /// RT / R2 or W go, LT / L2 or S brake, left stick / A D steer, B / ○ or E get off. Once
    /// found, B / ○ or E far from it whistles it over.
    /// </summary>
    public class Bike : MonoBehaviour
    {
        Game game;
        public bool dormant = true, ridden;
        public float Speed => new Vector2(vel.x, vel.z).magnitude;
        Vector3 vel; float yaw, bank, pitch, vy;
        Transform body;   // the drawn bike (the exported parts), banked and pitched
        GameObject tarp; Vector3 tarpFrom, tarpTo; float tarpT = -1;
        const float Hover = 0.95f, Max = 26f, Accel = 16f, TurnRate = 95f;

        public void Init(Game g, GameObject drawn, GameObject tarpObj)
        {
            game = g;
            transform.position = drawn.transform.position;
            yaw = drawn.transform.eulerAngles.y;
            transform.rotation = Quaternion.Euler(0, yaw, 0);
            drawn.transform.SetParent(transform, true);
            body = drawn.transform;
            tarp = tarpObj;
            var G = game.state; var Q = game.quests;
            if (tarp) { tarpFrom = tarp.transform.position; tarpTo = tarpFrom + transform.right * 2.6f + Vector3.down * 0.3f; }
            Interact.Add(new Interactable
            {
                id = "bike.tarp", at = () => transform.position, range = 3.2f, enabled = () => !G.Is("desert.bike.uncovered"),
                prompt = () => "pull back the tarp",
                use = () => { G.Set("desert.bike.uncovered", true); tarpT = 0; game.hud.Toast("Under the tarp: a hoverbike, dusty, its fluid caps dark."); },
            });
            Interact.Add(new Interactable
            {
                id = "bike.wake", at = () => transform.position, range = 3.2f, enabled = () => G.Is("desert.bike.uncovered") && !G.Is("desert.bike.found"),
                prompt = () => Q.Has("backpack") ? "wake the hoverbike with the backpack" : "look at the hoverbike",
                use = () =>
                {
                    if (!Q.Has("backpack")) { game.hud.Toast("It needs power."); return; }
                    G.Set("desert.bike.found", true); dormant = false;
                    game.hud.Toast("The hose clicks in; the fluid lights its caps. The hoverbike hums.");
                },
            });
            Interact.Add(new Interactable
            {
                id = "bike.ride", at = () => transform.position, range = 3f, priority = 0, enabled = () => !dormant && !ridden,
                prompt = () => "ride the hoverbike", use = Mount,
            });
        }

        public void Mount()
        {
            ridden = true;
            var p = game.player; p.riding = true; p.cc.enabled = false; p.vel = Vector3.zero;
            vel = Vector3.zero;
        }
        public void Dismount()
        {
            ridden = false;
            var p = game.player;
            var side = transform.right * -1.4f;
            var at = transform.position + side;
            if (Physics.Raycast(at + Vector3.up * 3, Vector3.down, out var h, 8)) at = h.point;
            p.transform.position = at; p.cc.enabled = true; p.riding = false; p.heading = yaw;
            p.vel = vel * 0.3f;
        }
        public void Whistle()
        {
            Sounds.Instance?.Play("whistle");
            var p = game.player.transform;
            var at = p.position - p.forward * 2 + p.right * 3;
            if (Physics.Raycast(at + Vector3.up * 20, Vector3.down, out var h, 60)) at = h.point;
            transform.position = at + Vector3.up * Hover; yaw = p.eulerAngles.y; vel = Vector3.zero;
            game.hud.Toast("The hoverbike comes to your whistle.");
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            if (tarpT >= 0 && tarpT < 1 && tarp)
            {
                tarpT = Mathf.Min(1, tarpT + dt / 1.1f);
                tarp.transform.position = Vector3.Lerp(tarpFrom, tarpTo, tarpT) + Vector3.up * Mathf.Sin(Mathf.PI * tarpT) * 0.9f;
                tarp.transform.localScale = new Vector3(1 - tarpT * 0.45f, 1 - tarpT * 0.8f, 1 - tarpT * 0.55f);
            }
            if (dormant) return;
            Vector2 mv = ridden ? Pad.Move() : Vector2.zero;
            float throttle = ridden ? Mathf.Max(mv.y, Pad.BikeUpDown() ? 1 : 0) : 0;
            float brake = ridden ? Mathf.Max(0, -mv.y) : 1;
            var fwd = Quaternion.Euler(0, yaw, 0) * Vector3.forward;
            float sp = Vector3.Dot(vel, fwd);
            sp += (throttle * Accel - brake * 14f * Mathf.Sign(sp) * Mathf.Min(1, Mathf.Abs(sp)) - sp * 0.12f) * dt;
            sp = Mathf.Clamp(sp, -6, Max * (Pad.Run() && ridden ? 1.3f : 1f));
            float steer = ridden ? (Mathf.Abs(mv.x) < 0.12f ? 0 : mv.x) : 0;
            yaw += steer * TurnRate * Mathf.Clamp01(Mathf.Abs(sp) / 6f + 0.25f) * dt * (sp < 0 ? -1 : 1);
            fwd = Quaternion.Euler(0, yaw, 0) * Vector3.forward;
            // a little drift: the sideways speed bleeds off slower than the forward one
            var side = vel - Vector3.Dot(vel, fwd) * fwd; side.y = 0;
            vel = fwd * sp + side * Mathf.Exp(-3.5f * dt);
            // the hover spring over whatever is below
            var pos = transform.position;
            float ground = -1e9f;
            if (Physics.Raycast(pos + Vector3.up * 2, Vector3.down, out var h, 30)) ground = h.point.y;
            float want = ground + Hover;
            vy += ((want - pos.y) * 40f - vy * 9f) * dt;
            if (pos.y > want + 1.5f) vy -= 32f * dt;
            pos += new Vector3(vel.x, 0, vel.z) * dt; pos.y += vy * dt;
            if (pos.y < want - 0.3f) { pos.y = want - 0.3f; vy = Mathf.Max(vy, 0); }
            // walls: stop against them
            if (Physics.Raycast(transform.position + Vector3.up * 0.6f, vel.normalized, out var w, Speed * dt + 0.9f) && w.normal.y < 0.6f) { vel = Vector3.ProjectOnPlane(vel, w.normal) * 0.5f; pos = transform.position; }
            transform.position = pos;
            // bank into turns, pitch with the ground ahead
            bank = Mathf.Lerp(bank, -steer * Mathf.Clamp01(Speed / 12f) * 22f, 1 - Mathf.Exp(-5 * dt));
            float ahead = Physics.Raycast(pos + fwd * 2.5f + Vector3.up * 3, Vector3.down, out var a, 30) ? a.point.y : ground;
            pitch = Mathf.Lerp(pitch, -Mathf.Atan2(ahead - ground, 2.5f) * Mathf.Rad2Deg, 1 - Mathf.Exp(-4 * dt));
            transform.rotation = Quaternion.Euler(0, yaw, 0);
            if (body) body.localRotation = Quaternion.Euler(pitch, 0, bank);
            if (ridden)
            {
                var p = game.player;
                p.transform.position = pos + Vector3.up * 0.15f;
                p.transform.rotation = transform.rotation * Quaternion.Euler(pitch, 0, bank);
                p.heading = yaw;
                if (Pad.InteractDown()) Dismount();
            }
        }
    }
}
