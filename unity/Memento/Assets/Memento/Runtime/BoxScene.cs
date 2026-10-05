using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// Opening a makers' box (src/boxes/scene.js). They don't open like a lid on hinges: they wake,
    /// lift off the ground and come apart into light, leaving what they kept hovering there.
    ///   approach  the camera cuts to a low three-quarter shot over the traveller's shoulder; the
    ///             traveller is set square in front of the box, facing it
    ///   wake      the box shudders and hums, light leaking from it
    ///   rise      it lifts off the ground, turning slowly, and hangs there
    ///   dissolve  it comes apart from the top down (Surface.shader _Dissolve: noise, a burning edge);
    ///             the item grows out of the light at its centre
    ///   reveal    the box is gone; the item hovers, turning
    ///   card      what it is, what it does (B / ○, E, a click goes on)
    ///   out       the item flies to the traveller and is theirs; the camera goes back
    /// Back (Y / △, Esc) skips to the card.
    /// </summary>
    public class BoxScene : MonoBehaviour
    {
        static readonly string[] Order = { "approach", "wake", "rise", "dissolve", "reveal", "card", "out" };
        Game game; GameObject box; string item; System.Action onGrant;
        Dictionary<string, object> dims;
        float yaw;                      // the box's Unity yaw (rad)
        Vector3 F, S, basePos;          // its front and local +x (mirrored from three), its foot
        string phase; float t, clock, lift, cardT;
        bool granted, fanfared;
        public bool Done { get; private set; }
        Figure model;
        readonly List<Material> mats = new();
        float H, scale, standAt, LIFT, itemScale;
        Vector3 from;

        public static BoxScene Play(Game g, GameObject box, float yawU, string item, System.Action onGrant)
        {
            var bs = new GameObject("box scene " + item).AddComponent<BoxScene>();
            bs.Begin(g, box, yawU, item, onGrant);
            return bs;
        }

        float Time(string p) => dims.O("times").F(p, 0);
        Vector3 P(float x, float y, float z) => basePos + S * x + F * z + Vector3.up * y;
        Vector3 Heart(float k) => P(0, LIFT * k + H * scale / 2, 0);

        void Begin(Game g, GameObject b, float yawU, string id, System.Action grant)
        {
            game = g; box = b; item = id; onGrant = grant; yaw = yawU;
            dims = FigureLibrary.Instance?.BoxDims ?? new Dictionary<string, object>();
            H = dims.F("h", 0.485f); scale = dims.F("scale", 1.9f); standAt = dims.F("standAt", 1.42f); LIFT = dims.F("lift", 0.75f); itemScale = dims.F("item", 1.8f);
            basePos = box.transform.position;
            F = new Vector3(Mathf.Sin(yaw), 0, Mathf.Cos(yaw));
            S = new Vector3(-Mathf.Cos(yaw), 0, Mathf.Sin(yaw));
            foreach (var r in box.GetComponentsInChildren<Renderer>()) foreach (var m in r.materials) mats.Add(m);
            // square in front of the box, facing it
            var stand = P(0, 0, standAt);
            if (Physics.Raycast(stand + Vector3.up * 1.5f, Vector3.down, out var h, 3f) && Mathf.Abs(h.point.y - basePos.y) < 1.2f) stand.y = h.point.y; else stand.y = basePos.y;
            game.player.Teleport(stand, (yaw + Mathf.PI) * Mathf.Rad2Deg);
            game.player.frozen = true;
            var rec = FigureLibrary.Instance?.Item(item);
            if (rec != null) { model = FigureLibrary.Instance.Spawn(rec, transform, "item " + item); model.gameObject.SetActive(false); }
            game.rig.enabled = false;
            game.hud.cinematic = true;
            Enter("approach");
        }

        void Enter(string p)
        {
            phase = p; t = 0;
            var S = Sounds.Instance;
            if (p == "wake") S?.Play("box_creak");
            if (p == "rise") S?.Play("box_hum");
            if (p == "dissolve") S?.Play("box_burst");
            if (p == "reveal") S?.Play("fanfare");
            if (p == "out") S?.Play("chime");
            if (p == "dissolve" && model) model.gameObject.SetActive(true);
            if (p == "reveal") SetDissolve(1);
            if (p == "card")
            {
                var def = FigureLibrary.Instance?.ItemDef(item);
                string text = def != null ? $"<b>What it is</b>\n{def.S("text")}" + (string.IsNullOrEmpty(def.S("use")) ? "" : $"\n\n<b>What it does</b>\n{def.S("use")}") + "\n\n<i>Left by the makers for one who has come a long way.</i>" : "";
                game.hud.ShowCard(def?.S("name") ?? item, text, dims.F("cardMin", 0.5f));
                cardT = 0;
            }
            if (p == "out")
            {
                if (!granted) { granted = true; onGrant?.Invoke(); }
                from = model ? model.transform.position : Heart(1);
            }
        }

        void SetDissolve(float k)
        {
            float y0 = box.transform.position.y, y1 = y0 + H * scale + 0.05f;
            foreach (var m in mats) m.SetVector("_Dissolve", new Vector4(k, 0.09f, y0 - 0.02f, y1));
            foreach (var r in box.GetComponentsInChildren<Renderer>()) r.shadowCastingMode = k > 0 ? UnityEngine.Rendering.ShadowCastingMode.Off : UnityEngine.Rendering.ShadowCastingMode.On;
            if (k >= 1) foreach (var r in box.GetComponentsInChildren<Renderer>()) r.enabled = false;
        }

        static float Smooth(float x) { x = Mathf.Clamp01(x); return x * x * (3 - 2 * x); }
        static float EaseOut(float x) => 1 - Mathf.Pow(1 - Mathf.Clamp01(x), 3);

        void Update()
        {
            if (Done) return;
            float dt = UnityEngine.Time.deltaTime;
            t += dt; clock += dt;
            if (Pad.BackDown() && phase != "card" && phase != "out") Skip();
            if (phase == "card") { cardT += dt; if (game.hud.card == null && cardT > 0.1f) Enter("out"); }
            float T = Time(phase);
            if (T > 0 && t >= T) Enter(Order[System.Array.IndexOf(Order, phase) + 1]);
            int at = System.Array.IndexOf(Order, phase);
            bool After(string p) => at > System.Array.IndexOf(Order, p);
            // the box: a shudder, the lift, the slow turn, then it comes apart
            float shake = 0;
            if (phase == "wake") shake = Smooth(t / Time("wake")) * (0.6f + 0.4f * Mathf.Pow(Mathf.Sin(t * 9), 2));
            if (phase == "rise") lift = EaseOut(t / Time("rise")); else if (After("rise")) lift = 1;
            float bob = lift * Mathf.Sin(clock * 1.8f) * 0.04f;
            box.transform.position = basePos + Vector3.up * (LIFT * lift + bob);
            float rx = Mathf.Sin(t * 47) * 0.02f * shake + lift * 0.04f * Mathf.Sin(clock * 1.1f), rz = Mathf.Sin(t * 53) * 0.02f * shake;
            float ry = yaw - (0.6f * Smooth(lift) + Mathf.Sin(t * 31) * 0.03f * shake);
            box.transform.rotation = Quaternion.Euler(rx * Mathf.Rad2Deg, ry * Mathf.Rad2Deg, -rz * Mathf.Rad2Deg);
            if (phase == "dissolve") SetDissolve(Smooth(t / Time("dissolve")));
            // the item: grows out of the light at the box's heart and hovers there
            if (model && model.gameObject.activeSelf)
            {
                var mt = model.transform;
                if (phase == "dissolve") { mt.position = Heart(lift); mt.localScale = Vector3.one * itemScale * Mathf.Max(1e-3f, Smooth((t / Time("dissolve") - 0.15f) / 0.7f)); }
                else if (phase == "reveal" || phase == "card") { mt.position = Heart(1); mt.localScale = Vector3.one * itemScale; }
                else if (phase == "out")
                {
                    float u = Smooth(t / 0.6f);
                    mt.position = Vector3.Lerp(from, P(0, 1.2f, standAt), u);
                    mt.localScale = Vector3.one * Mathf.Max(1e-3f, itemScale * (1 - u));
                    if (u >= 1) model.gameObject.SetActive(false);
                }
                mt.position += Vector3.up * Mathf.Sin(clock * 2.2f) * 0.04f;
                mt.rotation = Quaternion.Euler(0.15f * Mathf.Sin(clock * 0.9f) * Mathf.Rad2Deg, -clock * 1.1f * Mathf.Rad2Deg, 0);
                foreach (var m in model.materials) if (m.GetFloat("_Fluid") > 0.5f) m.SetVector("_FluidA", new Vector4(1, 4, clock, 0));
            }
            Camera();
            if (phase == "out" && t >= dims.F("out", 1.3f)) End();
        }

        void Camera()
        {
            if (phase == "out") { game.rig.enabled = true; return; }
            int at = System.Array.IndexOf(Order, phase);
            Vector3 pos, look; float fov;
            if (at < System.Array.IndexOf(Order, "reveal"))
            {
                float since = 0; for (int k = 0; k < at; k++) since += Time(Order[k]); since += t;
                float k1 = 1 - 0.18f * Smooth(since / 4.4f);
                pos = P(1.7f * k1, 1.15f + 0.35f * lift, standAt + 2.6f * k1);
                look = Heart(lift) + Vector3.down * 0.15f;
                fov = 46;
            }
            else
            {
                float since = t; for (int k = System.Array.IndexOf(Order, "reveal"); k < at; k++) since += Time(Order[k]);
                float k1 = 1 - 0.12f * Smooth(since / 5);
                pos = P(1.25f * k1, 1.45f, standAt + 0.9f * k1);
                look = Heart(1);
                fov = 44;
            }
            // keep out of walls: pull in to whatever stands between the traveller's chest and the lens
            var chest = P(0, 1.3f, standAt);
            var dir = pos - chest; float d = dir.magnitude;
            if (Physics.Raycast(chest, dir / d, out var hit, d)) pos = chest + dir / d * Mathf.Max(0.9f, hit.distance - 0.25f);
            pos += new Vector3(Mathf.Sin(clock * 0.7f) * 0.012f, Mathf.Sin(clock * 0.9f) * 0.01f, 0);
            var cam = game.cam;
            cam.transform.position = pos; cam.transform.LookAt(look); cam.fieldOfView = fov;
        }

        public void Skip()
        {
            if (Done || phase == "card" || phase == "out") return;
            if (model) model.gameObject.SetActive(true);
            lift = 1; SetDissolve(1);
            Enter("card");
        }

        void End()
        {
            if (Done) return;
            Done = true;
            if (!granted) { granted = true; onGrant?.Invoke(); }
            SetDissolve(1);
            box.SetActive(false);
            game.rig.enabled = true;
            game.cam.fieldOfView = 55;
            game.player.frozen = false;
            game.hud.cinematic = false;
            Destroy(gameObject);
        }
    }
}
