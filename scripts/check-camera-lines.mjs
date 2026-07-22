import fs from "node:fs";
import ts from "typescript";
import * as THREE from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

const source = fs.readFileSync("app/OfficeTour.tsx", "utf8");
const sourceFile = ts.createSourceFile(
  "OfficeTour.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function numberValue(node) {
  return ts.isPrefixUnaryExpression(node)
    ? -Number(node.operand.text)
    : Number(node.text);
}

function literalValue(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node) || ts.isPrefixUnaryExpression(node)) {
    return numberValue(node);
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  return undefined;
}

let stopsArray;
let viewingDistance = 4;

function visit(node) {
  if (ts.isVariableDeclaration(node)) {
    const name = node.name.getText(sourceFile);
    if (name === "TOUR_STOPS") {
      stopsArray = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
    }
    if (name === "VIEWING_DISTANCE") {
      viewingDistance = literalValue(node.initializer);
    }
  }
  ts.forEachChild(node, visit);
}

visit(sourceFile);

const stops = stopsArray.elements.map((object) =>
  Object.fromEntries(
    object.properties
      .filter(ts.isPropertyAssignment)
      .map((property) => [property.name.getText(sourceFile), literalValue(property.initializer)]),
  ),
);

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const document = await io.read("public/police-office-web.glb");
const collisionMeshes = [];

for (const node of document.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;

  const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute("POSITION");
    if (!position) continue;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        position.getArray(),
        position.getElementSize(),
        position.getNormalized(),
      ),
    );

    const indices = primitive.getIndices();
    if (indices) {
      geometry.setIndex(
        new THREE.BufferAttribute(
          indices.getArray(),
          indices.getElementSize(),
          indices.getNormalized(),
        ),
      );
    }

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const collisionMesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    collisionMesh.applyMatrix4(matrix);
    collisionMesh.updateMatrixWorld(true);
    collisionMeshes.push(collisionMesh);
  }
}

const raycaster = new THREE.Raycaster();
const origin = new THREE.Vector3();
const target = new THREE.Vector3();
const direction = new THREE.Vector3();

const report = stops.map((stop, index) => {
  target.fromArray(stop.target);
  const verticalDistance = stop.cameraHeight - target.y;
  const horizontalDistance = Math.sqrt(
    Math.max(viewingDistance ** 2 - verticalDistance ** 2, 0),
  );
  const clearAngles = [];

  for (let degrees = -180; degrees < 180; degrees += 5) {
    const radians = THREE.MathUtils.degToRad(degrees);
    origin.set(
      target.x + Math.cos(radians) * horizontalDistance,
      stop.cameraHeight,
      target.z + Math.sin(radians) * horizontalDistance,
    );

    if (origin.x < 0.2 || origin.x > 16.35 || origin.z < -21.35 || origin.z > -0.15) {
      continue;
    }

    direction.copy(target).sub(origin).normalize();
    raycaster.set(origin, direction);
    raycaster.near = 0.08;
    raycaster.far = Math.max(viewingDistance - 0.45, 0.1);
    const hits = raycaster.intersectObjects(collisionMeshes, false);
    if (hits.length === 0) clearAngles.push(degrees);
  }

  return {
    stop: index + 1,
    title: stop.title,
    clearAngles,
  };
});

console.log(JSON.stringify({ viewingDistance, report }, null, 2));
