using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Memento
{
    /// <summary>
    /// The desert scene's bootstrap: loads the web game's export, sets up the page's look,
    /// the sun, the camera, then the traveller, the people, the story and the HUD.
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
        public Bike bike;
        public FluidTool tool;
        public ShipScene ship;
        public Ambient ambient;
        public Wildlife wildlife;
        public static bool playPrologue = true;
        public static bool useSaves => !Application.isBatchMode;   // (a batch run starts fresh; Batch.Play tests the saves itself)
        public Dictionary<string, object> loaded;   // a new game opens in the ship, out in space (Batch: -noPrologue)
        public readonly System.Collections.Generic.List<Npc> npcs = new();
        public string prompt;

        public Vector3? promptAt;                   // where the use prompt floats (the interactable's place), null: in the status box
        /// <summary>The title screen first (the Title scene's Loading sets it; a batch run with -title too).</summary>
        public static bool showTitle;
        public TitleScreen title;

        void Awake()
        {
            Instance = this;
            if (!BuildWorld()) { enabled = false; return; }
            if (showTitle) { title = gameObject.AddComponent<TitleScreen>(); title.Begin(this); return; }
            StartPlay();
        }
        /// <summary>From the title: the play begins (a save continued, or the prologue).</summary>
        public void BeginPlay() { title = null; StartPlay(); }

        /// <summary>Where you are (biome.js biomeAtmosphere): golden dunes, rose canyons or salt flats.</summary>
        public string Region(Vector3 p)
        {
            // (three's x is mirrored in Unity: the field is read at -x)
            float x = -p.x, z = p.z;
            float f = Mathf.Sin(x * 0.0021f) * Mathf.Cos(z * 0.0017f - 0.7f) + 0.5f * Mathf.Sin((x + z) * 0.0011f);
            float rose = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(0.3f, 0.6f, f)), salt = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(-0.3f, -0.6f, f));
            return rose > 0.5f ? "Rose canyons" : salt > 0.5f ? "Salt flats" : "Golden dunes";
        }

        /// <summary>The world and the look only (what the editor's batch shots need).</summary>
        public void BuildForEditor() { Instance = this; BuildWorld(); }

        bool BuildWorld()
        {
            if (Built) return true;
            QualitySettings.vSyncCount = 1;
            if (!world) world = new GameObject("World").AddComponent<WorldLoader>();
            world.transform.SetParent(transform, false);
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
    }
}
