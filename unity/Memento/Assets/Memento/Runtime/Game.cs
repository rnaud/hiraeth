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
        public readonly System.Collections.Generic.List<Npc> npcs = new();
        public string prompt;

        void Awake()
        {
            Instance = this;
            if (!BuildWorld()) { enabled = false; return; }
            StartPlay();
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
