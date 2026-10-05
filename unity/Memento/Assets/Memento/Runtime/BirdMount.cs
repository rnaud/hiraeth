using UnityEngine;

namespace Memento
{
    /// <summary>What the camera and the sound ask of whatever you ride (the hoverbike, the bird).</summary>
    public interface IMount { float Speed { get; } float Yaw { get; } bool Ridden { get; } }

    /// <summary>
    /// Vael's bird (src/bird.js), the mount of the bone-white worlds: B / ○ beside her and you are on her back.
    /// On the ground she walks slowly (the stick) and takes off with A / ×; in the air she banks to turn (the
    /// stick's x), dives and pulls up (its y: W dives, S pulls up), A / × flaps (lift and thrust), RT / R2 thrusts;
    /// diving speeds her up, climbing slows her, under 16 m/s she sinks; she lands where she meets the ground
    /// slowly (or with the stick pulled back), skims and pulls up when fast. B / ○ gets off: beside her on the
    /// ground, or off her back in the air (she circles down and lands). The whistle brings her to you.
    /// </summary>
    public class BirdMount : MonoBehaviour, IMount
    {
        Game game;
        public bool ridden, landed = true;
        public float speed, heading, pitch, bank, flap;
        public float Speed => landed ? 0 : speed;
        public float Yaw => heading * Mathf.Rad2Deg;
        public bool Ridden => ridden;
        Transform body; Vector3 pos; bool gliding;
        const float MinSpeed = 8, MaxSpeed = 55;
        static readonly int Mask = ~(1 << 2);

        public void Init(Game g, GameObject drawn)
        {
            game = g;
            pos = drawn.transform.position;
            heading = drawn.transform.eulerAngles.y * Mathf.Deg2Rad;
            transform.position = pos; transform.rotation = Quaternion.Euler(0, Yaw, 0);
            drawn.transform.SetParent(transform, true);
            body = drawn.transform;
            Interact.Add(new Interactable
            {
                id = "bird.ride", at = () => transform.position, range = 7f, priority = 0, enabled = () => !ridden && landed,
                prompt = () => "ride the bird", use = Mount,
            });
        }

        float Ground(Vector3 p, float from) => Physics.Raycast(new Vector3(p.x, from, p.z), Vector3.down, out var h, 2000, Mask, QueryTriggerInteraction.Ignore) ? h.point.y : -1e4f;

        public void Mount()
        {
            ridden = true; gliding = false;
            var p = game.player; p.riding = true; p.cc.enabled = false; p.vel = Vector3.zero;
            Sounds.Instance?.Play("flap");
            game.state.Emit("mount", "bird");
        }
        public void Dismount()
        {
            ridden = false;
            var p = game.player;
            var at = transform.position + transform.right * -2.5f;
            if (landed) { at.y = Ground(at, at.y + 3) ; p.transform.position = at; }
            else { p.transform.position = transform.position + Vector3.down * 1.5f; gliding = true; }
            p.cc.enabled = true; p.riding = false; p.heading = Yaw;
            p.vel = landed ? Vector3.zero : transform.forward * speed * 0.5f;
        }
        public void Whistle()
        {
            Sounds.Instance?.Play("whistle");
            var p = game.player.transform;
            var at = p.position - p.forward * 2 + p.right * 3;
            at.y = Ground(at, p.position.y + 4) + 1.4f;
            pos = at; heading = p.eulerAngles.y * Mathf.Deg2Rad; landed = true; speed = 0; gliding = false;
            game.hud.Toast("The bird comes down to your whistle.");
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            flap += dt * (3 + (landed ? 0 : 5));
            if (ridden) Fly(dt);
            else if (gliding)
            {
                // rider off mid-air: she circles down and lands
                heading += 0.4f * dt;
                var f = new Vector3(Mathf.Sin(heading), 0, Mathf.Cos(heading));
                pos += f * 14 * dt; pos.y -= 6 * dt; bank = 0.3f;
                float g = Ground(pos, pos.y + 1);
                if (pos.y < g + 1.5f) { pos.y = g + 1.4f; landed = true; gliding = false; speed = 0; }
            }
            else { pitch *= Mathf.Exp(-4 * dt); bank *= Mathf.Exp(-4 * dt); float g = Ground(pos, pos.y + 1); if (g > -1e3f) pos.y += (g + 1.4f - pos.y) * (1 - Mathf.Exp(-6 * dt)); }
            transform.position = pos;
            transform.rotation = Quaternion.Euler(0, Yaw, 0);
            // (three's pitch about x and bank about z, mirrored: the bank turns the other way in Unity)
            if (body) body.localRotation = Quaternion.Euler(pitch * Mathf.Rad2Deg, 0, -bank * Mathf.Rad2Deg) * Quaternion.Euler(0, 0, landed ? 0 : Mathf.Sin(flap) * 2f);
            if (ridden)
            {
                var p = game.player;
                p.transform.position = pos + Vector3.up * 0.6f;
                p.transform.rotation = transform.rotation * Quaternion.Euler(pitch * Mathf.Rad2Deg, 0, -bank * Mathf.Rad2Deg);
                p.heading = Yaw;
                if (Pad.InteractDown()) Dismount();
            }
        }

        void Fly(float dt)
        {
            var mv = Pad.Move();
            float steer = Mathf.Abs(mv.x) < 0.12f ? 0 : mv.x, dive = mv.y;
            bool flapping = Pad.Jump();
            float thrust = Pad.BikeUpDown() ? 1 : 0;
            var fwd = new Vector3(Mathf.Sin(heading), 0, Mathf.Cos(heading));
            if (landed)
            {
                // walk her round slowly; take off with A / ×
                heading += steer * 1.5f * dt;
                if (dive > 0 || thrust > 0) pos += fwd * 5 * dt;
                float g = Ground(pos, pos.y + 2); if (g > -1e3f) pos.y += (g + 1.4f - pos.y) * (1 - Mathf.Exp(-6 * dt));
                if (flapping || thrust > 0.5f) { landed = false; speed = 16; pos.y += 1; Sounds.Instance?.Play("flap"); }
                return;
            }
            // bank to turn (a coordinated turn), pitch from the stick
            bank += (steer * 0.8f - bank) * (1 - Mathf.Exp(-3 * dt));
            float targetPitch = dive * 0.55f - (flapping ? 0.25f : 0);
            pitch += (targetPitch - pitch) * (1 - Mathf.Exp(-2.5f * dt));
            // (three's heading turns the other way: bank right, turn right)
            heading += Mathf.Tan(bank) * 9.8f / Mathf.Max(speed, 8) * dt * 2.2f;
            float drag = speed > 22 ? (speed - 22) * 0.35f : 0.25f;
            speed += (Mathf.Sin(pitch) * 22 - drag + (flapping ? 12 : 0) + thrust * 12) * dt;
            speed = Mathf.Clamp(speed, MinSpeed, MaxSpeed);
            float lift = flapping ? 9 : 0;
            float sink = Mathf.Clamp(Mathf.Lerp(2.5f, 0, (speed - MinSpeed) / (16 - MinSpeed)), -0.3f, 2.5f);
            fwd = new Vector3(Mathf.Sin(heading), 0, Mathf.Cos(heading));
            var vel = fwd * Mathf.Cos(pitch) * speed + Vector3.up * (-Mathf.Sin(pitch) * speed + lift - sink);
            var from = pos;
            var step = vel * dt;
            // swept: a wall stops her (the web's capsule sweep)
            if (Physics.SphereCast(from + Vector3.up * 0.2f, 1.2f, step.normalized, out var hit, step.magnitude + 0.2f, Mask, QueryTriggerInteraction.Ignore) && hit.normal.y < 0.6f)
            { step = Vector3.ProjectOnPlane(step, hit.normal) * 0.5f; speed *= 0.85f; }
            pos += step;
            float gy = Ground(pos, Mathf.Max(from.y, pos.y) + 0.5f);
            if (pos.y < gy + 1.4f)
            {
                pos.y = gy + 1.4f;
                if (speed < 22 || dive >= 0) { landed = true; speed = 0; pitch = 0; }
                else pitch = Mathf.Min(pitch, -0.1f);
            }
            if (pos.y > 900) pos.y = 900;
        }
    }
}
