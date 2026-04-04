import { useEffect, useRef, useState } from 'react';

import { jsPDF } from 'jspdf';

import AdminPromoterPanel from './AdminPromoterPanel';

type UnitSystem = 'metric' | 'imperial';

type PlannerInputs = {
  groundWidth: number;
  groundLength: number;
  includeLoft: boolean;
  includeBalcony: boolean;
  includeSideWall: boolean;
  includeConcreteSlab: boolean;
  minimumLoftHeadroom: number;
  sideWallBaseHeight: number;
  totalHeightBase: number;
  availableWoodWidth: number;
  availableWoodDepth: number;
  availableWoodLength: number;
  roofBoardingThickness: number;
  stockCostPerPiece: number;
  woodCostPerCubic: number;
  roofCostPerSquare: number;
  panelCostPerSquare: number;
  glassCostPerSquare: number;
};

type SliderOffsets = {
  totalHeight: number;
  sideWallHeight: number;
  loftFloorHeight: number;
  rafterSpacing: number;
  glazingRatio: number;
  ladderPosition: number;
  frontTerraceBays: number;
};

type SectionRule = {
  width: number;
  depth: number;
  labelMetric: string;
  labelImperial: string;
  spanLimit: number;
  spacingLimit: number;
};

type PlannerMetrics = {
  groundArea: number;
  groundHeadspaceArea: number;
  floorBoardingArea: number;
  groundFloorLength: number;
  enclosedShellLength: number;
  groundHeadspaceWidth: number;
  frontTerraceDepth: number;
  totalHeight: number;
  sideWallHeight: number;
  loftFloorHeight: number;
  rafterSpacing: number;
  anchorSpacingX: number;
  anchorSpacingY: number;
  glazingStage: number;
  glazingLabel: string;
  glazingRatio: number;
  roofRise: number;
  rafterLength: number;
  fullRafterLength: number;
  roofPitch: number;
  frameCount: number;
  rafterCount: number;
  floorJoistCount: number;
  connectorBraceCount: number;
  perimeterBeamCount: number;
  stockPieceCount: number;
  actualSpacing: number;
  loftDeckWidth: number;
  loftHeadspaceWidth: number;
  loftUsableWidth: number;
  loftDeckLength: number;
  balconyMargin: number;
  loftArea: number;
  loftHeadspaceArea: number;
  roofSurfaceArea: number;
  sideWallArea: number;
  endWallArea: number;
  glassArea: number;
  panelArea: number;
  wallCladdingArea: number;
  roofBoardingVolume: number;
  totalWoodVolume: number;
  apexScrewLengthMm: number;
  apexScrewDiameterMm: number;
  apexScrewCount: number;
  roofWallScrewLengthMm: number;
  roofWallScrewCount: number;
  wallFloorScrewLengthMm: number;
  wallFloorScrewCount: number;
  stockCostEstimate: number;
  panelCostEstimate: number;
  roofBoardingCostEstimate: number;
  roofCostEstimate: number;
  shellCostEstimate: number;
  recommendedSection: SectionRule;
  availableSectionAdequate: boolean;
  stockLengthAdequate: boolean;
  anchorPoints: { x: number; y: number }[];
};

type DeferredNumberFieldProps = {
  fieldId: string;
  label: string;
  value: number;
  commitSignal: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  onCommit: (value: number) => void;
  onDirtyChange: (fieldId: string, isDirty: boolean) => void;
};

type AdjustmentSliderProps = {
  label: string;
  valueLabel: string;
  helper: string;
  sliderValue: number;
  onSliderChange: (value: number) => void;
};

type RangeSliderProps = {
  label: string;
  valueLabel: string;
  helper: string;
  sliderValue: number;
  min: number;
  max: number;
  step?: number;
  onSliderChange: (value: number) => void;
};

type DragState = {
  active: boolean;
  lastX: number;
  lastY: number;
};

type Point3D = {
  x: number;
  y: number;
  z: number;
};
type Point2D = {
  x: number;
  y: number;
};

type ProjectedPoint = {
  x: number;
  y: number;
  z: number;
};

const PREVIEW_CENTER_X = 210;
const PREVIEW_CENTER_Y = 176;
const LADDER_ANGLE_DEGREES = 75;

const METERS_PER_FOOT = 0.3048;
const SQM_PER_SQFT = 0.09290304;
const MM_PER_INCH = 25.4;
const CUBIC_METERS_PER_CUBIC_FOOT = 0.0283168;

const SECTION_RULES: SectionRule[] = [
  { width: 0.045, depth: 0.145, labelMetric: '45 x 145 mm', labelImperial: '2 x 6 in', spanLimit: 4.2, spacingLimit: 0.6 },
  { width: 0.045, depth: 0.195, labelMetric: '45 x 195 mm', labelImperial: '2 x 8 in', spanLimit: 5.4, spacingLimit: 0.7 },
  { width: 0.063, depth: 0.195, labelMetric: '63 x 195 mm', labelImperial: '3 x 8 in', spanLimit: 6.6, spacingLimit: 0.8 },
  { width: 0.075, depth: 0.22, labelMetric: '75 x 220 mm', labelImperial: '3 x 10 in', spanLimit: 7.8, spacingLimit: 0.8 },
  { width: 0.09, depth: 0.245, labelMetric: '90 x 245 mm', labelImperial: '4 x 10 in', spanLimit: 9.6, spacingLimit: 1.0 },
];

const defaultInputs: PlannerInputs = {
  groundWidth: 4,
  groundLength: 6.4,
  includeLoft: true,
  includeBalcony: true,
  includeSideWall: true,
  includeConcreteSlab: true,
  minimumLoftHeadroom: 1.8,
  sideWallBaseHeight: 0.15,
  totalHeightBase: 2.5,
  availableWoodWidth: 0.07,
  availableWoodDepth: 0.15,
  availableWoodLength: 5,
  roofBoardingThickness: 0.02,
  stockCostPerPiece: 50,
  woodCostPerCubic: 950,
  roofCostPerSquare: 30,
  panelCostPerSquare: 80,
  glassCostPerSquare: 180,
};

const defaultSliderOffsets: SliderOffsets = {
  totalHeight: 0,
  sideWallHeight: 0,
  loftFloorHeight: 0,
  rafterSpacing: 0,
  glazingRatio: 2,
  ladderPosition: 67,
  frontTerraceBays: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function scaleFromRecommendation(baseValue: number, sliderValue: number, min: number, max: number) {
  return clamp(baseValue * (1 + ((sliderValue / 100) * 0.3)), min, max);
}

function toDisplayLength(value: number, unit: UnitSystem) {
  return round(unit === 'metric' ? value : value / METERS_PER_FOOT, 2);
}

function fromDisplayLength(value: number, unit: UnitSystem) {
  return unit === 'metric' ? value : value * METERS_PER_FOOT;
}

function toDisplayArea(value: number, unit: UnitSystem) {
  return round(unit === 'metric' ? value : value / SQM_PER_SQFT, 2);
}

function toDisplaySection(value: number, unit: UnitSystem) {
  return round(unit === 'metric' ? value * 1000 : (value * 1000) / MM_PER_INCH, 1);
}

function fromDisplaySection(value: number, unit: UnitSystem) {
  return unit === 'metric' ? value / 1000 : (value * MM_PER_INCH) / 1000;
}

function toDisplayVolumeCost(value: number, unit: UnitSystem) {
  return round(unit === 'metric' ? value : value * CUBIC_METERS_PER_CUBIC_FOOT, 2);
}

function fromDisplayVolumeCost(value: number, unit: UnitSystem) {
  return unit === 'metric' ? value : value / CUBIC_METERS_PER_CUBIC_FOOT;
}

function toDisplaySurfaceCost(value: number, unit: UnitSystem) {
  return round(unit === 'metric' ? value : value * SQM_PER_SQFT, 2);
}

function fromDisplaySurfaceCost(value: number, unit: UnitSystem) {
  return unit === 'metric' ? value : value / SQM_PER_SQFT;
}

function formatValue(value: number, digits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatLength(value: number, unit: UnitSystem) {
  return `${formatValue(toDisplayLength(value, unit), 2)} ${unit === 'metric' ? 'm' : 'ft'}`;
}

function formatArea(value: number, unit: UnitSystem) {
  return `${formatValue(toDisplayArea(value, unit), 2)} ${unit === 'metric' ? 'm2' : 'ft2'}`;
}

function formatVolume(value: number, unit: UnitSystem) {
  const displayValue = unit === 'metric' ? value : value / CUBIC_METERS_PER_CUBIC_FOOT;
  return `${formatValue(displayValue, 2)} ${unit === 'metric' ? 'm3' : 'ft3'}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function getSectionLabel(rule: SectionRule, unit: UnitSystem) {
  return unit === 'metric' ? rule.labelMetric : rule.labelImperial;
}

function getSectionCapacity(width: number, depth: number) {
  return width * depth * depth;
}

function getRecommendedSection(rafterLength: number, rafterSpacing: number) {
  return SECTION_RULES.find((rule) => rafterLength <= rule.spanLimit && rafterSpacing <= rule.spacingLimit) ?? SECTION_RULES[SECTION_RULES.length - 1];
}

function stockLengthAdequateText(stockLengthAdequate: boolean) {
  return stockLengthAdequate ? 'Full-length rafters possible' : 'Splice or laminated members required';
}

function buildGridAxis(totalLength: number, minSpacing: number, maxSpacing: number) {
  const safeLength = Math.max(totalLength, 0);
  const safeMin = Math.max(minSpacing, 0.25);
  const safeMax = Math.max(maxSpacing, safeMin);

  if (safeLength <= safeMax) {
    return { positions: [0, round(safeLength, 2)], spacing: safeLength };
  }

  const minIntervals = Math.max(1, Math.ceil(safeLength / safeMax));
  const maxIntervals = Math.max(minIntervals, Math.floor(safeLength / safeMin));

  let bestIntervalCount = minIntervals;
  let bestSpacing = safeLength / minIntervals;
  let bestScore = Number.POSITIVE_INFINITY;
  const targetSpacing = (safeMin + safeMax) / 2;

  for (let intervalCount = minIntervals; intervalCount <= maxIntervals; intervalCount += 1) {
    const spacing = safeLength / intervalCount;
    if (spacing < safeMin || spacing > safeMax) {
      continue;
    }
    const score = Math.abs(spacing - targetSpacing);
    if (score < bestScore) {
      bestScore = score;
      bestSpacing = spacing;
      bestIntervalCount = intervalCount;
    }
  }

  const positions = Array.from({ length: bestIntervalCount + 1 }, (_, index) => round((safeLength / bestIntervalCount) * index, 2));
  return { positions, spacing: round(bestSpacing, 2) };
}

function buildFrontRailingLayout(width: number, targetSpacing: number, hasOpening: boolean) {
  const safeWidth = Math.max(width, 0);
  if (safeWidth <= 0.05) {
    return {
      segments: [] as { startX: number; endX: number }[],
      postXs: [] as number[],
      totalRailLength: 0,
      totalPostLength: 0,
    };
  }

  const openingHalfWidth = hasOpening ? clamp(0.38, 0.22, Math.max((safeWidth / 2) - 0.2, 0.22)) : 0;
  const segments = hasOpening
    ? [
      { startX: -safeWidth / 2, endX: -openingHalfWidth },
      { startX: openingHalfWidth, endX: safeWidth / 2 },
    ].filter((segment) => (segment.endX - segment.startX) > 0.05)
    : [{ startX: -safeWidth / 2, endX: safeWidth / 2 }];
  const maxSupportSpan = clamp(targetSpacing * 2.5, 1.2, 1.8);
  const postXs = [...new Set(segments.flatMap((segment) => {
    const segmentLength = segment.endX - segment.startX;
    const interiorCount = Math.max(0, Math.ceil(segmentLength / maxSupportSpan) - 1);
    const interiorPosts = Array.from({ length: interiorCount }, (_, index) => round(segment.startX + ((segmentLength / (interiorCount + 1)) * (index + 1)), 3));
    return [round(segment.startX, 3), ...interiorPosts, round(segment.endX, 3)];
  }))].sort((left, right) => left - right);
  const totalRailLength = segments.reduce((sum, segment) => sum + (segment.endX - segment.startX), 0);
  const totalPostLength = postXs.length * 0.92;

  return {
    segments,
    postXs,
    totalRailLength,
    totalPostLength,
  };
}

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDxfNumber(value: number) {
  return round(value, 4).toString();
}

function createDxfLine(x1: number, y1: number, x2: number, y2: number, layer: string) {
  return [
    '0', 'LINE',
    '8', layer,
    '10', formatDxfNumber(x1),
    '20', formatDxfNumber(y1),
    '30', '0',
    '11', formatDxfNumber(x2),
    '21', formatDxfNumber(y2),
    '31', '0',
  ];
}

function createDxfCircle(x: number, y: number, radius: number, layer: string) {
  return [
    '0', 'CIRCLE',
    '8', layer,
    '10', formatDxfNumber(x),
    '20', formatDxfNumber(y),
    '30', '0',
    '40', formatDxfNumber(radius),
  ];
}

function createDxfText(x: number, y: number, height: number, text: string, layer: string) {
  return [
    '0', 'TEXT',
    '8', layer,
    '10', formatDxfNumber(x),
    '20', formatDxfNumber(y),
    '30', '0',
    '40', formatDxfNumber(height),
    '1', text,
  ];
}

function createDxfRect(x: number, y: number, width: number, height: number, layer: string) {
  return [
    ...createDxfLine(x, y, x + width, y, layer),
    ...createDxfLine(x + width, y, x + width, y + height, layer),
    ...createDxfLine(x + width, y + height, x, y + height, layer),
    ...createDxfLine(x, y + height, x, y, layer),
  ];
}

function createDxfArc(x: number, y: number, radius: number, startAngle: number, endAngle: number, layer: string) {
  return [
    '0', 'ARC',
    '8', layer,
    '10', formatDxfNumber(x),
    '20', formatDxfNumber(y),
    '30', '0',
    '40', formatDxfNumber(radius),
    '50', formatDxfNumber(startAngle),
    '51', formatDxfNumber(endAngle),
  ];
}

function createDxfPolyline(points: { x: number; y: number }[], layer: string, closed = true) {
  const entities = ['0', 'LWPOLYLINE', '8', layer, '90', String(points.length), '70', closed ? '1' : '0'];
  points.forEach((point) => {
    entities.push('10', formatDxfNumber(point.x), '20', formatDxfNumber(point.y));
  });
  return entities;
}

function createBeamPolygon(start: Point2D, end: Point2D, thickness: number, startCutAngleDeg: number, endCutAngleDeg: number) {
  const axisAngle = Math.atan2(end.y - start.y, end.x - start.x);
  const normalAngle = axisAngle + (Math.PI / 2);
  const startCutAngle = startCutAngleDeg * (Math.PI / 180);
  const endCutAngle = endCutAngleDeg * (Math.PI / 180);
  const halfThickness = thickness / 2;
  const offset = { x: Math.cos(normalAngle) * halfThickness, y: Math.sin(normalAngle) * halfThickness };
  const startSlope = { x: Math.cos(startCutAngle), y: Math.sin(startCutAngle) };
  const endSlope = { x: Math.cos(endCutAngle), y: Math.sin(endCutAngle) };

  const intersect = (linePointA: Point2D, lineDirA: Point2D, linePointB: Point2D, lineDirB: Point2D) => {
    const denominator = (lineDirA.x * lineDirB.y) - (lineDirA.y * lineDirB.x);
    if (Math.abs(denominator) < 0.0001) {
      return linePointA;
    }
    const diff = { x: linePointB.x - linePointA.x, y: linePointB.y - linePointA.y };
    const t = ((diff.x * lineDirB.y) - (diff.y * lineDirB.x)) / denominator;
    return { x: linePointA.x + (lineDirA.x * t), y: linePointA.y + (lineDirA.y * t) };
  };

  const topStart = { x: start.x + offset.x, y: start.y + offset.y };
  const bottomStart = { x: start.x - offset.x, y: start.y - offset.y };
  const topEnd = { x: end.x + offset.x, y: end.y + offset.y };
  const bottomEnd = { x: end.x - offset.x, y: end.y - offset.y };

  return [
    intersect(topStart, startSlope, topEnd, endSlope),
    intersect(bottomStart, startSlope, bottomEnd, endSlope),
    intersect(bottomEnd, endSlope, bottomStart, startSlope),
    intersect(topEnd, endSlope, topStart, startSlope),
  ];
}

function intersectPointLines(linePointA: Point2D, lineDirA: Point2D, linePointB: Point2D, lineDirB: Point2D) {
  const denominator = (lineDirA.x * lineDirB.y) - (lineDirA.y * lineDirB.x);
  if (Math.abs(denominator) < 0.0001) {
    return linePointA;
  }
  const diff = { x: linePointB.x - linePointA.x, y: linePointB.y - linePointA.y };
  const t = ((diff.x * lineDirB.y) - (diff.y * lineDirB.x)) / denominator;
  return { x: linePointA.x + (lineDirA.x * t), y: linePointA.y + (lineDirA.y * t) };
}

function createVerticalMitredBeamPolygon(start: Point2D, end: Point2D, thickness: number, seamX: number) {
  const axis = { x: end.x - start.x, y: end.y - start.y };
  const axisLength = Math.hypot(axis.x, axis.y) || 1;
  const unitAxis = { x: axis.x / axisLength, y: axis.y / axisLength };
  const unitNormal = { x: -unitAxis.y, y: unitAxis.x };
  const halfThickness = thickness / 2;
  const topStart = { x: start.x + (unitNormal.x * halfThickness), y: start.y + (unitNormal.y * halfThickness) };
  const bottomStart = { x: start.x - (unitNormal.x * halfThickness), y: start.y - (unitNormal.y * halfThickness) };
  const seamPoint = { x: seamX, y: end.y };
  const seamDirection = { x: 0, y: 1 };
  const bottomEnd = intersectPointLines(bottomStart, unitAxis, seamPoint, seamDirection);
  const topEnd = intersectPointLines(topStart, unitAxis, seamPoint, seamDirection);

  return [topStart, bottomStart, bottomEnd, topEnd];
}

function buildDetailGeometry(metrics: PlannerMetrics, inputs: PlannerInputs) {
  const timberFace = inputs.availableWoodDepth;
  const roofPitch = metrics.roofPitch;
  const apexAngle = 180 - (roofPitch * 2);
  const wallRoofAngle = 90 - roofPitch;
  return { timberFace, roofPitch, apexAngle, wallRoofAngle };
}

function createDxfDimensions(x: number, y: number, width: number, height: number, unitSystem: UnitSystem, layer: string) {
  const textHeight = unitSystem === 'metric' ? 0.2 : 0.6;
  return [
    ...createDxfText(x, y - (unitSystem === 'metric' ? 0.45 : 1.2), textHeight, `W ${formatLength(width, unitSystem)}`, layer),
    ...createDxfText(x, y - (unitSystem === 'metric' ? 0.8 : 2.1), textHeight, `L ${formatLength(height, unitSystem)}`, layer),
  ];
}

function buildDxf(inputs: PlannerInputs, metrics: PlannerMetrics, unitSystem: UnitSystem) {
  const unitCode = unitSystem === 'metric' ? '6' : '2';
  const lengthFactor = unitSystem === 'metric' ? 1 : 1 / METERS_PER_FOOT;
  const displayLength = (value: number) => value * lengthFactor;
  const groundLength = displayLength(metrics.groundFloorLength);
  const groundWidth = displayLength(inputs.groundWidth);
  const groundHeadspaceWidth = displayLength(metrics.groundHeadspaceWidth);
  const groundHeadspaceLength = displayLength(metrics.enclosedShellLength);
  const groundHeadspaceOffsetY = displayLength(metrics.frontTerraceDepth);
  const loftOuterWidth = displayLength(metrics.loftDeckWidth);
  const loftOuterLength = displayLength(metrics.loftDeckLength);
  const loftWidth = displayLength(metrics.loftHeadspaceWidth);
  const loftLength = displayLength(metrics.loftDeckLength);
  const loftOriginX = groundWidth + (unitSystem === 'metric' ? 2 : 6) + ((Math.max(groundWidth, loftOuterWidth) - loftOuterWidth) / 2);
  const loftInnerX = groundWidth + (unitSystem === 'metric' ? 2 : 6) + ((Math.max(groundWidth, loftOuterWidth) - loftWidth) / 2);
  const anchorRadius = unitSystem === 'metric' ? 0.08 : 0.25;
  const planOffset = groundWidth + (unitSystem === 'metric' ? 2 : 6);
  const anchorOffsetY = Math.max(groundLength, 1) + (unitSystem === 'metric' ? 3 : 10);
  const textHeight = unitSystem === 'metric' ? 0.22 : 0.7;
  const detailOffsetY = anchorOffsetY + displayLength(inputs.groundLength) + (unitSystem === 'metric' ? 4 : 12);
  const detail = buildDetailGeometry(metrics, inputs);
  const timberFace = displayLength(detail.timberFace);
  const apexSeamCenter = { x: 7.5, y: detailOffsetY + 2.4 };
  const apexLength = unitSystem === 'metric' ? 5.8 : 18;
  const apexRun = Math.cos(metrics.roofPitch * (Math.PI / 180)) * apexLength;
  const apexDrop = Math.sin(metrics.roofPitch * (Math.PI / 180)) * apexLength;
  const apexLeftStart = { x: apexSeamCenter.x - apexRun, y: apexSeamCenter.y + apexDrop };
  const apexRightStart = { x: apexSeamCenter.x + apexRun, y: apexSeamCenter.y + apexDrop };
  const apexLeft = createVerticalMitredBeamPolygon(apexLeftStart, apexSeamCenter, timberFace, apexSeamCenter.x);
  const apexRight = createVerticalMitredBeamPolygon(apexRightStart, apexSeamCenter, timberFace, apexSeamCenter.x);
  const apexBottomY = Math.max(apexLeft[2].y, apexRight[2].y);
  const apexTopY = Math.min(apexLeft[3].y, apexRight[3].y);
  const roofWallBaseY = detailOffsetY + 8.4;
  const roofWallLowPoint = { x: 18.8, y: roofWallBaseY };
  const roofWallLength = unitSystem === 'metric' ? 8.2 : 24;
  const roofWallHighPoint = {
    x: roofWallLowPoint.x + (Math.cos(metrics.roofPitch * (Math.PI / 180)) * roofWallLength),
    y: roofWallLowPoint.y - (Math.sin(metrics.roofPitch * (Math.PI / 180)) * roofWallLength),
  };
  const roofWallRoof = createBeamPolygon(roofWallLowPoint, roofWallHighPoint, timberFace, 90, 90);
  const roofWallWallHeight = 6.4;
  const roofWallSetout = roofWallWallHeight / Math.max(Math.sin(metrics.roofPitch * (Math.PI / 180)), 0.001);
  const roofWallAxisUnit = {
    x: (roofWallHighPoint.x - roofWallLowPoint.x) / roofWallLength,
    y: (roofWallHighPoint.y - roofWallLowPoint.y) / roofWallLength,
  };
  const roofWallNormal = { x: -roofWallAxisUnit.y, y: roofWallAxisUnit.x };
  const roofWallAxisPoint = {
    x: roofWallLowPoint.x + (roofWallAxisUnit.x * roofWallSetout),
    y: roofWallLowPoint.y + (roofWallAxisUnit.y * roofWallSetout),
  };
  const roofWallAttachPoint = {
    x: roofWallAxisPoint.x + (roofWallNormal.x * (timberFace / 2)),
    y: roofWallAxisPoint.y + (roofWallNormal.y * (timberFace / 2)),
  };
  const roofWallWall = createDxfRect(roofWallAttachPoint.x - timberFace, roofWallAttachPoint.y, timberFace, roofWallWallHeight, 'DETAIL_ROOF_WALL');
  const wallFloorWallX = 31.5;
  const wallFloorFloorY = detailOffsetY + 8.6;
  const wallFloorWall = createDxfRect(wallFloorWallX, detailOffsetY + 1.4, timberFace, 7.2, 'DETAIL_WALL_FLOOR');
  const wallFloorBase = createDxfRect(29.4, wallFloorFloorY, 10.4, displayLength(inputs.availableWoodWidth), 'DETAIL_WALL_FLOOR');
  const entities = [
    ...createDxfText(0, -0.8, textHeight, 'GROUND FLOOR', 'TEXT'),
    ...createDxfRect(0, 0, groundWidth, groundLength, 'GROUND_PLAN'),
    ...(metrics.groundHeadspaceArea > 0 ? createDxfRect((groundWidth - groundHeadspaceWidth) / 2, groundHeadspaceOffsetY, groundHeadspaceWidth, groundHeadspaceLength, 'GROUND_HEADSPACE') : []),
    ...createDxfDimensions(0, 0, inputs.groundWidth, metrics.groundFloorLength, unitSystem, 'TEXT'),
    ...createDxfText(planOffset, -0.8, textHeight, 'LOFT PLAN', 'TEXT'),
    ...(metrics.loftArea > 0 ? createDxfRect(loftOriginX, 0, loftOuterWidth, loftOuterLength, 'LOFT_PLAN') : []),
    ...(metrics.loftHeadspaceArea > 0 ? createDxfRect(loftInnerX, 0, loftWidth, loftLength, 'LOFT_HEADSPACE') : []),
    ...(metrics.loftArea > 0 ? createDxfDimensions(planOffset, 0, metrics.loftDeckWidth, metrics.loftDeckLength, unitSystem, 'TEXT') : []),
    ...createDxfText(0, anchorOffsetY - 0.8, textHeight, 'ANCHOR LAYOUT', 'TEXT'),
    ...createDxfRect(0, anchorOffsetY, groundWidth, displayLength(inputs.groundLength), 'ANCHORS'),
    ...createDxfText(0, detailOffsetY - 0.8, textHeight, 'APEX DETAIL', 'TEXT'),
    ...createDxfPolyline(apexLeft, 'DETAIL_APEX'),
    ...createDxfPolyline(apexRight, 'DETAIL_APEX'),
    ...createDxfLine(apexSeamCenter.x, apexTopY, apexSeamCenter.x, apexBottomY, 'DETAIL_APEX'),
    ...createDxfArc(apexSeamCenter.x, apexBottomY + (timberFace * 0.5), Math.max(timberFace * 1.05, unitSystem === 'metric' ? 0.7 : 2.1), 180 - metrics.roofPitch, metrics.roofPitch, 'DETAIL_APEX'),
    ...createDxfText(apexSeamCenter.x - (timberFace * 0.2), apexBottomY + (timberFace * 2.4), textHeight, `${formatValue(detail.apexAngle, 1)} deg`, 'DETAIL_APEX'),
    ...createDxfLine(apexLeftStart.x - (timberFace * 0.9), apexLeftStart.y + (timberFace * 0.95), apexLeftStart.x + (timberFace * 1.6), apexLeftStart.y + (timberFace * 0.95), 'DETAIL_APEX'),
    ...createDxfArc(apexLeftStart.x + (timberFace * 0.25), apexLeftStart.y + (timberFace * 0.95), Math.max(timberFace * 0.85, unitSystem === 'metric' ? 0.5 : 1.5), 360 - metrics.roofPitch, 360, 'DETAIL_APEX'),
    ...createDxfText(apexLeftStart.x + (timberFace * 1.55), apexLeftStart.y + (timberFace * 0.55), textHeight, `Pitch ${formatValue(metrics.roofPitch, 1)} deg`, 'DETAIL_APEX'),
    ...createDxfText(18.6, detailOffsetY - 0.8, textHeight, 'ROOF-WALL DETAIL', 'TEXT'),
    ...roofWallWall,
    ...createDxfPolyline(roofWallRoof, 'DETAIL_ROOF_WALL'),
    ...createDxfArc(roofWallAttachPoint.x - (timberFace * 0.15), roofWallAttachPoint.y + (timberFace * 0.35), Math.max(timberFace * 1.05, unitSystem === 'metric' ? 0.55 : 1.6), 270, 270 + detail.wallRoofAngle, 'DETAIL_ROOF_WALL'),
    ...createDxfText(roofWallAttachPoint.x + (timberFace * 0.9), roofWallAttachPoint.y + (timberFace * 0.5), textHeight, `${formatValue(detail.wallRoofAngle, 1)} deg`, 'DETAIL_ROOF_WALL'),
    ...createDxfLine(roofWallLowPoint.x + (roofWallNormal.x * timberFace), roofWallLowPoint.y + (roofWallNormal.y * timberFace), roofWallAxisPoint.x + (roofWallNormal.x * timberFace), roofWallAxisPoint.y + (roofWallNormal.y * timberFace), 'DETAIL_ROOF_WALL'),
    ...createDxfText(roofWallAxisPoint.x + (roofWallNormal.x * (timberFace * 1.8)), roofWallAxisPoint.y + (roofWallNormal.y * (timberFace * 1.8)), textHeight, `Setout ${formatLength(roofWallWallHeight / Math.max(Math.sin(metrics.roofPitch * (Math.PI / 180)), 0.001), unitSystem)}`, 'DETAIL_ROOF_WALL'),
    ...createDxfText(31, detailOffsetY - 0.8, textHeight, 'WALL-FLOOR DETAIL', 'TEXT'),
    ...wallFloorWall,
    ...wallFloorBase,
    ...createDxfPolyline([
      { x: wallFloorWallX + 0.05, y: wallFloorFloorY - 0.45 },
      { x: wallFloorWallX + (timberFace * 0.75), y: wallFloorFloorY - 0.45 },
      { x: wallFloorWallX + 2.1, y: wallFloorFloorY + 1.05 },
      { x: wallFloorWallX + 1.35, y: wallFloorFloorY + 1.05 },
    ], 'DETAIL_WALL_FLOOR'),
    ...createDxfCircle(wallFloorWallX + 0.45, wallFloorFloorY - 0.22, anchorRadius, 'DETAIL_WALL_FLOOR'),
    ...createDxfCircle(wallFloorWallX + 0.9, wallFloorFloorY + 0.18, anchorRadius, 'DETAIL_WALL_FLOOR'),
    ...createDxfCircle(wallFloorWallX + 1.55, wallFloorFloorY + 0.34, anchorRadius, 'DETAIL_WALL_FLOOR'),
    ...createDxfCircle(wallFloorWallX + 2.0, wallFloorFloorY + 0.74, anchorRadius, 'DETAIL_WALL_FLOOR'),
    ...createDxfArc(wallFloorWallX + 0.1, wallFloorFloorY - 0.05, Math.max(timberFace * 0.75, unitSystem === 'metric' ? 0.42 : 1.2), 180, 270, 'DETAIL_WALL_FLOOR'),
    ...createDxfText(wallFloorWallX + 1.55, wallFloorFloorY - 0.22, textHeight, '90 deg', 'DETAIL_WALL_FLOOR'),
    ...createDxfText(wallFloorWallX + 0.9, wallFloorFloorY + 1.9, textHeight, `4 x ${formatValue(Math.max(Math.round(((inputs.availableWoodWidth * 1000) - 5) / 5) * 5, 25), 0)} mm`, 'DETAIL_WALL_FLOOR'),
  ];

  metrics.anchorPoints.forEach((anchorPoint) => {
    const x = displayLength(anchorPoint.x);
    const y = displayLength(anchorPoint.y);
    entities.push(...createDxfCircle(x, anchorOffsetY + y, anchorRadius, 'ANCHORS'));
  });

  return [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$INSUNITS',
    '70', unitCode,
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES',
    ...entities,
    '0', 'ENDSEC',
    '0', 'EOF',
  ].join('\n');
}

function addPdfPlan(doc: jsPDF, title: string, x: number, y: number, width: number, length: number, innerWidth: number, innerLength: number, innerOffsetY: number, unitSystem: UnitSystem, sharedScale?: number) {
  const boxWidth = 70;
  const boxHeight = 42;
  const panelWidth = 91;
  const scale = sharedScale ?? Math.min(boxWidth / Math.max(width, 1), boxHeight / Math.max(length, 1));
  const drawWidth = width * scale;
  const drawHeight = length * scale;
  const originX = x + ((panelWidth - drawWidth) / 2);
  const drawingTopY = y + 8;
  const drawingBottomY = y + 48;
  const originY = drawingTopY + ((drawingBottomY - drawingTopY - drawHeight) / 2);
  const centerX = x + (panelWidth / 2);

  doc.setFontSize(12);
  doc.text(title, centerX, y, { align: 'center' });
  doc.setDrawColor(71, 54, 39);
  doc.rect(originX, originY, drawWidth, drawHeight);

  if (innerWidth > 0 && innerLength > 0) {
    const innerDrawWidth = innerWidth * scale;
    const innerDrawLength = innerLength * scale;
    const innerX = originX + ((drawWidth - innerDrawWidth) / 2);
    const innerY = originY + (innerOffsetY * scale);
    doc.setDrawColor(31, 95, 117);
    doc.setLineDashPattern([1.6, 1.2], 0);
    doc.rect(innerX, innerY, innerDrawWidth, innerDrawLength);
    doc.setLineDashPattern([], 0);
  }

  doc.setFontSize(9);
  doc.text(`Width ${formatLength(width, unitSystem)} | Length ${formatLength(length, unitSystem)}`, centerX, y + 58, { align: 'center' });
}

function addPdfAnchorPlan(doc: jsPDF, x: number, y: number, width: number, length: number, anchorPoints: { x: number; y: number }[], anchorSpacingX: number, anchorSpacingY: number, unitSystem: UnitSystem) {
  const boxWidth = 70;
  const boxHeight = 42;
  const rotateForPage = length > width;
  const horizontalSpan = rotateForPage ? length : width;
  const verticalSpan = rotateForPage ? width : length;
  const scale = Math.min(boxWidth / Math.max(horizontalSpan, 1), boxHeight / Math.max(verticalSpan, 1));
  const drawWidth = horizontalSpan * scale;
  const drawHeight = verticalSpan * scale;
  const originX = x + ((boxWidth - drawWidth) / 2);
  const originY = y + 8;

  doc.setFontSize(12);
  doc.text('Anchor layout', x, y);
  doc.setDrawColor(71, 54, 39);
  doc.rect(originX, originY, drawWidth, drawHeight);
  doc.setFillColor(31, 95, 117);
  anchorPoints.forEach((anchorPoint) => {
    const normalizedX = rotateForPage
      ? (length > 0 ? anchorPoint.y / length : 0)
      : (width > 0 ? anchorPoint.x / width : 0);
    const normalizedY = rotateForPage
      ? 1 - (width > 0 ? anchorPoint.x / width : 0)
      : (length > 0 ? anchorPoint.y / length : 0);
    const pointX = originX + (normalizedX * drawWidth);
    const pointY = originY + (normalizedY * drawHeight);
    doc.circle(pointX, pointY, 1, 'F');
  });
  doc.setFontSize(9);
  doc.text(`${anchorPoints.length} anchors total`, x, y + 56);
  doc.text(`Grid ${formatLength(rotateForPage ? anchorSpacingY : anchorSpacingX, unitSystem)} x ${formatLength(rotateForPage ? anchorSpacingX : anchorSpacingY, unitSystem)}`, x, y + 62);
}

function drawPdfFilledPolygon(doc: jsPDF, points: { x: number; y: number }[], fill: [number, number, number], stroke: [number, number, number], lineWidth = 0.5) {
  if (points.length < 3) {
    return;
  }
  const vectors = points.slice(1).map((point, index) => [point.x - points[index].x, point.y - points[index].y]);
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
  doc.setLineWidth(lineWidth);
  doc.lines(vectors, points[0].x, points[0].y, [1, 1], 'FD', true);
}

function drawPdfAngleArc(doc: jsPDF, centerX: number, centerY: number, radius: number, startAngleDeg: number, endAngleDeg: number, label: string, labelRadius = radius + 8) {
  const segments = 18;
  const startRadians = startAngleDeg * (Math.PI / 180);
  const endRadians = endAngleDeg * (Math.PI / 180);
  const sweep = endRadians - startRadians;
  const points = Array.from({ length: segments + 1 }, (_, index) => {
    const angle = startRadians + ((sweep * index) / segments);
    return {
      x: centerX + (Math.cos(angle) * radius),
      y: centerY + (Math.sin(angle) * radius),
    };
  });
  doc.setDrawColor(31, 95, 117);
  doc.setLineWidth(0.45);
  for (let index = 0; index < points.length - 1; index += 1) {
    doc.line(points[index].x, points[index].y, points[index + 1].x, points[index + 1].y);
  }
  const labelAngle = startRadians + (sweep / 2);
  doc.setFontSize(10);
  doc.text(label, centerX + (Math.cos(labelAngle) * labelRadius), centerY + (Math.sin(labelAngle) * labelRadius));
}

function addPdfRenderedViewsPage(doc: jsPDF, metrics: PlannerMetrics, inputs: PlannerInputs) {
  const views = [
    { title: 'Back isometric', yaw: 2.35, pitch: 0.28, x: 14, y: 34 },
    { title: 'Back raised 45 deg', yaw: 3.14, pitch: 0.78, x: 108, y: 34 },
    { title: 'Top view', yaw: 0, pitch: 1.18, x: 14, y: 136 },
    { title: 'Back isometric mirrored', yaw: -2.35, pitch: 0.28, x: 108, y: 136 },
  ];

  function drawView(viewX: number, viewY: number, title: string, yaw: number, pitch: number) {
    const boxWidth = 84;
    const boxHeight = 78;
    const ladderTopInset = Math.min(1.2, Math.max(metrics.loftDeckLength - 0.2, 0.4));
    const ladderRun = metrics.loftArea > 0 ? Math.max(metrics.loftFloorHeight / Math.tan((LADDER_ANGLE_DEGREES * Math.PI) / 180), 0.2) : 0;
    const scene = buildProjectedCabinScene({
      width: inputs.groundWidth,
      totalHeight: metrics.totalHeight,
      sideWallHeight: metrics.sideWallHeight,
      cabinLength: inputs.groundLength,
      glazingStage: metrics.glazingStage,
      loftFloorHeight: metrics.loftFloorHeight,
      loftDeckWidth: metrics.loftDeckWidth,
      loftDeckLength: metrics.loftDeckLength,
      balconyMargin: metrics.balconyMargin,
      frontWallOffset: metrics.frontTerraceDepth,
      backWallOffset: metrics.actualSpacing,
      includeLoft: inputs.includeLoft,
      includeBalcony: inputs.includeBalcony,
      frameCount: metrics.frameCount,
      actualSpacing: metrics.actualSpacing,
      includeConcreteSlab: inputs.includeConcreteSlab,
      ladderOffset: 0,
      ladderTopInset,
      ladderRun,
      yaw,
      pitch,
      scale: 1,
    });
    const allPoints = scene.allProjectedPoints;
    const minX = Math.min(...allPoints.map((point) => point.x));
    const maxX = Math.max(...allPoints.map((point) => point.x));
    const minY = Math.min(...allPoints.map((point) => point.y));
    const maxY = Math.max(...allPoints.map((point) => point.y));
    const scale = Math.min((boxWidth - 12) / Math.max(maxX - minX, 1), (boxHeight - 18) / Math.max(maxY - minY, 1));
    const offsetX = viewX + 6 + (((boxWidth - 12) - ((maxX - minX) * scale)) / 2) - (minX * scale);
    const offsetY = viewY + 14 + (((boxHeight - 18) - ((maxY - minY) * scale)) / 2) - (minY * scale);
    const mapPoint = (point: ProjectedPoint) => ({ x: offsetX + (point.x * scale), y: offsetY + (point.y * scale) });

    doc.setDrawColor(71, 54, 39);
    doc.roundedRect(viewX, viewY, boxWidth, boxHeight, 4, 4);
    doc.setFontSize(11);
    doc.text(title, viewX + 4, viewY + 8);
    scene.faces.forEach((face) => drawPdfFilledPolygon(doc, face.projected.map(mapPoint), hexToRgb(face.fill), hexToRgb(face.stroke), 0.2));
    drawPdfFilledPolygon(doc, scene.frontWoodFace.map(mapPoint), [214, 187, 147], [108, 69, 38], 0.2);
    if (scene.loftPolygon) {
      drawPdfFilledPolygon(doc, scene.loftPolygon.map(mapPoint), [241, 214, 161], [127, 93, 59], 0.2);
    }
    scene.backGlazingPolygons.forEach((polygon) => drawPdfFilledPolygon(doc, polygon.map(mapPoint), [180, 223, 235], [31, 95, 117], 0.18));
    scene.frontGlazingPolygons.forEach((polygon) => drawPdfFilledPolygon(doc, polygon.map(mapPoint), [124, 196, 216], [31, 95, 117], 0.18));
    doc.setDrawColor(96, 74, 53);
    doc.setLineWidth(0.45);
    scene.floorStructureLines.forEach((line) => doc.line(mapPoint(line[0]).x, mapPoint(line[0]).y, mapPoint(line[1]).x, mapPoint(line[1]).y));
    doc.setLineWidth(0.55);
    scene.rafterLines.forEach((line) => doc.line(mapPoint(line[0]).x, mapPoint(line[0]).y, mapPoint(line[1]).x, mapPoint(line[1]).y));
    doc.setDrawColor(127, 93, 59);
    scene.loftEdgeLines.forEach((line) => doc.line(mapPoint(line[0]).x, mapPoint(line[0]).y, mapPoint(line[1]).x, mapPoint(line[1]).y));
    doc.setDrawColor(214, 187, 147);
    scene.railingLines.forEach((line) => doc.line(mapPoint(line[0]).x, mapPoint(line[0]).y, mapPoint(line[1]).x, mapPoint(line[1]).y));
    scene.ladderLines.forEach((line) => doc.line(mapPoint(line[0]).x, mapPoint(line[0]).y, mapPoint(line[1]).x, mapPoint(line[1]).y));
    if (scene.loftPolygon) {
      doc.setDrawColor(127, 93, 59);
      doc.setLineWidth(0.65);
      const loftPoints = scene.loftPolygon.map(mapPoint);
      for (let index = 0; index < loftPoints.length; index += 1) {
        const nextIndex = (index + 1) % loftPoints.length;
        doc.line(loftPoints[index].x, loftPoints[index].y, loftPoints[nextIndex].x, loftPoints[nextIndex].y);
      }
    }
    const drawPolygonOutline = (points: ProjectedPoint[], strokeColor: [number, number, number], lineWidth = 0.5) => {
      if (points.length < 2) {
        return;
      }
      const mapped = points.map(mapPoint);
      doc.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
      doc.setLineWidth(lineWidth);
      for (let index = 0; index < mapped.length; index += 1) {
        const nextIndex = (index + 1) % mapped.length;
        doc.line(mapped[index].x, mapped[index].y, mapped[nextIndex].x, mapped[nextIndex].y);
      }
    };
    drawPolygonOutline(scene.doorPolygon, [47, 31, 20], 0.45);
    drawPolygonOutline(scene.doorGlassPolygon, [47, 31, 20], 0.35);
    scene.backGlazingPolygons.forEach((polygon) => drawPolygonOutline(polygon, [31, 95, 117], 0.35));
    scene.frontGlazingPolygons.forEach((polygon) => drawPolygonOutline(polygon, [31, 95, 117], 0.45));
  }

  doc.addPage();
  doc.setFontSize(20);
  doc.text('3D reference views', 14, 18);
  doc.setFontSize(10);
  doc.text('Textured snapshots generated from the live preview geometry with wireframe overlays for reading the structure.', 14, 26);
  views.forEach((view) => drawView(view.x, view.y, view.title, view.yaw, view.pitch));
}

function addPdfFramingSchematicPage(doc: jsPDF, metrics: PlannerMetrics, inputs: PlannerInputs, unitSystem: UnitSystem) {
  const boxX = 18;
  const boxY = 36;
  const boxWidth = 174;
  const boxHeight = 220;
  const drawingScale = Math.min((boxWidth - 24) / Math.max(inputs.groundWidth, 0.1), (boxHeight - 34) / Math.max(metrics.totalHeight, 0.1));
  const baseWidth = inputs.groundWidth * drawingScale;
  const totalHeight = metrics.totalHeight * drawingScale;
  const halfSpan = inputs.groundWidth / 2;
  const rafterLength = Math.max(metrics.fullRafterLength, 0.001);
  const timberInset = Math.min(inputs.availableWoodDepth, rafterLength * 0.25);
  const innerApexDrop = (timberInset * rafterLength) / Math.max(halfSpan, 0.001);
  const innerApexHeight = Math.max(metrics.totalHeight - innerApexDrop, metrics.loftFloorHeight);
  const innerLoftClearance = Math.max(innerApexHeight - metrics.loftFloorHeight, 0);
  const loftHalfWidth = metrics.loftDeckWidth / 2;
  const leftBase = { x: boxX + ((boxWidth - baseWidth) / 2), y: boxY + boxHeight - 52 };
  const rightBase = { x: leftBase.x + baseWidth, y: leftBase.y };
  const apex = { x: leftBase.x + (baseWidth / 2), y: leftBase.y - totalHeight };
  const sideWallHeight = metrics.sideWallHeight * drawingScale;
  const leftKnee = { x: leftBase.x + ((sideWallHeight / Math.max(totalHeight, 0.1)) * (apex.x - leftBase.x)), y: leftBase.y - sideWallHeight };
  const rightKnee = { x: rightBase.x - ((sideWallHeight / Math.max(totalHeight, 0.1)) * (rightBase.x - apex.x)), y: rightBase.y - sideWallHeight };
  const loftY = leftBase.y - (metrics.loftFloorHeight * drawingScale);
  const innerApexY = leftBase.y - (innerApexHeight * drawingScale);
  const loftLeftX = apex.x - (loftHalfWidth * drawingScale);
  const loftRightX = apex.x + (loftHalfWidth * drawingScale);
  const stockLabel = unitSystem === 'metric'
    ? `${formatValue(inputs.availableWoodWidth * 1000, 0)} x ${formatValue(inputs.availableWoodDepth * 1000, 0)} mm`
    : `${formatValue((inputs.availableWoodWidth * 1000) / MM_PER_INCH, 2)} x ${formatValue((inputs.availableWoodDepth * 1000) / MM_PER_INCH, 2)} in`;
  const rafterMidpoint = { x: leftBase.x + ((apex.x - leftBase.x) * 0.56), y: leftBase.y + ((apex.y - leftBase.y) * 0.56) };
  const rafterLabelOffset = 10;
  const rafterLabelPoint = {
    x: rafterMidpoint.x - (((leftBase.y - apex.y) / Math.max(metrics.fullRafterLength * drawingScale, 0.1)) * rafterLabelOffset),
    y: rafterMidpoint.y - (((apex.x - leftBase.x) / Math.max(metrics.fullRafterLength * drawingScale, 0.1)) * rafterLabelOffset),
  };
  const frameRows = [
    `Build ${metrics.frameCount} A-frames at ${formatLength(metrics.actualSpacing, unitSystem)} centers`,
    `Per frame: 2 rafters at ${formatLength(metrics.fullRafterLength, unitSystem)}`,
    `Per frame: 1 base tie at ${formatLength(inputs.groundWidth, unitSystem)}`,
    metrics.sideWallHeight > 0 ? `Per frame: 2 side wall studs at ${formatLength(metrics.sideWallHeight, unitSystem)}` : 'True A-frame: no vertical side wall studs',
    metrics.loftArea > 0 ? `Loft deck level set at ${formatLength(metrics.loftFloorHeight, unitSystem)}` : 'No loft deck included in this configuration',
  ];

  doc.addPage();
  doc.setFontSize(20);
  doc.text('Framing schematic', 14, 18);
  doc.setFontSize(10);
  doc.text('Single frame reference with the main build dimensions laid over the current geometry.', 14, 26);

  doc.setDrawColor(71, 54, 39);
  doc.setLineWidth(0.9);
  doc.line(leftBase.x, leftBase.y, apex.x, apex.y);
  doc.line(apex.x, apex.y, rightBase.x, rightBase.y);
  doc.line(leftBase.x, leftBase.y, rightBase.x, rightBase.y);
  if (metrics.sideWallHeight > 0) {
    doc.line(leftKnee.x, leftKnee.y, leftKnee.x, leftBase.y);
    doc.line(rightKnee.x, rightKnee.y, rightKnee.x, rightBase.y);
  }
  if (metrics.loftArea > 0) {
    doc.line(loftLeftX, loftY, loftRightX, loftY);
  }

  doc.setDrawColor(45, 45, 45);
  doc.setLineWidth(0.45);
  doc.line(leftBase.x - 12, leftBase.y, leftBase.x - 12, apex.y);
  doc.line(leftBase.x - 14, leftBase.y, leftBase.x - 10, leftBase.y);
  doc.line(leftBase.x - 14, apex.y, leftBase.x - 10, apex.y);
  doc.text(formatLength(metrics.totalHeight, unitSystem), leftBase.x - 18, (leftBase.y + apex.y) / 2, { angle: 90, align: 'center' });

  doc.line(leftBase.x, leftBase.y + 14, rightBase.x, leftBase.y + 14);
  doc.line(leftBase.x, leftBase.y + 11, leftBase.x, leftBase.y + 17);
  doc.line(rightBase.x, leftBase.y + 11, rightBase.x, leftBase.y + 17);
  doc.text(formatLength(inputs.groundWidth, unitSystem), apex.x, leftBase.y + 24, { align: 'center' });

  if (metrics.loftArea > 0) {
    doc.line(loftLeftX, loftY + 10, loftRightX, loftY + 10);
    doc.line(loftLeftX, loftY + 7, loftLeftX, loftY + 13);
    doc.line(loftRightX, loftY + 7, loftRightX, loftY + 13);
    doc.text(formatLength(metrics.loftDeckWidth, unitSystem), apex.x, loftY + 20, { align: 'center' });

    doc.line(apex.x, loftY, apex.x, innerApexY);
    doc.line(apex.x - 3, loftY, apex.x + 3, loftY);
    doc.line(apex.x - 3, innerApexY, apex.x + 3, innerApexY);
    doc.text(formatLength(innerLoftClearance, unitSystem), apex.x + 6, (loftY + innerApexY) / 2, { angle: 90, align: 'center' });

    doc.line(apex.x - 12, loftY, apex.x - 12, leftBase.y);
    doc.line(apex.x - 15, loftY, apex.x - 9, loftY);
    doc.line(apex.x - 15, leftBase.y, apex.x - 9, leftBase.y);
    doc.text(formatLength(metrics.loftFloorHeight, unitSystem), apex.x - 24, (loftY + leftBase.y) / 2, { angle: 90, align: 'center' });
  }

  if (metrics.sideWallHeight > 0) {
    doc.line(rightKnee.x + 12, rightKnee.y, rightKnee.x + 12, rightBase.y);
    doc.line(rightKnee.x + 9, rightKnee.y, rightKnee.x + 15, rightKnee.y);
    doc.line(rightKnee.x + 9, rightBase.y, rightKnee.x + 15, rightBase.y);
    doc.text(formatLength(metrics.sideWallHeight, unitSystem), rightKnee.x + 24, (rightKnee.y + rightBase.y) / 2, { angle: 90, align: 'center' });
  }

  doc.setFontSize(10);
  doc.text(`Rafter length ${formatLength(metrics.fullRafterLength, unitSystem)}`, rafterLabelPoint.x, rafterLabelPoint.y, { angle: metrics.roofPitch, align: 'center' });
  doc.text(`Roof pitch ${formatValue(metrics.roofPitch, 1)} deg`, 18, 236);
  doc.text(`Loft level ${metrics.loftArea > 0 ? formatLength(metrics.loftFloorHeight, unitSystem) : 'No loft'}`, 72, 236);
  doc.text(`Stock ${stockLabel}`, 132, 236, { align: 'center' });

  doc.setFontSize(11);
  doc.text('DIY cut list and counts', 18, 246);
  doc.setFontSize(9);
  frameRows.forEach((row, index) => {
    doc.text(`- ${row}`, 18, 253 + (index * 6));
  });
}

function addPdfApexDetail(doc: jsPDF, metrics: PlannerMetrics, inputs: PlannerInputs, unitSystem: UnitSystem) {
  const memberFaceDraw = clamp(inputs.availableWoodDepth * 1000 * 0.12, 12, 26);
  const apexAngle = 180 - (metrics.roofPitch * 2);
  const seamCenter = { x: 102, y: 82 };
  const memberLength = 88;
  const roofPitchRadians = metrics.roofPitch * (Math.PI / 180);
  const leftStart = {
    x: seamCenter.x - (Math.cos(roofPitchRadians) * memberLength),
    y: seamCenter.y + (Math.sin(roofPitchRadians) * memberLength),
  };
  const rightStart = {
    x: seamCenter.x + (Math.cos(roofPitchRadians) * memberLength),
    y: seamCenter.y + (Math.sin(roofPitchRadians) * memberLength),
  };
  const leftPolygon = createVerticalMitredBeamPolygon(leftStart, seamCenter, memberFaceDraw, seamCenter.x);
  const rightPolygon = createVerticalMitredBeamPolygon(rightStart, seamCenter, memberFaceDraw, seamCenter.x);
  const seamTopY = Math.min(leftPolygon[3].y, rightPolygon[3].y);
  const seamBottomY = Math.max(leftPolygon[2].y, rightPolygon[2].y);
  const notesX = 130;
  const notesY = 88;
  const insetWidth = 78;
  const insetHeight = 70;
  const insetX = (210 - insetWidth) / 2;
  const insetY = 186;
  const cutAngle = apexAngle / 2;
  const cutLength = inputs.availableWoodDepth / Math.max(Math.sin(cutAngle * (Math.PI / 180)), 0.001);
  const timberFaceMm = inputs.availableWoodDepth * 1000;
  const screwLengthMm = Math.max(Math.round(((timberFaceMm * 2) - 5) / 5) * 5, 30);
  const screwDiameterMm = clamp(Math.round(timberFaceMm / 25), 5, 10);
  const insetLeftBoard = { x: insetX + 10, y: insetY + 45, width: 42, height: 10 };
  const insetRightBoard = { x: insetX + 10, y: insetY + 25, width: 42, height: 10 };
  const topCutStartX = insetLeftBoard.x + 23;
  const bottomCutStartX = insetRightBoard.x + 23;
  const leftLowestCorner = leftPolygon.reduce((lowest, point) => (point.y > lowest.y ? point : lowest), leftPolygon[0]);
  const roofPitchRadius = 14;
  const roofPitchCenter = { x: leftLowestCorner.x, y: leftLowestCorner.y };
  const drawUnitsPerMm = memberFaceDraw / Math.max(timberFaceMm, 1);
  const screwOffsetDraw = 10 * drawUnitsPerMm;
  const screwLengthDraw = screwLengthMm * drawUnitsPerMm;
  const leftAxis = {
    x: seamCenter.x - leftStart.x,
    y: seamCenter.y - leftStart.y,
  };
  const leftAxisLength = Math.hypot(leftAxis.x, leftAxis.y) || 1;
  const leftAxisUnit = { x: leftAxis.x / leftAxisLength, y: leftAxis.y / leftAxisLength };
  const leftNormalUnit = { x: leftAxisUnit.y, y: -leftAxisUnit.x };
  const screwMidpoint = { x: seamCenter.x, y: seamBottomY - screwOffsetDraw };
  const screwStart = {
    x: screwMidpoint.x - (leftNormalUnit.x * (screwLengthDraw / 2)),
    y: screwMidpoint.y - (leftNormalUnit.y * (screwLengthDraw / 2)),
  };
  const screwEnd = {
    x: screwMidpoint.x + (leftNormalUnit.x * (screwLengthDraw / 2)),
    y: screwMidpoint.y + (leftNormalUnit.y * (screwLengthDraw / 2)),
  };
  const headSpan = 3.8;
  const headDepth = 2.4;
  const screwHeadLeft = {
    x: screwStart.x + (leftAxisUnit.x * headSpan),
    y: screwStart.y + (leftAxisUnit.y * headSpan),
  };
  const screwHeadRight = {
    x: screwStart.x - (leftAxisUnit.x * headSpan),
    y: screwStart.y - (leftAxisUnit.y * headSpan),
  };
  const screwHeadTip = {
    x: screwStart.x - (leftNormalUnit.x * headDepth),
    y: screwStart.y - (leftNormalUnit.y * headDepth),
  };

  doc.addPage();
  doc.setFontSize(20);
  doc.text('Roof to roof apex connection', 14, 18);
  doc.setFontSize(10);
  doc.text('Two rafters cut back to a vertical ridge seam, with the apex angle and cut geometry shown on one page.', 14, 26);
  drawPdfFilledPolygon(doc, leftPolygon, [183, 122, 71], [108, 66, 36], 0.7);
  drawPdfFilledPolygon(doc, rightPolygon, [141, 82, 42], [93, 52, 25], 0.7);
  doc.setDrawColor(71, 54, 39);
  doc.setLineWidth(0.8);
  doc.line(seamCenter.x, seamTopY, seamCenter.x, seamBottomY);
  doc.setDrawColor(220, 24, 45);
  doc.setLineWidth(1.1);
  doc.line(screwStart.x, screwStart.y, screwEnd.x, screwEnd.y);
  doc.setLineWidth(0.45);
  doc.line(screwHeadLeft.x, screwHeadLeft.y, screwHeadTip.x, screwHeadTip.y);
  doc.line(screwHeadRight.x, screwHeadRight.y, screwHeadTip.x, screwHeadTip.y);
  doc.setDrawColor(71, 54, 39);
  doc.setLineWidth(0.8);
  drawPdfAngleArc(doc, seamCenter.x, seamBottomY, 18, 180 - metrics.roofPitch, metrics.roofPitch, '', 26);
  doc.setFontSize(10);
  doc.text(`Apex ${formatValue(apexAngle, 1)} deg`, seamCenter.x, seamBottomY + 28, { align: 'center' });
  doc.line(roofPitchCenter.x - 20, roofPitchCenter.y, roofPitchCenter.x + roofPitchRadius, roofPitchCenter.y);
  drawPdfAngleArc(doc, roofPitchCenter.x, roofPitchCenter.y, roofPitchRadius, 360 - metrics.roofPitch, 360, '', 24);
  doc.text(`Roof pitch ${formatValue(metrics.roofPitch, 1)} deg`, roofPitchCenter.x + 20, roofPitchCenter.y - 6);
  doc.setFontSize(11);
  doc.text('Vertical seam after both mitres are cut back', notesX, notesY);
  doc.text(`Apex angle ${formatValue(apexAngle, 1)} deg`, notesX, notesY + 8);
  doc.setDrawColor(220, 24, 45);
  doc.setLineWidth(1.1);
  doc.line(61, 171, 68, 171);
  doc.setDrawColor(71, 54, 39);
  doc.text(`Countersunk screw ${screwLengthMm} mm x ${screwDiameterMm} mm`, 105, 172, { align: 'center' });
  doc.text('Estimated from two timber faces minus 5 mm for the joint allowance', 105, 179, { align: 'center' });

  doc.setDrawColor(71, 54, 39);
  doc.roundedRect(insetX, insetY, insetWidth, insetHeight, 3, 3);
  doc.setFontSize(11);
  doc.text('Cut detail', insetX + 4, insetY + 8);
  doc.setFontSize(9);
  doc.text('Each end is cut to the same half-angle before meeting the vertical seam.', insetX + 4, insetY + 14, { maxWidth: insetWidth - 8 });
  doc.setDrawColor(108, 69, 38);
  doc.setFillColor(214, 187, 147);
  doc.rect(insetLeftBoard.x, insetLeftBoard.y, insetLeftBoard.width, insetLeftBoard.height, 'FD');
  doc.line(topCutStartX, insetLeftBoard.y, insetLeftBoard.x + insetLeftBoard.width, insetLeftBoard.y + insetLeftBoard.height);
  doc.rect(insetRightBoard.x, insetRightBoard.y, insetRightBoard.width, insetRightBoard.height, 'FD');
  doc.line(bottomCutStartX, insetRightBoard.y + insetRightBoard.height, insetRightBoard.x + insetRightBoard.width, insetRightBoard.y);
  drawPdfAngleArc(doc, topCutStartX, insetLeftBoard.y, 5.5, 0, cutAngle, '', 15);
  drawPdfAngleArc(doc, bottomCutStartX, insetRightBoard.y + insetRightBoard.height, 5.5, 360 - cutAngle, 360, '', 15);
  doc.text(`${formatValue(cutAngle, 1)} deg`, insetLeftBoard.x + insetLeftBoard.width + 6, insetLeftBoard.y + 6);
  doc.text(`${formatValue(cutAngle, 1)} deg`, insetRightBoard.x + insetRightBoard.width + 6, insetRightBoard.y + 7);
  doc.text(`Cut length ${formatLength(cutLength, unitSystem)}`, insetX + (insetWidth / 2), insetY + 40, { align: 'center' });
  doc.text('Cut line', insetX + 4, insetY + 60);
  doc.text(`Timber face ${formatLength(inputs.availableWoodDepth, unitSystem)}`, insetX + 30, insetY + 60);
  doc.text(`Timber face ${formatLength(inputs.availableWoodDepth, unitSystem)}`, 105, insetY + insetHeight + 10, { align: 'center' });
}

function addPdfRoofWallDetail(doc: jsPDF, metrics: PlannerMetrics, inputs: PlannerInputs, unitSystem: UnitSystem) {
  const memberFaceMm = inputs.availableWoodDepth * 1000;
  const memberWidthMm = inputs.availableWoodWidth * 1000;
  const memberFaceDraw = clamp(memberFaceMm * 0.12, 12, 26);
  const wallHeight = 90;
  const baseY = 214;
  const roofLowPoint = { x: 54, y: baseY };
  const roofLength = 126;
  const roofPitchRadians = metrics.roofPitch * (Math.PI / 180);
  const roofHighPoint = { x: roofLowPoint.x + (Math.cos(roofPitchRadians) * roofLength), y: roofLowPoint.y - (Math.sin(roofPitchRadians) * roofLength) };
  const roofPolygon = createBeamPolygon(roofLowPoint, roofHighPoint, memberFaceDraw, 90, 90);
  const roofAxisUnit = {
    x: (roofHighPoint.x - roofLowPoint.x) / roofLength,
    y: (roofHighPoint.y - roofLowPoint.y) / roofLength,
  };
  const roofNormal = { x: -roofAxisUnit.y, y: roofAxisUnit.x };
  const wallSetout = wallHeight / Math.max(Math.sin(roofPitchRadians), 0.001);
  const wallAxisPoint = {
    x: roofLowPoint.x + (roofAxisUnit.x * wallSetout),
    y: roofLowPoint.y + (roofAxisUnit.y * wallSetout),
  };
  const wallAttachPoint = {
    x: wallAxisPoint.x + (roofNormal.x * (memberFaceDraw / 2)),
    y: wallAxisPoint.y + (roofNormal.y * (memberFaceDraw / 2)),
  };
  const wallX = wallAttachPoint.x - memberFaceDraw;
  const topY = wallAttachPoint.y;
  const wallPolygon = [
    { x: wallX, y: baseY },
    { x: wallX, y: topY },
    { x: wallX + memberFaceDraw, y: topY },
    { x: wallX + memberFaceDraw, y: baseY },
  ];
  const wallRoofAngle = 90 - metrics.roofPitch;
  const setoutLineStart = { x: roofLowPoint.x - (roofNormal.x * (memberFaceDraw * 1.3)), y: roofLowPoint.y - (roofNormal.y * (memberFaceDraw * 1.3)) };
  const setoutLineEnd = { x: wallAxisPoint.x - (roofNormal.x * (memberFaceDraw * 1.3)), y: wallAxisPoint.y - (roofNormal.y * (memberFaceDraw * 1.3)) };
  const setoutLabel = {
    x: ((setoutLineStart.x + setoutLineEnd.x) / 2) - (roofNormal.x * 4.5) - (roofAxisUnit.x * 2),
    y: ((setoutLineStart.y + setoutLineEnd.y) / 2) - (roofNormal.y * 4.5) - (roofAxisUnit.y * 2),
  };
  const screwCenter = { x: wallX + (memberFaceDraw / 2), y: topY + (wallHeight * 0.12) };
  const screwRadius = 2.2;
  const screwLengthMm = Math.max(Math.round(((memberWidthMm * 2) - 5) / 5) * 5, 25);
  const timberTextX = wallX + (memberFaceDraw / 2);
  const timberTextY = baseY + 24;
  const screwNoteY = timberTextY + 10;
  const angleLabelPoint = { x: wallAttachPoint.x + (memberFaceDraw * 2.3), y: wallAttachPoint.y + (memberFaceDraw * 0.15) };
  const sideWallDimX = Math.max(112, wallX + memberFaceDraw + 16);

  doc.addPage();
  doc.setFontSize(20);
  doc.text('Roof to wall connection', 14, 18);
  doc.setFontSize(10);
  doc.text('Simplified wall seat detail with the rafter extended to floor level and cut off at the slab line.', 14, 26);
  drawPdfFilledPolygon(doc, wallPolygon, [214, 187, 147], [108, 69, 38], 0.7);
  drawPdfFilledPolygon(doc, roofPolygon, [183, 122, 71], [108, 66, 36], 0.7);
  drawPdfAngleArc(doc, wallAttachPoint.x - (memberFaceDraw * 0.15), wallAttachPoint.y + (memberFaceDraw * 0.42), 16, 270, 270 + wallRoofAngle, '', 26);
  doc.setFontSize(10);
  doc.setTextColor(71, 54, 39);
  doc.text(`${formatValue(wallRoofAngle, 1)} deg`, angleLabelPoint.x, angleLabelPoint.y);
  doc.setDrawColor(220, 24, 45);
  doc.setFillColor(220, 24, 45);
  doc.circle(screwCenter.x, screwCenter.y, screwRadius, 'S');
  doc.line(screwCenter.x - 1.25, screwCenter.y - 1.25, screwCenter.x + 1.25, screwCenter.y + 1.25);
  doc.line(screwCenter.x - 1.25, screwCenter.y + 1.25, screwCenter.x + 1.25, screwCenter.y - 1.25);
  doc.setFontSize(11);
  doc.setDrawColor(31, 95, 117);
  doc.setLineWidth(0.55);
  doc.line(setoutLineStart.x, setoutLineStart.y, setoutLineEnd.x, setoutLineEnd.y);
  doc.setLineWidth(0.4);
  doc.line(setoutLineStart.x - (roofNormal.x * 4), setoutLineStart.y - (roofNormal.y * 4), setoutLineStart.x + (roofNormal.x * 4), setoutLineStart.y + (roofNormal.y * 4));
  doc.line(setoutLineEnd.x - (roofNormal.x * 4), setoutLineEnd.y - (roofNormal.y * 4), setoutLineEnd.x + (roofNormal.x * 4), setoutLineEnd.y + (roofNormal.y * 4));
  doc.setFontSize(10);
  doc.setTextColor(31, 95, 117);
  doc.text(`Wall setout from floor cut ${formatLength(metrics.sideWallHeight / Math.max(Math.sin(roofPitchRadians), 0.001), unitSystem)}`, setoutLabel.x, setoutLabel.y, { align: 'center', angle: metrics.roofPitch });
  doc.setTextColor(71, 54, 39);
  doc.setFontSize(11);
  doc.text('Measure the wall seat from the lower floor cut end', 14, 34);

  doc.setDrawColor(79, 101, 112);
  doc.setDrawColor(31, 95, 117);
  doc.line(sideWallDimX, topY, sideWallDimX, baseY);
  doc.line(sideWallDimX - 3, topY, sideWallDimX + 3, topY);
  doc.line(sideWallDimX - 3, baseY, sideWallDimX + 3, baseY);
  doc.text(`Side wall face ${formatLength(inputs.availableWoodDepth, unitSystem)}`, sideWallDimX + 8, (topY + baseY) / 2, { angle: 90, align: 'center' });

  doc.line(wallX, baseY + 16, wallX + memberFaceDraw, baseY + 16);
  doc.line(wallX, baseY + 13, wallX, baseY + 19);
  doc.line(wallX + memberFaceDraw, baseY + 13, wallX + memberFaceDraw, baseY + 19);
  doc.setTextColor(71, 54, 39);
  doc.text(`Timber face ${formatLength(inputs.availableWoodDepth, unitSystem)}`, timberTextX, timberTextY, { align: 'center' });
  doc.setDrawColor(220, 24, 45);
  doc.setFillColor(220, 24, 45);
  doc.circle(timberTextX - 32, screwNoteY - 1.4, 1.5, 'F');
  doc.setTextColor(220, 24, 45);
  doc.text(`Screw recommended size ${formatValue(screwLengthMm, 0)} mm`, timberTextX, screwNoteY, { align: 'center' });
  doc.setTextColor(71, 54, 39);
}

function addPdfWallFloorDetail(doc: jsPDF, inputs: PlannerInputs, unitSystem: UnitSystem) {
  const memberFaceDraw = clamp(inputs.availableWoodDepth * 1000 * 0.12, 12, 26);
  const floorThicknessDraw = clamp(inputs.availableWoodWidth * 1000 * 0.18, 8, 18);
  const wallX = 92;
  const floorY = 188;
  const wallHeight = 102;
  const floorLength = 104;
  const screwLengthMm = Math.max(Math.round(((inputs.availableWoodWidth * 1000) - 5) / 5) * 5, 25);
  const screwCountPerConnection = 4;
  const floorPolygon = [
    { x: wallX - 16, y: floorY },
    { x: wallX - 16 + floorLength, y: floorY },
    { x: wallX - 16 + floorLength, y: floorY + floorThicknessDraw },
    { x: wallX - 16, y: floorY + floorThicknessDraw },
  ];
  const wallPolygon = [
    { x: wallX, y: floorY },
    { x: wallX + memberFaceDraw, y: floorY },
    { x: wallX + memberFaceDraw, y: floorY - wallHeight },
    { x: wallX, y: floorY - wallHeight },
  ];

  doc.addPage();
  doc.setFontSize(20);
  doc.text('Wall to floor connection', 14, 18);
  doc.setFontSize(10);
  doc.text('Large 2D joinery reference for the side wall and floor build-up.', 14, 26);
  drawPdfFilledPolygon(doc, floorPolygon, [217, 198, 165], [108, 69, 38], 0.7);
  drawPdfFilledPolygon(doc, wallPolygon, [214, 187, 147], [108, 69, 38], 0.7);
  const tiePolygon = [
    { x: wallX + 2, y: floorY - 9 },
    { x: wallX + 13, y: floorY - 9 },
    { x: wallX + 34, y: floorY + 10 },
    { x: wallX + 23, y: floorY + 10 },
  ];
  drawPdfFilledPolygon(doc, tiePolygon, [120, 130, 138], [79, 101, 112], 0.5);
  doc.setDrawColor(220, 24, 45);
  doc.setFillColor(220, 24, 45);
  const screwHeads = [
    { x: wallX + 8, y: floorY - 4 },
    { x: wallX + 14, y: floorY },
    { x: wallX + 23, y: floorY + 2 },
    { x: wallX + 29, y: floorY + 7 },
  ];
  screwHeads.forEach((head) => {
    doc.circle(head.x, head.y, 1.3, 'S');
    doc.line(head.x - 0.9, head.y - 0.9, head.x + 0.9, head.y + 0.9);
    doc.line(head.x - 0.9, head.y + 0.9, head.x + 0.9, head.y - 0.9);
  });
  drawPdfAngleArc(doc, wallX + 2, floorY - 1, 12, 180, 270, '90 deg', 18);
  doc.setFontSize(11);
  doc.setTextColor(71, 54, 39);
  doc.text('Hurricane / seismic tie', wallX + 56, floorY + (floorThicknessDraw * 0.5), { align: 'center' });

  doc.setDrawColor(79, 101, 112);
  doc.setTextColor(31, 95, 117);
  doc.line(wallX + memberFaceDraw + 12, floorY - wallHeight, wallX + memberFaceDraw + 12, floorY);
  doc.line(wallX + memberFaceDraw + 9, floorY - wallHeight, wallX + memberFaceDraw + 15, floorY - wallHeight);
  doc.line(wallX + memberFaceDraw + 9, floorY, wallX + memberFaceDraw + 15, floorY);
  doc.text(`Wall face ${formatLength(inputs.availableWoodDepth, unitSystem)}`, wallX + memberFaceDraw + 18, floorY - (wallHeight / 2), { angle: 90 });

  doc.line(wallX - 16, floorY + floorThicknessDraw + 14, wallX - 16 + floorLength, floorY + floorThicknessDraw + 14);
  doc.line(wallX - 16, floorY + floorThicknessDraw + 11, wallX - 16, floorY + floorThicknessDraw + 17);
  doc.line(wallX - 16 + floorLength, floorY + floorThicknessDraw + 11, wallX - 16 + floorLength, floorY + floorThicknessDraw + 17);
  doc.text(`Base member span shown ${formatLength(inputs.groundWidth, unitSystem)}`, wallX - 16 + (floorLength / 2), floorY + floorThicknessDraw + 22, { align: 'center' });
  doc.setTextColor(71, 54, 39);
  doc.text(`Timber face ${formatLength(inputs.availableWoodDepth, unitSystem)}`, wallX + (memberFaceDraw / 2), floorY + floorThicknessDraw + 32, { align: 'center' });
  doc.setDrawColor(220, 24, 45);
  doc.setFillColor(220, 24, 45);
  doc.circle(80, floorY + floorThicknessDraw + 41, 1.5, 'F');
  doc.setTextColor(220, 24, 45);
  doc.text(`Screws ${screwCountPerConnection} x ${formatValue(screwLengthMm, 0)} mm`, 105, floorY + floorThicknessDraw + 42, { align: 'center' });
  doc.setTextColor(71, 54, 39);
}

function exportPdf(inputs: PlannerInputs, metrics: PlannerMetrics, unitSystem: UnitSystem) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const stockWidth = unitSystem === 'metric' ? inputs.availableWoodWidth * 1000 : (inputs.availableWoodWidth * 1000) / MM_PER_INCH;
  const stockDepth = unitSystem === 'metric' ? inputs.availableWoodDepth * 1000 : (inputs.availableWoodDepth * 1000) / MM_PER_INCH;
  const stockUnit = unitSystem === 'metric' ? 'mm' : 'in';

  doc.setFontSize(22);
  doc.text(`A-Frame Cabin Plan Export (${unitSystem === 'metric' ? 'Metric' : 'Imperial'})`, 14, 18);
  doc.setFontSize(10);
  doc.text(`Units: ${unitSystem === 'metric' ? 'Metric' : 'Imperial'}`, 14, 26);

  const summaryRows = [
    ['Ground width', formatLength(inputs.groundWidth, unitSystem)],
    ['Ground length', formatLength(inputs.groundLength, unitSystem)],
    ['Ground area', formatArea(metrics.groundArea, unitSystem)],
    ['Floor 1.7 m zone', formatArea(metrics.groundHeadspaceArea, unitSystem)],
    ['Total height', formatLength(metrics.totalHeight, unitSystem)],
    ['Rafter length', formatLength(metrics.rafterLength, unitSystem)],
    ['Loft usable area', metrics.loftArea > 0 ? formatArea(metrics.loftArea, unitSystem) : 'No loft enabled'],
    ['Loft 1.7 m zone', metrics.loftArea > 0 ? formatArea(metrics.loftHeadspaceArea, unitSystem) : 'No loft enabled'],
    ['Roof surfaces', formatArea(metrics.roofSurfaceArea, unitSystem)],
    ['Side walls', formatArea(metrics.sideWallArea, unitSystem)],
    ['Glass area', formatArea(metrics.glassArea, unitSystem)],
    ['Wall and roof cladding', formatArea(metrics.wallCladdingArea, unitSystem)],
    ['Floor boarding', formatArea(metrics.floorBoardingArea, unitSystem)],
    [`Roof boarding volume (${formatLength(inputs.roofBoardingThickness, unitSystem)})`, formatVolume(metrics.roofBoardingVolume, unitSystem)],
    ['Timber volume', formatVolume(metrics.totalWoodVolume, unitSystem)],
    ['Rafter count', `${metrics.rafterCount} pcs`],
    ['Base ties / floor joists', `${metrics.floorJoistCount} pcs`],
    ['Connector braces @ 2 m', `${metrics.connectorBraceCount} pcs`],
    ['Estimated stock pieces', `${metrics.stockPieceCount} pcs`],
    ['Apex screws total', `${metrics.apexScrewCount} pcs @ ${formatValue(metrics.apexScrewLengthMm, 0)} x ${formatValue(metrics.apexScrewDiameterMm, 0)} mm`],
    ['Roof-wall screws total', `${metrics.roofWallScrewCount} pcs @ ${formatValue(metrics.roofWallScrewLengthMm, 0)} mm`],
    ['Wall-floor screws total', `${metrics.wallFloorScrewCount} pcs @ ${formatValue(metrics.wallFloorScrewLengthMm, 0)} mm`],
    ['Recommended section (pine wood)', getSectionLabel(metrics.recommendedSection, unitSystem)],
    ['Available stock', `${formatValue(stockWidth, unitSystem === 'metric' ? 0 : 2)} x ${formatValue(stockDepth, unitSystem === 'metric' ? 0 : 2)} ${stockUnit}`],
    ['Stock length', stockLengthAdequateText(metrics.stockLengthAdequate)],
    ['Stock cost', formatCurrency(metrics.stockCostEstimate)],
    ['Wall and floor panel cost', formatCurrency(metrics.panelCostEstimate)],
    ['Roof boarding cost', formatCurrency(metrics.roofBoardingCostEstimate)],
    ['Roof finish cost', formatCurrency(metrics.roofCostEstimate)],
    ['Shell estimate', formatCurrency(metrics.shellCostEstimate)],
  ];

  let y = 38;
  summaryRows.forEach(([label, value], index) => {
    const rowX = index % 2 === 0 ? 14 : 108;
    const valueX = rowX + 86;
    if (index % 2 === 0 && index > 0) {
      y += 8;
    }
    doc.setFontSize(9);
    doc.text(`${label}:`, rowX, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(value), valueX, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
  });

  y += 16;
  const sharedPlanScale = Math.min(
    70 / Math.max(inputs.groundWidth, metrics.loftDeckWidth, 1),
    42 / Math.max(metrics.groundFloorLength, metrics.loftDeckLength, 1),
  );
  addPdfPlan(doc, 'Ground floor plan', 14, y, inputs.groundWidth, metrics.groundFloorLength, metrics.groundHeadspaceWidth, metrics.enclosedShellLength, metrics.frontTerraceDepth, unitSystem, sharedPlanScale);
  addPdfPlan(doc, 'Loft plan', 105, y, metrics.loftDeckWidth, metrics.loftDeckLength, metrics.loftHeadspaceWidth, metrics.loftDeckLength, 0, unitSystem, sharedPlanScale);
  addPdfAnchorPlan(doc, 14, y + 78, inputs.groundWidth, inputs.groundLength, metrics.anchorPoints, metrics.anchorSpacingX, metrics.anchorSpacingY, unitSystem);
  doc.setFontSize(9);
  doc.text(`Rafter spacing ${formatLength(metrics.actualSpacing, unitSystem)} | Roof pitch ${formatValue(metrics.roofPitch, 1)} deg`, 105, y + 134);
  doc.text(`Facade glazing ${metrics.glazingLabel}`, 105, y + 140);

  addPdfRenderedViewsPage(doc, metrics, inputs);
  addPdfFramingSchematicPage(doc, metrics, inputs, unitSystem);
  addPdfApexDetail(doc, metrics, inputs, unitSystem);
  addPdfRoofWallDetail(doc, metrics, inputs, unitSystem);
  addPdfWallFloorDetail(doc, inputs, unitSystem);

  doc.save('a-frame-cabin-plan.pdf');
}

function DeferredNumberField({ fieldId, label, value, commitSignal, min, max, step = 0.1, suffix, disabled, onCommit, onDirtyChange }: DeferredNumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const hasMounted = useRef(false);

  useEffect(() => {
    setDraft(String(value));
    onDirtyChange(fieldId, false);
  }, [value]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    commitDraft();
  }, [commitSignal]);

  function commitDraft() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      onDirtyChange(fieldId, false);
      return;
    }
    const constrained = clamp(parsed, min ?? parsed, max ?? parsed);
    onDirtyChange(fieldId, false);
    onCommit(constrained);
  }

  return (
    <label>
      {label}
      <div className="deferred-input-row">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          disabled={disabled}
          onChange={(event) => {
            const nextDraft = event.target.value;
            setDraft(nextDraft);
            onDirtyChange(fieldId, nextDraft !== String(value));
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDraft();
              (event.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
        {suffix ? <span className="input-suffix">{suffix}</span> : null}
      </div>
    </label>
  );
}

function AdjustmentSlider({ label, valueLabel, helper, sliderValue, onSliderChange }: AdjustmentSliderProps) {
  return (
    <div className="slider-card">
      <div className="slider-meta">
        <div>
          <strong>{label}</strong>
          <span>{helper}</span>
        </div>
        <strong>{valueLabel}</strong>
      </div>
      <input type="range" min={-100} max={100} step={1} value={sliderValue} onChange={(event) => onSliderChange(Number(event.target.value))} />
    </div>
  );
}

function RangeSlider({ label, valueLabel, helper, sliderValue, min, max, step = 1, onSliderChange }: RangeSliderProps) {
  return (
    <div className="slider-card">
      <div className="slider-meta">
        <div>
          <strong>{label}</strong>
          <span>{helper}</span>
        </div>
        <strong>{valueLabel}</strong>
      </div>
      <input type="range" min={min} max={max} step={step} value={sliderValue} onChange={(event) => onSliderChange(Number(event.target.value))} />
    </div>
  );
}

function rotatePoint(point: Point3D, yaw: number, pitch: number): Point3D {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);

  const xzX = (point.x * cosYaw) - (point.z * sinYaw);
  const xzZ = (point.x * sinYaw) + (point.z * cosYaw);
  const yzY = (point.y * cosPitch) - (xzZ * sinPitch);
  const yzZ = (point.y * sinPitch) + (xzZ * cosPitch);

  return { x: xzX, y: yzY, z: yzZ };
}

function projectPoint(point: Point3D, yaw: number, pitch: number, cameraDistance: number): ProjectedPoint {
  const rotated = rotatePoint(point, yaw, pitch);
  const safeDistance = Math.max(cameraDistance, 1);
  const perspective = safeDistance / Math.max(rotated.z + safeDistance, safeDistance * 0.45);
  return {
    x: PREVIEW_CENTER_X + (rotated.x * perspective * 18),
    y: PREVIEW_CENTER_Y - (rotated.y * perspective * 18),
    z: rotated.z,
  };
}

function scaleProjectedPoint(point: ProjectedPoint, scale: number): ProjectedPoint {
  return {
    x: PREVIEW_CENTER_X + ((point.x - PREVIEW_CENTER_X) * scale),
    y: PREVIEW_CENTER_Y + ((point.y - PREVIEW_CENTER_Y) * scale),
    z: point.z,
  };
}

function polygonPoints(points: ProjectedPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const safeHex = normalized.length === 3
    ? normalized.split('').map((value) => `${value}${value}`).join('')
    : normalized;
  const red = Number.parseInt(safeHex.slice(0, 2), 16);
  const green = Number.parseInt(safeHex.slice(2, 4), 16);
  const blue = Number.parseInt(safeHex.slice(4, 6), 16);
  return [red, green, blue];
}

function getPlanFrame(length: number, width: number, maxDrawWidth: number, maxDrawHeight: number) {
  const safeLength = Math.max(length, 0.1);
  const safeWidth = Math.max(width, 0.1);
  const scale = Math.min(maxDrawWidth / safeLength, maxDrawHeight / safeWidth);
  const drawWidth = safeLength * scale;
  const drawHeight = safeWidth * scale;

  return {
    drawWidth,
    drawHeight,
    scale,
  };
}

function polygonArea(points: Point2D[]) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += (current.x * next.y) - (next.x * current.y);
  }
  return Math.abs(area) / 2;
}

function isFaceVisible(points: Point3D[], yaw: number, pitch: number, cameraDistance: number) {
  if (points.length < 3) {
    return false;
  }

  const [first, second, third] = points.slice(0, 3).map((point) => rotatePoint(point, yaw, pitch));
  const edgeA = { x: second.x - first.x, y: second.y - first.y, z: second.z - first.z };
  const edgeB = { x: third.x - first.x, y: third.y - first.y, z: third.z - first.z };
  const normal = {
    x: (edgeA.y * edgeB.z) - (edgeA.z * edgeB.y),
    y: (edgeA.z * edgeB.x) - (edgeA.x * edgeB.z),
    z: (edgeA.x * edgeB.y) - (edgeA.y * edgeB.x),
  };
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y, z: sum.z + point.z }), { x: 0, y: 0, z: 0 });
  const rotatedCenter = rotatePoint({ x: center.x / points.length, y: center.y / points.length, z: center.z / points.length }, yaw, pitch);
  const toCamera = { x: -rotatedCenter.x, y: -rotatedCenter.y, z: -cameraDistance - rotatedCenter.z };

  return ((normal.x * toCamera.x) + (normal.y * toCamera.y) + (normal.z * toCamera.z)) > 0;
}

function buildGlazingPreset(stage: number, width: number, totalHeight: number, sideWallHeight: number) {
  const normalizedStage = clamp(Math.round(stage), 0, 6);
  const halfWidth = width / 2;
  const doorWidth = clamp(width * 0.22, 0.8, 1.0);
  const doorHeight = clamp(Math.min(2.05, totalHeight - 0.35), 1.85, 2.05);
  const eyeSize = 0.18;
  const eyeCenterY = Math.min(1.52, doorHeight - 0.28);
  const jambInset = 0.08;
  const frontWallPolygon = [
    { x: -halfWidth, y: 0 },
    { x: -halfWidth, y: sideWallHeight },
    { x: 0, y: totalHeight },
    { x: halfWidth, y: sideWallHeight },
    { x: halfWidth, y: 0 },
  ];
  const frontLoftTriangle = [
    { x: -halfWidth, y: sideWallHeight },
    { x: 0, y: totalHeight - 0.02 },
    { x: halfWidth, y: sideWallHeight },
  ];
  const backLoftTriangle = frontLoftTriangle;
  const frontPolygons: Point2D[][] = [];
  const backPolygons: Point2D[][] = [];
  const doorGlassHeight = normalizedStage === 1 ? doorHeight * 0.66 : doorHeight;
  const doorGlassBottom = normalizedStage === 1 ? doorHeight - doorGlassHeight : 0;

  if (normalizedStage === 0) {
    frontPolygons.push([
      { x: -(eyeSize / 2), y: eyeCenterY - (eyeSize / 2) },
      { x: -(eyeSize / 2), y: eyeCenterY + (eyeSize / 2) },
      { x: eyeSize / 2, y: eyeCenterY + (eyeSize / 2) },
      { x: eyeSize / 2, y: eyeCenterY - (eyeSize / 2) },
    ]);
  }

  if (normalizedStage >= 1) {
    frontPolygons.push([
      { x: -(doorWidth / 2), y: doorGlassBottom },
      { x: -(doorWidth / 2), y: doorHeight },
      { x: doorWidth / 2, y: doorHeight },
      { x: doorWidth / 2, y: doorGlassBottom },
    ]);
  }
  if (normalizedStage >= 3) {
    frontPolygons.push(frontLoftTriangle);
  }
  if (normalizedStage >= 4) {
    frontPolygons.splice(0, frontPolygons.length, frontWallPolygon);
  }
  if (normalizedStage >= 5) {
    backPolygons.push(backLoftTriangle);
  }
  if (normalizedStage >= 6) {
    backPolygons.splice(0, backPolygons.length, frontWallPolygon);
  }

  const labels = [
    'Door eye',
    '2/3 glass door',
    'Full glass door',
    'Door plus full upper triangle',
    'Full front glazing',
    'Rear loft glazing',
    'Front and rear full glazing',
  ];

  const glassArea = [...frontPolygons, ...backPolygons].reduce((sum, polygon) => sum + polygonArea(polygon), 0);
  const totalEndWallArea = ((width * sideWallHeight) + (0.5 * width * Math.max(totalHeight - sideWallHeight, 0))) * 2;

  return {
    stage: normalizedStage,
    label: labels[normalizedStage],
    frontPolygons,
    backPolygons,
    glassArea,
    ratio: totalEndWallArea > 0 ? glassArea / totalEndWallArea : 0,
    doorHeight,
    doorWidth,
    doorInset: jambInset,
  };
}

function buildProjectedCabinScene({ width, totalHeight, sideWallHeight, cabinLength, glazingStage, loftFloorHeight, loftDeckWidth, loftDeckLength, balconyMargin, frontWallOffset, backWallOffset, includeLoft, includeBalcony, frameCount, actualSpacing, includeConcreteSlab, ladderOffset, ladderTopInset, ladderRun, yaw, pitch, scale = 1 }: { width: number; totalHeight: number; sideWallHeight: number; cabinLength: number; glazingStage: number; loftFloorHeight: number; loftDeckWidth: number; loftDeckLength: number; balconyMargin: number; frontWallOffset: number; backWallOffset: number; includeLoft: boolean; includeBalcony: boolean; frameCount: number; actualSpacing: number; includeConcreteSlab: boolean; ladderOffset: number; ladderTopInset: number; ladderRun: number; yaw: number; pitch: number; scale?: number }) {
  const halfWidth = Math.max(width / 2, 0.1);
  const halfLength = Math.max(cabinLength / 2, 0.1);
  const roofRise = Math.max(totalHeight, 0.6);
  const wallIntersectionX = sideWallHeight > 0
    ? halfWidth * clamp(1 - (sideWallHeight / Math.max(totalHeight, 0.001)), 0, 1)
    : halfWidth;
  const frontApex = { x: 0, y: totalHeight, z: -halfLength };
  const backApex = { x: 0, y: totalHeight, z: halfLength };
  const frontLeftBottom = { x: -halfWidth, y: 0, z: -halfLength };
  const frontRightBottom = { x: halfWidth, y: 0, z: -halfLength };
  const backFloorZ = halfLength - backWallOffset;
  const backLeftBottom = { x: -halfWidth, y: 0, z: backFloorZ };
  const backRightBottom = { x: halfWidth, y: 0, z: backFloorZ };
  const frontLeftKnee = { x: -wallIntersectionX, y: sideWallHeight, z: -halfLength };
  const frontRightKnee = { x: wallIntersectionX, y: sideWallHeight, z: -halfLength };
  const backLeftKnee = { x: -wallIntersectionX, y: sideWallHeight, z: halfLength };
  const backRightKnee = { x: wallIntersectionX, y: sideWallHeight, z: halfLength };
  const frontWallZ = -halfLength + frontWallOffset;
  const backWallZ = halfLength - backWallOffset;
  const frontWallLeftBase = { x: -wallIntersectionX, y: 0, z: frontWallZ };
  const frontWallRightBase = { x: wallIntersectionX, y: 0, z: frontWallZ };
  const frontWallLeftKnee = { x: -wallIntersectionX, y: sideWallHeight, z: frontWallZ };
  const frontWallRightKnee = { x: wallIntersectionX, y: sideWallHeight, z: frontWallZ };
  const frontWallApex = { x: 0, y: totalHeight, z: frontWallZ };
  const backWallLeftBase = { x: -wallIntersectionX, y: 0, z: backWallZ };
  const backWallRightBase = { x: wallIntersectionX, y: 0, z: backWallZ };
  const backWallLeftKnee = { x: -wallIntersectionX, y: sideWallHeight, z: backWallZ };
  const backWallRightKnee = { x: wallIntersectionX, y: sideWallHeight, z: backWallZ };
  const backWallApex = { x: 0, y: totalHeight, z: backWallZ };
  const loftHalfWidth = Math.max(loftDeckWidth / 2, 0.08);
  const loftFrontZ = frontWallZ + balconyMargin;
  const loftRearZ = backWallZ;
  const glazingPreset = buildGlazingPreset(glazingStage, width, totalHeight, sideWallHeight);
  const maxDimension = Math.max(width, cabinLength, totalHeight, 2.8);
  const cameraDistance = (maxDimension * 4.6) + 18;
  const projectScenePoint = (point: Point3D) => scaleProjectedPoint(projectPoint(point, yaw, pitch, cameraDistance), scale);

  const faces = [
    { fill: '#7a553a', stroke: '#4e3321', points: [frontLeftBottom, frontRightBottom, backRightBottom, backLeftBottom] },
    { fill: '#b77a47', stroke: '#6c4224', points: [frontLeftBottom, frontLeftKnee, frontApex, backApex, backLeftKnee, backLeftBottom] },
    { fill: '#8d522a', stroke: '#5d3419', points: [frontRightBottom, frontRightKnee, frontApex, backApex, backRightKnee, backRightBottom] },
    { fill: '#d6bb93', stroke: '#6c4526', points: [frontWallLeftBase, frontWallLeftKnee, frontWallApex, frontWallRightKnee, frontWallRightBase] },
    { fill: '#d9c6a5', stroke: '#6c4526', points: [backWallLeftBase, backWallLeftKnee, backWallApex, backWallRightKnee, backWallRightBase] },
  ].map((face) => {
    const projected = face.points.map((point) => projectScenePoint(point));
    const depth = projected.reduce((sum, point) => sum + point.z, 0) / projected.length;
    return { ...face, projected, depth };
  }).sort((left, right) => left.depth - right.depth);

  const frontWoodFace = [frontWallLeftBase, frontWallLeftKnee, frontWallApex, frontWallRightKnee, frontWallRightBase].map((point) => projectScenePoint({ ...point, z: frontWallZ + 0.005 }));
  const frontWallFace = [frontWallLeftBase, frontWallLeftKnee, frontWallApex, frontWallRightKnee, frontWallRightBase];
  const backWallFace = [backWallRightBase, backWallRightKnee, backWallApex, backWallLeftKnee, backWallLeftBase];
  const showFrontGlazing = isFaceVisible(frontWallFace, yaw, pitch, cameraDistance);
  const showBackGlazing = isFaceVisible(backWallFace, yaw, pitch, cameraDistance);
  const frontGlazingPolygons = glazingPreset.frontPolygons.map((polygon) => polygon.map((point) => projectScenePoint({ x: point.x, y: point.y, z: frontWallZ + 0.01 })));
  const backGlazingPolygons = glazingPreset.backPolygons.map((polygon) => polygon.map((point) => projectScenePoint({ x: point.x, y: point.y, z: backWallZ + 0.01 })));
  const doorPolygon = [
    { x: -(glazingPreset.doorWidth / 2), y: 0, z: frontWallZ + 0.02 },
    { x: -(glazingPreset.doorWidth / 2), y: glazingPreset.doorHeight, z: frontWallZ + 0.02 },
    { x: glazingPreset.doorWidth / 2, y: glazingPreset.doorHeight, z: frontWallZ + 0.02 },
    { x: glazingPreset.doorWidth / 2, y: 0, z: frontWallZ + 0.02 },
  ].map((point) => projectScenePoint(point));
  const doorGlassPolygon = [
    { x: -(glazingPreset.doorWidth / 2) + glazingPreset.doorInset, y: glazingPreset.doorInset, z: frontWallZ + 0.025 },
    { x: -(glazingPreset.doorWidth / 2) + glazingPreset.doorInset, y: glazingPreset.doorHeight - glazingPreset.doorInset, z: frontWallZ + 0.025 },
    { x: (glazingPreset.doorWidth / 2) - glazingPreset.doorInset, y: glazingPreset.doorHeight - glazingPreset.doorInset, z: frontWallZ + 0.025 },
    { x: (glazingPreset.doorWidth / 2) - glazingPreset.doorInset, y: glazingPreset.doorInset, z: frontWallZ + 0.025 },
  ].map((point) => projectScenePoint(point));
  const loftPolygon = includeLoft && loftDeckWidth > 0 && loftDeckLength > 0.2
    ? [
      { x: -loftHalfWidth, y: loftFloorHeight, z: loftFrontZ },
      { x: loftHalfWidth, y: loftFloorHeight, z: loftFrontZ },
      { x: loftHalfWidth, y: loftFloorHeight, z: loftRearZ },
      { x: -loftHalfWidth, y: loftFloorHeight, z: loftRearZ },
    ].map((point) => projectScenePoint(point))
    : null;
  const loftEdgeLines = includeLoft && loftDeckWidth > 0 && loftDeckLength > 0.2
    ? [
      [{ x: -loftHalfWidth, y: loftFloorHeight, z: loftFrontZ }, { x: -loftHalfWidth, y: 0, z: loftFrontZ }],
      [{ x: loftHalfWidth, y: loftFloorHeight, z: loftFrontZ }, { x: loftHalfWidth, y: 0, z: loftFrontZ }],
      [{ x: -loftHalfWidth, y: loftFloorHeight, z: loftRearZ }, { x: loftHalfWidth, y: loftFloorHeight, z: loftRearZ }],
    ].map((line) => line.map((point) => projectScenePoint(point)))
    : [];
  const railingLayout = includeLoft && includeBalcony && loftDeckWidth > 0 && loftDeckLength > 0.2
    ? buildFrontRailingLayout(loftDeckWidth, actualSpacing, true)
    : { segments: [], postXs: [], totalRailLength: 0, totalPostLength: 0 };
  const railingLines = includeLoft && includeBalcony && loftDeckWidth > 0 && loftDeckLength > 0.2
    ? [
      ...railingLayout.segments.map((segment) => ([{ x: segment.startX, y: loftFloorHeight + 0.92, z: loftFrontZ }, { x: segment.endX, y: loftFloorHeight + 0.92, z: loftFrontZ }])),
      ...railingLayout.postXs.map((x) => ([{ x, y: loftFloorHeight, z: loftFrontZ }, { x, y: loftFloorHeight + 0.92, z: loftFrontZ }])),
    ].map((line) => line.map((point) => projectScenePoint(point)))
    : [];
  const ladderTopZ = includeBalcony
    ? loftFrontZ
    : loftFrontZ + Math.min(Math.max(ladderOffset + ladderTopInset, 0.2), Math.max(loftDeckLength, 0.2));
  const ladderBaseZ = Math.max(frontWallZ + 0.18, ladderTopZ - Math.max(ladderRun, 0.8));
  const ladderRailZAtHeight = (heightRatio: number) => ladderBaseZ + ((ladderTopZ - ladderBaseZ) * heightRatio);
  const ladderLines = includeLoft
    ? [
      [{ x: -0.22, y: 0, z: ladderBaseZ }, { x: -0.22, y: loftFloorHeight, z: ladderTopZ }],
      [{ x: 0.22, y: 0, z: ladderBaseZ }, { x: 0.22, y: loftFloorHeight, z: ladderTopZ }],
      [{ x: -0.22, y: loftFloorHeight * 0.3, z: ladderRailZAtHeight(0.3) }, { x: 0.22, y: loftFloorHeight * 0.3, z: ladderRailZAtHeight(0.3) }],
      [{ x: -0.22, y: loftFloorHeight * 0.55, z: ladderRailZAtHeight(0.55) }, { x: 0.22, y: loftFloorHeight * 0.55, z: ladderRailZAtHeight(0.55) }],
      [{ x: -0.22, y: loftFloorHeight * 0.8, z: ladderRailZAtHeight(0.8) }, { x: 0.22, y: loftFloorHeight * 0.8, z: ladderRailZAtHeight(0.8) }],
    ].map((line) => line.map((point) => projectScenePoint(point)))
    : [];
  const frameZPositions = Array.from({ length: frameCount }, (_, index) => (-halfLength + (actualSpacing * index)));
  const rafterLines = frameZPositions.flatMap((zPosition) => {
    const leftBase = { x: -halfWidth, y: 0, z: zPosition };
    const rightBase = { x: halfWidth, y: 0, z: zPosition };
    const apex = { x: 0, y: totalHeight, z: zPosition };
    return [[leftBase, apex], [apex, rightBase], [leftBase, rightBase]].map((line) => line.map((point) => projectScenePoint(point)));
  });
  const floorStructureLines = !includeConcreteSlab
    ? [[frontLeftBottom, backLeftBottom], [frontRightBottom, backRightBottom], ...frameZPositions.flatMap((zPosition) => {
      const leftBase = { x: -halfWidth, y: 0, z: zPosition };
      const rightBase = { x: halfWidth, y: 0, z: zPosition };
      const leftWallBase = { x: -wallIntersectionX, y: 0, z: zPosition };
      const leftWallTop = { x: -wallIntersectionX, y: sideWallHeight, z: zPosition };
      const rightWallBase = { x: wallIntersectionX, y: 0, z: zPosition };
      const rightWallTop = { x: wallIntersectionX, y: sideWallHeight, z: zPosition };
      return [[leftBase, rightBase], ...(sideWallHeight > 0 ? [[leftWallBase, leftWallTop], [rightWallBase, rightWallTop]] : [])];
    })].map((line) => line.map((point) => projectScenePoint(point)))
    : [];
  const allProjectedPoints = [
    ...faces.flatMap((face) => face.projected),
    ...frontWoodFace,
    ...(loftPolygon ?? []),
    ...doorPolygon,
    ...doorGlassPolygon,
    ...frontGlazingPolygons.flat(),
    ...backGlazingPolygons.flat(),
    ...loftEdgeLines.flat(),
    ...railingLines.flat(),
    ...ladderLines.flat(),
    ...rafterLines.flat(),
    ...floorStructureLines.flat(),
  ];

  return {
    roofRise,
    faces,
    frontWoodFace,
    showFrontGlazing,
    showBackGlazing,
    frontGlazingPolygons,
    backGlazingPolygons,
    doorPolygon,
    doorGlassPolygon,
    loftPolygon,
    loftEdgeLines,
    railingLines,
    ladderLines,
    rafterLines,
    floorStructureLines,
    allProjectedPoints,
  };
}

function InteractiveCabinPreview({ width, totalHeight, sideWallHeight, cabinLength, glazingStage, loftFloorHeight, loftDeckWidth, loftDeckLength, balconyMargin, frontWallOffset, backWallOffset, includeLoft, includeBalcony, frameCount, actualSpacing, includeConcreteSlab, ladderOffset, ladderTopInset, ladderRun }: { width: number; totalHeight: number; sideWallHeight: number; cabinLength: number; glazingStage: number; loftFloorHeight: number; loftDeckWidth: number; loftDeckLength: number; balconyMargin: number; frontWallOffset: number; backWallOffset: number; includeLoft: boolean; includeBalcony: boolean; frameCount: number; actualSpacing: number; includeConcreteSlab: boolean; ladderOffset: number; ladderTopInset: number; ladderRun: number }) {
  const defaultYaw = -0.72;
  const defaultPitch = 0.28;
  const defaultZoom = 16;
  const [yaw, setYaw] = useState(defaultYaw);
  const [pitch, setPitch] = useState(defaultPitch);
  const [zoom, setZoom] = useState(defaultZoom);
  const [dragState, setDragState] = useState<DragState>({ active: false, lastX: 0, lastY: 0 });
  const roofRise = Math.max(totalHeight - sideWallHeight, 0.6);
  const maxDimension = Math.max(width, cabinLength, totalHeight, 2.8);
  const fitScale = clamp(2.4 / maxDimension, 0.22, 0.72);
  const sceneScale = fitScale * zoom * 0.32;
  const scene = buildProjectedCabinScene({ width, totalHeight, sideWallHeight, cabinLength, glazingStage, loftFloorHeight, loftDeckWidth, loftDeckLength, balconyMargin, frontWallOffset, backWallOffset, includeLoft, includeBalcony, frameCount, actualSpacing, includeConcreteSlab, ladderOffset, ladderTopInset, ladderRun, yaw, pitch, scale: sceneScale });

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ active: true, lastX: event.clientX, lastY: event.clientY });
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragState.active) {
      return;
    }
    const dx = event.clientX - dragState.lastX;
    const dy = event.clientY - dragState.lastY;
    setYaw((current) => current + (dx * 0.01));
    setPitch((current) => clamp(current - (dy * 0.01), -0.55, 0.55));
    setDragState({ active: true, lastX: event.clientX, lastY: event.clientY });
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragState((current) => ({ ...current, active: false }));
  }

  function stepZoom(delta: number) {
    setZoom((current) => clamp(current + delta, 4, 16));
  }

  return (
    <div>
      <div className="preview-header-actions">
        <span className="panel-note">Drag to orbit. Use the buttons to zoom in and out.</span>
        <div className="preview-button-group">
          <button type="button" className="ghost-button" onClick={() => stepZoom(-1)} aria-label="Zoom out preview">
            -
          </button>
          <button type="button" className="ghost-button" onClick={() => stepZoom(1)} aria-label="Zoom in preview">
            +
          </button>
          <button type="button" className="ghost-button" onClick={() => { setYaw(defaultYaw); setPitch(defaultPitch); setZoom(defaultZoom); }}>
            Reset view
          </button>
        </div>
      </div>
      <svg
        viewBox="0 0 420 320"
        className="render-canvas interactive-canvas"
        role="img"
        aria-label="Interactive 3D preview of the A-frame cabin shell"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setDragState((current) => ({ ...current, active: false }))}
      >
        <rect x="0" y="0" width="420" height="320" rx="24" fill="rgba(255,252,246,0.25)" />
        {scene.faces.map((face, index) => (
          <polygon key={`${face.fill}-${index}`} points={polygonPoints(face.projected)} fill={face.fill} stroke={face.stroke} strokeWidth="2.4" />
        ))}
        {scene.floorStructureLines.map((line, index) => (
          <line
            key={`floor-line-${index}`}
            x1={line[0].x}
            y1={line[0].y}
            x2={line[1].x}
            y2={line[1].y}
            stroke="#5f452f"
            strokeWidth="1.5"
            opacity="0.9"
          />
        ))}
        {scene.rafterLines.map((line, index) => (
          <line
            key={`rafter-line-${index}`}
            x1={line[0].x}
            y1={line[0].y}
            x2={line[1].x}
            y2={line[1].y}
            stroke="#f8e0b8"
            strokeWidth="1.35"
            opacity="0.95"
          />
        ))}
        {scene.railingLines.map((line, index) => (
          <line
            key={`railing-line-${index}`}
            x1={line[0].x}
            y1={line[0].y}
            x2={line[1].x}
            y2={line[1].y}
            stroke="#d8c4a2"
            strokeWidth="1.8"
            opacity="0.95"
          />
        ))}
        {scene.ladderLines.map((line, index) => (
          <line
            key={`ladder-line-${index}`}
            x1={line[0].x}
            y1={line[0].y}
            x2={line[1].x}
            y2={line[1].y}
            stroke="#ecd6b4"
            strokeWidth="1.6"
            opacity="0.95"
          />
        ))}
        <polygon points={polygonPoints(scene.frontWoodFace)} fill="rgba(214, 187, 147, 0.88)" stroke="rgba(108, 69, 38, 0.35)" strokeWidth="1.2" />
        {scene.loftPolygon ? <polygon points={polygonPoints(scene.loftPolygon)} fill="rgba(241, 214, 161, 0.82)" stroke="#7f5d3b" strokeWidth="2" /> : null}
        <polygon points={polygonPoints(scene.doorPolygon)} fill="rgba(120, 86, 53, 0.22)" stroke="#2f1f14" strokeWidth="1.8" />
        <polygon points={polygonPoints(scene.doorGlassPolygon)} fill="none" stroke="rgba(47, 31, 20, 0.45)" strokeWidth="1.1" />
        {scene.loftEdgeLines.map((line, index) => (
          <line
            key={`loft-line-${index}`}
            x1={line[0].x}
            y1={line[0].y}
            x2={line[1].x}
            y2={line[1].y}
            stroke="#7f5d3b"
            strokeWidth="1.8"
            strokeDasharray={index < 2 ? '4 5' : undefined}
          />
        ))}
        {scene.showBackGlazing ? scene.backGlazingPolygons.map((polygon, index) => (
          <polygon key={`back-glass-${index}`} points={polygonPoints(polygon)} fill="rgba(124, 196, 216, 0.34)" stroke="#1f5f75" strokeWidth="1.4" />
        )) : null}
        {scene.showFrontGlazing ? scene.frontGlazingPolygons.map((polygon, index) => (
          <polygon key={`front-glass-${index}`} points={polygonPoints(polygon)} fill="rgba(124, 196, 216, 0.68)" stroke="#1f5f75" strokeWidth="2" />
        )) : null}
        <text x="20" y="284">Width {formatValue(width, 2)}</text>
        <text x="156" y="284">Length {formatValue(cabinLength, 2)}</text>
        <text x="290" y="284">Height {formatValue(totalHeight, 2)}</text>
        <text x="20" y="302">Roof rise {formatValue(roofRise, 2)}</text>
        <text x="150" y="302">Frames {frameCount}</text>
      </svg>
    </div>
  );
}

function FloorPlan({ title, areaLabel, width, length, loftWidth, loftLength, loftOffsetY, openingLength, openingWidth, openingOffsetY, openingLabel, openingMarkerOnly, headspaceAreaLabel, unit }: { title: string; areaLabel: string; width: number; length: number; loftWidth: number; loftLength: number; loftOffsetY: number; openingLength: number; openingWidth: number; openingOffsetY: number; openingLabel?: string; openingMarkerOnly?: boolean; headspaceAreaLabel?: string; unit: UnitSystem }) {
  const hasPlan = width > 0.05 && length > 0.05;
  const outerX = 24;
  const outerY = 30;
  const maxDrawWidth = 312;
  const maxDrawHeight = 168;
  const planFrame = getPlanFrame(length, width, maxDrawWidth, maxDrawHeight);
  const planX = outerX + ((maxDrawWidth - planFrame.drawWidth) / 2);
  const planY = outerY + ((maxDrawHeight - planFrame.drawHeight) / 2);
  const loftVisualWidth = loftLength * planFrame.scale;
  const loftVisualHeight = loftWidth * planFrame.scale;
  const loftX = planX + (loftOffsetY * planFrame.scale);
  const loftY = planY + ((planFrame.drawHeight - loftVisualHeight) / 2);
  const openingVisualWidth = openingLength * planFrame.scale;
  const openingVisualHeight = openingWidth * planFrame.scale;
  const openingX = planX + (openingOffsetY * planFrame.scale);
  const openingY = planY + ((planFrame.drawHeight - openingVisualHeight) / 2);
  const headspaceLabelX = Math.min(loftX + loftVisualWidth + 12, 346);
  const headspaceLabelY = planY + (planFrame.drawHeight / 2);

  return (
    <div className="visual-card">
      <div className="visual-header">
        <h3>{title}</h3>
        <span>{areaLabel}</span>
      </div>
      <svg viewBox="0 0 360 230" className="plan-canvas" role="img" aria-label={`${title} floor plan`}>
        {hasPlan ? (
          <>
            <rect x={planX} y={planY} width={planFrame.drawWidth} height={planFrame.drawHeight} fill="#f6ede1" stroke="#6f5134" strokeWidth="3" />
            {loftWidth > 0 && loftLength > 0 ? <rect x={loftX} y={loftY} width={loftVisualWidth} height={loftVisualHeight} fill="none" stroke="#7f5d3b" strokeWidth="2" strokeDasharray="6 6" /> : null}
            {openingLength > 0 && openingWidth > 0 ? (
              <>
                <rect x={openingX} y={openingY} width={openingVisualWidth} height={openingVisualHeight} fill={openingMarkerOnly ? "none" : "#fffaf0"} stroke="#1f5f75" strokeWidth="2" strokeDasharray="6 4" />
                <text x={openingX + (openingVisualWidth / 2)} y={openingY + (openingVisualHeight / 2) + 3} textAnchor="middle" fontSize="9">{openingLabel ?? 'Ladder'}</text>
              </>
            ) : null}
            {loftWidth > 0 && loftLength > 0 ? (
              <>
                <text x="180" y="18" textAnchor="middle" fontSize="10">1.7 m headspace area {headspaceAreaLabel ?? formatArea(loftWidth * loftLength, unit)} (- - - -)</text>
                <text x={headspaceLabelX} y={headspaceLabelY} transform={`rotate(-90 ${headspaceLabelX} ${headspaceLabelY})`} textAnchor="middle" fontSize="10">Headspace width {formatLength(loftWidth, unit)}</text>
              </>
            ) : null}
            <text x="180" y="222" textAnchor="middle">Length {formatLength(length, unit)}</text>
            <text x="14" y="118" transform="rotate(-90 14 118)" textAnchor="middle">Width {formatLength(width, unit)}</text>
          </>
        ) : (
          <text x="180" y="118" textAnchor="middle">No loft enabled</text>
        )}
      </svg>
    </div>
  );
}

function AnchorPlan({ length, width, anchorPoints, anchorSpacingX, anchorSpacingY, unit }: { length: number; width: number; anchorPoints: { x: number; y: number }[]; anchorSpacingX: number; anchorSpacingY: number; unit: UnitSystem }) {
  const outerX = 34;
  const outerY = 44;
  const maxDrawWidth = 292;
  const maxDrawHeight = 142;
  const planFrame = getPlanFrame(length, width, maxDrawWidth, maxDrawHeight);
  const planX = outerX + ((maxDrawWidth - planFrame.drawWidth) / 2);
  const planY = outerY + ((maxDrawHeight - planFrame.drawHeight) / 2);

  return (
    <div className="visual-card">
      <div className="visual-header">
        <h3>Ground anchor layout</h3>
        <span>{anchorPoints.length} anchors</span>
      </div>
      <svg viewBox="0 0 360 230" className="plan-canvas" role="img" aria-label="Ground anchor layout">
        <rect x={planX} y={planY} width={planFrame.drawWidth} height={planFrame.drawHeight} fill="#f3eadf" stroke="#5c4430" strokeWidth="3" />
        {anchorPoints.map((anchorPoint, index) => {
          const x = planX + ((length > 0 ? anchorPoint.y / length : 0) * planFrame.drawWidth);
          const y = planY + ((width > 0 ? anchorPoint.x / width : 0) * planFrame.drawHeight);
          return (
            <g key={`${anchorPoint.x}-${anchorPoint.y}-${index}`}>
              <circle cx={x} cy={y} r="5.3" fill="#1f5f75" />
            </g>
          );
        })}
        <text x="180" y="218" textAnchor="middle">Length {formatLength(length, unit)}</text>
        <text x="20" y="118" transform="rotate(-90 20 118)" textAnchor="middle">Width {formatLength(width, unit)}</text>
        <text x={planX + (planFrame.drawWidth / 2)} y="30" textAnchor="middle">Grid {formatLength(anchorSpacingY, unit)} x {formatLength(anchorSpacingX, unit)}</text>
      </svg>
    </div>
  );
}

export default function App() {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAdvancedCosts, setShowAdvancedCosts] = useState(false);
  const [commitSignal, setCommitSignal] = useState(0);
  const [dirtyFields, setDirtyFields] = useState<string[]>([]);
  const [inputs, setInputs] = useState<PlannerInputs>(defaultInputs);
  const [sliderOffsets, setSliderOffsets] = useState<SliderOffsets>(defaultSliderOffsets);

  const groundArea = inputs.groundWidth * inputs.groundLength;
  const recommendedSideWallHeight = inputs.includeSideWall
    ? inputs.sideWallBaseHeight
    : 0;
  const recommendedLoftFloorHeight = inputs.includeLoft ? 2.2 : 0;
  const recommendedTotalHeight = inputs.includeLoft
    ? Math.max(recommendedLoftFloorHeight + inputs.minimumLoftHeadroom + 0.55, inputs.groundWidth * 0.62)
    : inputs.totalHeightBase;
  const recommendedSpacing = 0.6;
  const anchorSpacingMin = inputs.includeConcreteSlab ? 1.5 : 1;
  const anchorSpacingMax = inputs.includeConcreteSlab ? 2.5 : 1.5;

  const totalHeight = scaleFromRecommendation(recommendedTotalHeight, sliderOffsets.totalHeight, inputs.includeLoft ? inputs.minimumLoftHeadroom + 1.4 : 2.6, 12);
  const sideWallHeight = inputs.includeSideWall
    ? scaleFromRecommendation(recommendedSideWallHeight, sliderOffsets.sideWallHeight, 0, Math.max(totalHeight - 0.6, 0.1))
    : 0;
  const maxLoftFloorHeight = Math.max(totalHeight - inputs.minimumLoftHeadroom - 0.3, 2.0);
  const loftFloorBaseHeight = Math.min(recommendedLoftFloorHeight, maxLoftFloorHeight);
  const loftFloorHeight = inputs.includeLoft
    ? clamp(loftFloorBaseHeight + ((sliderOffsets.loftFloorHeight / 100) * (loftFloorBaseHeight * 0.3)), 2.0, maxLoftFloorHeight)
    : 0;
  const rafterSpacing = scaleFromRecommendation(recommendedSpacing, sliderOffsets.rafterSpacing, 0.3, 1);
  const glazingStage = clamp(Math.round(sliderOffsets.glazingRatio), 0, 6);
  const roofRise = Math.max(totalHeight, 0.6);
  const wallCapRise = Math.max(totalHeight - sideWallHeight, 0.6);
  const halfSpan = inputs.groundWidth / 2;
  const rafterLength = Math.sqrt((halfSpan * halfSpan) + (roofRise * roofRise));
  const fullRafterLength = Math.sqrt((halfSpan * halfSpan) + (totalHeight * totalHeight));
  const roofPitch = Math.atan2(roofRise, Math.max(halfSpan, 0.001)) * (180 / Math.PI);
  const frameCount = Math.max(2, Math.floor(inputs.groundLength / Math.max(rafterSpacing, 0.2)) + 1);
  const rafterCount = frameCount * 2;
  const bayCount = Math.max(frameCount - 1, 1);
  const actualSpacing = inputs.groundLength / bayCount;
  const frontTerraceDepth = (2 + sliderOffsets.frontTerraceBays) * actualSpacing;
  const backRecessDepth = actualSpacing;
  const enclosedShellLength = Math.max(inputs.groundLength - frontTerraceDepth - backRecessDepth, actualSpacing * 2);
  const groundFloorLength = Math.max(inputs.groundLength - backRecessDepth, actualSpacing * 2);
  const balconyMargin = inputs.includeLoft && inputs.includeBalcony ? 3 * actualSpacing : 0;
  const groundHeadspaceWidth = inputs.groundWidth * clamp(1 - (1.7 / roofRise), 0, 1);
  const loftDeckWidth = inputs.includeLoft
    ? inputs.groundWidth * clamp(1 - (loftFloorHeight / roofRise), 0, 1)
    : 0;
  const loftHeadspaceWidth = inputs.includeLoft
    ? inputs.groundWidth * clamp(1 - ((loftFloorHeight + 1.7) / roofRise), 0, 1)
    : 0;
  const loftUsableWidth = inputs.includeLoft
    ? inputs.groundWidth * clamp(1 - ((loftFloorHeight + inputs.minimumLoftHeadroom) / roofRise), 0, 1)
    : 0;
  const loftDeckLength = inputs.includeLoft ? Math.max(enclosedShellLength - balconyMargin, 0.6) : 0;
  const groundHeadspaceArea = groundHeadspaceWidth * enclosedShellLength;
  const loftHeadspaceArea = loftHeadspaceWidth * loftDeckLength;
  const loftArea = loftUsableWidth * loftDeckLength;
  const ladderFootprintLength = inputs.includeLoft ? Math.max(loftFloorHeight / Math.tan((LADDER_ANGLE_DEGREES * Math.PI) / 180), 0.2) : 0;
  const ladderOpeningLength = inputs.includeLoft ? Math.min(1.2, Math.max(loftDeckLength - 0.2, 0.4)) : 0;
  const ladderOpeningWidth = inputs.includeLoft ? Math.min(0.7, Math.max(loftDeckWidth - 0.2, 0.4)) : 0;
  const ladderOpeningMaxOffset = Math.max(loftDeckLength - ladderOpeningLength, 0);
  const ladderOpeningOffset = inputs.includeLoft
    ? (inputs.includeBalcony
      ? 0
      : Math.min(
        Math.round((((ladderOpeningMaxOffset * sliderOffsets.ladderPosition) / 100) / Math.max(actualSpacing, 0.01))) * actualSpacing,
        ladderOpeningMaxOffset,
      ))
    : 0;
  const ladderTopOffset = inputs.includeBalcony
    ? balconyMargin
    : balconyMargin + ladderOpeningOffset + ladderOpeningLength;
  const groundLadderMarkerOffset = Math.max(ladderTopOffset - ladderFootprintLength, 0);
  const loftHoleLength = inputs.includeBalcony ? 0 : ladderOpeningLength;
  const loftHoleWidth = inputs.includeBalcony ? 0 : ladderOpeningWidth;
  const railingSectionArea = 0.045 * 0.095;
  const railingLayout = inputs.includeLoft && inputs.includeBalcony
    ? buildFrontRailingLayout(loftDeckWidth, actualSpacing, true)
    : { segments: [], postXs: [], totalRailLength: 0, totalPostLength: 0 };
  const railingVolume = inputs.includeLoft && inputs.includeBalcony
    ? ((railingLayout.totalRailLength + railingLayout.totalPostLength) * railingSectionArea)
    : 0;
  const roofSurfaceArea = 2 * rafterLength * enclosedShellLength;
  const sideWallArea = 2 * enclosedShellLength * sideWallHeight;
  const endWallArea = ((inputs.groundWidth * sideWallHeight) + (0.5 * inputs.groundWidth * wallCapRise)) * 2;
  const glazingPreset = buildGlazingPreset(glazingStage, inputs.groundWidth, totalHeight, sideWallHeight);
  const glassArea = glazingPreset.glassArea;
  const glazingRatio = glazingPreset.ratio;
  const wallCladdingArea = roofSurfaceArea + sideWallArea + Math.max(endWallArea - glassArea, 0);
  const floorBoardingArea = (inputs.groundWidth * groundFloorLength) + (inputs.includeLoft ? loftDeckWidth * loftDeckLength : 0);
  const panelArea = sideWallArea + Math.max(endWallArea - glassArea, 0) + floorBoardingArea;
  const roofBoardingVolume = roofSurfaceArea * inputs.roofBoardingThickness;

  const recommendedSection = getRecommendedSection(rafterLength, actualSpacing);
  const availableSectionArea = inputs.availableWoodWidth * inputs.availableWoodDepth;
  const availableCapacity = getSectionCapacity(inputs.availableWoodWidth, inputs.availableWoodDepth);
  const recommendedCapacity = getSectionCapacity(recommendedSection.width, recommendedSection.depth);
  const availableSectionAdequate = availableCapacity >= recommendedCapacity;
  const stockLengthAdequate = inputs.availableWoodLength >= rafterLength;
  const apexScrewLengthMm = Math.max(Math.round((((inputs.availableWoodDepth * 1000) * 2) - 5) / 5) * 5, 30);
  const apexScrewDiameterMm = clamp(Math.round((inputs.availableWoodDepth * 1000) / 25), 5, 10);
  const apexScrewCount = frameCount;
  const roofWallScrewLengthMm = Math.max(Math.round((((inputs.availableWoodWidth * 1000) * 2) - 5) / 5) * 5, 25);
  const roofWallScrewCount = rafterCount;
  const wallFloorScrewLengthMm = Math.max(Math.round(((inputs.availableWoodWidth * 1000) - 5) / 5) * 5, 25);
  const wallFloorScrewCount = rafterCount * 4;

  const rafterVolume = frameCount * 2 * rafterLength * availableSectionArea;
  const floorAxisGrid = buildGridAxis(inputs.groundLength, anchorSpacingMin, anchorSpacingMax);
  const widthAxisGrid = buildGridAxis(inputs.groundWidth, anchorSpacingMin, anchorSpacingMax);
  const floorAxis = floorAxisGrid.positions;
  const widthAxis = widthAxisGrid.positions;
  const anchorPoints = floorAxis.flatMap((y) => widthAxis.map((x) => ({ x, y })));
  const floorJoistCount = frameCount;
  const connectorRows = Math.max(1, Math.ceil(inputs.groundLength / 2));
  const connectorBraceCount = connectorRows * 2;
  const perimeterBeamCount = inputs.includeConcreteSlab ? 0 : 4;
  const floorJoistVolume = frameCount * inputs.groundWidth * availableSectionArea;
  const connectorBraceVolume = connectorBraceCount * actualSpacing * availableSectionArea;
  const perimeterBeamVolume = inputs.includeConcreteSlab ? 0 : ((inputs.groundLength * 2) + (inputs.groundWidth * 2)) * availableSectionArea;
  const totalWoodVolume = rafterVolume + floorJoistVolume + connectorBraceVolume + perimeterBeamVolume + railingVolume;
  const stockPieceCount = Math.max(1, Math.ceil(totalWoodVolume / Math.max(availableSectionArea * inputs.availableWoodLength, 0.0001)));

  const stockCostEstimate = stockPieceCount * inputs.stockCostPerPiece;
  const panelCostEstimate = panelArea * inputs.panelCostPerSquare;
  const roofBoardingCostEstimate = roofBoardingVolume * inputs.woodCostPerCubic;
  const roofCostEstimate = roofSurfaceArea * inputs.roofCostPerSquare;
  const shellCostEstimate = stockCostEstimate + panelCostEstimate + roofBoardingCostEstimate + roofCostEstimate;
  const metrics: PlannerMetrics = {
    groundArea,
    groundHeadspaceArea,
    floorBoardingArea,
    groundFloorLength,
    enclosedShellLength,
    groundHeadspaceWidth,
    frontTerraceDepth,
    totalHeight,
    sideWallHeight,
    loftFloorHeight,
    rafterSpacing,
    anchorSpacingX: widthAxisGrid.spacing,
    anchorSpacingY: floorAxisGrid.spacing,
    glazingStage,
    glazingLabel: glazingPreset.label,
    glazingRatio,
    roofRise,
    rafterLength,
    fullRafterLength,
    roofPitch,
    frameCount,
    rafterCount,
    floorJoistCount,
    connectorBraceCount,
    perimeterBeamCount,
    stockPieceCount,
    actualSpacing,
    loftDeckWidth,
    loftHeadspaceWidth,
    loftUsableWidth,
    loftDeckLength,
    balconyMargin,
    loftArea,
    loftHeadspaceArea,
    roofSurfaceArea,
    sideWallArea,
    endWallArea,
    glassArea,
    panelArea,
    wallCladdingArea,
    roofBoardingVolume,
    totalWoodVolume,
    apexScrewLengthMm,
    apexScrewDiameterMm,
    apexScrewCount,
    roofWallScrewLengthMm,
    roofWallScrewCount,
    wallFloorScrewLengthMm,
    wallFloorScrewCount,
    stockCostEstimate,
    panelCostEstimate,
    roofBoardingCostEstimate,
    roofCostEstimate,
    shellCostEstimate,
    recommendedSection,
    availableSectionAdequate,
    stockLengthAdequate,
    anchorPoints,
  };

  function handleExportPdf() {
    exportPdf(inputs, metrics, unitSystem);
  }

  function handleExportDxf() {
    const dxf = buildDxf(inputs, metrics, unitSystem);
    downloadFile(dxf, 'a-frame-cabin-plan.dxf', 'application/dxf');
  }

  function handleCalculate() {
    setCommitSignal((current) => current + 1);
  }

  function handleDirtyChange(fieldId: string, isDirty: boolean) {
    setDirtyFields((current) => {
      if (isDirty) {
        return current.includes(fieldId) ? current : [...current, fieldId];
      }
      return current.filter((item) => item !== fieldId);
    });
  }

  function handleResetTuning() {
    setSliderOffsets(defaultSliderOffsets);
  }

  return (
    <div className="planner-app">
      <section className="planner-hero">
        <div>
          <p className="planner-eyebrow">A-frame layout studio</p>
          <h1>Drive the layout from footprint and headroom, then tune the shell with sliders.</h1>
          <p className="planner-lede">
            The ground floor width and length are the only core size inputs. Surface, loft, and framing numbers are calculated, and the live shell preview updates after Enter or blur on text fields.
          </p>
        </div>
      </section>

      <div className="planner-layout">
        <div className="planner-controls">
          <section className="panel panel-form">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Core inputs</p>
                <h2>Ground floor and loft minimums</h2>
              </div>
              <div className="unit-switch" role="tablist" aria-label="Unit selection">
                <button type="button" className={unitSystem === 'metric' ? 'unit-button active' : 'unit-button'} onClick={() => setUnitSystem('metric')}>
                  Metric
                </button>
                <button type="button" className={unitSystem === 'imperial' ? 'unit-button active' : 'unit-button'} onClick={() => setUnitSystem('imperial')}>
                  Imperial
                </button>
              </div>
            </div>

            <div className="input-grid">
              <DeferredNumberField
                fieldId="groundWidth"
                label={`Ground width (${unitSystem === 'metric' ? 'm' : 'ft'})`}
                value={toDisplayLength(inputs.groundWidth, unitSystem)}
                commitSignal={commitSignal}
                min={unitSystem === 'metric' ? 2.4 : 8}
                max={unitSystem === 'metric' ? 16 : 52}
                step={0.1}
                onCommit={(value) => setInputs({ ...inputs, groundWidth: fromDisplayLength(value, unitSystem) })}
                onDirtyChange={handleDirtyChange}
              />
              <DeferredNumberField
                fieldId="groundLength"
                label={`Ground length (${unitSystem === 'metric' ? 'm' : 'ft'})`}
                value={toDisplayLength(inputs.groundLength, unitSystem)}
                commitSignal={commitSignal}
                min={unitSystem === 'metric' ? 2.4 : 8}
                max={unitSystem === 'metric' ? 20 : 66}
                step={0.1}
                onCommit={(value) => setInputs({ ...inputs, groundLength: fromDisplayLength(value, unitSystem) })}
                onDirtyChange={handleDirtyChange}
              />
              <div className="surface-output-card">
                <span>Calculated ground floor area</span>
                <strong>{formatArea(groundArea, unitSystem)}</strong>
                <p className="muted">Surface is derived from the ground width and length.</p>
              </div>
              {inputs.includeLoft ? (
                <DeferredNumberField
                  fieldId="minimumLoftHeadroom"
                  label={`Minimum loft headroom (${unitSystem === 'metric' ? 'm' : 'ft'})`}
                  value={toDisplayLength(inputs.minimumLoftHeadroom, unitSystem)}
                  commitSignal={commitSignal}
                  min={unitSystem === 'metric' ? 1 : 3.25}
                  max={unitSystem === 'metric' ? 2.5 : 8.2}
                  step={0.1}
                  onCommit={(value) => setInputs({ ...inputs, minimumLoftHeadroom: fromDisplayLength(value, unitSystem) })}
                  onDirtyChange={handleDirtyChange}
                />
              ) : (
                <DeferredNumberField
                  fieldId="totalHeightBase"
                  label={`Base total height (${unitSystem === 'metric' ? 'm' : 'ft'})`}
                  value={toDisplayLength(inputs.totalHeightBase, unitSystem)}
                  commitSignal={commitSignal}
                  min={unitSystem === 'metric' ? 2.2 : 7.2}
                  max={unitSystem === 'metric' ? 8 : 26.2}
                  step={0.1}
                  onCommit={(value) => setInputs({ ...inputs, totalHeightBase: fromDisplayLength(value, unitSystem) })}
                  onDirtyChange={handleDirtyChange}
                />
              )}
              {inputs.includeSideWall ? (
                <DeferredNumberField
                  fieldId="sideWallBaseHeight"
                  label={`Base side wall height (${unitSystem === 'metric' ? 'm' : 'ft'})`}
                  value={toDisplayLength(inputs.sideWallBaseHeight, unitSystem)}
                  commitSignal={commitSignal}
                  min={0}
                  max={unitSystem === 'metric' ? 3 : 9.8}
                  step={0.1}
                  onCommit={(value) => setInputs({ ...inputs, sideWallBaseHeight: fromDisplayLength(value, unitSystem) })}
                  onDirtyChange={handleDirtyChange}
                />
              ) : null}
            </div>

            <div className="toggle-row">
              <label className="checkbox-row-lite">
                <input type="checkbox" checked={inputs.includeLoft} onChange={(event) => setInputs({ ...inputs, includeLoft: event.target.checked })} />
                <span>Include loft</span>
              </label>
              <label className="checkbox-row-lite">
                <input type="checkbox" checked={inputs.includeSideWall} onChange={(event) => setInputs({ ...inputs, includeSideWall: event.target.checked })} />
                <span>Include side wall</span>
              </label>
              <label className="checkbox-row-lite">
                <input type="checkbox" checked={inputs.includeConcreteSlab} onChange={(event) => setInputs({ ...inputs, includeConcreteSlab: event.target.checked })} />
                <span>Concrete slab foundation</span>
              </label>
              <label className="checkbox-row-lite">
                <input type="checkbox" checked={inputs.includeBalcony} disabled={!inputs.includeLoft} onChange={(event) => setInputs({ ...inputs, includeBalcony: event.target.checked })} />
                <span>Retracted loft</span>
              </label>
            </div>

            <div className="form-actions-row">
              <button type="button" className={dirtyFields.length > 0 ? 'primary-button' : 'secondary-button'} onClick={handleCalculate}>
                {dirtyFields.length > 0 ? `Calculate ${dirtyFields.length} pending change${dirtyFields.length === 1 ? '' : 's'}` : 'Calculate'}
              </button>
              <span className="muted">Text fields already apply on blur or Enter. Use Calculate to force-refresh any pending edits.</span>
            </div>
          </section>

          <section className="panel stats-panel">
            <div className="panel-heading compact-heading">
              <div>
                <p className="section-kicker">Derived shell</p>
                <h2>Main outputs with tuning sliders</h2>
              </div>
              <button type="button" className="ghost-button" onClick={handleResetTuning}>Reset tuning</button>
            </div>
            <div className="stats-grid">
              <article>
                <span>Total shell height</span>
                <strong>{formatLength(totalHeight, unitSystem)}</strong>
              </article>
              <article>
                <span>Side wall height</span>
                <strong>{formatLength(sideWallHeight, unitSystem)}</strong>
              </article>
              <article>
                <span>Rafter length</span>
                <strong>{formatLength(rafterLength, unitSystem)}</strong>
              </article>
              <article>
                <span>Roof pitch</span>
                <strong>{formatValue(roofPitch, 1)} deg</strong>
              </article>
              <article>
                <span>Actual frame spacing</span>
                <strong>{formatLength(actualSpacing, unitSystem)}</strong>
              </article>
              <article>
                <span>Usable upstairs area</span>
                <strong>{inputs.includeLoft ? formatArea(loftArea, unitSystem) : 'No loft'}</strong>
              </article>
              <article>
                <span>Floor 1.7 m zone</span>
                <strong>{formatArea(groundHeadspaceArea, unitSystem)}</strong>
              </article>
              <article>
                <span>Loft 1.7 m zone</span>
                <strong>{inputs.includeLoft ? formatArea(loftHeadspaceArea, unitSystem) : 'No loft'}</strong>
              </article>
            </div>

            <div className="slider-stack">
              <AdjustmentSlider
                label="Total shell height"
                valueLabel={formatLength(totalHeight, unitSystem)}
                helper="Slider range is plus or minus 30 percent around the recommended value."
                sliderValue={sliderOffsets.totalHeight}
                onSliderChange={(value) => setSliderOffsets({ ...sliderOffsets, totalHeight: value })}
              />
              {inputs.includeSideWall ? (
                <AdjustmentSlider
                  label="Side wall height"
                  valueLabel={formatLength(sideWallHeight, unitSystem)}
                  helper="Lower this to approach a true A-frame."
                  sliderValue={sliderOffsets.sideWallHeight}
                  onSliderChange={(value) => setSliderOffsets({ ...sliderOffsets, sideWallHeight: value })}
                />
              ) : null}
              {inputs.includeLoft ? (
                <AdjustmentSlider
                  label="Downstairs headspace"
                  valueLabel={formatLength(loftFloorHeight, unitSystem)}
                  helper="Sets the clear height below the loft. Default is 2.2 m and it never goes below 2.0 m."
                  sliderValue={sliderOffsets.loftFloorHeight}
                  onSliderChange={(value) => setSliderOffsets({ ...sliderOffsets, loftFloorHeight: value })}
                />
              ) : null}
              {inputs.includeLoft && !inputs.includeBalcony ? (
                <RangeSlider
                  label="Ladder opening position"
                  valueLabel={formatLength(ladderOpeningOffset, unitSystem)}
                  helper="Moves the ladder opening along the loft length and snaps to rafter spacing."
                  sliderValue={sliderOffsets.ladderPosition}
                  min={0}
                  max={100}
                  step={1}
                  onSliderChange={(value) => setSliderOffsets({ ...sliderOffsets, ladderPosition: value })}
                />
              ) : null}
              <RangeSlider
                label="Extra front terrace"
                valueLabel={`${formatLength(sliderOffsets.frontTerraceBays * actualSpacing, unitSystem)}`}
                helper="Adds more front terrace depth in full rafter-spacing steps beyond the default two bays."
                sliderValue={sliderOffsets.frontTerraceBays}
                min={0}
                max={4}
                step={1}
                onSliderChange={(value) => setSliderOffsets({ ...sliderOffsets, frontTerraceBays: value })}
              />
              <AdjustmentSlider
                label="Rafter spacing"
                valueLabel={formatLength(rafterSpacing, unitSystem)}
                helper="Tighter spacing generally improves framing capacity."
                sliderValue={sliderOffsets.rafterSpacing}
                onSliderChange={(value) => setSliderOffsets({ ...sliderOffsets, rafterSpacing: value })}
              />
              <RangeSlider
                label="Front and rear glazing"
                valueLabel={glazingPreset.label}
                helper="Steps through door glass, front top glazing, full front glazing, then rear loft and rear full glazing."
                sliderValue={glazingStage}
                min={0}
                max={6}
                step={1}
                onSliderChange={(value) => setSliderOffsets({ ...sliderOffsets, glazingRatio: value })}
              />
            </div>
          </section>

          <section className="panel estimate-panel">
            <div className="panel-heading compact-heading">
              <div>
                <p className="section-kicker">Materials</p>
                <h2>Surface and shell takeoff</h2>
              </div>
            </div>
            <div className="estimate-list">
              <div>
                <span>Roof surfaces</span>
                <strong>{formatArea(roofSurfaceArea, unitSystem)}</strong>
              </div>
              <div>
                <span>Side walls</span>
                <strong>{formatArea(sideWallArea, unitSystem)}</strong>
              </div>
              <div>
                <span>Front and rear wall area</span>
                <strong>{formatArea(endWallArea, unitSystem)}</strong>
              </div>
              <div>
                <span>Glass allowance</span>
                <strong>{formatArea(glassArea, unitSystem)}</strong>
              </div>
              <div>
                <span>Wall and roof cladding</span>
                <strong>{formatArea(wallCladdingArea, unitSystem)}</strong>
              </div>
              <div>
                <span>Floor boarding</span>
                <strong>{formatArea(floorBoardingArea, unitSystem)}</strong>
              </div>
              <div>
                <span>Roof boarding volume ({formatLength(inputs.roofBoardingThickness, unitSystem)})</span>
                <strong>{formatVolume(roofBoardingVolume, unitSystem)}</strong>
              </div>
              <div>
                <span>Timber shell volume</span>
                <strong>{formatVolume(totalWoodVolume, unitSystem)} | {stockPieceCount} pcs</strong>
              </div>
              <div>
                <span>Rafters</span>
                <strong>{rafterCount} pcs</strong>
              </div>
              <div>
                <span>Base ties / floor joists</span>
                <strong>{floorJoistCount} pcs</strong>
              </div>
              <div>
                <span>Connector braces @ 2 m</span>
                <strong>{connectorBraceCount} pcs</strong>
              </div>
              <div>
                <span>Apex screws total</span>
                <strong>{apexScrewCount} pcs @ {formatValue(apexScrewLengthMm, 0)} x {formatValue(apexScrewDiameterMm, 0)} mm</strong>
              </div>
              <div>
                <span>Roof-wall screws total</span>
                <strong>{roofWallScrewCount} pcs @ {formatValue(roofWallScrewLengthMm, 0)} mm</strong>
              </div>
              <div>
                <span>Wall-floor screws total</span>
                <strong>{wallFloorScrewCount} pcs @ {formatValue(wallFloorScrewLengthMm, 0)} mm</strong>
              </div>
              <div>
                <span>Foundation grid</span>
                <strong>{formatLength(widthAxisGrid.spacing, unitSystem)} x {formatLength(floorAxisGrid.spacing, unitSystem)}</strong>
              </div>
            </div>

            <label className="checkbox-row-lite advanced-toggle-row">
              <input type="checkbox" checked={showAdvancedCosts} onChange={(event) => setShowAdvancedCosts(event.target.checked)} />
              <span>Show advanced stock and cost inputs</span>
            </label>

            {showAdvancedCosts ? (
              <div className="advanced-panel">
                <div className="input-grid compact-input-grid">
                  <DeferredNumberField
                    fieldId="availableWoodWidth"
                    label={`Available wood width (${unitSystem === 'metric' ? 'mm' : 'in'})`}
                    value={toDisplaySection(inputs.availableWoodWidth, unitSystem)}
                    commitSignal={commitSignal}
                    min={unitSystem === 'metric' ? 25 : 1}
                    max={unitSystem === 'metric' ? 300 : 12}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, availableWoodWidth: fromDisplaySection(value, unitSystem) })}
                    onDirtyChange={handleDirtyChange}
                  />
                  <DeferredNumberField
                    fieldId="availableWoodDepth"
                    label={`Available wood depth (${unitSystem === 'metric' ? 'mm' : 'in'})`}
                    value={toDisplaySection(inputs.availableWoodDepth, unitSystem)}
                    commitSignal={commitSignal}
                    min={unitSystem === 'metric' ? 75 : 3}
                    max={unitSystem === 'metric' ? 400 : 16}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, availableWoodDepth: fromDisplaySection(value, unitSystem) })}
                    onDirtyChange={handleDirtyChange}
                  />
                  <DeferredNumberField
                    fieldId="availableWoodLength"
                    label={`Stock length (${unitSystem === 'metric' ? 'm' : 'ft'})`}
                    value={toDisplayLength(inputs.availableWoodLength, unitSystem)}
                    commitSignal={commitSignal}
                    min={unitSystem === 'metric' ? 2 : 6.5}
                    max={unitSystem === 'metric' ? 12 : 39}
                    step={0.1}
                    onCommit={(value) => setInputs({ ...inputs, availableWoodLength: fromDisplayLength(value, unitSystem) })}
                    onDirtyChange={handleDirtyChange}
                  />
                  <DeferredNumberField
                    fieldId="roofBoardingThickness"
                    label={`Roof boarding thickness (${unitSystem === 'metric' ? 'mm' : 'in'})`}
                    value={toDisplaySection(inputs.roofBoardingThickness, unitSystem)}
                    commitSignal={commitSignal}
                    min={unitSystem === 'metric' ? 10 : 0.4}
                    max={unitSystem === 'metric' ? 50 : 2}
                    step={unitSystem === 'metric' ? 1 : 0.05}
                    onCommit={(value) => setInputs({ ...inputs, roofBoardingThickness: fromDisplaySection(value, unitSystem) })}
                    onDirtyChange={handleDirtyChange}
                  />
                  <DeferredNumberField
                    fieldId="stockCostPerPiece"
                    label="Stock cost (per piece)"
                    value={inputs.stockCostPerPiece}
                    commitSignal={commitSignal}
                    min={0}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, stockCostPerPiece: value })}
                    onDirtyChange={handleDirtyChange}
                  />
                  <DeferredNumberField
                    fieldId="woodCostPerCubic"
                    label={`Roof boarding wood cost (${unitSystem === 'metric' ? 'per m3' : 'per ft3'})`}
                    value={toDisplayVolumeCost(inputs.woodCostPerCubic, unitSystem)}
                    commitSignal={commitSignal}
                    min={0}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, woodCostPerCubic: fromDisplayVolumeCost(value, unitSystem) })}
                    onDirtyChange={handleDirtyChange}
                  />
                  <DeferredNumberField
                    fieldId="roofCostPerSquare"
                    label={`Roof finish cost (${unitSystem === 'metric' ? 'per m2' : 'per ft2'})`}
                    value={toDisplaySurfaceCost(inputs.roofCostPerSquare, unitSystem)}
                    commitSignal={commitSignal}
                    min={0}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, roofCostPerSquare: fromDisplaySurfaceCost(value, unitSystem) })}
                    onDirtyChange={handleDirtyChange}
                  />
                  <DeferredNumberField
                    fieldId="panelCostPerSquare"
                    label={`Wall and floor panel cost (${unitSystem === 'metric' ? 'per m2' : 'per ft2'})`}
                    value={toDisplaySurfaceCost(inputs.panelCostPerSquare, unitSystem)}
                    commitSignal={commitSignal}
                    min={0}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, panelCostPerSquare: fromDisplaySurfaceCost(value, unitSystem) })}
                    onDirtyChange={handleDirtyChange}
                  />
                </div>
                <div className="cost-breakdown">
                  <p>Stock <strong>{formatCurrency(stockCostEstimate)}</strong></p>
                  <p>Wall panels and floor boarding <strong>{formatCurrency(panelCostEstimate)}</strong></p>
                  <p>Roof boarding <strong>{formatCurrency(roofBoardingCostEstimate)}</strong></p>
                  <p>Roof finish <strong>{formatCurrency(roofCostEstimate)}</strong></p>
                  <p>Shell total <strong>{formatCurrency(shellCostEstimate)}</strong></p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="panel framing-panel">
            <div className="panel-heading compact-heading">
              <div>
                <p className="section-kicker">Framing</p>
                <h2>Section guidance and anchors</h2>
              </div>
            </div>
            <div className="framing-summary">
              <div>
                <span>Recommended minimum section (pine wood)</span>
                <strong>{getSectionLabel(recommendedSection, unitSystem)}</strong>
              </div>
              <div>
                <span>Current available stock</span>
                <strong>
                  {unitSystem === 'metric'
                    ? `${formatValue(inputs.availableWoodWidth * 1000, 0)} x ${formatValue(inputs.availableWoodDepth * 1000, 0)} mm`
                    : `${formatValue((inputs.availableWoodWidth * 1000) / MM_PER_INCH, 2)} x ${formatValue((inputs.availableWoodDepth * 1000) / MM_PER_INCH, 2)} in`}
                </strong>
              </div>
              <div>
                <span>Stock length check</span>
                <strong>{stockLengthAdequateText(stockLengthAdequate)}</strong>
              </div>
              <div>
                <span>Rafter count</span>
                <strong>{rafterCount} pcs</strong>
              </div>
              <div>
                <span>Base ties / floor joists</span>
                <strong>{floorJoistCount} pcs</strong>
              </div>
              <div>
                <span>Connector braces @ 2 m</span>
                <strong>{connectorBraceCount} pcs</strong>
              </div>
              <div>
                <span>Estimated stock pieces</span>
                <strong>{stockPieceCount} pcs</strong>
              </div>
              <div>
                <span>Apex screws total</span>
                <strong>{apexScrewCount} pcs @ {formatValue(apexScrewLengthMm, 0)} x {formatValue(apexScrewDiameterMm, 0)} mm</strong>
              </div>
              <div>
                <span>Roof-wall screws total</span>
                <strong>{roofWallScrewCount} pcs @ {formatValue(roofWallScrewLengthMm, 0)} mm</strong>
              </div>
              <div>
                <span>Wall-floor screws total</span>
                <strong>{wallFloorScrewCount} pcs @ {formatValue(wallFloorScrewLengthMm, 0)} mm</strong>
              </div>
              <div>
                <span>Ground anchors</span>
                <strong>{anchorPoints.length} total points</strong>
              </div>
            </div>
            <div className={availableSectionAdequate ? 'status-chip ok' : 'status-chip warn'}>
              {availableSectionAdequate
                ? 'Current stock meets the recommended minimum for the tuned span and spacing.'
                : 'Current stock is undersized for the tuned span or spacing. Increase lumber depth first before changing the footprint.'}
            </div>
          </section>

          <section className="panel export-panel">
            <div className="panel-heading compact-heading">
              <div>
                <p className="section-kicker">Exports</p>
                <h2>PDF and DXF output</h2>
              </div>
            </div>
            <p className="panel-note export-note">
              PDF exports the active summary, plan blocks, and anchor layout. DXF exports simple linework for the ground floor, loft footprint, and anchor positions.
            </p>
            <div className="export-actions">
              <button type="button" className="primary-button" onClick={handleExportPdf}>Export PDF report</button>
              <button type="button" className="secondary-button" onClick={handleExportDxf}>Export DXF plan</button>
            </div>
          </section>
        </div>

        <aside className="planner-visuals">
          <section className="panel preview-panel">
            <div className="panel-heading compact-heading">
              <div>
                <p className="section-kicker">Preview</p>
                <h2>Interactive 3D shell view</h2>
              </div>
            </div>
            <InteractiveCabinPreview
              width={inputs.groundWidth}
              totalHeight={totalHeight}
              sideWallHeight={sideWallHeight}
              cabinLength={inputs.groundLength}
              glazingStage={glazingStage}
              loftFloorHeight={loftFloorHeight}
              loftDeckWidth={loftDeckWidth}
              loftDeckLength={loftDeckLength}
              balconyMargin={balconyMargin}
              frontWallOffset={frontTerraceDepth}
              backWallOffset={backRecessDepth}
              includeLoft={inputs.includeLoft}
              includeBalcony={inputs.includeBalcony}
              frameCount={frameCount}
              actualSpacing={actualSpacing}
              includeConcreteSlab={inputs.includeConcreteSlab}
              ladderOffset={ladderOpeningOffset}
              ladderTopInset={ladderOpeningLength}
              ladderRun={ladderFootprintLength}
            />
            <div className="preview-stats">
              <div>
                <strong>{formatArea(groundArea, unitSystem)}</strong>
                <span>Ground floor area</span>
              </div>
              <div>
                <strong>{formatArea(groundHeadspaceArea, unitSystem)}</strong>
                <span>Floor 1.7 m zone</span>
              </div>
              <div>
                <strong>{inputs.includeLoft ? formatArea(loftArea, unitSystem) : 'No loft'}</strong>
                <span>Usable upstairs</span>
              </div>
              <div>
                <strong>{inputs.includeLoft ? formatArea(loftHeadspaceArea, unitSystem) : 'No loft'}</strong>
                <span>Loft 1.7 m zone</span>
              </div>
              <div>
                <strong>{formatCurrency(shellCostEstimate)}</strong>
                <span>Shell estimate</span>
              </div>
            </div>
          </section>

          <FloorPlan title="Ground floor plan" areaLabel={formatArea(inputs.groundWidth * groundFloorLength, unitSystem)} width={inputs.groundWidth} length={groundFloorLength} loftWidth={groundHeadspaceWidth} loftLength={enclosedShellLength} loftOffsetY={frontTerraceDepth} openingLength={ladderFootprintLength} openingWidth={Math.min(ladderOpeningWidth, 0.7)} openingOffsetY={frontTerraceDepth + groundLadderMarkerOffset} openingLabel={inputs.includeBalcony ? 'Ladder mark' : 'Ladder'} openingMarkerOnly={inputs.includeBalcony} headspaceAreaLabel={formatArea(groundHeadspaceArea, unitSystem)} unit={unitSystem} />
          <FloorPlan title="Loft plan" areaLabel={inputs.includeLoft ? formatArea(loftArea, unitSystem) : 'No loft'} width={inputs.includeLoft ? loftDeckWidth : 0} length={inputs.includeLoft ? loftDeckLength : 0} loftWidth={inputs.includeLoft ? loftHeadspaceWidth : 0} loftLength={inputs.includeLoft ? loftDeckLength : 0} loftOffsetY={0} openingLength={inputs.includeLoft ? loftHoleLength : 0} openingWidth={inputs.includeLoft ? loftHoleWidth : 0} openingOffsetY={inputs.includeLoft ? ladderOpeningOffset : 0} openingLabel="Ladder" headspaceAreaLabel={inputs.includeLoft ? formatArea(loftHeadspaceArea, unitSystem) : undefined} unit={unitSystem} />
          <AnchorPlan length={inputs.groundLength} width={inputs.groundWidth} anchorPoints={anchorPoints} anchorSpacingX={widthAxisGrid.spacing} anchorSpacingY={floorAxisGrid.spacing} unit={unitSystem} />
        </aside>
      </div>

      <section className="panel notes-panel">
        <div className="panel-heading compact-heading">
          <div>
            <p className="section-kicker">Planning notes</p>
            <h2>What drives the shape</h2>
          </div>
        </div>
        <div className="notes-grid-lite">
          <article>
            <strong>Minimal input set</strong>
            <p>The footprint and minimum headroom define the baseline shell. Area is always calculated from width and length.</p>
          </article>
          <article>
            <strong>Slider behavior</strong>
            <p>Each tuning slider only moves plus or minus 30 percent around the current recommendation so the shell stays close to a reasonable starting point.</p>
          </article>
          <article>
            <strong>Boarding split</strong>
            <p>Wall and roof cladding is reported separately from floor boarding because floor boards often need a different thickness or finish.</p>
          </article>
          <article>
            <strong>No loft option</strong>
            <p>Disable the loft to turn the upstairs off entirely and size the cabin as a simpler A-frame shell.</p>
          </article>
        </div>
      </section>

      <section className={showAdmin ? 'admin-drawer open' : 'admin-drawer'}>
        <button type="button" className="admin-toggle" onClick={() => setShowAdmin((current) => !current)}>
          {showAdmin ? 'Hide hidden admin tab' : 'Show hidden admin tab'}
        </button>
        {showAdmin ? <AdminPromoterPanel /> : null}
      </section>
    </div>
  );
}