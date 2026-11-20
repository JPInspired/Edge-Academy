# Edge Preview

A walkable WebXR preview of the **Inspired Edge Academy at PaRK International School Alfragide (Amadora, Lisbon)**, built from the
ZPZ Partners *Spatial Concept rev. 6* (10 Nov 2026): the two floor plans plus the concept renders.

It runs straight in the browser with three.js (bundled in `vendor/`, so it works offline). There is no build step
and no install. It is a standalone project, separate from WebXR Classes.

## Where it lives

- **Public repository:** JPInspired/Edge-Academy on GitHub. Its website, published with GitHub Pages from the main
  branch, opens for anyone with the link, with no sign-in: https://jpinspired.github.io/Edge-Academy/
- **Private repository:** Inspired-Education-Group/Edge-Preview (company organisation), with the full history of the
  work and a private copy of the website (only members of the organisation signed in to GitHub can open it; the
  address is under **Settings → Pages**).
- Both are kept identical: after committing, run `./sync-public.sh` (see **Publishing an update**). Each website
  updates within a minute or two.
- On a Quest, open the public address in the Quest Browser.

## What's in it

| Floor | Spaces |
|---|---|
| Ground | Entrance, **Reception** (desk, logo wall, lounge, high table, lockers), glass **Office**, WC block, **Hub** (presentation rows, projector screen on the terracotta wall, tiered seating, curved bookshelf and meeting table, gallery wall, lounge seating) |
| First | **Project Lab** (project wall, team benches, mobile carts, worktop along the stair, tool wall and wet end, green-screen set corner, build bay) and **Learning Studio** (pods, writing walls, nesting desks, standing ledge, gathering circle, meeting booth, terracotta logo wall) |

The 23-step stair joins the floors and you can walk up and down it. A minimap shows where you are.

**Accuracy:** this is a blockout for getting a feel of the space, not a survey model. It is built **at true
scale**: the drawing is to scale (its areas, Hub 80.6 m², Lab 82.2 m² and Studio 74.6 m², fit a grid of 1 m squares),
so the building is 8 m × 21 m inside, about 4 m floor to floor (23 risers × 17.5 cm). The windows follow photographs
of the real building: the courtyard side is glazed along the ground floor and solid above; the motorway side has one
long window band along the first floor; the courtyard end is blank. The real building is slightly skewed; here it is
a clean rectangle. Furniture is placed to match the plans and modelled on the concept renders and their 360° tour (moulded shell chairs
on wire sleds, stools on five-star bases, height-adjustable benches, carts with frosted drawers, a curved bookcase of
single books); colours and materials follow the renders. Add `?simple` to the address for the earlier, plainer
furniture (lighter, if a headset ever struggles).

## The site (PaRK International School Alfragide)

The Edge block is the low white building at the south-east end of PaRK's main building, on the courtyard, with the
motorway (Estrada dos Cabos de Ávila) below it on the south-west. `src/site.js` builds the surroundings from
`src/site-data.js`, which `tools/site/build-site.mjs` makes from OpenStreetMap data (outlines and positions of the
buildings, roads, paths, the pitch and fences, turned into the model's coordinates):

- PaRK's main building (Saraiva + Associados) as in photographs: three floors floating on clusters of slanted grey
  pillars, with white walls, narrow windows and deep white fins, over an open covered walkway. Behind the pillars runs
  one continuous glazed ground floor with a white band and a railed terrace on top; it joins the Edge block's Reception
  end through a one-storey glazed link, as the Edge block is an annex of the main building.
- The courtyard in light concrete with lamp posts, round planters, benches and concrete picnic tables; the sports hall,
  the multi-sports pitch, the north building, the houses, flats and offices around; umbrella pines on the slope.
- The ground falls about 5 m to the motorway (bare earth with stakes and young trees, as now), behind a precast concrete
  boundary wall; tall maritime pines stand in front of the Edge block; the motorway has its crash barriers, central
  barrier and lamp posts, and cars drive the real lanes. The sun is a November Saturday morning's (low in the east-south-east).

Heights, the slope and the furniture outside are estimates from photographs; the positions come from the map.

**Inside the Edge block.** Visitors stay inside the Edge block (it opens at sunset in Reception); the surroundings are
there to be seen from its windows: the courtyard, PaRK's main building, the gym (a white hall with a white roof), the
football pitch beside it (artificial turf, a white wall with PaRK on it, tall nets) with the car park along the access
road, the wooded slopes, the motorway and the city around. The layout follows the school's site plan and the map.

**Sunset and morning.** The **Back to morning** / **Sunset** button (desktop: <kbd>T</kbd>; Quest: click the right thumbstick) switches between a November
Saturday morning and dusk as in the photographs of PaRK: the sun setting in the west-south-west, a lavender and orange
sky, long shadows, the main building's windows and glazed ground floor lit, warm lights inside the Edge block.

## Run it

**Windows:** double-click `start.bat`. It opens http://localhost:8090 (it uses Python if installed, otherwise
the included PowerShell server `serve.ps1`).
**macOS / Linux:** run `./start.sh` (needs Python 3).

### Controls

| Desktop | Quest / VR |
|---|---|
| `W A S D` walk, `Shift` faster | Left stick: walk (hold trigger to go faster) |
| Drag, or click to capture the mouse, to look | Right stick: snap turn |
| `Q`/`E` or arrow keys to turn | `A`/`X` next room, `B`/`Y` previous room |
| `1`–`8` jump to a room, `H` hide panels, `M` hide map | Click the left stick: show / hide hub chairs |
| `C` show / hide hub chairs, `P` effects on / off | |

### On a Meta Quest

Headsets only allow WebXR on `https://` pages or on `localhost`. Either:
- **USB:** enable developer mode, connect the Quest, run `adb reverse tcp:8090 tcp:8090`, then open
  http://localhost:8090 in the Quest Browser.
- **Wi-Fi:** in the Quest Browser open `chrome://flags`, add `http://<this PC's IP>:8090` under
  *Insecure origins treated as secure*, and restart the browser. (`serve.ps1` only listens on localhost; use
  `python -m http.server 8090` for Wi-Fi access.)
- **Hosted:** publish the folder on any https static host (e.g. GitHub Pages) and open that link.

Without a headset, the *Immersive Web Emulator* extension for Chrome emulates a Quest.

## Files

```
index.html          page, UI, import map
src/main.js         renderer, desktop + VR movement, collision, tour stops, minimap
src/building.js     the building: walls, floors, stair, rooms, furniture, surroundings
src/furniture.js    the detailed furniture (chairs, stools, benches, carts, bookcase …), modelled on the renders
src/textures.js     every texture is drawn in code (no image files)
vendor/three/       three.js r160 (MIT)
start.bat/.sh, serve.ps1   local launchers
```

To change the layout, edit `src/building.js`. Each room has its own function (`reception`, `office`, `hub`,
`lab`, `studio` …) and room layouts use plan units that are scaled to metres (see the comment at the top of the file).

## Removing it

Everything lives in this one folder; nothing is installed elsewhere.
1. Delete the `edge-preview` folder.
2. Delete both GitHub repositories: on GitHub open each repo, then **Settings → Danger Zone → Delete this
   repository**.

## Checking for clipping

Open the browser console on the page and run `edge.overlaps()`. It lists every place where two separate
objects intersect by more than 2 cm (tree canopies touching and the chairs tucked inside the pods are expected).

## Publishing an update

GitHub Pages lets browsers reuse files for up to 10 minutes. To stop a browser from mixing a
new page with old cached scripts, run `./bump-version.sh` (Git Bash on Windows) before committing:
it stamps a new `?v=` version on the script URLs in `index.html`.

Then commit, and run `./sync-public.sh`. It pushes main to the private repository as it is, and sends the same
files to the public repository as a new commit signed with the JPInspired account's GitHub no-reply address (the
public history starts from its own first copy, so no personal email address appears there).
