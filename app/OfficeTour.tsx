"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useProgress } from "@react-three/drei/core/Progress.js";
import { Html } from "@react-three/drei/web/Html.js";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Vec3 = [number, number, number];

type TourStop = {
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  position: Vec3;
  target: Vec3;
  marker: Vec3;
  fov: number;
};

const TOUR_STOPS: TourStop[] = [
  {
    eyebrow: "Arrival / Orientation",
    title: "Welcome desk",
    description: "Enter the office at eye level and begin the guided walkthrough.",
    detail: "Front-of-house overview",
    position: [8.6, 1.55, 1.25],
    target: [8.62, 0.9, -0.28],
    marker: [8.62, 1.22, -0.28],
    fov: 48,
  },
  {
    eyebrow: "Arrival / Visitor Care",
    title: "Reception station",
    description: "A closer view of the visitor-facing desk and check-in position.",
    detail: "Reception computer and counter",
    position: [3.95, 1.5, 1.1],
    target: [2.15, 0.85, -0.32],
    marker: [2.15, 1.22, -0.32],
    fov: 42,
  },
  {
    eyebrow: "Arrival / Safety",
    title: "Safety point",
    description: "Operational details are highlighted as the camera crosses the entrance.",
    detail: "Visitor safety marker",
    position: [11.75, 1.48, -0.65],
    target: [10.01, 0.52, -2.15],
    marker: [10.01, 0.95, -2.15],
    fov: 40,
  },
  {
    eyebrow: "Operations / Workstation",
    title: "Analyst screen",
    description: "The camera moves directly toward the computer screen for a focused explanation.",
    detail: "Primary digital workspace",
    position: [6.85, 1.62, -5.35],
    target: [8.83, 1.05, -7.07],
    marker: [8.83, 1.38, -7.07],
    fov: 38,
  },
  {
    eyebrow: "Operations / Console",
    title: "Multi-monitor desk",
    description: "A second workstation demonstrates how screen-based tools support the team.",
    detail: "Monitoring and coordination",
    position: [13.9, 1.62, -5.55],
    target: [12.19, 1.02, -7.26],
    marker: [12.19, 1.38, -7.26],
    fov: 38,
  },
  {
    eyebrow: "Collaboration / Briefing",
    title: "Briefing circle",
    description: "A wider camera angle reveals the round meeting point and surrounding work area.",
    detail: "Team briefing zone",
    position: [6.45, 1.78, -6.2],
    target: [8.45, 0.82, -7.82],
    marker: [8.45, 1.25, -7.82],
    fov: 46,
  },
  {
    eyebrow: "Support / Staff Kitchen",
    title: "Kitchen station",
    description: "The route turns into the staff support area and focuses on the fitted equipment.",
    detail: "Fridge and refreshment area",
    position: [7.95, 1.52, -8.05],
    target: [6.11, 0.9, -9.44],
    marker: [6.11, 1.3, -9.44],
    fov: 40,
  },
  {
    eyebrow: "Security / Access",
    title: "Secure doorway",
    description: "The camera pauses at an internal threshold that separates operational zones.",
    detail: "Controlled circulation point",
    position: [10.95, 1.56, -7.45],
    target: [9.13, 1.05, -9.4],
    marker: [9.13, 1.45, -9.4],
    fov: 42,
  },
  {
    eyebrow: "Casework / Desk",
    title: "Casework station",
    description: "Documents, seating and desktop tools come into view at the central workbench.",
    detail: "Active case preparation",
    position: [6.95, 1.58, -10.4],
    target: [8.78, 0.92, -12.15],
    marker: [8.78, 1.34, -12.15],
    fov: 39,
  },
  {
    eyebrow: "Records / Review",
    title: "Records desk",
    description: "A precise close-up presents the document review position and adjacent screens.",
    detail: "Records and verification",
    position: [13.75, 1.58, -10.35],
    target: [12.06, 0.94, -12.24],
    marker: [12.06, 1.34, -12.24],
    fov: 38,
  },
  {
    eyebrow: "Systems / Computing",
    title: "Compute tower",
    description: "The tour lowers slightly to show the workstation hardware beneath the desk line.",
    detail: "Local processing equipment",
    position: [9.75, 1.42, -10.55],
    target: [11.17, 0.63, -12.19],
    marker: [11.17, 1.05, -12.19],
    fov: 36,
  },
  {
    eyebrow: "Facilities / Control",
    title: "Facilities panel",
    description: "A short turn reveals the building-services control point on the west side.",
    detail: "Electrical breaker panel",
    position: [3.1, 1.58, -12.85],
    target: [4.68, 1.48, -14.79],
    marker: [4.68, 1.72, -14.79],
    fov: 40,
  },
  {
    eyebrow: "Evidence / Handling",
    title: "Evidence desk",
    description: "The camera approaches the rear desk where evidence can be recorded and reviewed.",
    detail: "Controlled evidence workflow",
    position: [14.25, 1.6, -14.05],
    target: [12.79, 0.94, -15.82],
    marker: [12.79, 1.36, -15.82],
    fov: 38,
  },
  {
    eyebrow: "Systems / Equipment",
    title: "Systems bay",
    description: "A close inspection highlights the equipment towers supporting the rear workstations.",
    detail: "Workstation hardware line",
    position: [9.25, 1.52, -14.02],
    target: [11.1, 0.68, -15.84],
    marker: [11.1, 1.12, -15.84],
    fov: 37,
  },
  {
    eyebrow: "Staff Hub / Final Stop",
    title: "Staff refreshment hub",
    description: "The route concludes at the rear staff area with a final view back through the office.",
    detail: "Vending and staff amenity",
    position: [3.55, 1.62, -18.35],
    target: [1.55, 1.0, -20.71],
    marker: [1.55, 1.48, -20.71],
    fov: 42,
  },
];

function CameraRig({
  progressRef,
  reducedMotion,
}: {
  progressRef: React.MutableRefObject<number>;
  reducedMotion: boolean;
}) {
  const positions = useMemo(
    () => TOUR_STOPS.map((stop) => new THREE.Vector3(...stop.position)),
    [],
  );
  const targets = useMemo(
    () => TOUR_STOPS.map((stop) => new THREE.Vector3(...stop.target)),
    [],
  );
  const positionCurve = useMemo(
    () => new THREE.CatmullRomCurve3(positions, false, "catmullrom", 0.2),
    [positions],
  );
  const targetCurve = useMemo(
    () => new THREE.CatmullRomCurve3(targets, false, "catmullrom", 0.2),
    [targets],
  );
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const smoothTarget = useRef(targets[0].clone());

  useFrame(({ camera }, delta) => {
    const progress = THREE.MathUtils.clamp(progressRef.current, 0, 1);
    positionCurve.getPoint(progress, desiredPosition);
    targetCurve.getPoint(progress, desiredTarget);

    const speed = reducedMotion ? 18 : 4.2;
    const alpha = 1 - Math.exp(-speed * delta);
    camera.position.lerp(desiredPosition, alpha);
    smoothTarget.current.lerp(desiredTarget, alpha);
    camera.lookAt(smoothTarget.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const scaled = progress * (TOUR_STOPS.length - 1);
      const start = Math.floor(scaled);
      const end = Math.min(start + 1, TOUR_STOPS.length - 1);
      const localProgress = scaled - start;
      const desiredFov = THREE.MathUtils.lerp(
        TOUR_STOPS[start].fov,
        TOUR_STOPS[end].fov,
        localProgress,
      );
      camera.fov = THREE.MathUtils.damp(camera.fov, desiredFov, speed, delta);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function OfficeModel() {
  const gltf = useLoader(GLTFLoader, "/police-office-web.glb", (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  useEffect(() => {
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
        object.frustumCulled = true;
      }
    });
  }, [gltf.scene]);

  return <primitive object={gltf.scene} dispose={null} />;
}

function Hotspots({ active, onSelect }: { active: number; onSelect: (index: number) => void }) {
  return (
    <group>
      {TOUR_STOPS.map((stop, index) => {
        const isActive = index === active;
        const isNear = Math.abs(index - active) <= 1;
        return (
          <Html
            key={stop.title}
            position={stop.marker}
            center
            distanceFactor={5}
            zIndexRange={[40, 10]}
          >
            <button
              type="button"
              className={`scene-hotspot${isActive ? " is-active" : ""}${isNear ? " is-near" : ""}`}
              onClick={() => onSelect(index)}
              aria-label={`Go to stop ${index + 1}: ${stop.title}`}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{stop.title}</strong>
            </button>
          </Html>
        );
      })}
    </group>
  );
}

function LoadingScreen() {
  const { progress, active } = useProgress();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!active && progress >= 100) {
      const timeout = window.setTimeout(() => setVisible(false), 650);
      return () => window.clearTimeout(timeout);
    }
  }, [active, progress]);

  return (
    <div className={`loading-screen${visible ? "" : " is-hidden"}`} aria-live="polite">
      <div className="loading-mark" aria-hidden="true">
        <span />
        <span />
      </div>
      <p>Preparing the office</p>
      <strong>{Math.round(progress)}%</strong>
      <div className="loading-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function OfficeTour() {
  const progressRef = useRef(0);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const updateFromScroll = () => {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const nextProgress = THREE.MathUtils.clamp(window.scrollY / maxScroll, 0, 1);
      progressRef.current = nextProgress;
      const nextActive = Math.min(
        TOUR_STOPS.length - 1,
        Math.round(nextProgress * (TOUR_STOPS.length - 1)),
      );
      if (nextActive !== activeRef.current) {
        activeRef.current = nextActive;
        setActive(nextActive);
      }
    };

    updateFromScroll();
    window.addEventListener("scroll", updateFromScroll, { passive: true });
    window.addEventListener("resize", updateFromScroll);
    return () => {
      window.removeEventListener("scroll", updateFromScroll);
      window.removeEventListener("resize", updateFromScroll);
    };
  }, []);

  const goToStop = useCallback(
    (index: number) => {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      const top = (index / (TOUR_STOPS.length - 1)) * maxScroll;
      window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
    },
    [reducedMotion],
  );

  const stop = TOUR_STOPS[active];
  const progressPercent = ((active + 1) / TOUR_STOPS.length) * 100;

  return (
    <main className="office-tour">
      <div className="scene-stage" aria-label="Interactive three-dimensional office tour">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: TOUR_STOPS[0].position, fov: TOUR_STOPS[0].fov, near: 0.05, far: 100 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <color attach="background" args={["#080a0b"]} />
          <fog attach="fog" args={["#080a0b", 16, 38]} />
          <ambientLight intensity={1.65} />
          <hemisphereLight args={["#f1e5cb", "#24211c", 1.8]} />
          <directionalLight position={[7, 10, 4]} intensity={2.2} color="#ffe5b0" />
          <directionalLight position={[-8, 5, -12]} intensity={1.15} color="#87a0b4" />
          <Suspense fallback={null}>
            <OfficeModel />
            <Hotspots active={active} onSelect={goToStop} />
          </Suspense>
          <CameraRig progressRef={progressRef} reducedMotion={reducedMotion} />
        </Canvas>
        <div className="scene-vignette" aria-hidden="true" />
        <div className="scene-grain" aria-hidden="true" />
      </div>

      <LoadingScreen />

      <header className="tour-header">
        <a className="brand" href="#tour-start" onClick={() => goToStop(0)}>
          <span>15</span>
          <div>
            <strong>Office Field Tour</strong>
            <small>Interactive spatial story</small>
          </div>
        </a>
        <div className="tour-status">
          <span className="status-dot" />
          Real-time 3D
        </div>
      </header>

      <nav className="tour-rail" aria-label="Office tour stops">
        <div
          className="rail-line"
          aria-hidden="true"
          style={{ "--tour-progress": `${progressPercent}%` } as React.CSSProperties}
        >
          <span />
        </div>
        <ol>
          {TOUR_STOPS.map((item, index) => (
            <li key={item.title}>
              <button
                type="button"
                className={index === active ? "is-active" : ""}
                onClick={() => goToStop(index)}
                aria-current={index === active ? "step" : undefined}
                aria-label={`Stop ${index + 1}: ${item.title}`}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.title}</strong>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="story-card" aria-live="polite" aria-atomic="true">
        <div className="story-meta">
          <span>Stop {String(active + 1).padStart(2, "0")}</span>
          <span>{stop.eyebrow}</span>
        </div>
        <h1>{stop.title}</h1>
        <p>{stop.description}</p>
        <div className="story-detail">
          <span aria-hidden="true" />
          {stop.detail}
        </div>
        <div className="story-actions">
          <button type="button" onClick={() => goToStop(Math.max(active - 1, 0))} disabled={active === 0}>
            Previous
          </button>
          <button
            type="button"
            className="next-action"
            onClick={() => goToStop(Math.min(active + 1, TOUR_STOPS.length - 1))}
            disabled={active === TOUR_STOPS.length - 1}
          >
            Next stop <span aria-hidden="true">↘</span>
          </button>
        </div>
      </section>

      <div className={`scroll-cue${active > 0 ? " is-hidden" : ""}`} aria-hidden="true">
        <span />
        Scroll to enter
      </div>

      <div className="chapter-count" aria-hidden="true">
        <span>{String(active + 1).padStart(2, "0")}</span>
        <i />
        <span>15</span>
      </div>

      <footer className="model-credit">
        3D model “Police Office” by{" "}
        <a href="https://sketchfab.com/neutralize" target="_blank" rel="noreferrer">neutralize</a>
        {" · "}
        <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">
          CC BY-NC 4.0
        </a>
        {" · Optimized for this tour"}
      </footer>

      <div className="scroll-chapters" id="tour-start">
        {TOUR_STOPS.map((item, index) => (
          <section key={item.title} aria-label={`Tour stop ${index + 1}: ${item.title}`}>
            <h2 className="sr-only">{item.title}</h2>
          </section>
        ))}
      </div>
    </main>
  );
}

useLoader.preload(GLTFLoader, "/police-office-web.glb", (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});
