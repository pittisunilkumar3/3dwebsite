"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useProgress } from "@react-three/drei/core/Progress.js";
import { Html } from "@react-three/drei/web/Html.js";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Vec3 = [number, number, number];
type Vec2 = [number, number];

type TourStop = {
  eyebrow: string;
  title: string;
  contentTitle: string;
  description: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  target: Vec3;
  viewDirection: Vec2;
  cameraHeight: number;
  marker: Vec3;
  fov: number;
};

type TourFrame =
  | { kind: "overview"; nextStop: number | null }
  | { kind: "stop"; stopIndex: number };

type NavigationRequest = {
  id: number;
  frameIndex: number;
};

type CameraFlight = {
  requestId: number;
  elapsed: number;
  duration: number;
  cruiseHeight: number;
  startPosition: THREE.Vector3;
  endPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  startFov: number;
  endFov: number;
};

type ServiceBranch = {
  code: string;
  title: string;
  color: string;
  items: {
    title: string;
    description: string;
  }[];
};

type ServiceItem = {
  code: string;
  title: string;
  description: string;
  category: string;
  color: string;
  side: "left" | "right";
  row: number;
};

const VIEWING_DISTANCE = 4;

function getTourViewPosition(stop: TourStop, result = new THREE.Vector3()) {
  const target = new THREE.Vector3(...stop.target);
  const viewDirection = new THREE.Vector3(
    stop.viewDirection[0],
    0,
    stop.viewDirection[1],
  ).normalize();
  const verticalDistance = stop.cameraHeight - target.y;
  const horizontalDistance = Math.sqrt(
    Math.max(VIEWING_DISTANCE ** 2 - verticalDistance ** 2, 0),
  );

  // Each authored direction is preserved and the camera remains exactly
  // four metres from its subject in three-dimensional space.
  return result
    .copy(target)
    .addScaledVector(viewDirection, horizontalDistance)
    .setY(stop.cameraHeight);
}

function getTourViewTarget(stop: TourStop, result = new THREE.Vector3()) {
  return result.set(...stop.target);
}

const TOUR_STOPS: TourStop[] = [
  {
    eyebrow: "Company / Overview",
    title: "Reception desk",
    contentTitle: "ProDyum IT",
    description: "A Hyderabad-based digital solutions company combining marketing, design, web development, and multimedia to help businesses grow online.",
    detail: "Strategy · Creativity · Technology",
    actionLabel: "Explore Our Story",
    actionHref: "https://prodyum.in/it/about",
    target: [3.3, 0.85, -12.67],
    viewDirection: [-0.7, -0.72],
    cameraHeight: 3.6,
    marker: [3.3, 1.2, -12.67],
    fov: 45,
  },
  {
    eyebrow: "Services / Interactive Map",
    title: "Evidence files",
    contentTitle: "Our Services",
    description: "Explore ProDyum's complete digital offering through an interactive connected service map.",
    detail: "Marketing · Branding · Web · Video",
    actionLabel: "View All Services",
    actionHref: "https://prodyum.in/it/services",
    target: [12.9, 0.84, -15.95],
    viewDirection: [-0.2, 0.98],
    cameraHeight: 1.44,
    marker: [12.9, 1.2, -15.95],
    fov: 39,
  },
  {
    eyebrow: "Marketing / Performance",
    title: "Safety point",
    contentTitle: "Performance Marketing",
    description: "Run data-driven advertising campaigns across Meta and Google platforms.",
    detail: "Meta Ads · Google Ads",
    actionLabel: "Get a Quote",
    actionHref: "https://prodyum.in/it/contact",
    target: [10.01, 0.48, -2.15],
    viewDirection: [-0.75, -0.66],
    cameraHeight: 1.5,
    marker: [10.01, 0.95, -2.15],
    fov: 41,
  },
  {
    eyebrow: "Process / Planning",
    title: "Interview table",
    contentTitle: "Strategy & Planning",
    description: "A tailored roadmap aligns creative and technical execution with your business goals.",
    detail: "Requirements · Roadmap · Outcomes",
    actionLabel: "Plan Your Project",
    actionHref: "https://prodyum.in/it/contact",
    target: [7.85, 0.8, -7.05],
    viewDirection: [0.82, -0.57],
    cameraHeight: 4.4,
    marker: [7.85, 1.12, -7.05],
    fov: 43,
  },
  {
    eyebrow: "Services / Development",
    title: "Analyst screen",
    contentTitle: "Web Development",
    description: "Modern, responsive business, corporate, landing-page, and e-commerce websites.",
    detail: "Responsive · Scalable · Business-ready",
    actionLabel: "Build Your Website",
    actionHref: "https://prodyum.in/it/contact",
    target: [9.26, 1.14, -12.54],
    viewDirection: [0, -1],
    cameraHeight: 1.52,
    marker: [9.26, 1.4, -12.54],
    fov: 36,
  },
  {
    eyebrow: "Marketing / Search",
    title: "Records desk",
    contentTitle: "Search Engine Optimization",
    description: "Improve search visibility through keyword research, on-page optimization, and link building.",
    detail: "Keywords · On-page · Links",
    actionLabel: "Improve Visibility",
    actionHref: "https://prodyum.in/it/contact",
    target: [12.2, 0.84, -12.38],
    viewDirection: [-0.32, -0.95],
    cameraHeight: 3.45,
    marker: [12.2, 1.18, -12.38],
    fov: 43,
  },
  {
    eyebrow: "Marketing / Social",
    title: "Lounge sofa",
    contentTitle: "Social Media Management",
    description: "End-to-end social media management across Facebook, Instagram, LinkedIn, and X.",
    detail: "Content · Community · Growth",
    actionLabel: "Grow Social Media",
    actionHref: "https://prodyum.in/it/contact",
    target: [5.7, 0.58, -12.85],
    viewDirection: [0.3, -0.95],
    cameraHeight: 3.35,
    marker: [5.7, 0.95, -12.85],
    fov: 44,
  },
  {
    eyebrow: "Services / Creative",
    title: "Chess table",
    contentTitle: "Branding & Design",
    description: "Build a strong identity through logo design, brand systems, campaign creatives, and UI/UX.",
    detail: "Logo · Identity · UI/UX",
    actionLabel: "Build Your Brand",
    actionHref: "https://prodyum.in/it/contact",
    target: [5.75, 0.76, -14.2],
    viewDirection: [-0.45, -0.89],
    cameraHeight: 3.45,
    marker: [5.75, 1.04, -14.2],
    fov: 45,
  },
  {
    eyebrow: "Why ProDyum / Delivery",
    title: "Air-conditioning unit",
    contentTitle: "End-to-end Solutions",
    description: "Complete digital services under one roof, combining strategy, creativity, and technology.",
    detail: "One team · Complete delivery",
    actionLabel: "View All Services",
    actionHref: "https://prodyum.in/it/services",
    target: [10.9, 2.05, -18.12],
    viewDirection: [0.55, 0.83],
    cameraHeight: 2.05,
    marker: [10.9, 2.05, -18.12],
    fov: 36,
  },
  {
    eyebrow: "Services / Multimedia",
    title: "Staff refreshment hub",
    contentTitle: "Video & Multimedia",
    description: "Professional product shoots, promotional videos, social reels, and video editing.",
    detail: "Shoots · Promos · Reels · Editing",
    actionLabel: "Explore Multimedia",
    actionHref: "https://prodyum.in/it/services",
    target: [1.98, 1.05, -20.71],
    viewDirection: [0.4, 0.92],
    cameraHeight: 1.58,
    marker: [1.98, 1.48, -20.71],
    fov: 42,
  },
  {
    eyebrow: "Let's Talk / Consultation",
    title: "Conference room",
    contentTitle: "Free Consultation",
    description: "Discuss your goals with ProDyum IT and shape the right digital solution for your business.",
    detail: "Discover · Plan · Deliver",
    actionLabel: "Book a Consultation",
    actionHref: "https://prodyum.in/it/contact",
    target: [11.95, 0.84, -7.62],
    viewDirection: [1, 0],
    cameraHeight: 1.65,
    marker: [12.15, 1.12, -7.62],
    fov: 44,
  },
  {
    eyebrow: "Why ProDyum / Support",
    title: "Wall clock",
    contentTitle: "24/7 Support",
    description: "Reliable support is available whenever your digital business needs assistance.",
    detail: "Responsive · Professional · Reliable",
    actionLabel: "Contact Support",
    actionHref: "https://prodyum.in/it/contact",
    target: [9.7, 2.12, -18.12],
    viewDirection: [0.08, 1],
    cameraHeight: 1.62,
    marker: [9.7, 2.12, -18.12],
    fov: 37,
  },
  {
    eyebrow: "Why ProDyum / Strategy",
    title: "Umbrella rack",
    contentTitle: "Customized Strategies",
    description: "Every solution is tailored to each client's goals, audience, and growth needs.",
    detail: "Tailored to your business",
    actionLabel: "Discuss Your Goals",
    actionHref: "https://prodyum.in/it/contact",
    target: [13.65, 0.22, -0.82],
    viewDirection: [0.5, -0.87],
    cameraHeight: 1.25,
    marker: [13.65, 0.62, -0.82],
    fov: 39,
  },
  {
    eyebrow: "Web / Commerce",
    title: "Office refrigerator",
    contentTitle: "E-commerce Websites",
    description: "Modern, responsive e-commerce websites tailored to your business needs.",
    detail: "Storefront · Mobile · Business-ready",
    actionLabel: "Launch Your Store",
    actionHref: "https://prodyum.in/it/contact",
    target: [5.79, 0.85, -9.78],
    viewDirection: [0, -1],
    cameraHeight: 1.55,
    marker: [5.79, 1.25, -9.78],
    fov: 39,
  },
  {
    eyebrow: "Why ProDyum / Growth",
    title: "Water dispenser",
    contentTitle: "Creative + Technology",
    description: "A creative and technical team combines strategy and technology to help brands grow online.",
    detail: "Creative · Strategic · Technical",
    actionLabel: "Why ProDyum",
    actionHref: "https://prodyum.in/it/about",
    target: [6.08, 0.95, -17.75],
    viewDirection: [0.2, 0.98],
    cameraHeight: 1.55,
    marker: [6.08, 1.2, -17.75],
    fov: 39,
  },
  {
    eyebrow: "Start / Your Project",
    title: "Evidence box",
    contentTitle: "Ready to Grow?",
    description: "Start a conversation about the digital solutions that can help achieve your business goals.",
    detail: "100+ clients · 50+ projects",
    actionLabel: "Start Your Project",
    actionHref: "https://prodyum.in/it/contact",
    target: [10.02, 0.82, -15.92],
    viewDirection: [0.85, 0.53],
    cameraHeight: 3.55,
    marker: [10.02, 1.1, -15.92],
    fov: 42,
  },
];

const COMPANY_CAPABILITIES = [
  {
    code: "01",
    title: "Digital Marketing",
    description: "Social media, performance campaigns, SEO, YouTube, and content strategy.",
    color: "#35c86c",
  },
  {
    code: "02",
    title: "Branding & Design",
    description: "Brand identity, campaign creatives, graphic design, and UI/UX.",
    color: "#149ee7",
  },
  {
    code: "03",
    title: "Web Development",
    description: "Business, corporate, landing-page, and e-commerce experiences.",
    color: "#f4b568",
  },
  {
    code: "04",
    title: "Video & Multimedia",
    description: "Product shoots, promotional films, social video, and editing.",
    color: "#c58aff",
  },
] as const;

const COMPANY_AUDIENCES = [
  "Startups & SMEs",
  "Real estate",
  "Education",
  "E-commerce",
  "Entertainment",
  "Local businesses",
] as const;

const SERVICE_BRANCHES: ServiceBranch[] = [
  {
    code: "01",
    title: "Digital Marketing",
    color: "#35c86c",
    items: [
      {
        title: "Social Media Management",
        description: "Plan, publish, and manage branded content and communities across major social platforms.",
      },
      {
        title: "Meta Ads & Google Ads",
        description: "Reach high-intent audiences with measurable paid campaigns across Meta and Google.",
      },
      {
        title: "Search Engine Optimization",
        description: "Improve organic visibility through keyword, on-page, technical, and authority optimisation.",
      },
      {
        title: "YouTube Marketing",
        description: "Grow reach through channel strategy, optimised videos, and audience-focused campaigns.",
      },
      {
        title: "Content Strategy",
        description: "Turn business goals into a consistent content plan across every important channel.",
      },
    ],
  },
  {
    code: "02",
    title: "Branding & Design",
    color: "#149ee7",
    items: [
      {
        title: "Logo Design",
        description: "Create a memorable and versatile logo that represents your business clearly.",
      },
      {
        title: "Brand Identity Design",
        description: "Build a complete visual system covering colour, typography, imagery, and usage.",
      },
      {
        title: "Social Media Creatives",
        description: "Produce branded posts, stories, carousels, and campaign-ready social graphics.",
      },
      {
        title: "Marketing Graphics",
        description: "Design brochures, banners, advertisements, and persuasive brand collateral.",
      },
      {
        title: "UI/UX Design",
        description: "Design intuitive websites and product experiences around real user needs.",
      },
    ],
  },
  {
    code: "03",
    title: "Web Development",
    color: "#f4b568",
    items: [
      {
        title: "Business Websites",
        description: "Present your services with a fast, responsive website built to generate enquiries.",
      },
      {
        title: "Corporate Websites",
        description: "Create a credible and scalable company website for teams, stakeholders, and customers.",
      },
      {
        title: "Landing Pages",
        description: "Build focused campaign pages designed to turn traffic into qualified leads.",
      },
      {
        title: "E-commerce Websites",
        description: "Launch a secure online store with smooth product discovery and checkout.",
      },
    ],
  },
  {
    code: "04",
    title: "Video & Multimedia",
    color: "#c58aff",
    items: [
      {
        title: "Product Shoots",
        description: "Capture professional product photography and video for campaigns and catalogues.",
      },
      {
        title: "Promotional Videos",
        description: "Tell your brand story through polished videos built for awareness and conversion.",
      },
      {
        title: "Social Media Videos",
        description: "Create short-form reels and platform-ready videos that stop the scroll.",
      },
      {
        title: "Video Editing",
        description: "Transform raw footage with polished pacing, graphics, sound, and colour.",
      },
    ],
  },
];

const serviceSideRows = { left: 0, right: 0 };
const INDIVIDUAL_SERVICES: ServiceItem[] = SERVICE_BRANCHES.flatMap(
  (branch, branchIndex) =>
    branch.items.map((item, itemIndex) => {
      const side: ServiceItem["side"] =
        (itemIndex + branchIndex) % 2 === 0 ? "left" : "right";
      const row = serviceSideRows[side];
      serviceSideRows[side] += 1;

      return {
        code: String(
          SERVICE_BRANCHES
            .slice(0, branchIndex)
            .reduce((total, item) => total + item.items.length, 0) +
            itemIndex +
            1,
        ).padStart(2, "0"),
        title: item.title,
        description: item.description,
        category: branch.title,
        color: branch.color,
        side,
        row,
      };
    }),
);

const SERVICE_MAP_HUB_Y = 380;
const SERVICE_MAP_ROW_HEIGHT = 70;
const SERVICE_MAP_ROW_STEP = 82;
const SERVICE_MAP_DIAGONAL_X = 118.5;

// The landing overview is composed slightly to the right so the office remains
// visible beside the editorial hero panel instead of sitting behind the copy.
const TOP_VIEW_POSITION = new THREE.Vector3(8.3, 22, -9.8);
const TOP_VIEW_TARGET = new THREE.Vector3(8.3, 0, -10.8);
const TOP_VIEW_FOV = 52;
const SAFE_TRAVEL_HEIGHT = 7.5;

const TOUR_FRAMES: TourFrame[] = [
  { kind: "overview", nextStop: 0 },
  ...TOUR_STOPS.flatMap<TourFrame>((_, index) => [
    { kind: "stop", stopIndex: index },
    {
      kind: "overview",
      nextStop: index < TOUR_STOPS.length - 1 ? index + 1 : null,
    },
  ]),
];

function getFramePosition(frame: TourFrame) {
  return frame.kind === "overview"
    ? TOP_VIEW_POSITION.clone()
    : getTourViewPosition(TOUR_STOPS[frame.stopIndex]);
}

function getFrameTarget(frame: TourFrame) {
  return frame.kind === "overview"
    ? TOP_VIEW_TARGET.clone()
    : getTourViewTarget(TOUR_STOPS[frame.stopIndex]);
}

function getFrameFov(frame: TourFrame) {
  return frame.kind === "overview"
    ? TOP_VIEW_FOV
    : TOUR_STOPS[frame.stopIndex].fov;
}

function CameraRig({
  progressRef,
  navigationRequestRef,
  onNavigationSettled,
  reducedMotion,
}: {
  progressRef: React.MutableRefObject<number>;
  navigationRequestRef: React.MutableRefObject<NavigationRequest | null>;
  onNavigationSettled: () => void;
  reducedMotion: boolean;
}) {
  const positions = useMemo(
    () => TOUR_FRAMES.map(getFramePosition),
    [],
  );
  const targets = useMemo(
    () => TOUR_FRAMES.map(getFrameTarget),
    [],
  );
  const fovs = useMemo(() => TOUR_FRAMES.map(getFrameFov), []);
  const desiredPositionRef = useRef(new THREE.Vector3());
  const desiredTargetRef = useRef(new THREE.Vector3());
  const smoothTarget = useRef(targets[0].clone());
  const handledRequestId = useRef(0);
  const flightRef = useRef<CameraFlight | null>(null);

  useFrame(({ camera }, delta) => {
    const desiredPosition = desiredPositionRef.current;
    const desiredTarget = desiredTargetRef.current;
    const navigationRequest = navigationRequestRef.current;

    if (
      navigationRequest &&
      navigationRequest.id !== handledRequestId.current
    ) {
      handledRequestId.current = navigationRequest.id;
      const endPosition = positions[navigationRequest.frameIndex];
      flightRef.current = {
        requestId: navigationRequest.id,
        elapsed: 0,
        duration: reducedMotion ? 0.01 : 2.2,
        cruiseHeight: Math.max(
          SAFE_TRAVEL_HEIGHT,
          camera.position.y,
          endPosition.y,
        ),
        startPosition: camera.position.clone(),
        endPosition: endPosition.clone(),
        startTarget: smoothTarget.current.clone(),
        endTarget: targets[navigationRequest.frameIndex].clone(),
        startFov:
          camera instanceof THREE.PerspectiveCamera
            ? camera.fov
            : fovs[navigationRequest.frameIndex],
        endFov: fovs[navigationRequest.frameIndex],
      };
    }

    const flight = flightRef.current;
    if (flight) {
      flight.elapsed += delta;
      const flightProgress = THREE.MathUtils.clamp(
        flight.elapsed / flight.duration,
        0,
        1,
      );

      if (flightProgress < 0.28) {
        const phase = THREE.MathUtils.smootherstep(
          flightProgress / 0.28,
          0,
          1,
        );
        desiredPosition.copy(flight.startPosition);
        desiredPosition.y = THREE.MathUtils.lerp(
          flight.startPosition.y,
          flight.cruiseHeight,
          phase,
        );
      } else if (flightProgress < 0.72) {
        const phase = THREE.MathUtils.smootherstep(
          (flightProgress - 0.28) / 0.44,
          0,
          1,
        );
        desiredPosition.lerpVectors(
          flight.startPosition,
          flight.endPosition,
          phase,
        );
        desiredPosition.y = flight.cruiseHeight;
      } else {
        const phase = THREE.MathUtils.smootherstep(
          (flightProgress - 0.72) / 0.28,
          0,
          1,
        );
        desiredPosition.copy(flight.endPosition);
        desiredPosition.y = THREE.MathUtils.lerp(
          flight.cruiseHeight,
          flight.endPosition.y,
          phase,
        );
      }

      const targetProgress = THREE.MathUtils.smootherstep(
        flightProgress,
        0,
        1,
      );
      desiredTarget
        .copy(flight.startTarget)
        .lerp(flight.endTarget, targetProgress);

      camera.position.copy(desiredPosition);
      smoothTarget.current.copy(desiredTarget);
      camera.lookAt(smoothTarget.current);

      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = THREE.MathUtils.lerp(
          flight.startFov,
          flight.endFov,
          targetProgress,
        );
        camera.updateProjectionMatrix();
      }

      if (flightProgress >= 1) {
        flightRef.current = null;
        if (navigationRequestRef.current?.id === flight.requestId) {
          navigationRequestRef.current = null;
        }
        onNavigationSettled();
      }
      return;
    }

    const progress = THREE.MathUtils.clamp(progressRef.current, 0, 1);
    const scaled = progress * (TOUR_FRAMES.length - 1);
    const start = Math.floor(scaled);
    const end = Math.min(start + 1, TOUR_FRAMES.length - 1);
    const segmentProgress = scaled - start;
    const easedProgress = THREE.MathUtils.smootherstep(segmentProgress, 0, 1);
    const startFrame = TOUR_FRAMES[start];
    const endFrame = TOUR_FRAMES[end];
    const startPosition = positions[start];
    const endPosition = positions[end];

    if (start === end) {
      desiredPosition.copy(startPosition);
    } else if (startFrame.kind === "overview" && endFrame.kind === "stop") {
      // Travel over the walls first, then descend vertically onto the point.
      const horizontalPhase = 0.64;
      if (easedProgress < horizontalPhase) {
        const phase = THREE.MathUtils.smootherstep(
          easedProgress / horizontalPhase,
          0,
          1,
        );
        desiredPosition.lerpVectors(startPosition, endPosition, phase);
        desiredPosition.y = THREE.MathUtils.lerp(
          startPosition.y,
          SAFE_TRAVEL_HEIGHT,
          phase,
        );
      } else {
        const phase = THREE.MathUtils.smootherstep(
          (easedProgress - horizontalPhase) / (1 - horizontalPhase),
          0,
          1,
        );
        desiredPosition.copy(endPosition);
        desiredPosition.y = THREE.MathUtils.lerp(
          SAFE_TRAVEL_HEIGHT,
          endPosition.y,
          phase,
        );
      }
    } else if (startFrame.kind === "stop" && endFrame.kind === "overview") {
      // Reverse the same safe route: rise above the walls before crossing.
      const verticalPhase = 0.36;
      if (easedProgress < verticalPhase) {
        const phase = THREE.MathUtils.smootherstep(
          easedProgress / verticalPhase,
          0,
          1,
        );
        desiredPosition.copy(startPosition);
        desiredPosition.y = THREE.MathUtils.lerp(
          startPosition.y,
          SAFE_TRAVEL_HEIGHT,
          phase,
        );
      } else {
        const phase = THREE.MathUtils.smootherstep(
          (easedProgress - verticalPhase) / (1 - verticalPhase),
          0,
          1,
        );
        desiredPosition.lerpVectors(startPosition, endPosition, phase);
        desiredPosition.y = THREE.MathUtils.lerp(
          SAFE_TRAVEL_HEIGHT,
          endPosition.y,
          phase,
        );
      }
    } else {
      desiredPosition.lerpVectors(startPosition, endPosition, easedProgress);
    }

    desiredTarget
      .copy(targets[start])
      .lerp(targets[end], easedProgress);

    const speed = reducedMotion ? 18 : 4.2;
    const alpha = 1 - Math.exp(-speed * delta);
    camera.position.lerp(desiredPosition, alpha);
    smoothTarget.current.lerp(desiredTarget, alpha);
    camera.lookAt(smoothTarget.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const desiredFov = THREE.MathUtils.lerp(
        fovs[start],
        fovs[end],
        easedProgress,
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
    const materials = new Set<THREE.Material>();

    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
        object.frustumCulled = true;

        const meshMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        meshMaterials.forEach((material) => materials.add(material));
      }
    });

    // The source model contains one-sided wall surfaces. Rendering both faces
    // keeps every wall visible while the camera moves inside the office.
    materials.forEach((material) => {
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    });
  }, [gltf.scene]);

  return <primitive object={gltf.scene} dispose={null} />;
}

function Hotspots({
  active,
  onSelect,
}: {
  active: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <group>
      {TOUR_STOPS.map((stop, index) => {
        const isActive = index === active;
        const isNear = active === null || Math.abs(index - active) <= 1;
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

function CompanyOverview({
  onPrevious,
  onNext,
}: {
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <section
      className="company-overview"
      aria-labelledby="company-overview-title"
      aria-live="polite"
    >
      <div className="company-overview-orbit" aria-hidden="true">
        <span />
        <span />
      </div>

      <header className="company-overview-header">
        <div>
          <span className="company-overview-point">Point 01</span>
          <span className="company-overview-location">Reception · Hyderabad</span>
        </div>
        <p>Company overview</p>
      </header>

      <div className="company-overview-grid">
        <div className="company-overview-intro">
          <p className="company-overview-kicker">
            ProDyum IT Pvt Ltd
          </p>
          <h1 id="company-overview-title">
            One partner for
            <strong>digital growth.</strong>
          </h1>
          <p className="company-overview-summary">
            A Hyderabad-based digital solutions company bringing strategy,
            creativity, and technology together to build stronger brands and
            meaningful online growth.
          </p>

          <div className="company-overview-promise">
            <span aria-hidden="true">ϟ</span>
            <div>
              <small>Our promise</small>
              <strong>From first idea to measurable digital presence.</strong>
            </div>
          </div>

          <a
            className="company-overview-link"
            href="https://prodyum.in/it/about"
            target="_blank"
            rel="noreferrer"
          >
            Explore our complete story <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="company-overview-details">
          <div className="company-overview-section-heading">
            <span>What we do</span>
            <small>End-to-end capabilities</small>
          </div>

          <div className="company-capabilities">
            {COMPANY_CAPABILITIES.map((capability) => (
              <article
                key={capability.code}
                className="company-capability"
                style={{ "--capability-color": capability.color } as CSSProperties}
              >
                <span>{capability.code}</span>
                <div>
                  <h2>{capability.title}</h2>
                  <p>{capability.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="company-purpose">
            <article>
              <span>Mission</span>
              <p>
                Empower businesses with modern digital solutions that improve
                visibility, engagement, and growth.
              </p>
            </article>
            <article>
              <span>Vision</span>
              <p>
                Become a trusted digital partner for ambitious businesses
                across India.
              </p>
            </article>
          </div>
        </div>
      </div>

      <footer className="company-overview-footer">
        <div className="company-audiences" aria-label="Industries and clients we serve">
          <span>Built for</span>
          <div>
            {COMPANY_AUDIENCES.map((audience) => (
              <small key={audience}>{audience}</small>
            ))}
          </div>
        </div>
        <div className="company-overview-actions">
          <button type="button" onClick={onPrevious}>
            Previous view
          </button>
          <button type="button" className="next-action" onClick={onNext}>
            Continue tour <span aria-hidden="true">↘</span>
          </button>
        </div>
      </footer>
    </section>
  );
}

function SceneServicesMap({
  visible,
  selectedIndex,
  onSelect,
  onPrevious,
  onNext,
}: {
  visible: boolean;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const touchStartYRef = useRef<number | null>(null);
  const boundaryLockRef = useRef(false);

  const navigateAtBoundary = useCallback(
    (direction: "previous" | "next") => {
      if (boundaryLockRef.current) return;
      boundaryLockRef.current = true;
      if (direction === "next") {
        onNext();
      } else {
        onPrevious();
      }
      window.setTimeout(() => {
        boundaryLockRef.current = false;
      }, 800);
    },
    [onNext, onPrevious],
  );

  const handleServicesWheel = useCallback(
    (event: ReactWheelEvent<HTMLElement>) => {
      const element = event.currentTarget;
      if (element.scrollHeight <= element.clientHeight + 2) return;
      const atTop = element.scrollTop <= 2;
      const atBottom =
        element.scrollTop + element.clientHeight >= element.scrollHeight - 2;

      if ((event.deltaY > 0 && atBottom) || (event.deltaY < 0 && atTop)) {
        event.preventDefault();
        navigateAtBoundary(event.deltaY > 0 ? "next" : "previous");
      }
    },
    [navigateAtBoundary],
  );

  const handleServicesTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLElement>) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    },
    [],
  );

  const handleServicesTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLElement>) => {
      const startY = touchStartYRef.current;
      const currentY = event.touches[0]?.clientY;
      if (startY === null || currentY === undefined) return;

      const gestureDistance = startY - currentY;
      if (Math.abs(gestureDistance) < 24) return;

      const element = event.currentTarget;
      if (element.scrollHeight <= element.clientHeight + 2) return;
      const atTop = element.scrollTop <= 2;
      const atBottom =
        element.scrollTop + element.clientHeight >= element.scrollHeight - 2;

      if ((gestureDistance > 0 && atBottom) || (gestureDistance < 0 && atTop)) {
        event.preventDefault();
        touchStartYRef.current = currentY;
        navigateAtBoundary(gestureDistance > 0 ? "next" : "previous");
      }
    },
    [navigateAtBoundary],
  );

  if (!visible) return null;

  return (
    <Html
      position={[12.9, 0.84, -15.95]}
      fullscreen
      zIndexRange={[70, 45]}
    >
      <section
        className="scene-services-flow"
        aria-labelledby="services-map-title"
        onWheel={handleServicesWheel}
        onTouchStart={handleServicesTouchStart}
        onTouchMove={handleServicesTouchMove}
        onTouchEnd={() => {
          touchStartYRef.current = null;
        }}
      >
        <header className="services-map-heading">
          <span>Point 02 · Digital solutions</span>
          <h1 id="services-map-title">Our Services</h1>
          <p>Explore every service and continue scrolling to resume the office tour.</p>
        </header>

        <div className="services-map">
          <div className="service-hub" aria-hidden="true">
            <span>02</span>
          </div>

          {INDIVIDUAL_SERVICES.map((service, index) => {
            const isSelected = selectedIndex === index;
            const serviceY =
              SERVICE_MAP_ROW_HEIGHT / 2 + service.row * SERVICE_MAP_ROW_STEP;
            const deltaY = SERVICE_MAP_HUB_Y - serviceY;
            const connectorLength = Math.hypot(
              SERVICE_MAP_DIAGONAL_X,
              deltaY,
            );
            const connectorAngle =
              (Math.atan2(
                deltaY,
                service.side === "left"
                  ? SERVICE_MAP_DIAGONAL_X
                  : -SERVICE_MAP_DIAGONAL_X,
              ) *
                180) /
              Math.PI;
            const serviceStyle = {
              "--service-row": service.row,
              "--service-color": service.color,
              "--connector-length": `${connectorLength}px`,
              "--connector-angle": `${connectorAngle}deg`,
            } as CSSProperties;

            return (
              <button
                key={service.title}
                type="button"
                className={`service-node service-node--${service.side}${isSelected ? " is-selected" : ""}`}
                style={serviceStyle}
                onClick={() => onSelect(index)}
                aria-pressed={isSelected}
                aria-label={`${service.title}, ${service.category}`}
              >
                <span className="service-connector" aria-hidden="true" />
                <span className="service-node-number">{service.code}</span>
                <span className="service-node-copy">
                  <strong>{service.title}</strong>
                  <small>{service.category}</small>
                  <p>{service.description}</p>
                </span>
                <i aria-hidden="true">{isSelected ? "✓" : "↗"}</i>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="services-mobile-continue"
          onClick={onNext}
        >
          Continue office tour <span aria-hidden="true">↓</span>
        </button>
      </section>
    </Html>
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
  const navigationRequestRef = useRef<NavigationRequest | null>(null);
  const navigationIdRef = useRef(0);
  const activeFrameRef = useRef(0);
  const [activeFrame, setActiveFrame] = useState(0);
  const [isLanding, setIsLanding] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(0);

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
      setIsLanding(window.scrollY <= 8);
      progressRef.current = nextProgress;
      const nextActiveFrame = Math.min(
        TOUR_FRAMES.length - 1,
        Math.round(nextProgress * (TOUR_FRAMES.length - 1)),
      );
      if (nextActiveFrame !== activeFrameRef.current) {
        activeFrameRef.current = nextActiveFrame;
        setActiveFrame(nextActiveFrame);
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

  const goToFrame = useCallback(
    (frameIndex: number) => {
      const nextFrame = THREE.MathUtils.clamp(
        frameIndex,
        0,
        TOUR_FRAMES.length - 1,
      );
      if (
        nextFrame === activeFrameRef.current &&
        navigationRequestRef.current === null
      ) {
        setIsNavigating(false);
        return;
      }
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      const nextProgress = nextFrame / (TOUR_FRAMES.length - 1);

      setIsNavigating(true);
      navigationIdRef.current += 1;
      navigationRequestRef.current = {
        id: navigationIdRef.current,
        frameIndex: nextFrame,
      };
      progressRef.current = nextProgress;
      activeFrameRef.current = nextFrame;
      setActiveFrame(nextFrame);
      setIsLanding(nextFrame === 0);

      // Jump the document directly to the selected chapter. CameraRig owns the
      // visible over-wall flight, so intermediate stops never activate.
      window.scrollTo({ top: nextProgress * maxScroll, behavior: "auto" });
    },
    [],
  );

  const handleNavigationSettled = useCallback(() => {
    setIsNavigating(false);
  }, []);

  const goToStop = useCallback(
    (stopIndex: number) => goToFrame(stopIndex * 2 + 1),
    [goToFrame],
  );

  const frame = TOUR_FRAMES[activeFrame];
  const activeStop = frame.kind === "stop" ? frame.stopIndex : null;
  const overviewNextStop = frame.kind === "overview" ? frame.nextStop : null;
  const stop = activeStop === null ? null : TOUR_STOPS[activeStop];
  const pointNumber = activeStop === null ? 0 : activeStop + 1;
  const progressPercent = ((activeFrame + 1) / TOUR_FRAMES.length) * 100;
  const story = stop
    ? {
        eyebrow: stop.eyebrow,
        title: stop.contentTitle,
        description: stop.description,
        detail: stop.detail,
        meta: `Point ${String(pointNumber).padStart(2, "0")} · ${stop.title}`,
        actionLabel: stop.actionLabel,
        actionHref: stop.actionHref,
      }
    : overviewNextStop === null
      ? {
          eyebrow: "Tour / Complete",
          title: "Tour complete",
          description: "You have explored all sixteen office viewpoints. Scroll upward to revisit any point.",
          detail: "Sixteen points explored",
          meta: "Top view",
          actionLabel: null,
          actionHref: null,
        }
      : {
          eyebrow: "Navigation / Top View",
          title: "Office overview",
          description: `Continue scrolling to point ${String(overviewNextStop + 1).padStart(2, "0")}: ${TOUR_STOPS[overviewNextStop].title}.`,
          detail: `Next · ${TOUR_STOPS[overviewNextStop].title}`,
          meta: "Top view",
          actionLabel: null,
          actionHref: null,
        };
  const presentedStory =
    isNavigating && stop
      ? {
          eyebrow: "Navigation / Direct Flight",
          title: `Moving to ${stop.title}`,
          description: "The camera is taking a direct route above the office and descending at the selected pointer.",
          detail: "Rise · Travel · Descend",
          meta: `Point ${String(pointNumber).padStart(2, "0")}`,
          actionLabel: null,
          actionHref: null,
        }
      : story;
  const showCompanyOverview = activeStop === 0 && !isNavigating;
  const showServicesFlow = activeStop === 1 && !isNavigating;

  return (
    <main className={`office-tour${isLanding ? " is-landing" : ""}${showCompanyOverview ? " is-company-overview" : ""}${showServicesFlow ? " is-services" : ""}`}>
      <div className="scene-stage" aria-label="Interactive three-dimensional office tour">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: TOP_VIEW_POSITION.toArray(), fov: TOP_VIEW_FOV, near: 0.05, far: 100 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <color attach="background" args={["#080a0b"]} />
          <fog attach="fog" args={["#080a0b", 24, 52]} />
          <ambientLight intensity={0.72} />
          <hemisphereLight args={["#f1e5cb", "#24211c", 0.8]} />
          <directionalLight position={[7, 10, 4]} intensity={1.05} color="#ffe5b0" />
          <directionalLight position={[-8, 5, -12]} intensity={0.42} color="#87a0b4" />
          <Suspense fallback={null}>
            <OfficeModel />
            {!showServicesFlow ? (
              <Hotspots active={activeStop} onSelect={goToStop} />
            ) : null}
            <SceneServicesMap
              visible={showServicesFlow}
              selectedIndex={selectedServiceIndex}
              onSelect={setSelectedServiceIndex}
              onPrevious={() => goToFrame(Math.max(activeFrame - 1, 0))}
              onNext={() => goToFrame(Math.min(activeFrame + 1, TOUR_FRAMES.length - 1))}
            />
          </Suspense>
          <CameraRig
            progressRef={progressRef}
            navigationRequestRef={navigationRequestRef}
            onNavigationSettled={handleNavigationSettled}
            reducedMotion={reducedMotion}
          />
        </Canvas>
        <div className="scene-vignette" aria-hidden="true" />
        <div className="scene-grain" aria-hidden="true" />
      </div>

      <LoadingScreen />

      <section className={`landing-hero${isLanding ? "" : " is-hidden"}`} aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="landing-badge">
            <span aria-hidden="true">ϟ</span>
            Digital Solutions Partner
          </p>
          <h1 id="landing-title">
            <span>Helping Businesses Grow</span>
            <span>Through</span>
            <strong>Digital Marketing &amp;</strong>
            <strong>Technology</strong>
          </h1>
          <p className="landing-description">
            ProDyum IT Pvt Ltd delivers professional Digital Marketing, Branding, Web Development, and Multimedia Solutions that help businesses build a strong digital presence and grow online.
          </p>
          <div className="landing-actions">
            <a className="landing-primary" href="https://prodyum.in/it/services">
              <span>Our Services</span><i aria-hidden="true">→</i>
            </a>
            <a className="landing-secondary" href="https://prodyum.in/it/contact">
              <span>Contact Us</span>
            </a>
          </div>
        </div>
      </section>

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
                className={`${index === activeStop ? "is-active" : ""}${index === overviewNextStop ? " is-next" : ""}`}
                onClick={() => goToStop(index)}
                aria-current={index === activeStop ? "step" : undefined}
                aria-label={`Stop ${index + 1}: ${item.title}`}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.title}</strong>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {showCompanyOverview ? (
        <CompanyOverview
          onPrevious={() => goToFrame(Math.max(activeFrame - 1, 0))}
          onNext={() => goToFrame(Math.min(activeFrame + 1, TOUR_FRAMES.length - 1))}
        />
      ) : null}

      {activeFrame > 0 && !showCompanyOverview && !showServicesFlow ? (
        <section className={`story-card${stop ? "" : " is-overview"}${isNavigating ? " is-travelling" : ""}`} aria-live="polite" aria-atomic="true">
          <div className="story-meta">
            <span>{presentedStory.meta}</span>
            <span>{presentedStory.eyebrow}</span>
          </div>
          <h1>{presentedStory.title}</h1>
          <p>{presentedStory.description}</p>
          <div className="story-detail">
            <span aria-hidden="true" />
            {presentedStory.detail}
          </div>
          {presentedStory.actionHref && presentedStory.actionLabel ? (
            <a
              className="story-cta"
              href={presentedStory.actionHref}
              target="_blank"
              rel="noreferrer"
              aria-label={`${presentedStory.actionLabel} on ProDyum IT`}
            >
              {presentedStory.actionLabel}
              <span aria-hidden="true">↗</span>
            </a>
          ) : null}
          <div className="story-actions">
            <button type="button" onClick={() => goToFrame(Math.max(activeFrame - 1, 0))} disabled={activeFrame === 0}>
              Previous view
            </button>
            <button
              type="button"
              className="next-action"
              onClick={() => goToFrame(Math.min(activeFrame + 1, TOUR_FRAMES.length - 1))}
              disabled={activeFrame === TOUR_FRAMES.length - 1}
            >
              Next view <span aria-hidden="true">↘</span>
            </button>
          </div>
        </section>
      ) : null}

      {showServicesFlow ? (
        <div className="point-two-controls" aria-label="Point 2 navigation">
          <button type="button" onClick={() => goToFrame(Math.max(activeFrame - 1, 0))}>
            Previous view
          </button>
          <span>Point 02 · Services</span>
          <button type="button" onClick={() => goToFrame(Math.min(activeFrame + 1, TOUR_FRAMES.length - 1))}>
            Next view <i aria-hidden="true">↘</i>
          </button>
        </div>
      ) : null}

      <div className={`scroll-cue${activeFrame > 0 ? " is-hidden" : ""}`} aria-hidden="true">
        <span className="scroll-mouse" />
        <div>
          <strong>Scroll to explore</strong>
          <small>First stop · Reception</small>
        </div>
      </div>

      <div className="chapter-count" aria-hidden="true">
        <span>{activeStop === null ? "TOP" : String(activeStop + 1).padStart(2, "0")}</span>
        <i />
        <span>{String(TOUR_STOPS.length).padStart(2, "0")}</span>
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
        {TOUR_FRAMES.map((item, index) => {
          const label =
            item.kind === "overview"
              ? item.nextStop === null
                ? "Final office overview"
                : `Office overview before point ${item.nextStop + 1}`
              : `Tour point ${item.stopIndex + 1}: ${TOUR_STOPS[item.stopIndex].title}`;
          return (
            <section key={`${item.kind}-${index}`} aria-label={label}>
              <h2 className="sr-only">{label}</h2>
            </section>
          );
        })}
      </div>
    </main>
  );
}

useLoader.preload(GLTFLoader, "/police-office-web.glb", (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});
