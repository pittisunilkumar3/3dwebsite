# ProDyum IT Interactive 3D Office

A scroll-driven, real-time 3D office experience built for ProDyum IT. The tour
uses the supplied Police Office GLB model and presents ProDyum services across
16 interactive viewpoints.

## Experience

- Scroll sequence alternates between the office overview and each viewpoint.
- Clicking a numbered pointer starts a direct camera flight above the walls.
- Every viewpoint finishes exactly four metres from its target.
- ProDyum service content and its action button appear after camera arrival.
- Point 4 presents the interview table and point 11 presents the conference room.
- Responsive navigation supports desktop and mobile layouts.

## ProDyum content

The interactive cards cover Digital Marketing, Performance Marketing, Strategy
and Planning, Web Development, SEO, Social Media Management, Branding and
Design, Video and Multimedia, e-commerce, support, and consultation.

Content actions link to the official ProDyum IT pages:

- <https://prodyum.in/it>
- <https://prodyum.in/it/services>
- <https://prodyum.in/it/about>
- <https://prodyum.in/it/contact>

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by the development server.

## Validation

```bash
npm run build
npm run test
npm run lint
node scripts/check-camera-lines.mjs
```

`npm run build` creates the standard Next.js `.next` output used by Vercel.
For the Cloudflare/Vinext deployment target, use `npm run build:sites`.

## Main files

- `app/OfficeTour.tsx` — viewpoints, camera movement, ProDyum content, actions
- `app/globals.css` — visual design and responsive layout
- `public/police-office-web.glb` — optimized web model
- `scripts/check-camera-lines.mjs` — camera distance and obstruction checks

## 3D model credit

“Police Office” by neutralize, licensed under CC BY-NC 4.0 and optimized for
this interactive tour.
