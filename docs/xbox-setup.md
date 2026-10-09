# Playing Hiraeth on your Xbox (Developer Mode)

A step-by-step guide for the author's Xbox Series X. The game runs as a sideloaded app in Developer Mode;
it isn't in the Store. How the package is built and why: [systems/xbox.md](systems/xbox.md).

You need: the Xbox, a Microsoft account, a computer on the same network (the Mac is fine: everything is
done in a web browser), and about 30 minutes the first time.

## 1. Register as a developer (once)

Developer Mode is unlocked by an **individual developer account** in Microsoft Partner Center.

1. Go to <https://developer.microsoft.com/microsoft-store/register> and sign up as an **Individual**
   developer with your Microsoft account.
2. Microsoft has charged a one-time fee of about **US$19** for this; some accounts are offered it free. The
   checkout page shows which applies to you.
3. Finish the registration (name, address, payment if asked). It can take a little while to be confirmed.

## 2. Turn on Developer Mode on the console (once)

1. On the Xbox, open the **Microsoft Store** and install the green **Xbox Dev Mode** app (not the old black
   "Dev Mode Activation" app, which no longer works).
2. Open it. It shows an **activation code**.
3. On the computer, go to **Partner Center → Xbox devices** (<https://partner.microsoft.com/xboxconsoles>),
   sign in with the same developer account, and enter the code.
4. Back on the Xbox, the app confirms; choose **Switch and restart**. The first switch downloads an update and
   takes several minutes.
5. The console restarts into **Dev Home** (Developer Mode's home screen).

## 3. Turn on the Device Portal (once)

The Device Portal is a web page served by the console; you install apps through it.

1. In Dev Home, open **Remote access settings** (or *Manage → Remote access*).
2. Turn on **Enable Xbox Device Portal**, set a **user name and password**.
3. Note the address it shows, like `https://192.168.1.50:11443`.

## 4. Install Hiraeth

1. On the computer, download **`hiraeth-xbox.zip`** from the `xbox` pre-release:
   <https://github.com/rnaud/hiraeth/releases/tag/xbox>, and unzip it. It holds `hiraeth-xbox.msix` (the
   game), `hiraeth-xbox.cer` (its certificate) and a few `.appx` files (the parts it depends on).
2. Open the console's address in the computer's browser. The browser warns that the connection isn't
   private (the console uses its own certificate): continue anyway. Sign in with the Device Portal's user
   name and password.
3. In **Home → My games & apps**, choose **Add**.
4. Pick **`hiraeth-xbox.msix`**, then **Next**.
5. On the next page add **every `.appx`** file from the zip, then **Next** / **Start**. If it asks for a
   certificate, give it **`hiraeth-xbox.cer`**.
6. When it finishes, Hiraeth is in Dev Home's list of games and apps.

## 5. Set it to "Game" (important, once)

An app gets about 1 GB of memory and under half the graphics power; a **game** gets about 5 GB and all of it.

1. In Dev Home, select **Hiraeth**, press the **View / ☰** button → **View details**.
2. Set **App type** to **Game**.

## 6. Play

Launch Hiraeth from Dev Home. The controller works as on the other versions; B goes back in menus and never
closes the game. The game updates itself over the internet like the Android app does (Settings → Updates),
and your saves stay across updates.

**New versions of the package itself** (rare: only when the app around the game changes): repeat step 4. It
installs over the old one and keeps your saves, because every package is signed with the same certificate.

## Playing your normal games again

Retail games and apps (Game Pass, the Store's games) don't run in Developer Mode. To go back:
**Dev Home → Leave developer mode** (the console restarts in retail mode). To come back to Hiraeth later,
open the Xbox Dev Mode app again and switch (no new activation needed).

## If something goes wrong

- **The Device Portal page doesn't open**: check the console's address in Dev Home, that both are on the same
  network, and use `https://` with port `11443`.
- **"Certificate" or "signature" errors when installing**: add `hiraeth-xbox.cer` from the same zip.
- **It installed but runs slowly**: check step 5 (App type: Game). The frame readout (Settings → Show FPS)
  shows the frame rate; it should say `xbox` at the end.
- **The game doesn't start**: in the Device Portal, *My games & apps* → Hiraeth → *Uninstall*, then install
  again (this loses the saves on the console).

What to look at on the first run (for the author's measurements): [systems/xbox.md](systems/xbox.md),
"First run: what to measure".
