using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Memento
{
    /// <summary>The player's settings (src/ui.js Settings), kept in PlayerPrefs and applied to the pad, the sound and the ink.</summary>
    public static class Settings
    {
        public static bool smooth = true, invertY, mute, showFps;
        public static float sensitivity = 1, music = 0.8f, effects = 1, voices = 1;
        static bool loaded;
        public static void Load()
        {
            if (loaded) return; loaded = true;
            smooth = PlayerPrefs.GetInt("memento.smooth", 1) == 1; invertY = PlayerPrefs.GetInt("memento.invertY", 0) == 1;
            mute = PlayerPrefs.GetInt("memento.mute", 0) == 1; showFps = PlayerPrefs.GetInt("memento.fps", 0) == 1;
            sensitivity = PlayerPrefs.GetFloat("memento.sensitivity", 1); music = PlayerPrefs.GetFloat("memento.music", 0.8f);
            effects = PlayerPrefs.GetFloat("memento.effects", 1); voices = PlayerPrefs.GetFloat("memento.voices", 1);
            Apply();
        }
        public static void Save()
        {
            PlayerPrefs.SetInt("memento.smooth", smooth ? 1 : 0); PlayerPrefs.SetInt("memento.invertY", invertY ? 1 : 0);
            PlayerPrefs.SetInt("memento.mute", mute ? 1 : 0); PlayerPrefs.SetInt("memento.fps", showFps ? 1 : 0);
            PlayerPrefs.SetFloat("memento.sensitivity", sensitivity); PlayerPrefs.SetFloat("memento.music", music);
            PlayerPrefs.SetFloat("memento.effects", effects); PlayerPrefs.SetFloat("memento.voices", voices);
            PlayerPrefs.Save();
            Apply();
        }
        public static void Apply()
        {
            Pad.lookScale = sensitivity; Pad.invertY = invertY;
            Rendering.MementoFeature.Settings.fxaa = smooth;
            Sounds.Instance?.SetVolumes(music, effects, voices, mute);
        }
    }

    /// <summary>
    /// The Start menu (src/ui.js SettingsMenu, src/menus.css .fullmenu): the gold side with the
    /// stamped brand, where you are, the menu (Resume, Sketchbook, Quit to title), and the
    /// settings beside it on ruled paper (graphics, camera, sound, the frame time, a fresh start).
    /// Menu / Esc opens it and the game holds still; ↑ ↓ choose, → into the settings, ← → change
    /// one, A / × press, B / ○ back. The title screen opens it too, for its settings.
    /// </summary>
    public class PauseMenu
    {
        readonly RectTransform root; readonly Game game; readonly bool title;
        public bool open;
        public System.Action onClose;
        int col, navSel, rowSel; bool asking;
        RectTransform el; Sketch rules; Image side, sideShade, sideRule; Label brand, where, whereB, saved, h1, h1v, keys;
        readonly List<(Ui.Box box, Label text)> nav = new();
        readonly List<Row> rows = new();
        Ui.Box danger; Label dangerText;
        class Row { public string label, kind; public RectTransform rt; public Label name, value; public Image band; public Sketch draw; public Ui.Box box; public System.Func<float> get; public System.Action<float> set; public string[] options; }

        string[] NavItems => title ? new[] { "BACK" } : new[] { "RESUME", "SKETCHBOOK", "QUIT TO TITLE" };

        public PauseMenu(Hud hud, RectTransform root) : this(hud.game, root, false) { }
        public PauseMenu(Game game, RectTransform root, bool title)
        {
            this.game = game; this.root = root; this.title = title;
            Settings.Load();
            Build();
        }

        void Build()
        {
            var mono = Ui.Mono; var ink = Ui.Ink;
            el = Ui.Stretch(Ui.Node(title ? "title settings" : "pause menu", root));
            Ui.Fill(el, Ui.Sketchbook, 0, "paper");
            rules = Ui.Stretch(Ui.Node("rules", el)).gameObject.AddComponent<Sketch>(); rules.raycastTarget = false; rules.feather = 0.5f;
            side = Ui.Rect(el, Ui.Gold, 0, "side");
            sideShade = Ui.Rect(el, Ui.Hex("#2b211f", 0.1f), 0, "inset");
            sideRule = Ui.Rect(el, ink, 0, "rule");
            brand = Ui.Label(el, "brand", Ui.Heavy, 50, Ui.CardC, TextAnchor.UpperLeft, FontStyle.Bold);
            brand.horizontalOverflow = HorizontalWrapMode.Overflow;
            var o = brand.gameObject.AddComponent<Outline>(); o.effectColor = ink; o.effectDistance = new Vector2(1.6f, -1.6f);
            var s2 = brand.gameObject.AddComponent<Shadow>(); s2.effectColor = ink; s2.effectDistance = new Vector2(4, -4);
            Ui.Space(brand, 0.06f);
            whereB = Ui.Label(el, "where b", mono, 15, ink, TextAnchor.UpperLeft, FontStyle.Bold);
            where = Ui.Label(el, "where", mono, 13, ink, lineSpacing: 1.3f);
            foreach (var n in NavItems)
            {
                var b = Ui.Panel(el, n, Ui.CardC, ink, 2.5f, 4, 4);
                var t = Ui.Label(b.rt, "t", mono, 17, ink, TextAnchor.MiddleLeft, FontStyle.Bold); Ui.Space(t, 0.1f);
                nav.Add((b, t));
            }
            saved = Ui.Label(el, "saved", mono, 11, Ui.Hex("#2b211f", 0.7f));
            h1 = Ui.Label(el, "h1", mono, 23, ink, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(h1, 0.16f); h1.text = "SETTINGS";
            h1v = Ui.Label(el, "v", mono, 12, Ui.Hex("#2b211f", 0.6f));
            AddRow("Graphics", "select", () => Settings.smooth ? 0 : 1, v => Settings.smooth = v < 0.5f, "Smooth lines (FXAA)", "Sharp lines");
            AddRow("Camera sensitivity", "range", () => Mathf.InverseLerp(0.3f, 2.5f, Settings.sensitivity), v => Settings.sensitivity = Mathf.Lerp(0.3f, 2.5f, v));
            AddRow("Invert camera Y", "check", () => Settings.invertY ? 1 : 0, v => Settings.invertY = v > 0.5f);
            AddRow("Music", "range", () => Settings.music, v => Settings.music = v);
            AddRow("Effects", "range", () => Settings.effects, v => Settings.effects = v);
            AddRow("Voices", "range", () => Settings.voices, v => Settings.voices = v);
            AddRow("Mute", "check", () => Settings.mute ? 1 : 0, v => Settings.mute = v > 0.5f);
            AddRow("Show FPS and frame time", "check", () => Settings.showFps ? 1 : 0, v => Settings.showFps = v > 0.5f);
            if (!title) { danger = Ui.Panel(el, "restart", Ui.Paper, ink, 2, 3, 3); dangerText = Ui.Label(danger.rt, "t", mono, 13, Ui.Red, TextAnchor.MiddleCenter); Ui.Stretch(dangerText.rectTransform); }
            keys = Ui.Label(el, "keys", mono, 11, Ui.Hex("#2b211f", 0.65f), lineSpacing: 1.3f);
            el.gameObject.SetActive(false);
        }
        void AddRow(string label, string kind, System.Func<float> get, System.Action<float> set, params string[] options)
        {
            var r = new Row { label = label, kind = kind, get = get, set = set, options = options };
            r.rt = Ui.Node(label, el);
            r.band = Ui.Fill(r.rt, Ui.Hex("#f2c54b", 0.3f), 0, "focus");
            r.draw = Ui.Stretch(Ui.Node("draw", r.rt)).gameObject.AddComponent<Sketch>(); r.draw.raycastTarget = false;
            r.name = Ui.Label(r.rt, "name", Ui.Mono, 13, Ui.Ink, TextAnchor.MiddleLeft); r.name.text = label;
            if (kind == "select") { r.box = Ui.Panel(r.rt, "select", Ui.Paper, Ui.Ink, 2); r.value = Ui.Label(r.box.rt, "v", Ui.Mono, 13, Ui.Ink, TextAnchor.MiddleLeft); }
            rows.Add(r);
        }

        public void Open()
        {
            open = true; col = 0; navSel = 0; rowSel = 0; asking = false;
            if (!title) Time.timeScale = 0;
            Sounds.Instance?.Play("page");
        }
        public void Close()
        {
            open = false; asking = false;
            if (!title) Time.timeScale = 1;
            Settings.Save();
            onClose?.Invoke();
        }

        public void Update(float dt)
        {
            if (!open) return;
            int n = Pad.NavDown(), x = Pad.NavXDown();
            bool ok = Pad.ConfirmDown(), back = Pad.BackDown();
            if (!title && Pad.StartDown()) { Close(); return; }
            if (col == 0)
            {
                if (n != 0) { navSel = Mathf.Clamp(navSel + n, 0, NavItems.Length - 1); Sounds.Instance?.Play("tick"); }
                if (x > 0) { col = 1; return; }
                if (back) { Close(); return; }
                if (ok) Act(NavItems[navSel]);
                return;
            }
            // the settings: rows, then the fresh start (the pause menu's)
            int last = rows.Count - 1 + (danger != null ? 1 : 0);
            if (n != 0) { rowSel = Mathf.Clamp(rowSel + n, 0, last); asking = false; Sounds.Instance?.Play("tick"); }
            if (back) { if (asking) asking = false; else col = 0; return; }
            if (rowSel < rows.Count)
            {
                var r = rows[rowSel];
                if (r.kind == "range")
                {
                    float held = Pad.NavXHeld();
                    if (x != 0) r.set(Mathf.Clamp01(r.get() + x * 0.05f));
                    else if (held != 0) r.set(Mathf.Clamp01(r.get() + held * dt * 0.6f));
                    if (x != 0 || held != 0) Settings.Apply();
                }
                else if (x != 0 || ok)
                {
                    if (r.kind == "check") r.set(r.get() > 0.5f ? 0 : 1);
                    else r.set((Mathf.RoundToInt(r.get()) + (x < 0 ? -1 : 1) + r.options.Length) % r.options.Length);
                    Settings.Apply(); Sounds.Instance?.Play("tick");
                }
                else if (x < 0 && r.kind != "range") col = 0;
            }
            else if (ok)
            {
                if (!asking) asking = true;
                else { asking = false; Time.timeScale = 1; Save.Erase(); Game.showTitle = false; Game.playPrologue = true; SceneManager.LoadScene(SceneManager.GetActiveScene().name); }
            }
        }

        void Act(string what)
        {
            switch (what)
            {
                case "RESUME": case "BACK": Close(); break;
                case "SKETCHBOOK": Close(); if (game.hud) { game.hud.journalOpen = true; game.hud.journal.Open(); } break;
                case "QUIT TO TITLE":
                    if (Game.useSaves && game.state != null && game.state.Is("prologue.done")) Memento.Save.Write(game);
                    Time.timeScale = 1; Game.showTitle = true; SceneManager.LoadScene(SceneManager.GetActiveScene().name);
                    break;
            }
        }

        public void Draw(bool on)
        {
            if (el.gameObject.activeSelf != on) el.gameObject.SetActive(on);
            if (!on) return;
            float W = root.rect.width, H = root.rect.height;
            var ink = Ui.Ink;
            rules.Clear();
            for (float ry = 27; ry < H; ry += 28) rules.Box(new Rect(-W / 2, H / 2 - ry - 1, W, 1), Ui.Hex("#2b211f", 0.07f));
            // the side: minmax(220px, 31%), gold, a ruled edge with a shade inside it
            float sw = Mathf.Max(220, W * 0.31f), padT = Mathf.Clamp(H * 0.05f, 12, 56), padX = Mathf.Clamp(W * 0.026f, 14, 44);
            Ui.Place(side.rectTransform, 0, 0, sw, H); Ui.Place(sideShade.rectTransform, sw - 3 - 8, 0, 8, H); Ui.Place(sideRule.rectTransform, sw - 3, 0, 3, H);
            float gap = Mathf.Clamp(H * 0.024f, 8, 22), y = padT;
            brand.fontSize = Mathf.RoundToInt(Mathf.Clamp(H * 0.07f, 28, 66));
            brand.text = title ? "MEMENTO" : "PAUSED";
            brand.rectTransform.localRotation = Quaternion.Euler(0, 0, 2);
            Ui.Place(brand.rectTransform, padX, y, sw - 2 * padX, brand.fontSize * 1.2f); y += brand.fontSize * 1.15f + gap;
            if (!title)
            {
                whereB.text = "The Desert";
                var mins = Mathf.FloorToInt(Time.realtimeSinceStartup / 60);
                where.text = $"{(game.quests != null && game.quests.Tracked() is string t ? game.quests.defs[t].S("title") : "Qanat, under the smoke")} · {(mins < 1 ? "under a minute" : mins + " min")} played";
                Ui.Place(whereB.rectTransform, padX, y, sw - 2 * padX, 20); y += 21;
                var ws = Ui.Measure(where, where.text, sw - 2 * padX); Ui.Place(where.rectTransform, padX, y, sw - 2 * padX, ws.y); y += ws.y + gap;
            }
            whereB.gameObject.SetActive(!title); where.gameObject.SetActive(!title);
            float bh = Mathf.Clamp(H * 0.014f, 6, 12) * 2 + 22, ngap = Mathf.Clamp(H * 0.017f, 7, 14);
            for (int i = 0; i < nav.Count; i++)
            {
                var (b, t) = nav[i];
                bool f = col == 0 && i == navSel;
                t.text = NavItems[i]; t.color = f ? Ui.Cream : ink;
                b.SetFill(f ? Ui.Red : Ui.CardC); b.SetShadow(f ? 6 : 4, f ? 6 : 4);
                Ui.Place(t.rectTransform, 14, 0, sw - 2 * padX - 28, bh);
                Ui.Place(b.rt, padX - (f ? 2 : 0), y - (f ? 2 : 0), sw - 2 * padX, bh);
                y += bh + ngap;
            }
            saved.text = title ? "" : "Your progress is saved as you play.";
            Ui.Place(saved.rectTransform, padX, H - 14 - 16, sw - 2 * padX, 16);
            // the settings
            float px = sw + Mathf.Clamp(W * 0.04f, 14, 64), pw = Mathf.Min(760, W - px - Mathf.Clamp(W * 0.04f, 14, 64)); y = padT;
            Ui.Place(h1.rectTransform, px, y, 200, 30);
            h1v.text = "Unity port"; Ui.Place(h1v.rectTransform, px + Ui.Measure(h1, "SETTINGS").x + 18, y + 9, 200, 16);
            y += 30 + 12;
            float rh = Mathf.Clamp(H * 0.011f, 5, 10) * 2 + 22;
            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i];
                bool f = col == 1 && i == rowSel;
                Ui.Place(r.rt, px, y, pw, rh);
                r.band.enabled = f;
                Ui.Place(r.name.rectTransform, 6, 0, pw * 0.5f, rh);
                r.draw.Clear();
                // the dashed rule under the row
                r.draw.Path(new[] { new Vector2(-pw / 2, -rh / 2 + 0.5f), new Vector2(pw / 2, -rh / 2 + 0.5f) }, 1, Ui.Hex("#2b211f", 0.28f), false, 3, 3);
                float cw = pw * 0.46f, cx = pw / 2 - 6 - cw;   // the control's left edge, in the Sketch's centred space
                if (r.kind == "range")
                {
                    float v = r.get();
                    var a = new Vector2(cx + 8, 0); var b = new Vector2(pw / 2 - 14, 0);
                    r.draw.Line(a, b, 5, Ui.Hex("#2b211f", 0.18f));
                    r.draw.Line(a, Vector2.Lerp(a, b, v), 5, Ui.Red);
                    var k = Vector2.Lerp(a, b, v);
                    r.draw.Disc(k, f ? 8.5f : 7.5f, Ui.Red); r.draw.Disc(k, 2.5f, Ui.Hex("#fff6dc", 0.5f));
                }
                else if (r.kind == "check")
                {
                    bool c = r.get() > 0.5f; var ctr = new Vector2(pw / 2 - 18, 0);
                    r.draw.Box(new Rect(ctr.x - 9, -9, 18, 18), c ? Ui.Red : Ui.Hex("#767676"));
                    r.draw.Box(new Rect(ctr.x - 7.5f, -7.5f, 15, 15), c ? Ui.Red : Ui.Paper);
                    if (c) r.draw.Path(new[] { ctr + new Vector2(-4.5f, 0.5f), ctr + new Vector2(-1.2f, -3.6f), ctr + new Vector2(5, 4) }, 2.2f, Color.white);
                }
                else
                {
                    Ui.Place(r.box.rt, pw - 6 - cw, rh / 2 - 15, cw, 30);
                    r.value.text = r.options[Mathf.Clamp(Mathf.RoundToInt(r.get()), 0, r.options.Length - 1)] + (f ? "   ‹ ›" : "");
                    Ui.Place(r.value.rectTransform, 8, 0, cw - 16, 30);
                    var tri = new Vector2(pw / 2 - 18, 0);
                    r.draw.Tri(tri + new Vector2(-4, 2), tri + new Vector2(4, 2), tri + new Vector2(0, -3), ink);
                }
                // the pad's focus ring (.panel :focus: 3 px teal, 3 px out)
                if (f) r.draw.Path(new[] { new Vector2(-pw / 2 - 3, rh / 2 + 3), new Vector2(pw / 2 + 3, rh / 2 + 3), new Vector2(pw / 2 + 3, -rh / 2 - 3), new Vector2(-pw / 2 - 3, -rh / 2 - 3) }, 3, Ui.Teal, true);
                y += rh;
            }
            if (danger != null)
            {
                y += 18;
                bool f = col == 1 && rowSel == rows.Count;
                dangerText.text = asking ? "Sure? Press again to erase the save and start over" : "Restart this save from the prologue";
                var dw = Ui.Measure(dangerText, dangerText.text).x + 28;
                Ui.Place(danger.rt, px, y, dw, 34);
                danger.border.color = f ? Ui.Teal : ink; danger.SetShadow(3, 3);
                y += 34 + 14;
            }
            keys.text = Pad.HasPad
                ? "Controller: left stick move (L3 run) · right stick look · A / × jump (again in the air: boost) · B / ○ talk, use, get on · RT / R2 shoot · RB / R1 push · D-pad ← → gun mode · View sketchbook · Menu this menu"
                : "Keyboard: WASD move · Shift run · Space jump (again in the air: boost; hold: wings) · E talk, use · G or click shoot · C push · X gun mode · J / Tab sketchbook · H help · Esc this menu · mouse look";
            var ks = Ui.Measure(keys, keys.text, pw); Ui.Place(keys.rectTransform, px, Mathf.Max(y + 14, H - 14 - ks.y), pw, ks.y);
        }
    }
}
