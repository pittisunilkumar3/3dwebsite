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
const COMPACT_COMPANY_VIEWING_DISTANCE = 4.1;
// Point-one bubbles are presentation content, not physical office objects.
// Keep them above the GLB depth buffer so walls and furniture never obscure
// their copy while preserving their authored 3D positions and motion.
const COMPANY_BUBBLE_OVERLAY_ORDER = 80;

function getTourViewPosition(
  stop: TourStop,
  result = new THREE.Vector3(),
  viewingDistance = VIEWING_DISTANCE,
) {
  const target = new THREE.Vector3(...stop.target);
  const viewDirection = new THREE.Vector3(
    stop.viewDirection[0],
    0,
    stop.viewDirection[1],
  ).normalize();
  const verticalDistance = stop.cameraHeight - target.y;
  const horizontalDistance = Math.sqrt(
    Math.max(viewingDistance ** 2 - verticalDistance ** 2, 0),
  );

  // Each authored direction is preserved while the viewing distance can widen
  // for compact screens without changing the intended angle.
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
    target: [3.3, 2.05, -12.67],
    viewDirection: [-0.7, -0.72],
    cameraHeight: 2.7,
    marker: [3.3, 1.05, -12.67],
    fov: 55,
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

const COMPANY_BUBBLES = [
  {
    key: "overview",
    code: "PRODYUM IT",
    title: "Ideas Into",
    description:
      "Hyderabad digital solutions partner combining strategy, creativity, and technology.",
    footer: "Strategy · Creativity · Technology",
    color: "#35c86c",
    kind: "hero",
  },
  ...COMPANY_CAPABILITIES.map((capability) => ({
    key: capability.code,
    code: capability.code,
    title: capability.title,
    description: capability.description,
    footer: "End-to-end capability",
    color: capability.color,
    kind: "service",
  })),
  {
    key: "purpose",
    code: "MISSION · VISION",
    title: "Grow With\nConfidence.",
    description:
      "Modern, measurable solutions from a trusted digital partner for ambitious brands.",
    footer: "Built for business growth",
    color: "#48dd87",
    kind: "purpose",
  },
] as const;

const DESKTOP_COMPANY_BUBBLE_LAYOUT = [
  { position: [-1.12, 0.25, 0.02] as Vec3, radius: 0.9 },
  { position: [0.2, 1, 0.08] as Vec3, radius: 0.58 },
  { position: [1.42, 0.52, -0.02] as Vec3, radius: 0.58 },
  { position: [0.22, -0.42, 0.06] as Vec3, radius: 0.58 },
  { position: [1.42, -0.88, 0.1] as Vec3, radius: 0.58 },
  { position: [-0.88, -1.03, 0.1] as Vec3, radius: 0.64 },
] as const;

const COMPACT_COMPANY_BUBBLE_LAYOUT = [
  { position: [0, 1.08, 0.02] as Vec3, radius: 0.84 },
  { position: [-0.61, -0.08, 0.08] as Vec3, radius: 0.53 },
  { position: [0.61, -0.08, -0.02] as Vec3, radius: 0.53 },
  { position: [-0.61, -1.18, 0.06] as Vec3, radius: 0.53 },
  { position: [0.61, -1.18, 0.1] as Vec3, radius: 0.53 },
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

function getFramePosition(frame: TourFrame, compactViewport = false) {
  const compactCompanyView =
    compactViewport && frame.kind === "stop" && frame.stopIndex === 0;

  return frame.kind === "overview"
    ? TOP_VIEW_POSITION.clone()
    : getTourViewPosition(
        TOUR_STOPS[frame.stopIndex],
        new THREE.Vector3(),
        compactCompanyView
          ? COMPACT_COMPANY_VIEWING_DISTANCE
          : VIEWING_DISTANCE,
      );
}

function getFrameTarget(frame: TourFrame) {
  return frame.kind === "overview"
    ? TOP_VIEW_TARGET.clone()
    : getTourViewTarget(TOUR_STOPS[frame.stopIndex]);
}

function getFrameFov(frame: TourFrame, compactViewport = false) {
  if (compactViewport && frame.kind === "stop" && frame.stopIndex === 0) {
    return 70;
  }

  return frame.kind === "overview"
    ? TOP_VIEW_FOV
    : TOUR_STOPS[frame.stopIndex].fov;
}

function CameraRig({
  progressRef,
  navigationRequestRef,
  onNavigationSettled,
  reducedMotion,
  compactViewport,
}: {
  progressRef: React.MutableRefObject<number>;
  navigationRequestRef: React.MutableRefObject<NavigationRequest | null>;
  onNavigationSettled: () => void;
  reducedMotion: boolean;
  compactViewport: boolean;
}) {
  const positions = useMemo(
    () => TOUR_FRAMES.map((frame) => getFramePosition(frame, compactViewport)),
    [compactViewport],
  );
  const targets = useMemo(
    () => TOUR_FRAMES.map(getFrameTarget),
    [],
  );
  const fovs = useMemo(
    () => TOUR_FRAMES.map((frame) => getFrameFov(frame, compactViewport)),
    [compactViewport],
  );
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

function roundedCanvasPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const corner = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.quadraticCurveTo(x + width, y, x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - corner,
    y + height,
  );
  context.lineTo(x + corner, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - corner);
  context.lineTo(x, y + corner);
  context.quadraticCurveTo(x, y, x + corner, y);
  context.closePath();
}

function drawWrappedCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  });

  if (currentLine) lines.push(currentLine);
  lines.slice(0, maxLines).forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });
}

function createCompactCompanyOverviewTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1500;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Texture();

  context.save();
  roundedCanvasPath(context, 10, 10, 980, 1480, 42);
  context.clip();

  const background = context.createLinearGradient(0, 0, 1000, 1500);
  background.addColorStop(0, "rgba(4, 17, 25, 0.99)");
  background.addColorStop(0.58, "rgba(5, 14, 20, 0.98)");
  background.addColorStop(1, "rgba(5, 28, 22, 0.97)");
  context.fillStyle = background;
  context.fillRect(0, 0, 1000, 1500);

  const glow = context.createRadialGradient(800, 90, 0, 800, 90, 520);
  glow.addColorStop(0, "rgba(53, 200, 108, 0.2)");
  glow.addColorStop(1, "rgba(53, 200, 108, 0)");
  context.fillStyle = glow;
  context.fillRect(300, 0, 700, 650);

  context.strokeStyle = "rgba(255,255,255,0.035)";
  context.lineWidth = 1;
  for (let x = 40; x < 1000; x += 60) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 1500);
    context.stroke();
  }
  for (let y = 40; y < 1500; y += 60) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(1000, y);
    context.stroke();
  }
  context.restore();

  context.strokeStyle = "rgba(73, 229, 143, 0.62)";
  context.lineWidth = 4;
  roundedCanvasPath(context, 10, 10, 980, 1480, 42);
  context.stroke();

  const topLine = context.createLinearGradient(65, 0, 470, 0);
  topLine.addColorStop(0, "#149ee7");
  topLine.addColorStop(1, "#35c86c");
  context.fillStyle = topLine;
  context.fillRect(62, 10, 408, 7);

  context.font = '700 24px "SFMono-Regular", monospace';
  context.letterSpacing = "3px";
  context.fillStyle = "#48dd87";
  context.fillText("POINT 01", 64, 72);
  context.textAlign = "right";
  context.fillStyle = "rgba(236, 244, 241, 0.52)";
  context.fillText("COMPANY OVERVIEW", 936, 72);
  context.textAlign = "left";
  context.letterSpacing = "0px";

  context.strokeStyle = "rgba(236,244,241,0.13)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(64, 108);
  context.lineTo(936, 108);
  context.stroke();

  context.font = '700 24px "SFMono-Regular", monospace';
  context.fillStyle = "#41bdf1";
  context.fillText("PRODYUM IT PVT LTD", 64, 166);

  context.font = '500 72px Georgia, "Times New Roman", serif';
  context.fillStyle = "#f4f4ef";
  context.fillText("IDEAS INTO", 64, 257);
  const titleGradient = context.createLinearGradient(64, 0, 760, 0);
  titleGradient.addColorStop(0, "#25a9eb");
  titleGradient.addColorStop(1, "#46df86");
  context.fillStyle = titleGradient;
  context.fillText("DIGITAL GROWTH.", 64, 338);

  context.font = '400 28px "Avenir Next", Arial, sans-serif';
  context.fillStyle = "rgba(236,244,241,0.72)";
  drawWrappedCanvasText(
    context,
    "A Hyderabad-based digital solutions company combining strategy, creativity, and technology to help businesses build stronger brands and grow online.",
    64,
    405,
    872,
    42,
    4,
  );

  roundedCanvasPath(context, 64, 560, 872, 82, 18);
  context.fillStyle = "rgba(20,158,231,0.10)";
  context.fill();
  context.strokeStyle = "rgba(53,200,108,0.35)";
  context.stroke();
  context.font = '700 18px "SFMono-Regular", monospace';
  context.fillStyle = "#48dd87";
  context.fillText("OUR APPROACH", 92, 593);
  context.font = '600 24px "Avenir Next", Arial, sans-serif';
  context.fillStyle = "#f3f6f3";
  context.fillText("Strategy  +  Creativity  +  Technology", 92, 626);

  context.font = '700 20px "SFMono-Regular", monospace';
  context.fillStyle = "#48dd87";
  context.fillText("WHAT WE DO", 64, 704);

  COMPANY_CAPABILITIES.forEach((capability, index) => {
    const x = 64;
    const y = 736 + index * 137;

    roundedCanvasPath(context, x, y, 872, 116, 16);
    context.fillStyle = "rgba(2,10,14,0.52)";
    context.fill();
    context.strokeStyle = `${capability.color}80`;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = capability.color;
    context.fillRect(x, y + 16, 6, 84);

    context.font = '700 20px "SFMono-Regular", monospace';
    context.fillText(capability.code, x + 30, y + 45);
    context.font = '700 28px "Avenir Next", Arial, sans-serif';
    context.fillStyle = "#f3f6f3";
    context.fillText(capability.title, x + 92, y + 46);
    context.font = '400 21px "Avenir Next", Arial, sans-serif';
    context.fillStyle = "rgba(236,244,241,0.58)";
    drawWrappedCanvasText(
      context,
      capability.description,
      x + 30,
      y + 83,
      810,
      27,
      2,
    );
  });

  roundedCanvasPath(context, 64, 1300, 872, 118, 16);
  const purposeGradient = context.createLinearGradient(64, 0, 936, 0);
  purposeGradient.addColorStop(0, "rgba(20,158,231,0.12)");
  purposeGradient.addColorStop(1, "rgba(53,200,108,0.12)");
  context.fillStyle = purposeGradient;
  context.fill();
  context.strokeStyle = "rgba(236,244,241,0.15)";
  context.stroke();

  context.font = '700 18px "SFMono-Regular", monospace';
  context.fillStyle = "#41bdf1";
  context.fillText("MISSION", 90, 1335);
  context.fillStyle = "#48dd87";
  context.fillText("VISION", 530, 1335);
  context.font = '500 20px "Avenir Next", Arial, sans-serif';
  context.fillStyle = "rgba(244,246,243,0.78)";
  drawWrappedCanvasText(
    context,
    "Modern, measurable digital solutions.",
    90,
    1371,
    380,
    27,
    2,
  );
  drawWrappedCanvasText(
    context,
    "A trusted partner for ambitious brands.",
    530,
    1371,
    360,
    27,
    2,
  );

  context.font = '600 18px "SFMono-Regular", monospace';
  context.fillStyle = "rgba(236,244,241,0.54)";
  context.fillText("MARKETING · BRANDING · WEB · VIDEO", 64, 1460);
  context.textAlign = "right";
  context.fillStyle = "#48dd87";
  context.fillText("PRODYUM.IN", 936, 1460);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createCompanyOverviewTexture(compactViewport = false) {
  if (typeof document === "undefined") {
    return new THREE.Texture();
  }

  if (compactViewport) {
    return createCompactCompanyOverviewTexture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1000;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Texture();

  context.save();
  roundedCanvasPath(context, 10, 10, 1580, 980, 44);
  context.clip();

  const background = context.createLinearGradient(0, 0, 1600, 1000);
  background.addColorStop(0, "rgba(4, 17, 25, 0.98)");
  background.addColorStop(0.58, "rgba(5, 14, 20, 0.97)");
  background.addColorStop(1, "rgba(5, 25, 21, 0.96)");
  context.fillStyle = background;
  context.fillRect(0, 0, 1600, 1000);

  const glow = context.createRadialGradient(1380, 100, 0, 1380, 100, 520);
  glow.addColorStop(0, "rgba(53, 200, 108, 0.19)");
  glow.addColorStop(1, "rgba(53, 200, 108, 0)");
  context.fillStyle = glow;
  context.fillRect(800, 0, 800, 600);

  context.strokeStyle = "rgba(255,255,255,0.035)";
  context.lineWidth = 1;
  for (let x = 40; x < 1600; x += 60) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 1000);
    context.stroke();
  }
  for (let y = 40; y < 1000; y += 60) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(1600, y);
    context.stroke();
  }
  context.restore();

  context.strokeStyle = "rgba(73, 229, 143, 0.58)";
  context.lineWidth = 4;
  roundedCanvasPath(context, 10, 10, 1580, 980, 44);
  context.stroke();

  const topLine = context.createLinearGradient(70, 0, 520, 0);
  topLine.addColorStop(0, "#149ee7");
  topLine.addColorStop(1, "#35c86c");
  context.fillStyle = topLine;
  context.fillRect(78, 10, 430, 6);

  context.font = '700 24px "SFMono-Regular", monospace';
  context.letterSpacing = "4px";
  context.fillStyle = "#48dd87";
  context.fillText("POINT 01", 80, 78);
  context.fillStyle = "rgba(236, 244, 241, 0.52)";
  context.fillText("COMPANY OVERVIEW", 260, 78);
  context.textAlign = "right";
  context.fillText("RECEPTION · HYDERABAD", 1515, 78);
  context.textAlign = "left";
  context.letterSpacing = "0px";

  context.strokeStyle = "rgba(236,244,241,0.13)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(80, 112);
  context.lineTo(1520, 112);
  context.stroke();

  context.font = '700 25px "SFMono-Regular", monospace';
  context.fillStyle = "#41bdf1";
  context.fillText("PRODYUM IT PVT LTD", 80, 176);

  context.font = '500 74px Georgia, "Times New Roman", serif';
  context.fillStyle = "#f4f4ef";
  context.fillText("IDEAS INTO", 80, 272);
  const titleGradient = context.createLinearGradient(80, 0, 620, 0);
  titleGradient.addColorStop(0, "#25a9eb");
  titleGradient.addColorStop(1, "#46df86");
  context.fillStyle = titleGradient;
  context.fillText("DIGITAL GROWTH.", 80, 354);

  context.font = '400 30px "Avenir Next", Arial, sans-serif';
  context.fillStyle = "rgba(236,244,241,0.72)";
  drawWrappedCanvasText(
    context,
    "A Hyderabad-based digital solutions company combining strategy, creativity, and technology to help businesses build stronger brands and grow online.",
    80,
    425,
    590,
    46,
    4,
  );

  roundedCanvasPath(context, 80, 585, 590, 86, 18);
  context.fillStyle = "rgba(20,158,231,0.10)";
  context.fill();
  context.strokeStyle = "rgba(53,200,108,0.35)";
  context.lineWidth = 2;
  context.stroke();
  context.font = '700 20px "SFMono-Regular", monospace';
  context.fillStyle = "#48dd87";
  context.fillText("OUR APPROACH", 110, 620);
  context.font = '600 25px "Avenir Next", Arial, sans-serif';
  context.fillStyle = "#f3f6f3";
  context.fillText("Strategy  +  Creativity  +  Technology", 110, 654);

  context.font = '700 22px "SFMono-Regular", monospace';
  context.fillStyle = "rgba(236,244,241,0.58)";
  context.fillText("BUILT FOR", 80, 742);
  context.font = '600 25px "Avenir Next", Arial, sans-serif';
  context.fillStyle = "#f1f4f1";
  context.fillText("Startups · SMEs · Real estate · Education", 80, 783);
  context.fillText("E-commerce · Entertainment · Local business", 80, 822);

  context.strokeStyle = "rgba(236,244,241,0.12)";
  context.beginPath();
  context.moveTo(720, 150);
  context.lineTo(720, 855);
  context.stroke();

  context.font = '700 22px "SFMono-Regular", monospace';
  context.fillStyle = "#48dd87";
  context.fillText("WHAT WE DO", 770, 176);
  context.textAlign = "right";
  context.fillStyle = "rgba(236,244,241,0.38)";
  context.fillText("END-TO-END CAPABILITIES", 1515, 176);
  context.textAlign = "left";

  COMPANY_CAPABILITIES.forEach((capability, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 770 + column * 380;
    const y = 215 + row * 220;

    roundedCanvasPath(context, x, y, 350, 190, 18);
    context.fillStyle = "rgba(2,10,14,0.54)";
    context.fill();
    context.strokeStyle = `${capability.color}88`;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = capability.color;
    context.fillRect(x, y + 18, 6, 154);

    context.font = '700 21px "SFMono-Regular", monospace';
    context.fillText(capability.code, x + 30, y + 48);
    context.font = '700 30px "Avenir Next", Arial, sans-serif';
    context.fillStyle = "#f3f6f3";
    context.fillText(capability.title, x + 78, y + 52);
    context.font = '400 23px "Avenir Next", Arial, sans-serif';
    context.fillStyle = "rgba(236,244,241,0.58)";
    drawWrappedCanvasText(
      context,
      capability.description,
      x + 30,
      y + 103,
      295,
      31,
      3,
    );
  });

  roundedCanvasPath(context, 770, 675, 730, 170, 18);
  const purposeGradient = context.createLinearGradient(770, 0, 1500, 0);
  purposeGradient.addColorStop(0, "rgba(20,158,231,0.10)");
  purposeGradient.addColorStop(1, "rgba(53,200,108,0.10)");
  context.fillStyle = purposeGradient;
  context.fill();
  context.strokeStyle = "rgba(236,244,241,0.15)";
  context.stroke();

  context.font = '700 20px "SFMono-Regular", monospace';
  context.fillStyle = "#41bdf1";
  context.fillText("MISSION", 800, 718);
  context.fillStyle = "#48dd87";
  context.fillText("VISION", 1155, 718);
  context.font = '500 24px "Avenir Next", Arial, sans-serif';
  context.fillStyle = "rgba(244,246,243,0.78)";
  drawWrappedCanvasText(
    context,
    "Empower businesses with modern, measurable digital solutions.",
    800,
    760,
    310,
    33,
    3,
  );
  drawWrappedCanvasText(
    context,
    "Become a trusted digital partner for ambitious brands across India.",
    1155,
    760,
    310,
    33,
    3,
  );

  context.strokeStyle = "rgba(236,244,241,0.13)";
  context.beginPath();
  context.moveTo(80, 900);
  context.lineTo(1520, 900);
  context.stroke();
  context.font = '600 21px "SFMono-Regular", monospace';
  context.fillStyle = "rgba(236,244,241,0.55)";
  context.fillText("DIGITAL MARKETING  ·  BRANDING  ·  WEB  ·  MULTIMEDIA", 80, 950);
  context.textAlign = "right";
  context.fillStyle = "#48dd87";
  context.fillText("PRODYUM.IN", 1520, 950);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function drawCenteredBubbleText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines: string[] = [];

  text.split("\n").forEach((paragraph) => {
    const words = paragraph.split(" ");
    let currentLine = "";

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (
        context.measureText(candidate).width > maxWidth &&
        currentLine
      ) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    });

    if (currentLine) lines.push(currentLine);
  });

  lines.slice(0, maxLines).forEach((line, index) => {
    context.fillText(line, centerX, startY + index * lineHeight);
  });

  return Math.min(lines.length, maxLines);
}

function createCompanyBubbleTexture(
  bubble: (typeof COMPANY_BUBBLES)[number],
) {
  if (typeof document === "undefined") {
    return new THREE.Texture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Texture();

  const center = 512;
  const radius = 474;
  const glow = context.createRadialGradient(
    center - 160,
    center - 190,
    20,
    center,
    center,
    radius,
  );
  glow.addColorStop(0, `${bubble.color}45`);
  glow.addColorStop(0.42, "rgba(7, 31, 38, 0.96)");
  glow.addColorStop(1, "rgba(3, 12, 17, 0.98)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.beginPath();
  context.arc(center, center, radius - 4, 0, Math.PI * 2);
  context.clip();
  context.strokeStyle = "rgba(255,255,255,0.035)";
  context.lineWidth = 1;
  for (let x = 80; x < 944; x += 54) {
    context.beginPath();
    context.moveTo(x, 90);
    context.lineTo(x, 934);
    context.stroke();
  }
  for (let y = 90; y < 934; y += 54) {
    context.beginPath();
    context.moveTo(80, y);
    context.lineTo(944, y);
    context.stroke();
  }
  context.restore();

  context.lineWidth = 6;
  context.strokeStyle = `${bubble.color}c8`;
  context.beginPath();
  context.arc(center, center, radius - 4, 0, Math.PI * 2);
  context.stroke();

  context.lineWidth = 3;
  context.strokeStyle = "rgba(255,255,255,0.18)";
  context.beginPath();
  context.arc(center, center, radius - 24, Math.PI * 1.12, Math.PI * 1.76);
  context.stroke();

  const markerGradient = context.createLinearGradient(350, 0, 674, 0);
  markerGradient.addColorStop(0, "#149ee7");
  markerGradient.addColorStop(1, bubble.color);
  context.strokeStyle = markerGradient;
  context.lineWidth = 10;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(414, 112);
  context.lineTo(610, 112);
  context.stroke();

  context.textAlign = "center";
  context.font = '700 31px "SFMono-Regular", monospace';
  context.letterSpacing = "4px";
  context.fillStyle = bubble.color;
  context.fillText(bubble.code, center, 208);
  context.letterSpacing = "0px";

  const isHero = bubble.kind === "hero";
  const isPurpose = bubble.kind === "purpose";
  context.font = isHero
    ? '600 72px Georgia, "Times New Roman", serif'
    : isPurpose
      ? '600 62px Georgia, "Times New Roman", serif'
      : '700 62px "Avenir Next", Arial, sans-serif';
  context.shadowColor = "rgba(0, 0, 0, 0.9)";
  context.shadowBlur = 14;
  context.shadowOffsetY = 3;
  context.fillStyle = "#f4f7f3";
  const titleLines = drawCenteredBubbleText(
    context,
    bubble.title,
    center,
    isHero ? 326 : 330,
    isHero ? 760 : 720,
    isHero ? 82 : 68,
    3,
  );

  if (isHero) {
    const accentY = 326 + Math.max(titleLines, 1) * 82;
    const titleAccent = context.createLinearGradient(260, 0, 770, 0);
    titleAccent.addColorStop(0, "#25a9eb");
    titleAccent.addColorStop(1, "#46df86");
    context.fillStyle = titleAccent;
    context.font = '600 72px Georgia, "Times New Roman", serif';
    context.fillText("Digital Growth.", center, accentY);
  }

  context.shadowBlur = 10;
  context.shadowOffsetY = 2;
  const descriptionY = isHero
    ? 326 + Math.max(titleLines + 1, 2) * 82 + 35
    : 330 + titleLines * 68 + 45;
  context.font = isHero
    ? '600 34px "Avenir Next", Arial, sans-serif'
    : '600 36px "Avenir Next", Arial, sans-serif';
  context.fillStyle = "rgba(244, 249, 246, 0.88)";
  drawCenteredBubbleText(
    context,
    bubble.description,
    center,
    descriptionY,
    isHero ? 730 : 700,
    isHero ? 45 : 48,
    isHero ? 4 : 5,
  );

  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  roundedCanvasPath(context, 218, 805, 588, 78, 39);
  context.fillStyle = `${bubble.color}24`;
  context.fill();
  context.strokeStyle = `${bubble.color}78`;
  context.lineWidth = 2;
  context.stroke();
  context.font = '700 28px "SFMono-Regular", monospace';
  context.fillStyle = "rgba(248, 252, 249, 0.92)";
  context.fillText(bubble.footer.toUpperCase(), center, 855);

  context.font = '650 21px "SFMono-Regular", monospace';
  context.fillStyle = "rgba(244, 248, 245, 0.58)";
  context.fillText("POINT 01 · COMPANY OVERVIEW", center, 922);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function SceneCompanyOverview({
  visible,
  compactViewport,
}: {
  visible: boolean;
  compactViewport: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const bubbleRefs = useRef<Array<THREE.Group | null>>([]);
  const revealRef = useRef(0);
  const textures = useMemo(
    () => COMPANY_BUBBLES.map(createCompanyBubbleTexture),
    [],
  );
  const layout = compactViewport
    ? COMPACT_COMPANY_BUBBLE_LAYOUT
    : DESKTOP_COMPANY_BUBBLE_LAYOUT;
  const visibleBubbles = compactViewport
    ? COMPANY_BUBBLES.slice(0, 5)
    : COMPANY_BUBBLES;
  const clusterCenterY = compactViewport ? 2.7 : 2.28;
  const clusterQuaternion = useMemo(() => {
    const clusterPosition = new THREE.Vector3(
      3.3,
      clusterCenterY,
      -12.67,
    );
    const cameraPosition = getTourViewPosition(
      TOUR_STOPS[0],
      new THREE.Vector3(),
      compactViewport ? COMPACT_COMPANY_VIEWING_DISTANCE : VIEWING_DISTANCE,
    );
    const orientation = new THREE.Object3D();
    orientation.position.copy(clusterPosition);
    orientation.lookAt(cameraPosition);
    return orientation.quaternion.clone();
  }, [clusterCenterY, compactViewport]);

  useEffect(
    () => () => textures.forEach((texture) => texture.dispose()),
    [textures],
  );

  useFrame((state, delta) => {
    revealRef.current = THREE.MathUtils.damp(
      revealRef.current,
      visible ? 1 : 0,
      visible ? 4.8 : 8,
      delta,
    );
    const reveal = revealRef.current;

    if (groupRef.current) {
      groupRef.current.visible = reveal > 0.005 || visible;
      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(0.2, 1, reveal),
      );
    }

    bubbleRefs.current.forEach((bubble, index) => {
      if (!bubble) return;
      const authoredLayout = layout[index];
      if (!authoredLayout) return;
      const authoredPosition = authoredLayout.position;
      bubble.position.set(
        authoredPosition[0],
        authoredPosition[1] +
          Math.sin(state.clock.elapsedTime * 0.72 + index * 0.9) *
            0.035 *
            reveal,
        authoredPosition[2],
      );
      const bubbleReveal = THREE.MathUtils.clamp(
        reveal * 1.45 - index * 0.075,
        0,
        1,
      );
      bubble.scale.setScalar(
        THREE.MathUtils.lerp(0.45, 1, bubbleReveal),
      );
    });

    if (lightRef.current) {
      lightRef.current.intensity = reveal * 1.35;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[3.3, clusterCenterY, -12.67]}
      quaternion={clusterQuaternion}
      visible={false}
    >
      <pointLight
        ref={lightRef}
        position={[0, 0, 1.1]}
        color="#35c86c"
        intensity={0}
        distance={5.5}
        decay={2}
      />

      {layout.slice(1).map((bubbleLayout, connectorIndex) => {
        const heroPosition = layout[0].position;
        const dx = bubbleLayout.position[0] - heroPosition[0];
        const dy = bubbleLayout.position[1] - heroPosition[1];
        const connectorLength = Math.hypot(dx, dy);
        return (
          <mesh
            key={`connector-${COMPANY_BUBBLES[connectorIndex + 1].key}`}
            renderOrder={COMPANY_BUBBLE_OVERLAY_ORDER}
            position={[
              heroPosition[0] + dx / 2,
              heroPosition[1] + dy / 2,
              -0.08,
            ]}
            rotation={[0, 0, Math.atan2(dy, dx)]}
          >
            <boxGeometry args={[connectorLength, 0.018, 0.018]} />
            <meshBasicMaterial
              color={COMPANY_BUBBLES[connectorIndex + 1].color}
              transparent
              opacity={0.28}
              toneMapped={false}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {visibleBubbles.map((bubble, index) => {
        const bubbleLayout = layout[index];
        const radius = bubbleLayout.radius;
        return (
          <group
            key={bubble.key}
            ref={(node) => {
              bubbleRefs.current[index] = node;
            }}
            position={bubbleLayout.position}
          >
            <mesh
              position={[0, 0, -0.045]}
              renderOrder={COMPANY_BUBBLE_OVERLAY_ORDER + 1}
            >
              <circleGeometry args={[radius * 1.09, 64]} />
              <meshBasicMaterial
                color={bubble.color}
                transparent
                opacity={0.13}
                blending={THREE.AdditiveBlending}
                depthTest={false}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>

            <mesh
              scale={[1, 1, 0.14]}
              renderOrder={COMPANY_BUBBLE_OVERLAY_ORDER + 2}
            >
              <sphereGeometry args={[radius, 48, 32]} />
              <meshPhysicalMaterial
                color="#06191f"
                emissive={bubble.color}
                emissiveIntensity={0.2}
                metalness={0.2}
                roughness={0.18}
                transmission={0}
                transparent
                opacity={0.92}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>

            <mesh
              position={[0, 0, radius * 0.155]}
              renderOrder={COMPANY_BUBBLE_OVERLAY_ORDER + 3}
            >
              <circleGeometry args={[radius * 0.94, 64]} />
              <meshBasicMaterial
                map={textures[index]}
                transparent
                alphaTest={0.02}
                toneMapped={false}
                side={THREE.DoubleSide}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>

            <mesh
              position={[0, 0, radius * 0.18]}
              renderOrder={COMPANY_BUBBLE_OVERLAY_ORDER + 4}
            >
              <torusGeometry
                args={[radius * 0.945, radius * 0.018, 12, 64]}
              />
              <meshBasicMaterial
                color={bubble.color}
                transparent
                opacity={0.96}
                toneMapped={false}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
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
  const [compactViewport, setCompactViewport] = useState(false);
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const updateViewport = () => setCompactViewport(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
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
            {!showServicesFlow && !showCompanyOverview ? (
              <Hotspots
                active={activeStop}
                onSelect={goToStop}
              />
            ) : null}
            <SceneCompanyOverview
              visible={showCompanyOverview}
              compactViewport={compactViewport}
            />
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
            compactViewport={compactViewport}
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
        <>
          <section
            className="company-overview-accessible sr-only"
            aria-live="polite"
            aria-labelledby="company-overview-title"
          >
            <h1 id="company-overview-title">ProDyum IT company overview</h1>
            <p>
              A Hyderabad-based digital solutions company combining strategy,
              creativity, and technology to help businesses build stronger
              brands and grow online.
            </p>
            <h2>What we do</h2>
            <ul>
              {COMPANY_CAPABILITIES.map((capability) => (
                <li key={capability.code}>
                  {capability.title}: {capability.description}
                </li>
              ))}
            </ul>
            <p>
              Our mission is to empower businesses with modern, measurable
              digital solutions. Our vision is to become a trusted digital
              partner for ambitious brands across India.
            </p>
          </section>
          <div className="point-one-controls" aria-label="Point 1 navigation">
            <button
              type="button"
              onClick={() => goToFrame(Math.max(activeFrame - 1, 0))}
            >
              Previous view
            </button>
            <span>Point 01 · Company bubbles</span>
            <a
              href="https://prodyum.in/it/about"
              target="_blank"
              rel="noreferrer"
            >
              Full profile <i aria-hidden="true">↗</i>
            </a>
            <button
              type="button"
              onClick={() =>
                goToFrame(
                  Math.min(activeFrame + 1, TOUR_FRAMES.length - 1),
                )
              }
            >
              Continue tour <i aria-hidden="true">↘</i>
            </button>
          </div>
        </>
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
