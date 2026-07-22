import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the sixteen-point office tour", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ProDyum IT — Interactive 3D Office<\/title>/i);
  assert.match(html, /Explore ProDyum IT services through a scroll-driven/i);
  assert.match(html, /og\.png/i);
  assert.match(html, /Interactive three-dimensional office tour/i);
  assert.match(html, /Helping Businesses Grow Through/i);
  assert.match(html, /Digital<\/strong><strong class="landing-word">Marketing<\/strong><strong class="landing-technology"><em>&amp;<\/em> Technology/i);
  assert.match(html, /ProDyum IT Pvt Ltd delivers professional Digital Marketing/i);
  assert.match(html, /href="https:\/\/prodyum\.in\/it\/services"/i);
  assert.match(html, /href="https:\/\/prodyum\.in\/it\/contact"/i);
  assert.match(html, /Stop 1: Reception desk/i);
  assert.match(html, /Stop 4: Interview table/i);
  assert.match(html, /Stop 11: Conference room/i);
  assert.match(html, /Stop 14: Office refrigerator/i);
  assert.match(html, /Stop 15: Water dispenser/i);
  assert.match(html, /Stop 16: Evidence box/i);
  assert.match(html, /Office overview before point 1/i);
  assert.match(html, /Final office overview/i);
});

test("keeps the authored camera and model rules in place", async () => {
  const [tour, layout] = await Promise.all([
    readFile(new URL("../app/OfficeTour.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    access(new URL("../public/police-office-web.glb", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(tour, /const VIEWING_DISTANCE = 4;/);
  assert.match(tour, /const SAFE_TRAVEL_HEIGHT = 7\.5;/);
  assert.match(tour, /const TOP_VIEW_POSITION = new THREE\.Vector3\(11, 22, -9\.8\)/);
  assert.match(tour, /TOUR_STOPS\.flatMap<TourFrame>/);
  assert.match(tour, /material\.side = THREE\.DoubleSide/);
  assert.match(tour, /title: "Reception desk"[\s\S]*?target: \[3\.3, 0\.85, -12\.67\]/);
  assert.match(tour, /title: "Interview table"[\s\S]*?target: \[7\.85, 0\.8, -7\.05\]/);
  assert.match(tour, /title: "Conference room"[\s\S]*?target: \[11\.95, 0\.84, -7\.62\]/);
  assert.match(tour, /type NavigationRequest/);
  assert.match(tour, /CameraRig owns the[\s\S]*?intermediate stops never activate/);
  assert.match(tour, /window\.scrollTo\(\{ top: nextProgress \* maxScroll, behavior: "auto" \}\)/);
  assert.match(tour, /contentTitle: "Digital Solutions Partner"/);
  assert.match(tour, /contentTitle: "Web Development"/);
  assert.match(tour, /contentTitle: "Free Consultation"/);
  assert.match(tour, /actionHref: "https:\/\/prodyum\.in\/it\/contact"/);
  assert.match(tour, /className="brand prodyum-brand"/);
  assert.match(tour, /className="story-cta"/);
  assert.match(tour, /className={`landing-hero\$\{isLanding \? "" : " is-hidden"\}`}/);
  assert.match(tour, /setIsLanding\(window\.scrollY <= 8\)/);
  assert.match(tour, /Digital growth partner/);
  assert.match(tour, /First stop · Reception/);
  assert.match(tour, /onNavigationSettled/);
  assert.equal([...tour.matchAll(/contentTitle: "/g)].length, 16);
  assert.equal([...tour.matchAll(/actionLabel: "/g)].length, 16);
  assert.equal([...tour.matchAll(/actionHref: "https:\/\/prodyum\.in\/it\//g)].length, 16);
  assert.match(tour, /title: "Office refrigerator"/);
  assert.match(tour, /title: "Water dispenser"/);
  assert.match(tour, /title: "Evidence box"/);
  assert.match(layout, /socialImage = `\$\{protocol\}:\/\/\$\{host\}\/og\.png`/);
});
