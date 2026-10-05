using System.Threading.Tasks;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The traveller (src/player.js): walk 3.8 m/s, run 7.2, jump 13 m/s under a gravity of 32,
    /// step onto anything under 0.6 m; push into a steep wall to climb it (W/S up and down,
    /// A/D sideways, about 20 s of stamina), and the top pulls you up over the edge (mantle).
    /// Health 0..1: landings harder than 26 m/s knock you over (a limp tumble, then up again),
    /// 48 m/s and more are fatal; fire hurts while you touch it; after 5 s the bar refills.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class Player : MonoBehaviour
    {
        public const float Walk = 3.8f, Run = 7.2f, Gravity = 32f, JumpSpeed = 13f, ClimbSpeed = 1.7f, Stamina = 20f, JetThrust = 54f, JetMaxUp = 15f;
        public const float FallTumble = 26f, FallLethal = 48f;
        public CharacterController cc;
        public Vector3 vel;
        public float heading;            // Unity yaw (deg)
        public bool onGround, climbing, mantling, down, dead, riding, frozen, thrusting;
        public float health = 1f, stamina = Stamina;
        /// <summary>Below this you are put back where you last stood safely (level.killY: the shaft's acid lake; the desert's -200).</summary>
        public float killY = -200;
        float hurtT = 99, downT, mantleT, coyote, climbCooldown;
        Vector3 wallN, mantleFrom, mantleTo, lastSafe;
        public Transform model;          // the traveller, dressed (Figures.cs)
        public Figure figure;
        Animation anim;
        float climbF, climbS;
        public Transform camYaw;         // the camera rig (moves are relative to its yaw)
        public System.Action<string> toast = _ => { };
        public System.Func<bool> onAirJump;
        public System.Collections.Generic.List<Vector3> auto;   // walked along these points (a cinematic: stepping out of the ship)   // the fluid tool's boost (FluidTool.cs)
        public float glideSpeed, glideTurn;
        public float SpeedXZ => new Vector2(vel.x, vel.z).magnitude;
        public Transform HeadTransform => figure ? (headT ??= figure.Bone("Head")) : null;
        Transform headT;

        public void Init(Vector3 at, float yawDeg)
        {
            cc = GetComponent<CharacterController>();
            cc.radius = 0.4f; cc.height = 1.8f; cc.center = new Vector3(0, 0.9f, 0); cc.stepOffset = 0.6f; cc.slopeLimit = 50; cc.skinWidth = 0.05f;
            Teleport(at, yawDeg);
            var rec = FigureLibrary.Instance?.Person("traveller");
            if (rec != null)
            {
                // the people's own body as the traveller: the suit painted on, the kit of traveller.glb worn (people.mjs)
                figure = FigureLibrary.Instance.Spawn(rec, transform, "traveller");
                model = figure.transform;
                foreach (var r in figure.renderers) r.gameObject.layer = gameObject.layer;
            }
            else _ = LoadModel();
        }

        public void Teleport(Vector3 at, float yawDeg)
        {
            cc.enabled = false; transform.position = at + Vector3.up * 0.05f; cc.enabled = true;
            heading = yawDeg; vel = Vector3.zero; lastSafe = at;
            transform.rotation = Quaternion.Euler(0, heading, 0);
        }

        async Task LoadModel()
        {
            GameObject go;
            try { go = await Characters.Spawn("traveller.glb", transform); }
            catch (System.Exception e) { Debug.LogError($"Memento: the traveller could not be loaded: {e}"); return; }
            if (go == null) return;
            model = go.transform;
            // the bubble helmet is glass in the web game (only its rim drawn): left out here
            Characters.Restyle(go, true, null, n => n.Contains("Bubble"));
            anim = go.GetComponent<Animation>();
            if (anim && anim.GetClip("Idle")) anim.Play("Idle");
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 1 / 20f);
            if (frozen || riding) { Animate(dt, 0); return; }
            if (down) { UpdateDown(dt); return; }
            hurtT += dt;
            if (hurtT > 5 && !dead) health = Mathf.Min(1, health + dt * 0.25f);

            var mv = Pad.Move();
            var yawQ = Quaternion.Euler(0, camYaw ? camYaw.eulerAngles.y : heading, 0);
            Vector3 wish = yawQ * new Vector3(mv.x, 0, mv.y);
            if (auto != null && auto.Count > 0)
            {
                var to = auto[0] - transform.position; to.y = 0;
                if (to.magnitude < 0.45f) auto.RemoveAt(0);
                wish = to.normalized * 0.55f; mv = new Vector2(0, 0.55f);
                if (auto.Count == 0) { auto = null; wish = Vector3.zero; mv = Vector2.zero; }
            }
            bool run = Pad.Run();

            if (mantling) { UpdateMantle(dt); return; }
            if (climbing) { UpdateClimb(dt, mv, run); return; }

            // in the water (swim.js): wading slows the walk; past chest-deep you float and swim
            float? surf = waterAt?.Invoke(transform.position);
            if (surf.HasValue && UpdateSwim(dt, surf.Value, wish, mv, run)) return;
            swimming = false;
            float wade = surf.HasValue ? Mathf.Lerp(1, SwimWadeSlow, Mathf.InverseLerp(SwimWade, SwimFloat, surf.Value - transform.position.y)) : 1;
            float speed = (run ? Run : Walk) * wade * Mathf.Lerp(0.35f, 1, Mathf.Clamp01(mv.magnitude));
            Vector3 targetV = wish.sqrMagnitude > 0.001f ? wish.normalized * speed * Mathf.Clamp01(mv.magnitude / 0.9f + 0.1f) : Vector3.zero;
            float accel = onGround ? 14f : 3f;
            vel.x = Mathf.MoveTowards(vel.x, targetV.x, accel * speed * dt);
            vel.z = Mathf.MoveTowards(vel.z, targetV.z, accel * speed * dt);
            if (wish.sqrMagnitude > 0.01f) heading = Mathf.MoveTowardsAngle(heading, Mathf.Atan2(wish.x, wish.z) * Mathf.Rad2Deg, 720 * dt);

            coyote = onGround ? 0.12f : coyote - dt;
            bool jumpDown = Pad.JumpDown(), pressedNow = jumpDown;
            if (jumpDown && coyote > 0) { vel.y = JumpSpeed; coyote = 0; onGround = false; jumpDown = false; }
            // a fresh press in the air: the fluid's boost (fluid-tool.js)
            if (jumpDown && !onGround && onAirJump != null && onAirJump()) { }
            vel.y -= Gravity * dt;
            // the fluid wings (with the glider): hold jump while falling (player.js): forward along the heading,
            // A / D bank and turn, W dives, S flares
            var tool = FluidTool.Instance;
            // the jets (items: backpack + jetpack): hold A / × in the air to thrust while the tank has fluid;
            // out of fluid (or with L3 / Shift held), the wings if you have them (player.js)
            bool canJet = tool && tool.CanJet;
            bool wantGlide = tool && tool.CanGlide && !onGround && Pad.Jump() && (Pad.Run() || !canJet || tool.charges <= 0.004f);
            thrusting = canJet && !onGround && Pad.Jump() && tool.charges > 0.02f && !pressedNow && !wantGlide && tool.BurnJet(dt);
            if (thrusting)
            {
                // tilted forward: part of the thrust drives you along when you steer
                if (wish.sqrMagnitude > 0.01f) { var along = wish.normalized * JetThrust * 0.35f * dt; vel.x += along.x; vel.z += along.z; }
                vel.y = Mathf.Min(vel.y + JetThrust * dt, JetMaxUp);   // (net of gravity, taken off above: 22 m/s² up)
            }
            bool wasGliding = tool && tool.gliding;
            if (tool) tool.gliding = wantGlide && (vel.y < 0 || wasGliding);
            if (tool && tool.gliding)
            {
                if (!wasGliding) glideSpeed = Mathf.Max(new Vector2(vel.x, vel.z).magnitude, 11);
                float target = mv.y > 0.3f ? 30 : mv.y < -0.3f ? 7 : 15;
                glideSpeed += (target - glideSpeed) * (1 - Mathf.Exp(-(mv.y > 0.3f ? 0.9f : 0.6f) * dt));
                float sink = mv.y > 0.3f ? 7 : mv.y < -0.3f ? 1.3f : 2.4f;
                glideTurn = Mathf.Lerp(glideTurn, mv.x * 1.25f, 1 - Mathf.Exp(-4 * dt));
                heading += glideTurn * Mathf.Rad2Deg * dt;
                var fw = Quaternion.Euler(0, heading, 0) * Vector3.forward * glideSpeed;
                vel.x = fw.x; vel.z = fw.z;
                vel.y += Gravity * dt;
                vel.y += (-sink - vel.y) * (1 - Mathf.Exp(-3 * dt));
            }
            float fallSpeed = -vel.y;
            var flags = cc.Move(vel * dt);
            bool wasGround = onGround;
            onGround = (flags & CollisionFlags.Below) != 0 || (vel.y <= 0 && Grounded());
            if (onGround)
            {
                if (!wasGround) Land(fallSpeed);
                if (vel.y < -2) vel.y = -2;
                if (Physics.Raycast(transform.position + Vector3.up * 0.5f, Vector3.down, out var hit, 1.2f) && hit.normal.y > 0.8f) lastSafe = transform.position;
            }
            if ((flags & CollisionFlags.Above) != 0 && vel.y > 0) vel.y = 0;
            transform.rotation = Quaternion.Euler(0, heading, 0);

            // climbing: pushing into a steep wall (in the air at once, on the ground after a moment)
            climbCooldown -= dt;
            if (mv.y > 0.5f && climbCooldown <= 0 && WallAhead(out var wn) && (!onGround || (flags & CollisionFlags.Sides) != 0 || SpeedXZ < 0.6f))
            {
                climbing = true; wallN = wn; vel = Vector3.zero; stamina = Stamina;
                heading = Mathf.Atan2(-wn.x, -wn.z) * Mathf.Rad2Deg;
            }
            if (transform.position.y < killY) Respawn();
            Animate(dt, SpeedXZ);
        }

        bool Grounded() => Physics.SphereCast(transform.position + Vector3.up * 0.5f, 0.35f, Vector3.down, out _, 0.25f);

        // ------------------------------------------------------------ swimming (swim.js, simplified: on the surface)
        public const float SwimWade = 0.25f, SwimWadeSlow = 0.5f, SwimFloat = 1.3f, SwimStand = 1.1f, SwimRide = 1.28f, SwimSpeed = 2.5f, SwimSprint = 4.6f, SwimAccel = 2.6f, SwimHop = 7.5f;
        /// <summary>The water's surface over a point (Waters.cs), or null: dry.</summary>
        public System.Func<Vector3, float?> waterAt;
        public bool swimming;
        public System.Action<string> onSwim;
        bool UpdateSwim(float dt, float surface, Vector3 wish, Vector2 mv, bool run)
        {
            var p = transform.position;
            float over = surface - p.y;
            if (!swimming)
            {
                // walked in past the chest, or fell in
                bool deep = over >= SwimFloat && (!onGround || !Physics.Raycast(p + Vector3.up * 0.3f, Vector3.down, 0.6f));
                if (!(over >= SwimFloat && (deep || onGround)) && !(vel.y < 0 && !onGround && over >= 0.35f && !Physics.Raycast(p, Vector3.down, SwimFloat))) return false;
                swimming = true; onSwim?.Invoke("enter"); Sounds.Instance?.Play("splash", 0.6f);
            }
            // where the bed comes up close under the surface, you stand again
            if (Physics.Raycast(p + Vector3.up * 0.3f, Vector3.down, out var bed, 3f) && surface - bed.point.y < SwimStand) { swimming = false; onSwim?.Invoke("exit"); return false; }
            float sp = run ? SwimSprint : SwimSpeed;
            var target = wish.sqrMagnitude > 0.001f ? wish.normalized * sp * Mathf.Clamp01(mv.magnitude / 0.9f + 0.1f) : Vector3.zero;
            float k = 1 - Mathf.Exp(-SwimAccel * dt);
            vel.x += (target.x - vel.x) * k; vel.z += (target.z - vel.z) * k;
            vel.y = (surface - SwimRide - p.y) * 3.5f + Mathf.Sin(Time.time * 2.1f) * 0.08f;
            if (wish.sqrMagnitude > 0.01f) heading = Mathf.MoveTowardsAngle(heading, Mathf.Atan2(wish.x, wish.z) * Mathf.Rad2Deg, 300 * dt);
            // Space at the surface: a kick up (onto a low ledge, out of the water)
            if (Pad.JumpDown()) { vel.y = SwimHop; swimming = false; onSwim?.Invoke("hop"); cc.Move(vel * dt); return true; }
            var flags = cc.Move(vel * dt);
            onGround = false;
            transform.rotation = Quaternion.Euler(0, heading, 0);
            // a ledge at the surface: pushing into it pulls you out (the mantle)
            if (mv.y > 0.5f && WallAhead(out var wn)) { swimming = false; climbing = true; wallN = wn; vel = Vector3.zero; stamina = Stamina; heading = Mathf.Atan2(-wn.x, -wn.z) * Mathf.Rad2Deg; }
            lastSafeWater = p;
            Animate(dt, SpeedXZ * 0.6f);
            return true;
        }
        Vector3 lastSafeWater;

        bool WallAhead(out Vector3 n)
        {
            var fwd = Quaternion.Euler(0, heading, 0) * Vector3.forward;
            n = Vector3.zero;
            if (Physics.Raycast(transform.position + Vector3.up * 1.2f, fwd, out var h, 1.0f) && Mathf.Abs(h.normal.y) < 0.75f) { n = Flat(h.normal); return true; }
            return false;
        }
        static Vector3 Flat(Vector3 v) { v.y = 0; return v.sqrMagnitude > 1e-6f ? v.normalized : Vector3.forward; }

        void UpdateClimb(float dt, Vector2 mv, bool run)
        {
            climbF = Mathf.Abs(mv.y) > 0.1f ? Mathf.Sign(mv.y) * Mathf.Min(1, Mathf.Abs(mv.y)) : 0; climbS = Mathf.Abs(mv.x) > 0.1f ? Mathf.Sign(mv.x) * Mathf.Min(1, Mathf.Abs(mv.x)) : 0;
            stamina -= dt * (run ? 2f : 1f);
            var right = Vector3.Cross(Vector3.up, -wallN).normalized;
            float sp = ClimbSpeed * (run ? 1.6f : 1f);
            var move = (Vector3.up * mv.y + right * mv.x) * sp * dt;
            // hold the wall: the body ~0.35 m off it
            var chest = transform.position + Vector3.up * 1.2f;
            if (Physics.Raycast(chest, -wallN, out var h, 1.4f) && Mathf.Abs(h.normal.y) < 0.75f)
            {
                wallN = Vector3.Slerp(wallN, Flat(h.normal), 10 * dt).normalized;
                float off = h.distance - 0.4f;
                move += -wallN * off * Mathf.Min(1, 10 * dt);
            }
            else if (mv.y > 0.1f && TryMantle()) return;
            else { climbing = false; climbCooldown = 0.4f; return; }
            // over the top: nothing at the head any more -> pull up
            var head = transform.position + Vector3.up * 1.9f;
            if (mv.y > 0.1f && !Physics.Raycast(head, -wallN, 1.2f) && TryMantle()) return;
            cc.Move(move);
            heading = Mathf.Atan2(-wallN.x, -wallN.z) * Mathf.Rad2Deg;
            transform.rotation = Quaternion.Euler(0, heading, 0);
            if (Pad.JumpDown()) { climbing = false; climbCooldown = 0.5f; vel = wallN * 5f + Vector3.up * 7f; }
            if (stamina <= 0) { climbing = false; climbCooldown = 1f; toast("Too tired to hold on"); }
            if (mv.y < -0.1f && Physics.Raycast(transform.position + Vector3.up * 0.2f, Vector3.down, 0.3f)) { climbing = false; climbCooldown = 0.6f; }
            Animate(dt, mv.magnitude * 1.5f);
        }

        bool TryMantle()
        {
            var probe = transform.position + Vector3.up * 2.6f - wallN * 0.7f;
            if (Physics.Raycast(probe, Vector3.down, out var top, 2.4f) && top.normal.y > 0.7f)
            {
                mantling = true; climbing = false; mantleT = 0;
                mantleFrom = transform.position; mantleTo = top.point + Vector3.up * 0.05f;
                return true;
            }
            return false;
        }

        void UpdateMantle(float dt)
        {
            mantleT += dt / 0.7f;
            float k = Mathf.SmoothStep(0, 1, mantleT);
            var p = Vector3.Lerp(mantleFrom, mantleTo, k);
            p.y = Mathf.Lerp(mantleFrom.y, mantleTo.y, Mathf.SmoothStep(0, 1, Mathf.Min(1, mantleT * 1.6f)));
            cc.enabled = false; transform.position = p; cc.enabled = true;
            if (mantleT >= 1) { mantling = false; vel = Vector3.zero; onGround = true; }
            Animate(dt, 1);
        }

        void Land(float speed)
        {
            if (speed < FallTumble) return;
            if (speed >= FallLethal) { Hurt(1, "fall"); return; }
            float k = Mathf.InverseLerp(FallTumble, FallLethal, speed);
            health = Mathf.Max(0.05f, health - 0.15f - 0.5f * k);
            hurtT = 0;
            KnockDown();
        }

        /// <summary>Take k of the health bar (fire, falls). Empty: knocked out, a Restart asked for.</summary>
        public void Hurt(float k, string why)
        {
            if (dead) return;
            health -= k; hurtT = 0;
            if (health <= 0) { health = 0; dead = true; KnockDown(); toast(why == "fall" ? "That was too far to fall." : "Knocked out."); }
        }

        // ------------------------------------------------------------ the limp tumble (ragdoll.js, simplified)
        Vector3 downAxis; float downSpin;
        public void KnockDown()
        {
            down = true; downT = 0; climbing = false; mantling = false;
            downAxis = Quaternion.Euler(0, heading, 0) * Vector3.right;
            downSpin = Random.value < 0.5f ? 1 : -1;
            if (anim) anim.Stop();
            if (figure) figure.culled = true;
        }
        void UpdateDown(float dt)
        {
            downT += dt;
            vel.x *= Mathf.Exp(-3 * dt); vel.z *= Mathf.Exp(-3 * dt); vel.y -= Gravity * dt;
            var f = cc.Move(vel * dt);
            if ((f & CollisionFlags.Below) != 0) vel.y = 0;
            // the body goes over and lies on the ground; then (unless knocked out) it gets back up
            float lie = dead ? Mathf.Min(1, downT * 2.5f) : downT < 1.8f ? Mathf.Min(1, downT * 2.5f) : Mathf.Max(0, 1 - (downT - 1.8f) * 1.8f);
            if (model)
            {
                model.localRotation = Quaternion.AngleAxis(-85 * lie, Vector3.right) * Quaternion.AngleAxis(12 * lie * downSpin, Vector3.forward);
                model.localPosition = new Vector3(0, 0.25f * lie, 0);
            }
            if (!dead && downT > 2.4f) { down = false; if (figure) figure.culled = false; if (model) { model.localRotation = Quaternion.identity; model.localPosition = Vector3.zero; } }
            if (dead && downT > 1.2f && Pad.ConfirmDown()) Respawn();
        }
        public void Respawn()
        {
            dead = false; down = false; health = 1; if (figure) figure.culled = false;
            if (model) { model.localRotation = Quaternion.identity; model.localPosition = Vector3.zero; }
            Teleport(lastSafe, heading);
        }

        // ------------------------------------------------------------ animation (animator.js on the baked clips: Figure.cs)
        string playing;
        public bool talkingNow;
        float lastPhase;
        void Animate(float dt, float speed)
        {
            if (figure)
            {
                var fs = new Figure.State
                {
                    speed = climbing || mantling || riding ? 0 : SpeedXZ, onGround = onGround || climbing || mantling || riding,
                    mode = riding ? Figure.Mode.Drive : mantling ? Figure.Mode.Ledge : climbing ? Figure.Mode.Climb : talkingNow ? Figure.Mode.Talk : Figure.Mode.Ground,
                    climbF = climbF, climbS = climbS, climbRate = 1, ledgeT = mantleT,
                    walkAt = Mathf.Min(FigureLibrary.Instance.nativeWalk * 1.2f, Walk * 0.4f), jogAt = Walk, sprintAt = Run, strideScale = 1,
                };
                figure.Drive(dt, fs);
                // footsteps: a foot comes down twice a gait cycle (audio.js step, in the sand)
                float ph = figure.Phase;
                if (onGround && !riding && !climbing && SpeedXZ > 0.8f && (Mathf.Floor(ph * 2) != Mathf.Floor(lastPhase * 2)))
                {
                    Sounds.Instance?.Play(SpeedXZ > 6 ? "step_sand_run" : "step_sand_walk");
                    // and a print where the foot came down (life.js Footprints), left and right in turn
                    float side = Mathf.Floor(ph * 2) % 2 == 0 ? 1 : -1;
                    Game.Instance?.ambient?.Step(transform.position + transform.right * 0.11f * side, heading);
                }
                lastPhase = ph;
                return;
            }
            if (!anim) return;
            string want = speed > 0.3f ? "Walk" : "Idle";
            if (!anim.GetClip(want)) return;
            if (want != playing) { anim.CrossFade(want, 0.2f); playing = want; }
            var st = anim[want];
            if (st != null) st.speed = want == "Walk" ? Mathf.Clamp(speed / 2.2f, 0.6f, 2.6f) : 1f;
            if (!onGround && !climbing && !mantling && st != null) st.speed = 0.15f;   // in the air: a held stride
        }
    }
}
