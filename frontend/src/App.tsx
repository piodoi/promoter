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
  availableWoodWidth: number;
  availableWoodDepth: number;
  availableWoodLength: number;
  woodCostPerCubic: number;
  panelCostPerSquare: number;
  glassCostPerSquare: number;
};

type SliderOffsets = {
  totalHeight: number;
  sideWallHeight: number;
  loftFloorHeight: number;
  rafterSpacing: number;
  glazingRatio: number;
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
  totalHeight: number;
  sideWallHeight: number;
  loftFloorHeight: number;
  rafterSpacing: number;
  anchorSpacingX: number;
  anchorSpacingY: number;
  glazingRatio: number;
  roofRise: number;
  rafterLength: number;
  roofPitch: number;
  frameCount: number;
  actualSpacing: number;
  loftDeckWidth: number;
  loftUsableWidth: number;
  loftDeckLength: number;
  balconyMargin: number;
  loftArea: number;
  roofSurfaceArea: number;
  sideWallArea: number;
  endWallArea: number;
  glassArea: number;
  panelArea: number;
  totalWoodVolume: number;
  woodCostEstimate: number;
  panelCostEstimate: number;
  glassCostEstimate: number;
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

type ProjectedPoint = {
  x: number;
  y: number;
  z: number;
};

const PREVIEW_CENTER_X = 210;
const PREVIEW_CENTER_Y = 176;

const METERS_PER_FOOT = 0.3048;
const SQM_PER_SQFT = 0.09290304;
const MM_PER_INCH = 25.4;
const CUBIC_METERS_PER_CUBIC_FOOT = 0.0283168;

const SECTION_RULES: SectionRule[] = [
  { width: 0.045, depth: 0.145, labelMetric: '45 x 145 mm', labelImperial: '2 x 6 in', spanLimit: 3.6, spacingLimit: 0.4 },
  { width: 0.045, depth: 0.195, labelMetric: '45 x 195 mm', labelImperial: '2 x 8 in', spanLimit: 4.8, spacingLimit: 0.6 },
  { width: 0.063, depth: 0.195, labelMetric: '63 x 195 mm', labelImperial: '3 x 8 in', spanLimit: 6.0, spacingLimit: 0.6 },
  { width: 0.075, depth: 0.22, labelMetric: '75 x 220 mm', labelImperial: '3 x 10 in', spanLimit: 7.2, spacingLimit: 0.6 },
  { width: 0.09, depth: 0.245, labelMetric: '90 x 245 mm', labelImperial: '4 x 10 in', spanLimit: 9.0, spacingLimit: 0.8 },
];

const defaultInputs: PlannerInputs = {
  groundWidth: 8,
  groundLength: 9,
  includeLoft: true,
  includeBalcony: false,
  includeSideWall: false,
  includeConcreteSlab: false,
  minimumLoftHeadroom: 1.4,
  availableWoodWidth: 0.045,
  availableWoodDepth: 0.195,
  availableWoodLength: 4.8,
  woodCostPerCubic: 950,
  panelCostPerSquare: 42,
  glassCostPerSquare: 180,
};

const defaultSliderOffsets: SliderOffsets = {
  totalHeight: 0,
  sideWallHeight: 0,
  loftFloorHeight: 0,
  rafterSpacing: 0,
  glazingRatio: 0,
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

function buildDxf(inputs: PlannerInputs, metrics: PlannerMetrics, unitSystem: UnitSystem) {
  const unitCode = unitSystem === 'metric' ? '6' : '2';
  const lengthFactor = unitSystem === 'metric' ? 1 : 1 / METERS_PER_FOOT;
  const displayLength = (value: number) => value * lengthFactor;
  const cabinLength = displayLength(inputs.groundLength);
  const cabinWidth = displayLength(inputs.groundWidth);
  const loftWidth = displayLength(metrics.loftUsableWidth);
  const loftLength = displayLength(metrics.loftDeckLength);
  const loftStartY = displayLength(metrics.balconyMargin);
  const anchorRadius = unitSystem === 'metric' ? 0.08 : 0.25;
  const planOffset = cabinWidth + (unitSystem === 'metric' ? 2 : 6);
  const anchorOffsetY = Math.max(cabinLength, 1) + (unitSystem === 'metric' ? 3 : 10);
  const textHeight = unitSystem === 'metric' ? 0.22 : 0.7;
  const entities = [
    ...createDxfText(0, -0.8, textHeight, 'GROUND FLOOR', 'TEXT'),
    ...createDxfRect(0, 0, cabinWidth, cabinLength, 'GROUND_PLAN'),
    ...createDxfText(planOffset, -0.8, textHeight, 'LOFT PLAN', 'TEXT'),
    ...createDxfRect(planOffset, 0, cabinWidth, cabinLength, 'LOFT_PLAN'),
    ...(metrics.loftArea > 0 ? createDxfRect(planOffset + ((cabinWidth - loftWidth) / 2), loftStartY, loftWidth, loftLength, 'LOFT_USABLE') : []),
    ...createDxfText(0, anchorOffsetY - 0.8, textHeight, 'ANCHOR LAYOUT', 'TEXT'),
    ...createDxfRect(0, anchorOffsetY, cabinWidth, cabinLength, 'ANCHORS'),
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

function addPdfPlan(doc: jsPDF, title: string, x: number, y: number, width: number, length: number, innerWidth: number, innerLength: number, innerOffsetY: number, unitSystem: UnitSystem) {
  const boxWidth = 70;
  const boxHeight = 42;
  const scale = Math.min(boxWidth / Math.max(width, 1), boxHeight / Math.max(length, 1));
  const drawWidth = width * scale;
  const drawHeight = length * scale;
  const originX = x + ((boxWidth - drawWidth) / 2);
  const originY = y + 8;

  doc.setFontSize(12);
  doc.text(title, x, y);
  doc.setDrawColor(71, 54, 39);
  doc.rect(originX, originY, drawWidth, drawHeight);

  if (innerWidth > 0 && innerLength > 0) {
    const innerDrawWidth = innerWidth * scale;
    const innerDrawLength = innerLength * scale;
    const innerX = originX + ((drawWidth - innerDrawWidth) / 2);
    const innerY = originY + (innerOffsetY * scale);
    doc.setDrawColor(31, 95, 117);
    doc.rect(innerX, innerY, innerDrawWidth, innerDrawLength);
  }

  doc.setFontSize(9);
  doc.text(`Width ${formatLength(width, unitSystem)}`, x, y + 56);
  doc.text(`Length ${formatLength(length, unitSystem)}`, x, y + 62);
}

function addPdfAnchorPlan(doc: jsPDF, x: number, y: number, width: number, length: number, anchorPoints: { x: number; y: number }[], anchorSpacingX: number, anchorSpacingY: number, unitSystem: UnitSystem) {
  const boxWidth = 70;
  const boxHeight = 42;
  const scale = Math.min(boxWidth / Math.max(width, 1), boxHeight / Math.max(length, 1));
  const drawWidth = width * scale;
  const drawHeight = length * scale;
  const originX = x + ((boxWidth - drawWidth) / 2);
  const originY = y + 8;

  doc.setFontSize(12);
  doc.text('Anchor layout', x, y);
  doc.setDrawColor(71, 54, 39);
  doc.rect(originX, originY, drawWidth, drawHeight);
  doc.setFillColor(31, 95, 117);
  anchorPoints.forEach((anchorPoint) => {
    const pointX = originX + ((width > 0 ? anchorPoint.x / width : 0) * drawWidth);
    const pointY = originY + ((length > 0 ? anchorPoint.y / length : 0) * drawHeight);
    doc.circle(pointX, pointY, 1, 'F');
  });
  doc.setFontSize(9);
  doc.text(`${anchorPoints.length} anchors total`, x, y + 56);
  doc.text(`Grid ${formatLength(anchorSpacingX, unitSystem)} x ${formatLength(anchorSpacingY, unitSystem)}`, x, y + 62);
}

function exportPdf(inputs: PlannerInputs, metrics: PlannerMetrics, unitSystem: UnitSystem) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const stockWidth = unitSystem === 'metric' ? inputs.availableWoodWidth * 1000 : (inputs.availableWoodWidth * 1000) / MM_PER_INCH;
  const stockDepth = unitSystem === 'metric' ? inputs.availableWoodDepth * 1000 : (inputs.availableWoodDepth * 1000) / MM_PER_INCH;
  const stockUnit = unitSystem === 'metric' ? 'mm' : 'in';

  doc.setFontSize(22);
  doc.text('A-Frame Cabin Plan Export', 14, 18);
  doc.setFontSize(10);
  doc.text(`Units: ${unitSystem === 'metric' ? 'Metric' : 'Imperial'}`, 14, 26);
  doc.text('Generated from the current planner values.', 14, 31);

  const summaryRows = [
    ['Ground width', formatLength(inputs.groundWidth, unitSystem)],
    ['Ground length', formatLength(inputs.groundLength, unitSystem)],
    ['Ground area', formatArea(metrics.groundArea, unitSystem)],
    ['Total height', formatLength(metrics.totalHeight, unitSystem)],
    ['Rafter length', formatLength(metrics.rafterLength, unitSystem)],
    ['Loft usable area', metrics.loftArea > 0 ? formatArea(metrics.loftArea, unitSystem) : 'No loft enabled'],
    ['Roof surfaces', formatArea(metrics.roofSurfaceArea, unitSystem)],
    ['Side walls', formatArea(metrics.sideWallArea, unitSystem)],
    ['Glass area', formatArea(metrics.glassArea, unitSystem)],
    ['Panel area', formatArea(metrics.panelArea, unitSystem)],
    ['Timber volume', formatVolume(metrics.totalWoodVolume, unitSystem)],
    ['Recommended section', getSectionLabel(metrics.recommendedSection, unitSystem)],
    ['Available stock', `${formatValue(stockWidth, unitSystem === 'metric' ? 0 : 2)} x ${formatValue(stockDepth, unitSystem === 'metric' ? 0 : 2)} ${stockUnit}`],
    ['Stock length', stockLengthAdequateText(metrics.stockLengthAdequate)],
    ['Wood cost', formatCurrency(metrics.woodCostEstimate)],
    ['Panel cost', formatCurrency(metrics.panelCostEstimate)],
    ['Glass cost', formatCurrency(metrics.glassCostEstimate)],
    ['Shell estimate', formatCurrency(metrics.shellCostEstimate)],
  ];

  let y = 42;
  summaryRows.forEach(([label, value], index) => {
    const rowX = index % 2 === 0 ? 14 : 108;
    if (index % 2 === 0 && index > 0) {
      y += 10;
    }
    doc.setFontSize(10);
    doc.text(`${label}:`, rowX, y);
    doc.setFont('helvetica', 'bold');
    doc.text(value, rowX + 34, y);
    doc.setFont('helvetica', 'normal');
  });

  y += 20;
  addPdfPlan(doc, 'Ground floor', 14, y, inputs.groundWidth, inputs.groundLength, 0, 0, 0, unitSystem);
  addPdfPlan(doc, 'Loft plan', 105, y, inputs.groundWidth, inputs.groundLength, metrics.loftUsableWidth, metrics.loftDeckLength, metrics.balconyMargin, unitSystem);
  addPdfAnchorPlan(doc, 14, y + 78, inputs.groundWidth, inputs.groundLength, metrics.anchorPoints, metrics.anchorSpacingX, metrics.anchorSpacingY, unitSystem);
  doc.setFontSize(9);
  doc.text(`Rafter spacing ${formatLength(metrics.actualSpacing, unitSystem)} | Roof pitch ${formatValue(metrics.roofPitch, 1)} deg`, 105, y + 134);
  doc.text(`Facade glazing ${formatValue(metrics.glazingRatio * 100, 0)}%`, 105, y + 140);

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

function InteractiveCabinPreview({ width, totalHeight, sideWallHeight, cabinLength, glazingRatio, loftFloorHeight, loftDeckWidth, loftDeckLength, balconyMargin, includeLoft, frameCount, actualSpacing, includeConcreteSlab }: { width: number; totalHeight: number; sideWallHeight: number; cabinLength: number; glazingRatio: number; loftFloorHeight: number; loftDeckWidth: number; loftDeckLength: number; balconyMargin: number; includeLoft: boolean; frameCount: number; actualSpacing: number; includeConcreteSlab: boolean }) {
  const defaultYaw = -0.72;
  const defaultPitch = 0.28;
  const defaultZoom = 16;
  const [yaw, setYaw] = useState(defaultYaw);
  const [pitch, setPitch] = useState(defaultPitch);
  const [zoom, setZoom] = useState(defaultZoom);
  const [dragState, setDragState] = useState<DragState>({ active: false, lastX: 0, lastY: 0 });

  const halfWidth = Math.max(width / 2, 0.1);
  const halfLength = Math.max(cabinLength / 2, 0.1);
  const roofRise = Math.max(totalHeight - sideWallHeight, 0.6);
  const frontApex = { x: 0, y: totalHeight, z: -halfLength };
  const backApex = { x: 0, y: totalHeight, z: halfLength };
  const frontLeftBottom = { x: -halfWidth, y: 0, z: -halfLength };
  const frontRightBottom = { x: halfWidth, y: 0, z: -halfLength };
  const backLeftBottom = { x: -halfWidth, y: 0, z: halfLength };
  const backRightBottom = { x: halfWidth, y: 0, z: halfLength };
  const frontLeftKnee = { x: -halfWidth, y: sideWallHeight, z: -halfLength };
  const frontRightKnee = { x: halfWidth, y: sideWallHeight, z: -halfLength };
  const backLeftKnee = { x: -halfWidth, y: sideWallHeight, z: halfLength };
  const backRightKnee = { x: halfWidth, y: sideWallHeight, z: halfLength };
  const loftHalfWidth = Math.max(loftDeckWidth / 2, 0.08);
  const loftFrontZ = -halfLength + balconyMargin;
  const loftRearZ = halfLength - balconyMargin;
  const glazingInsetX = halfWidth * clamp(0.54 - (glazingRatio * 1.05), 0.08, 0.46);
  const glazingInsetY = totalHeight * clamp(0.48 - (glazingRatio * 0.55), 0.08, 0.32);
  const maxDimension = Math.max(width, cabinLength, totalHeight, 2.8);
  const cameraDistance = (maxDimension * 4.6) + 18;
  const fitScale = clamp(2.4 / maxDimension, 0.22, 0.72);
  const sceneScale = fitScale * zoom * 0.32;
  const projectScenePoint = (point: Point3D) => scaleProjectedPoint(projectPoint(point, yaw, pitch, cameraDistance), sceneScale);

  const faces = [
    {
      fill: '#7a553a',
      stroke: '#4e3321',
      points: [frontLeftBottom, frontRightBottom, backRightBottom, backLeftBottom],
    },
    {
      fill: '#b77a47',
      stroke: '#6c4224',
      points: [frontLeftBottom, frontLeftKnee, frontApex, backApex, backLeftKnee, backLeftBottom],
    },
    {
      fill: '#8d522a',
      stroke: '#5d3419',
      points: [frontRightBottom, frontRightKnee, frontApex, backApex, backRightKnee, backRightBottom],
    },
    {
      fill: '#d6bb93',
      stroke: '#6c4526',
      points: [frontLeftBottom, frontLeftKnee, frontApex, frontRightKnee, frontRightBottom],
    },
  ].map((face) => {
    const projected = face.points.map((point) => projectScenePoint(point));
    const depth = projected.reduce((sum, point) => sum + point.z, 0) / projected.length;
    return { ...face, projected, depth };
  }).sort((left, right) => left.depth - right.depth);

  const glazingPolygon = [
    { x: -halfWidth + glazingInsetX, y: 0.2, z: -halfLength + 0.01 },
    { x: -halfWidth + glazingInsetX * 0.82, y: sideWallHeight + 0.15, z: -halfLength + 0.01 },
    { x: 0, y: totalHeight - glazingInsetY, z: -halfLength + 0.01 },
    { x: halfWidth - glazingInsetX * 0.82, y: sideWallHeight + 0.15, z: -halfLength + 0.01 },
    { x: halfWidth - glazingInsetX, y: 0.2, z: -halfLength + 0.01 },
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
      [
        { x: -loftHalfWidth, y: loftFloorHeight, z: loftFrontZ },
        { x: -loftHalfWidth, y: 0, z: loftFrontZ },
      ],
      [
        { x: loftHalfWidth, y: loftFloorHeight, z: loftFrontZ },
        { x: loftHalfWidth, y: 0, z: loftFrontZ },
      ],
      [
        { x: -loftHalfWidth, y: loftFloorHeight, z: loftRearZ },
        { x: loftHalfWidth, y: loftFloorHeight, z: loftRearZ },
      ],
    ].map((line) => line.map((point) => projectScenePoint(point)))
    : [];

  const frameZPositions = Array.from({ length: frameCount }, (_, index) => (-halfLength + (actualSpacing * index)));
  const rafterLines = frameZPositions.flatMap((zPosition) => {
    const leftBase = { x: -halfWidth, y: 0, z: zPosition };
    const leftKnee = { x: -halfWidth, y: sideWallHeight, z: zPosition };
    const rightBase = { x: halfWidth, y: 0, z: zPosition };
    const rightKnee = { x: halfWidth, y: sideWallHeight, z: zPosition };
    const apex = { x: 0, y: totalHeight, z: zPosition };

    return [
      [leftBase, leftKnee],
      [leftKnee, apex],
      [apex, rightKnee],
      [rightKnee, rightBase],
      [leftBase, rightBase],
    ].map((line) => line.map((point) => projectScenePoint(point)));
  });

  const floorStructureLines = !includeConcreteSlab
    ? [
      [frontLeftBottom, backLeftBottom],
      [frontRightBottom, backRightBottom],
      ...frameZPositions.map((zPosition) => [
        { x: -halfWidth, y: 0.02, z: zPosition },
        { x: halfWidth, y: 0.02, z: zPosition },
      ]),
    ].map((line) => line.map((point) => projectScenePoint(point)))
    : [];

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
        {faces.map((face, index) => (
          <polygon key={`${face.fill}-${index}`} points={polygonPoints(face.projected)} fill={face.fill} stroke={face.stroke} strokeWidth="2.4" />
        ))}
        {floorStructureLines.map((line, index) => (
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
        {rafterLines.map((line, index) => (
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
        {loftPolygon ? <polygon points={polygonPoints(loftPolygon)} fill="rgba(241, 214, 161, 0.82)" stroke="#7f5d3b" strokeWidth="2" /> : null}
        {loftEdgeLines.map((line, index) => (
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
        <polygon points={polygonPoints(glazingPolygon)} fill="rgba(124, 196, 216, 0.68)" stroke="#1f5f75" strokeWidth="2" />
        <text x="20" y="284">Width {formatValue(width, 2)}</text>
        <text x="156" y="284">Length {formatValue(cabinLength, 2)}</text>
        <text x="290" y="284">Height {formatValue(totalHeight, 2)}</text>
        <text x="20" y="302">Roof rise {formatValue(roofRise, 2)}</text>
        <text x="150" y="302">Frames {frameCount}</text>
      </svg>
    </div>
  );
}

function FloorPlan({ title, areaLabel, width, length, loftWidth, loftLength, loftOffsetY, unit }: { title: string; areaLabel: string; width: number; length: number; loftWidth: number; loftLength: number; loftOffsetY: number; unit: UnitSystem }) {
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

  return (
    <div className="visual-card">
      <div className="visual-header">
        <h3>{title}</h3>
        <span>{areaLabel}</span>
      </div>
      <svg viewBox="0 0 360 230" className="plan-canvas" role="img" aria-label={`${title} floor plan`}>
        <rect x={planX} y={planY} width={planFrame.drawWidth} height={planFrame.drawHeight} rx="16" fill="#f6ede1" stroke="#6f5134" strokeWidth="3" />
        {loftWidth > 0 && loftLength > 0 ? <rect x={loftX} y={loftY} width={loftVisualWidth} height={loftVisualHeight} rx="10" fill="#cbb18f" fillOpacity="0.82" stroke="#7f5d3b" strokeDasharray="6 6" /> : null}
        <text x="180" y="222" textAnchor="middle">Length {formatLength(length, unit)}</text>
        <text x="14" y="118" transform="rotate(-90 14 118)" textAnchor="middle">Width {formatLength(width, unit)}</text>
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
        <rect x={planX} y={planY} width={planFrame.drawWidth} height={planFrame.drawHeight} rx="14" fill="#f3eadf" stroke="#5c4430" strokeWidth="3" />
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
    ? (inputs.includeLoft
    ? clamp(inputs.groundWidth * 0.12, 0, 1.4)
    : clamp(inputs.groundWidth * 0.04, 0, 0.45))
    : 0;
  const recommendedLoftFloorHeight = inputs.includeLoft
    ? clamp(inputs.groundWidth * 0.29, 1.8, 2.5)
    : 0;
  const recommendedTotalHeight = inputs.includeLoft
    ? Math.max(recommendedLoftFloorHeight + inputs.minimumLoftHeadroom + 0.55, recommendedSideWallHeight + (inputs.groundWidth * 0.62))
    : Math.max(recommendedSideWallHeight + (inputs.groundWidth * 0.72), 3);
  const recommendedSpacing = inputs.groundWidth > 8.5 ? 0.5 : 0.6;
  const recommendedGlazingRatio = inputs.includeLoft ? 0.34 : 0.28;
  const anchorSpacingMin = inputs.includeConcreteSlab ? 1.5 : 1;
  const anchorSpacingMax = inputs.includeConcreteSlab ? 2.5 : 1.5;

  const totalHeight = scaleFromRecommendation(recommendedTotalHeight, sliderOffsets.totalHeight, inputs.includeLoft ? inputs.minimumLoftHeadroom + 1.4 : 2.6, 12);
  const sideWallHeight = inputs.includeSideWall
    ? scaleFromRecommendation(recommendedSideWallHeight, sliderOffsets.sideWallHeight, 0, Math.max(totalHeight - 0.6, 0.1))
    : 0;
  const maxLoftFloorHeight = Math.max(totalHeight - inputs.minimumLoftHeadroom - 0.3, 1.6);
  const loftFloorHeight = inputs.includeLoft
    ? scaleFromRecommendation(Math.min(recommendedLoftFloorHeight, maxLoftFloorHeight), sliderOffsets.loftFloorHeight, 1.6, maxLoftFloorHeight)
    : 0;
  const rafterSpacing = scaleFromRecommendation(recommendedSpacing, sliderOffsets.rafterSpacing, 0.3, 1);
  const glazingRatio = scaleFromRecommendation(recommendedGlazingRatio, sliderOffsets.glazingRatio, 0, 0.85);
  const balconyMargin = inputs.includeLoft && inputs.includeBalcony ? clamp(inputs.groundLength * 0.14, 0.6, Math.max(inputs.groundLength * 0.22, 0.6)) : 0;

  const roofRise = Math.max(totalHeight - sideWallHeight, 0.6);
  const halfSpan = inputs.groundWidth / 2;
  const rafterLength = Math.sqrt((halfSpan * halfSpan) + (roofRise * roofRise));
  const roofPitch = Math.atan2(roofRise, Math.max(halfSpan, 0.001)) * (180 / Math.PI);
  const frameCount = Math.max(2, Math.floor(inputs.groundLength / Math.max(rafterSpacing, 0.2)) + 1);
  const bayCount = Math.max(frameCount - 1, 1);
  const actualSpacing = inputs.groundLength / bayCount;
  const loftDeckWidth = inputs.includeLoft
    ? (loftFloorHeight <= sideWallHeight ? inputs.groundWidth : inputs.groundWidth * clamp(1 - ((loftFloorHeight - sideWallHeight) / roofRise), 0, 1))
    : 0;
  const loftUsableWidth = inputs.includeLoft
    ? (loftFloorHeight + inputs.minimumLoftHeadroom <= sideWallHeight
      ? inputs.groundWidth
      : inputs.groundWidth * clamp(1 - (((loftFloorHeight + inputs.minimumLoftHeadroom) - sideWallHeight) / roofRise), 0, 1))
    : 0;
  const loftDeckLength = inputs.includeLoft ? Math.max(inputs.groundLength - (balconyMargin * 2), 0.6) : 0;
  const loftArea = loftUsableWidth * loftDeckLength;
  const roofSurfaceArea = 2 * rafterLength * inputs.groundLength;
  const sideWallArea = 2 * inputs.groundLength * sideWallHeight;
  const endWallArea = ((inputs.groundWidth * sideWallHeight) + (0.5 * inputs.groundWidth * roofRise)) * 2;
  const glassArea = endWallArea * glazingRatio;
  const panelArea = roofSurfaceArea + sideWallArea + Math.max(endWallArea - glassArea, 0);

  const recommendedSection = getRecommendedSection(rafterLength, actualSpacing);
  const availableSectionArea = inputs.availableWoodWidth * inputs.availableWoodDepth;
  const availableCapacity = getSectionCapacity(inputs.availableWoodWidth, inputs.availableWoodDepth);
  const recommendedCapacity = getSectionCapacity(recommendedSection.width, recommendedSection.depth);
  const availableSectionAdequate = availableCapacity >= recommendedCapacity;
  const stockLengthAdequate = inputs.availableWoodLength >= rafterLength;

  const rafterVolume = frameCount * 2 * rafterLength * availableSectionArea;
  const floorAxisGrid = buildGridAxis(inputs.groundLength, anchorSpacingMin, anchorSpacingMax);
  const widthAxisGrid = buildGridAxis(inputs.groundWidth, anchorSpacingMin, anchorSpacingMax);
  const floorAxis = floorAxisGrid.positions;
  const widthAxis = widthAxisGrid.positions;
  const anchorPoints = floorAxis.flatMap((y) => widthAxis.map((x) => ({ x, y })));
  const floorJoistVolume = inputs.includeConcreteSlab ? 0 : floorAxis.length * inputs.groundWidth * availableSectionArea;
  const perimeterBeamVolume = inputs.includeConcreteSlab ? 0 : ((inputs.groundLength * 2) + (inputs.groundWidth * 2)) * availableSectionArea;
  const totalWoodVolume = rafterVolume + floorJoistVolume + perimeterBeamVolume;

  const woodCostEstimate = totalWoodVolume * inputs.woodCostPerCubic;
  const panelCostEstimate = panelArea * inputs.panelCostPerSquare;
  const glassCostEstimate = glassArea * inputs.glassCostPerSquare;
  const shellCostEstimate = woodCostEstimate + panelCostEstimate + glassCostEstimate;
  const metrics: PlannerMetrics = {
    groundArea,
    totalHeight,
    sideWallHeight,
    loftFloorHeight,
    rafterSpacing,
    anchorSpacingX: widthAxisGrid.spacing,
    anchorSpacingY: floorAxisGrid.spacing,
    glazingRatio,
    roofRise,
    rafterLength,
    roofPitch,
    frameCount,
    actualSpacing,
    loftDeckWidth,
    loftUsableWidth,
    loftDeckLength,
    balconyMargin,
    loftArea,
    roofSurfaceArea,
    sideWallArea,
    endWallArea,
    glassArea,
    panelArea,
    totalWoodVolume,
    woodCostEstimate,
    panelCostEstimate,
    glassCostEstimate,
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
              <DeferredNumberField
                fieldId="minimumLoftHeadroom"
                label={`Minimum loft headroom (${unitSystem === 'metric' ? 'm' : 'ft'})`}
                value={toDisplayLength(inputs.minimumLoftHeadroom, unitSystem)}
                commitSignal={commitSignal}
                min={unitSystem === 'metric' ? 1 : 3.25}
                max={unitSystem === 'metric' ? 2.5 : 8.2}
                step={0.1}
                disabled={!inputs.includeLoft}
                onCommit={(value) => setInputs({ ...inputs, minimumLoftHeadroom: fromDisplayLength(value, unitSystem) })}
                onDirtyChange={handleDirtyChange}
              />
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
                <span>Retract loft for balcony</span>
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
                  label="Loft floor level"
                  valueLabel={formatLength(loftFloorHeight, unitSystem)}
                  helper="Higher loft floors reduce the usable upstairs width."
                  sliderValue={sliderOffsets.loftFloorHeight}
                  onSliderChange={(value) => setSliderOffsets({ ...sliderOffsets, loftFloorHeight: value })}
                />
              ) : null}
              <AdjustmentSlider
                label="Rafter spacing"
                valueLabel={formatLength(rafterSpacing, unitSystem)}
                helper="Tighter spacing generally improves framing capacity."
                sliderValue={sliderOffsets.rafterSpacing}
                onSliderChange={(value) => setSliderOffsets({ ...sliderOffsets, rafterSpacing: value })}
              />
              <AdjustmentSlider
                label="Front and rear glazing"
                valueLabel={`${formatValue(glazingRatio * 100, 0)}%`}
                helper="Higher glazing trades panel area for glass area."
                sliderValue={sliderOffsets.glazingRatio}
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
                <span>Wood panel allowance</span>
                <strong>{formatArea(panelArea, unitSystem)}</strong>
              </div>
              <div>
                <span>Timber shell volume</span>
                <strong>{formatVolume(totalWoodVolume, unitSystem)}</strong>
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
                    fieldId="woodCostPerCubic"
                    label={`Wood cost (${unitSystem === 'metric' ? 'per m3' : 'per ft3'})`}
                    value={toDisplayVolumeCost(inputs.woodCostPerCubic, unitSystem)}
                    commitSignal={commitSignal}
                    min={0}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, woodCostPerCubic: fromDisplayVolumeCost(value, unitSystem) })}
                    onDirtyChange={handleDirtyChange}
                  />
                  <DeferredNumberField
                    fieldId="panelCostPerSquare"
                    label={`Panel cost (${unitSystem === 'metric' ? 'per m2' : 'per ft2'})`}
                    value={toDisplaySurfaceCost(inputs.panelCostPerSquare, unitSystem)}
                    commitSignal={commitSignal}
                    min={0}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, panelCostPerSquare: fromDisplaySurfaceCost(value, unitSystem) })}
                    onDirtyChange={handleDirtyChange}
                  />
                  <DeferredNumberField
                    fieldId="glassCostPerSquare"
                    label={`Glass cost (${unitSystem === 'metric' ? 'per m2' : 'per ft2'})`}
                    value={toDisplaySurfaceCost(inputs.glassCostPerSquare, unitSystem)}
                    commitSignal={commitSignal}
                    min={0}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, glassCostPerSquare: fromDisplaySurfaceCost(value, unitSystem) })}
                    onDirtyChange={handleDirtyChange}
                  />
                </div>
                <div className="cost-breakdown">
                  <p>Wood framing <strong>{formatCurrency(woodCostEstimate)}</strong></p>
                  <p>Panels <strong>{formatCurrency(panelCostEstimate)}</strong></p>
                  <p>Glass <strong>{formatCurrency(glassCostEstimate)}</strong></p>
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
                <span>Recommended minimum section</span>
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
              glazingRatio={glazingRatio}
              loftFloorHeight={loftFloorHeight}
              loftDeckWidth={loftDeckWidth}
              loftDeckLength={loftDeckLength}
              balconyMargin={balconyMargin}
              includeLoft={inputs.includeLoft}
              frameCount={frameCount}
              actualSpacing={actualSpacing}
              includeConcreteSlab={inputs.includeConcreteSlab}
            />
            <div className="preview-stats">
              <div>
                <strong>{formatArea(groundArea, unitSystem)}</strong>
                <span>Ground floor area</span>
              </div>
              <div>
                <strong>{inputs.includeLoft ? formatArea(loftArea, unitSystem) : 'No loft'}</strong>
                <span>Usable upstairs</span>
              </div>
              <div>
                <strong>{formatCurrency(shellCostEstimate)}</strong>
                <span>Shell estimate</span>
              </div>
            </div>
          </section>

          <FloorPlan title="Ground floor plan" areaLabel={formatArea(groundArea, unitSystem)} width={inputs.groundWidth} length={inputs.groundLength} loftWidth={0} loftLength={0} loftOffsetY={0} unit={unitSystem} />
          <FloorPlan title="Loft plan" areaLabel={inputs.includeLoft ? formatArea(loftArea, unitSystem) : 'No loft'} width={inputs.groundWidth} length={inputs.groundLength} loftWidth={loftUsableWidth} loftLength={loftDeckLength} loftOffsetY={balconyMargin} unit={unitSystem} />
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