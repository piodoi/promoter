import { useEffect, useState } from 'react';

import { jsPDF } from 'jspdf';

import AdminPromoterPanel from './AdminPromoterPanel';

type UnitSystem = 'metric' | 'imperial';

type PlannerInputs = {
  groundWidth: number;
  groundLength: number;
  includeLoft: boolean;
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
  glazingRatio: number;
  roofRise: number;
  rafterLength: number;
  roofPitch: number;
  frameCount: number;
  actualSpacing: number;
  loftDeckWidth: number;
  loftUsableWidth: number;
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
  anchorPositions: number[];
};

type DeferredNumberFieldProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  onCommit: (value: number) => void;
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
  const anchorRadius = unitSystem === 'metric' ? 0.08 : 0.25;
  const planOffset = cabinWidth + (unitSystem === 'metric' ? 2 : 6);
  const anchorOffsetY = Math.max(cabinLength, 1) + (unitSystem === 'metric' ? 3 : 10);
  const textHeight = unitSystem === 'metric' ? 0.22 : 0.7;
  const entities = [
    ...createDxfText(0, -0.8, textHeight, 'GROUND FLOOR', 'TEXT'),
    ...createDxfRect(0, 0, cabinWidth, cabinLength, 'GROUND_PLAN'),
    ...createDxfText(planOffset, -0.8, textHeight, 'LOFT PLAN', 'TEXT'),
    ...createDxfRect(planOffset, 0, cabinWidth, cabinLength, 'LOFT_PLAN'),
    ...(metrics.loftArea > 0 ? createDxfRect(planOffset + ((cabinWidth - loftWidth) / 2), 0, loftWidth, cabinLength, 'LOFT_USABLE') : []),
    ...createDxfText(0, anchorOffsetY - 0.8, textHeight, 'ANCHOR LAYOUT', 'TEXT'),
    ...createDxfRect(0, anchorOffsetY, cabinWidth, cabinLength, 'ANCHORS'),
  ];

  metrics.anchorPositions.forEach((position) => {
    const y = displayLength(position);
    entities.push(...createDxfCircle(0, anchorOffsetY + y, anchorRadius, 'ANCHORS'));
    entities.push(...createDxfCircle(cabinWidth, anchorOffsetY + y, anchorRadius, 'ANCHORS'));
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

function addPdfPlan(doc: jsPDF, title: string, x: number, y: number, width: number, length: number, innerWidth: number, unitSystem: UnitSystem) {
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

  if (innerWidth > 0) {
    const innerDrawWidth = innerWidth * scale;
    const innerX = originX + ((drawWidth - innerDrawWidth) / 2);
    doc.setDrawColor(31, 95, 117);
    doc.rect(innerX, originY, innerDrawWidth, drawHeight);
  }

  doc.setFontSize(9);
  doc.text(`Width ${formatLength(width, unitSystem)}`, x, y + 56);
  doc.text(`Length ${formatLength(length, unitSystem)}`, x, y + 62);
}

function addPdfAnchorPlan(doc: jsPDF, x: number, y: number, width: number, length: number, anchorPositions: number[], unitSystem: UnitSystem) {
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
  anchorPositions.forEach((position) => {
    const ratio = length > 0 ? position / length : 0;
    const pointY = originY + (ratio * drawHeight);
    doc.circle(originX, pointY, 1, 'F');
    doc.circle(originX + drawWidth, pointY, 1, 'F');
  });
  doc.setFontSize(9);
  doc.text(`${anchorPositions.length * 2} anchors total`, x, y + 56);
  doc.text(`Nominal spacing ${formatLength(anchorPositions[1] ?? 0, unitSystem)}`, x, y + 62);
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
  addPdfPlan(doc, 'Ground floor', 14, y, inputs.groundWidth, inputs.groundLength, 0, unitSystem);
  addPdfPlan(doc, 'Loft plan', 105, y, inputs.groundWidth, inputs.groundLength, metrics.loftUsableWidth, unitSystem);
  addPdfAnchorPlan(doc, 14, y + 78, inputs.groundWidth, inputs.groundLength, metrics.anchorPositions, unitSystem);
  doc.setFontSize(9);
  doc.text(`Rafter spacing ${formatLength(metrics.actualSpacing, unitSystem)} | Roof pitch ${formatValue(metrics.roofPitch, 1)} deg`, 105, y + 134);
  doc.text(`Facade glazing ${formatValue(metrics.glazingRatio * 100, 0)}%`, 105, y + 140);

  doc.save('a-frame-cabin-plan.pdf');
}

function DeferredNumberField({ label, value, min, max, step = 0.1, suffix, disabled, onCommit }: DeferredNumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commitDraft() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const constrained = clamp(parsed, min ?? parsed, max ?? parsed);
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
          onChange={(event) => setDraft(event.target.value)}
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

function projectPoint(point: Point3D, yaw: number, pitch: number): ProjectedPoint {
  const rotated = rotatePoint(point, yaw, pitch);
  const perspective = 250 / (rotated.z + 7);
  return {
    x: 210 + (rotated.x * perspective * 26),
    y: 190 - (rotated.y * perspective * 26),
    z: rotated.z,
  };
}

function polygonPoints(points: ProjectedPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function InteractiveCabinPreview({ width, totalHeight, sideWallHeight, cabinLength, glazingRatio }: { width: number; totalHeight: number; sideWallHeight: number; cabinLength: number; glazingRatio: number }) {
  const [yaw, setYaw] = useState(-0.72);
  const [pitch, setPitch] = useState(0.28);
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
  const glazingInsetX = halfWidth * clamp(0.22 + glazingRatio * 0.25, 0.16, 0.35);
  const glazingInsetY = totalHeight * 0.14;

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
    const projected = face.points.map((point) => projectPoint(point, yaw, pitch));
    const depth = projected.reduce((sum, point) => sum + point.z, 0) / projected.length;
    return { ...face, projected, depth };
  }).sort((left, right) => left.depth - right.depth);

  const glazingPolygon = [
    { x: -halfWidth + glazingInsetX, y: 0.2, z: -halfLength + 0.01 },
    { x: -halfWidth + glazingInsetX * 0.82, y: sideWallHeight + 0.15, z: -halfLength + 0.01 },
    { x: 0, y: totalHeight - glazingInsetY, z: -halfLength + 0.01 },
    { x: halfWidth - glazingInsetX * 0.82, y: sideWallHeight + 0.15, z: -halfLength + 0.01 },
    { x: halfWidth - glazingInsetX, y: 0.2, z: -halfLength + 0.01 },
  ].map((point) => projectPoint(point, yaw, pitch));

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

  return (
    <div>
      <div className="preview-header-actions">
        <span className="panel-note">Drag to orbit the shell preview.</span>
        <button type="button" className="ghost-button" onClick={() => { setYaw(-0.72); setPitch(0.28); }}>
          Reset view
        </button>
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
        <polygon points={polygonPoints(glazingPolygon)} fill="rgba(124, 196, 216, 0.68)" stroke="#1f5f75" strokeWidth="2" />
        <text x="20" y="284">Width {formatValue(width, 2)}</text>
        <text x="160" y="284">Length {formatValue(cabinLength, 2)}</text>
        <text x="310" y="284">Height {formatValue(totalHeight, 2)}</text>
        <text x="20" y="302">Roof rise {formatValue(roofRise, 2)}</text>
      </svg>
    </div>
  );
}

function FloorPlan({ title, areaLabel, width, length, loftWidth, unit }: { title: string; areaLabel: string; width: number; length: number; loftWidth: number; unit: UnitSystem }) {
  const outerX = 24;
  const outerY = 30;
  const outerWidth = 312;
  const outerHeight = 168;
  const loftRatio = width > 0 ? loftWidth / width : 0;
  const loftVisualWidth = outerWidth * clamp(loftRatio, 0, 1);
  const loftX = outerX + ((outerWidth - loftVisualWidth) / 2);

  return (
    <div className="visual-card">
      <div className="visual-header">
        <h3>{title}</h3>
        <span>{areaLabel}</span>
      </div>
      <svg viewBox="0 0 360 230" className="plan-canvas" role="img" aria-label={`${title} floor plan`}>
        <rect x={outerX} y={outerY} width={outerWidth} height={outerHeight} rx="16" fill="#f6ede1" stroke="#6f5134" strokeWidth="3" />
        {loftWidth > 0 ? <rect x={loftX} y={outerY + 16} width={loftVisualWidth} height={outerHeight - 32} rx="10" fill="#cbb18f" fillOpacity="0.82" stroke="#7f5d3b" strokeDasharray="6 6" /> : null}
        <line x1={outerX} y1={outerY + outerHeight + 14} x2={outerX + outerWidth} y2={outerY + outerHeight + 14} stroke="#4f6570" strokeWidth="2" />
        <line x1={outerX - 14} y1={outerY} x2={outerX - 14} y2={outerY + outerHeight} stroke="#4f6570" strokeWidth="2" />
        <text x="180" y="222" textAnchor="middle">Length {formatLength(length, unit)}</text>
        <text x="14" y="118" transform="rotate(-90 14 118)" textAnchor="middle">Width {formatLength(width, unit)}</text>
      </svg>
    </div>
  );
}

function AnchorPlan({ length, width, anchorPositions, unit }: { length: number; width: number; anchorPositions: number[]; unit: UnitSystem }) {
  return (
    <div className="visual-card">
      <div className="visual-header">
        <h3>Ground anchor layout</h3>
        <span>{anchorPositions.length * 2} anchors</span>
      </div>
      <svg viewBox="0 0 360 230" className="plan-canvas" role="img" aria-label="Ground anchor layout">
        <rect x="34" y="44" width="292" height="142" rx="14" fill="#f3eadf" stroke="#5c4430" strokeWidth="3" />
        {anchorPositions.map((position, index) => {
          const ratio = length > 0 ? position / length : 0;
          const y = 44 + (ratio * 142);
          return (
            <g key={`${position}-${index}`}>
              <circle cx="34" cy={y} r="6.5" fill="#1f5f75" />
              <circle cx="326" cy={y} r="6.5" fill="#1f5f75" />
              <line x1="34" y1={y} x2="326" y2={y} stroke="#5b7f8d" strokeDasharray="4 8" opacity="0.55" />
            </g>
          );
        })}
        <text x="180" y="218" textAnchor="middle">Length {formatLength(length, unit)}</text>
        <text x="20" y="118" transform="rotate(-90 20 118)" textAnchor="middle">Width {formatLength(width, unit)}</text>
      </svg>
    </div>
  );
}

export default function App() {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAdvancedCosts, setShowAdvancedCosts] = useState(false);
  const [inputs, setInputs] = useState<PlannerInputs>(defaultInputs);
  const [sliderOffsets, setSliderOffsets] = useState<SliderOffsets>(defaultSliderOffsets);

  const groundArea = inputs.groundWidth * inputs.groundLength;
  const recommendedSideWallHeight = inputs.includeLoft
    ? clamp(inputs.groundWidth * 0.12, 0, 1.4)
    : clamp(inputs.groundWidth * 0.04, 0, 0.45);
  const recommendedLoftFloorHeight = inputs.includeLoft
    ? clamp(inputs.groundWidth * 0.29, 1.8, 2.5)
    : 0;
  const recommendedTotalHeight = inputs.includeLoft
    ? Math.max(recommendedLoftFloorHeight + inputs.minimumLoftHeadroom + 0.55, recommendedSideWallHeight + (inputs.groundWidth * 0.62))
    : Math.max(recommendedSideWallHeight + (inputs.groundWidth * 0.72), 3);
  const recommendedSpacing = inputs.groundWidth > 8.5 ? 0.5 : 0.6;
  const recommendedGlazingRatio = inputs.includeLoft ? 0.34 : 0.28;

  const totalHeight = scaleFromRecommendation(recommendedTotalHeight, sliderOffsets.totalHeight, inputs.includeLoft ? inputs.minimumLoftHeadroom + 1.4 : 2.6, 12);
  const sideWallHeight = scaleFromRecommendation(recommendedSideWallHeight, sliderOffsets.sideWallHeight, 0, Math.max(totalHeight - 0.6, 0.1));
  const maxLoftFloorHeight = Math.max(totalHeight - inputs.minimumLoftHeadroom - 0.3, 1.6);
  const loftFloorHeight = inputs.includeLoft
    ? scaleFromRecommendation(Math.min(recommendedLoftFloorHeight, maxLoftFloorHeight), sliderOffsets.loftFloorHeight, 1.6, maxLoftFloorHeight)
    : 0;
  const rafterSpacing = scaleFromRecommendation(recommendedSpacing, sliderOffsets.rafterSpacing, 0.3, 1);
  const glazingRatio = scaleFromRecommendation(recommendedGlazingRatio, sliderOffsets.glazingRatio, 0, 0.85);

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
  const loftArea = loftUsableWidth * inputs.groundLength;
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
  const floorJoistVolume = frameCount * inputs.groundWidth * availableSectionArea;
  const perimeterBeamVolume = ((inputs.groundLength * 2) + (inputs.groundWidth * 2)) * availableSectionArea;
  const totalWoodVolume = rafterVolume + floorJoistVolume + perimeterBeamVolume;

  const woodCostEstimate = totalWoodVolume * inputs.woodCostPerCubic;
  const panelCostEstimate = panelArea * inputs.panelCostPerSquare;
  const glassCostEstimate = glassArea * inputs.glassCostPerSquare;
  const shellCostEstimate = woodCostEstimate + panelCostEstimate + glassCostEstimate;
  const anchorPositions = Array.from({ length: frameCount }, (_, index) => round(index * actualSpacing, 2));

  const metrics: PlannerMetrics = {
    groundArea,
    totalHeight,
    sideWallHeight,
    loftFloorHeight,
    rafterSpacing,
    glazingRatio,
    roofRise,
    rafterLength,
    roofPitch,
    frameCount,
    actualSpacing,
    loftDeckWidth,
    loftUsableWidth,
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
    anchorPositions,
  };

  function handleExportPdf() {
    exportPdf(inputs, metrics, unitSystem);
  }

  function handleExportDxf() {
    const dxf = buildDxf(inputs, metrics, unitSystem);
    downloadFile(dxf, 'a-frame-cabin-plan.dxf', 'application/dxf');
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
        <div className="hero-stats">
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
                label={`Ground width (${unitSystem === 'metric' ? 'm' : 'ft'})`}
                value={toDisplayLength(inputs.groundWidth, unitSystem)}
                min={unitSystem === 'metric' ? 2.4 : 8}
                max={unitSystem === 'metric' ? 16 : 52}
                step={0.1}
                onCommit={(value) => setInputs({ ...inputs, groundWidth: fromDisplayLength(value, unitSystem) })}
              />
              <DeferredNumberField
                label={`Ground length (${unitSystem === 'metric' ? 'm' : 'ft'})`}
                value={toDisplayLength(inputs.groundLength, unitSystem)}
                min={unitSystem === 'metric' ? 2.4 : 8}
                max={unitSystem === 'metric' ? 20 : 66}
                step={0.1}
                onCommit={(value) => setInputs({ ...inputs, groundLength: fromDisplayLength(value, unitSystem) })}
              />
              <div className="surface-output-card">
                <span>Calculated ground floor area</span>
                <strong>{formatArea(groundArea, unitSystem)}</strong>
                <p className="muted">Surface is derived from the ground width and length.</p>
              </div>
              <DeferredNumberField
                label={`Minimum loft headroom (${unitSystem === 'metric' ? 'm' : 'ft'})`}
                value={toDisplayLength(inputs.minimumLoftHeadroom, unitSystem)}
                min={unitSystem === 'metric' ? 1 : 3.25}
                max={unitSystem === 'metric' ? 2.5 : 8.2}
                step={0.1}
                disabled={!inputs.includeLoft}
                onCommit={(value) => setInputs({ ...inputs, minimumLoftHeadroom: fromDisplayLength(value, unitSystem) })}
              />
            </div>

            <label className="checkbox-row-lite">
              <input type="checkbox" checked={inputs.includeLoft} onChange={(event) => setInputs({ ...inputs, includeLoft: event.target.checked })} />
              <span>Include loft</span>
            </label>
          </section>

          <section className="panel stats-panel">
            <div className="panel-heading compact-heading">
              <div>
                <p className="section-kicker">Derived shell</p>
                <h2>Main outputs with tuning sliders</h2>
              </div>
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
              <AdjustmentSlider
                label="Side wall height"
                valueLabel={formatLength(sideWallHeight, unitSystem)}
                helper="Lower this to approach a true A-frame."
                sliderValue={sliderOffsets.sideWallHeight}
                onSliderChange={(value) => setSliderOffsets({ ...sliderOffsets, sideWallHeight: value })}
              />
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
            </div>

            <label className="checkbox-row-lite advanced-toggle-row">
              <input type="checkbox" checked={showAdvancedCosts} onChange={(event) => setShowAdvancedCosts(event.target.checked)} />
              <span>Show advanced stock and cost inputs</span>
            </label>

            {showAdvancedCosts ? (
              <div className="advanced-panel">
                <div className="input-grid compact-input-grid">
                  <DeferredNumberField
                    label={`Available wood width (${unitSystem === 'metric' ? 'mm' : 'in'})`}
                    value={toDisplaySection(inputs.availableWoodWidth, unitSystem)}
                    min={unitSystem === 'metric' ? 25 : 1}
                    max={unitSystem === 'metric' ? 300 : 12}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, availableWoodWidth: fromDisplaySection(value, unitSystem) })}
                  />
                  <DeferredNumberField
                    label={`Available wood depth (${unitSystem === 'metric' ? 'mm' : 'in'})`}
                    value={toDisplaySection(inputs.availableWoodDepth, unitSystem)}
                    min={unitSystem === 'metric' ? 75 : 3}
                    max={unitSystem === 'metric' ? 400 : 16}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, availableWoodDepth: fromDisplaySection(value, unitSystem) })}
                  />
                  <DeferredNumberField
                    label={`Stock length (${unitSystem === 'metric' ? 'm' : 'ft'})`}
                    value={toDisplayLength(inputs.availableWoodLength, unitSystem)}
                    min={unitSystem === 'metric' ? 2 : 6.5}
                    max={unitSystem === 'metric' ? 12 : 39}
                    step={0.1}
                    onCommit={(value) => setInputs({ ...inputs, availableWoodLength: fromDisplayLength(value, unitSystem) })}
                  />
                  <DeferredNumberField
                    label={`Wood cost (${unitSystem === 'metric' ? 'per m3' : 'per ft3'})`}
                    value={toDisplayVolumeCost(inputs.woodCostPerCubic, unitSystem)}
                    min={0}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, woodCostPerCubic: fromDisplayVolumeCost(value, unitSystem) })}
                  />
                  <DeferredNumberField
                    label={`Panel cost (${unitSystem === 'metric' ? 'per m2' : 'per ft2'})`}
                    value={toDisplaySurfaceCost(inputs.panelCostPerSquare, unitSystem)}
                    min={0}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, panelCostPerSquare: fromDisplaySurfaceCost(value, unitSystem) })}
                  />
                  <DeferredNumberField
                    label={`Glass cost (${unitSystem === 'metric' ? 'per m2' : 'per ft2'})`}
                    value={toDisplaySurfaceCost(inputs.glassCostPerSquare, unitSystem)}
                    min={0}
                    step={1}
                    onCommit={(value) => setInputs({ ...inputs, glassCostPerSquare: fromDisplaySurfaceCost(value, unitSystem) })}
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
                <strong>{frameCount * 2} total anchors</strong>
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
            />
          </section>

          <FloorPlan title="Ground floor plan" areaLabel={formatArea(groundArea, unitSystem)} width={inputs.groundWidth} length={inputs.groundLength} loftWidth={0} unit={unitSystem} />
          <FloorPlan title="Loft plan" areaLabel={inputs.includeLoft ? formatArea(loftArea, unitSystem) : 'No loft'} width={inputs.groundWidth} length={inputs.groundLength} loftWidth={loftUsableWidth} unit={unitSystem} />
          <AnchorPlan length={inputs.groundLength} width={inputs.groundWidth} anchorPositions={anchorPositions} unit={unitSystem} />
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