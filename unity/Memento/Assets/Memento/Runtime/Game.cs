using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Memento
{
    /// <summary>
    /// The game's bootstrap: loads a world's export (the desert first: the title and the prologue
    /// are there), sets up the page's look, the sun, the camera, then the traveller, the people,
    /// the story and the HUD. <see cref="Travel"/> goes to another world: the ship takes off, the
    /// page is redrawn ("sketching …"), the old world is let go and the new one built from its
    /// export, keeping the save, the traveller, his gear and the HUD; then the approach from space
    /// and the landing at that world's ship site (ShipScene).
    /// </summary>
    public class Game : MonoBehaviour
    {
        public WorldLoader world;
        public MementoLook look;
        public Camera cam;
        public Light sun;
        public static Game Instance;
        public bool Built { get; private set; }
        // the play (Play.cs sets these up)
        public GameState state;
        public Quests quests;
        public Hud hud;
        public Player player;
        public CameraRig rig;
        public Crowd crowd;
        public DesertStory story;
        public WorldStory worldStory;
        public Bike bike;
        /// <summary>Vael's bird (BirdMount), where the world's mount is the bird.</summary>
        public BirdMount bird;
        /// <summary>Whatever you can ride here (the hoverbike, the bird), for the camera and the sound.</summary>
        public IMount Mount => bike ? bike : bird ? bird : null;
        public FluidTool tool;
        public ShipScene ship;
        public Ambient ambient;
        public Wildlife wildlife;
        public Observatory observatory;
        public DesertErrands errands;
        public Relics relics;
        public QuestMarker marker;
        public Atmo atmo;
        public static bool playPrologue = true;
        public static bool useSaves => !Application.isBatchMode;   // (a batch run starts fresh; Batch.Play tests the saves itself)
        public Dictionary<string, object> loaded;   // a new game opens in the ship, out in space (Batch: -noPrologue)
        public readonly System.Collections.Generic.List<Npc> npcs = new();
        public string prompt;
        /// <summary>The world you are in (its level id: desert, incal, arzach…).</summary>
        public string Level => world ? world.Id : "desert";
        /// <summary>The first world to build (the title's backdrop, or Batch: -world id).</summary>
        public static string startWorld = "desert";
        /// <summary>A batch run started in another world: the ship powered, the backpack on (as if the desert were done).</summary>
        public static bool batchStart;
        /// <summary>A world being swapped in (the loading page is up).</summary>
        public bool Switching { get; private set; }
        public string loadingTitle;

        public Vector3? promptAt;                   // where the use prompt floats (the interactable's place), null: in the status box
        /// <summary>The title screen first (the Title scene's Loading sets it; a batch run with -title too).</summary>
        public static bool showTitle;
        public TitleScreen title;

        void Awake()
        {
            Instance = this;
            // (a fresh desert, after a quit to the title: what the last one registered goes)
            Interact.All.Clear(); Targets.All.Clear();
            if (world == null) world = GetComponentInChildren<WorldLoader>();
            if (world && !showTitle && startWorld != "desert" && WorldLoader.Exported(startWorld)) world.folder = startWorld;
            if (!BuildWorld()) { enabled = false; return; }
            if (showTitle) { title = gameObject.AddComponent<TitleScreen>(); title.Begin(this); return; }
            StartPlay();
        }
        /// <summary>From the title: the play begins (a save continued, or the prologue).</summary>
        public void BeginPlay() { title = null; StartPlay(); }

        /// <summary>Where you are: the desert's regions (biome.js biomeAtmosphere: golden dunes, rose canyons, salt flats), or the world's own (level.atmo's names).</summary>
        public string Region(Vector3 p)
        {
            if (Level != "desert") return atmo != null && atmo.NameAt(p) is { Length: > 0 } n ? n : world.Level?.S("title") ?? Level;
            // (three's x is mirrored in Unity: the field is read at -x)
            float x = -p.x, z = p.z;
            float f = Mathf.Sin(x * 0.0021f) * Mathf.Cos(z * 0.0017f - 0.7f) + 0.5f * Mathf.Sin((x + z) * 0.0011f);
            float rose = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(0.3f, 0.6f, f)), salt = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(-0.3f, -0.6f, f));
            return rose > 0.5f ? "Rose canyons" : salt > 0.5f ? "Salt flats" : "Golden dunes";
        }

        /// <summary>The world and the look only (what the editor's batch shots need).</summary>
        public void BuildForEditor() { Instance = this; BuildWorld(); }
        /// <summary>Another world's look only, for the editor's batch shots (the old one let go).</summary>
        public bool BuildForEditor(string id)
        {
            Instance = this;
            if (Built && world && world.Id != id) { world.Unload(); Built = false; }
            if (world) world.folder = id; else startWorld = id;
            return BuildWorld();
        }

        bool BuildWorld()
        {
            if (Built) return true;
            QualitySettings.vSyncCount = 1;
            if (!world) world = new GameObject("World").AddComponent<WorldLoader>();
            if (!world.transform.parent) world.transform.SetParent(transform, false);
            if (startWorld != "desert" && world.folder == "desert" && WorldLoader.Exported(startWorld) && !showTitle) world.folder = startWorld;
            world.keepBin = true;   // (the people are dressed from it: Play.Begin, then it is let go)
            if (!world.Build()) return false;
            if (!sun)
            {
                sun = new GameObject("Sun").AddComponent<Light>();
                sun.transform.SetParent(transform, false);
                sun.type = LightType.Directional;
                sun.shadows = LightShadows.Soft;
                sun.shadowBias = 0.6f; sun.shadowNormalBias = 0.5f;
                sun.intensity = 1;
            }
            if (!cam)
            {
                cam = new GameObject("Camera").AddComponent<Camera>();
                cam.transform.SetParent(transform, false);
                cam.tag = "MainCamera";
                cam.nearClipPlane = 0.1f; cam.farClipPlane = 6000f;
                cam.fieldOfView = 55;
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = Color.black;
                cam.allowMSAA = false; cam.allowHDR = false;
                var extra = cam.gameObject.AddComponent<UniversalAdditionalCameraData>();
                extra.renderPostProcessing = false;
                extra.renderShadows = true;
                cam.gameObject.AddComponent<AudioListener>();
            }
            RenderSettings.skybox = null;
            RenderSettings.ambientMode = AmbientMode.Flat;
            if (!look) look = gameObject.AddComponent<MementoLook>();
            look.sun = sun;
            look.Load(world.World.O("look"), world.World.L("lights"));
            atmo = Atmo.From(world.World.O("atmo"));
            var p = world.Places;
            cam.transform.position = p.V3("spawn") + new Vector3(0, 2.2f, -5);
            cam.transform.LookAt(p.V3("spawn") + Vector3.up * 1.2f);
            Built = true;
            return true;
        }

        protected virtual void StartPlay()
        {
            var setup = GetComponent<Play>();
            if (!setup) setup = gameObject.AddComponent<Play>();
            setup.Begin(this);
        }

        // ------------------------------------------------------------------ travel
        /// <summary>The worlds the port can go to: those exported (scripts/unity-export/export-all.mjs).</summary>
        public static bool CanTravelTo(string id) => WorldLoader.Exported(id);

        /// <summary>
        /// Go to another world by ship (the map's "Travel to …?"): the takeoff here, the loading page,
        /// the new world built, the approach from space and the landing there. `viaShip` false: no
        /// cinematics (a save continued in another world, the batch's own jumps), you stand at its ramp.
        /// </summary>
        public void Travel(string id, bool viaShip = true)
        {
            if (Switching || !CanTravelTo(id)) return;
            StartCoroutine(TravelRoutine(id, viaShip));
        }

        IEnumerator TravelRoutine(string id, bool viaShip)
        {
            Switching = true;
            state.Emit("travel", id);
            state.Set("ship.level", id);
            if (viaShip && ship)
            {
                bool done = false;
                ship.StartTakeoff(id, TitleOf(id), () => done = true);
                while (!done) yield return null;
                state.Set("ship.launched", true);
            }
            loadingTitle = TitleOf(id);
            hud?.ShowLoading($"sketching {loadingTitle.ToLowerInvariant()}…");
            yield return null; yield return null;   // (the page drawn before the work starts)
            SwitchWorldNow(id);
            yield return null;
            hud?.ShowLoading(null);
            loadingTitle = null;
            Switching = false;
            if (viaShip && ship) ship.StartArrival();
            else ship?.ArrivedQuietly();
        }

        /// <summary>Swap the world in place (the loading page should be up): the old one let go, the new one built and peopled.</summary>
        public void SwitchWorldNow(string id)
        {
            var play = GetComponent<Play>();
            float t0 = Time.realtimeSinceStartup;
            play?.TearDownWorld();
            // the traveller's own meshes and materials stay (he came from the old world's export)
            var keepMats = new HashSet<Material>(); var keepMeshes = new HashSet<Mesh>();
            if (player)
                foreach (var r in player.GetComponentsInChildren<Renderer>(true))
                {
                    foreach (var m in r.sharedMaterials) if (m) keepMats.Add(m);
                    if (r is SkinnedMeshRenderer s && s.sharedMesh) keepMeshes.Add(s.sharedMesh);
                    if (r.TryGetComponent<MeshFilter>(out var mf) && mf.sharedMesh) keepMeshes.Add(mf.sharedMesh);
                }
            FigureLibrary.Instance?.Release(keepMeshes);
            world.Unload(keepMats);
            Built = false;
            world.folder = id;
            BuildWorld();
            Resources.UnloadUnusedAssets();
            System.GC.Collect();
            play?.BuildWorldPlay(arrived: true);
            Debug.Log($"Memento: world {id} built in {Time.realtimeSinceStartup - t0:0.0} s");
        }

        public string TitleOf(string id)
        {
            var ws = ship ? ship.Story?.L("worlds") : null;
            if (ws != null) foreach (var w in ws) if (w.S("id") == id) return w.S("title") ?? id;
            return id == "home" ? "Home" : id;
        }
    }

    /// <summary>
    /// The air by place (level.atmo: a tint over the page, the fog's thickness, the region's name),
    /// as the exporter sampled it on a grid over the world: the City-Shaft's haze thickening and
    /// turning green as you go down, the Hangar's quarters.
    /// </summary>
    public class Atmo
    {
        Vector3 min, max; int nx, ny, nz; float[] s, light; List<string> names;
        public static Atmo From(Dictionary<string, object> d)
        {
            if (d == null) return null;
            var n = d.L("n"); var mn = d.L("min"); var mx = d.L("max");
            var a = new Atmo { nx = (int)Json.Num(n[0]), ny = (int)Json.Num(n[1]), nz = (int)Json.Num(n[2]),
                min = new Vector3(Json.Num(mn[0]), Json.Num(mn[1]), Json.Num(mn[2])), max = new Vector3(Json.Num(mx[0]), Json.Num(mx[1]), Json.Num(mx[2])) };
            var S = d.L("samples"); a.s = new float[S.Count]; for (int i = 0; i < S.Count; i++) a.s[i] = Json.Num(S[i]);
            a.names = d.L("names").ConvertAll(x => x as string ?? "");
            var L = d.L("light"); if (L != null) { a.light = new float[L.Count]; for (int i = 0; i < L.Count; i++) a.light[i] = Json.Num(L[i]); }
            return a;
        }
        Vector3 Cell(Vector3 p)
        {
            var q = new Vector3(Mathf.InverseLerp(min.x, max.x, p.x) * (nx - 1), Mathf.InverseLerp(min.y, max.y, p.y) * (ny - 1), Mathf.InverseLerp(min.z, max.z, p.z) * (nz - 1));
            return q;
        }
        int Idx(int ix, int iy, int iz) => ((Mathf.Clamp(iy, 0, ny - 1) * nz + Mathf.Clamp(iz, 0, nz - 1)) * nx + Mathf.Clamp(ix, 0, nx - 1)) * 5;
        /// <summary>The region's name (the nearest sample's).</summary>
        public string NameAt(Vector3 p) { var c = Cell(p); int i = Idx(Mathf.RoundToInt(c.x), Mathf.RoundToInt(c.y), Mathf.RoundToInt(c.z)); int k = (int)s[i + 4]; return k >= 0 && k < names.Count ? names[k] : ""; }
        /// <summary>The sun by place (level.lightAt): the light's direction (three space) as this place turns it.</summary>
        public Vector3 LightAt(Vector3 p, Vector3 dir)
        {
            if (light == null) return dir;
            var c = Cell(p); int i = Idx(Mathf.RoundToInt(c.x), Mathf.RoundToInt(c.y), Mathf.RoundToInt(c.z)) / 5 * 4;
            int k = (int)light[i];
            if (k == 1 && dir.y > 0) return new Vector3(light[i + 1], light[i + 2], light[i + 3]).normalized;
            if (k == 2 && dir.y > 0.05f) { dir.y += light[i + 1]; return dir.normalized; }
            if (k == 3) dir.y = -dir.y;
            return dir;
        }
        /// <summary>The tint (rgb) and the fog's multiplier (w), blended between the samples round p.</summary>
        public Vector4 At(Vector3 p)
        {
            var c = Cell(p);
            int x0 = Mathf.FloorToInt(c.x), y0 = Mathf.FloorToInt(c.y), z0 = Mathf.FloorToInt(c.z);
            float fx = c.x - x0, fy = c.y - y0, fz = c.z - z0;
            Vector4 V(int x, int y, int z) { int i = Idx(x, y, z); return new Vector4(s[i], s[i + 1], s[i + 2], s[i + 3]); }
            var a = Vector4.Lerp(Vector4.Lerp(V(x0, y0, z0), V(x0 + 1, y0, z0), fx), Vector4.Lerp(V(x0, y0, z0 + 1), V(x0 + 1, y0, z0 + 1), fx), fz);
            var b = Vector4.Lerp(Vector4.Lerp(V(x0, y0 + 1, z0), V(x0 + 1, y0 + 1, z0), fx), Vector4.Lerp(V(x0, y0 + 1, z0 + 1), V(x0 + 1, y0 + 1, z0 + 1), fx), fz);
            return Vector4.Lerp(a, b, fy);
        }
    }
}
