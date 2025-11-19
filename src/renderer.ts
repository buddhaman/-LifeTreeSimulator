// Canvas rendering functions
import { isLeafNode, Node, Graph } from './graph';
import { Camera2D } from './Camera2D';

// Draw a rounded rectangle
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Wrap text to fit within a width
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// Draw a single bubble (node) - Apple-style design
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  node: Node,
  isHovered: boolean = false,
  isSelected: boolean = false
): void {
  // Use current dimensions directly
  const currentWidth = node.currentWidth;
  const currentHeight = node.currentHeight;

  const x = node.x - currentWidth / 2;
  const y = node.y - currentHeight / 2;
  const radius = 16;

  ctx.save();

  // Green glow for growing nodes
  if (node.isGrowing) {
    const glowIntensity = 0.6 + Math.sin(Date.now() / 200) * 0.4; // Pulsing effect
    ctx.shadowColor = `rgba(52, 211, 153, ${glowIntensity})`;
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    // Normal shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = isHovered ? 30 : 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = isHovered ? 8 : 4;
  }

  // White/gray card background
  const bgGray = isHovered ? 252 : 255;
  ctx.fillStyle = `rgb(${bgGray}, ${bgGray}, ${bgGray})`;
  drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
  ctx.fill();

  ctx.restore();
  ctx.save();

  // Subtle border
  if (isSelected) {
    ctx.strokeStyle = 'rgba(0, 122, 255, 0.8)';
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
    ctx.stroke();
  } else if (node.isGrowing) {
    // Green border for growing nodes
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
    ctx.stroke();
  }

  ctx.restore();

  // Only draw text if node is fully grown
  if (node.growthProgress >= 1) {
    // Text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Title
    ctx.font = '600 17px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillStyle = '#1d1d1f';
    const titleLines = wrapText(ctx, node.title, currentWidth - 32);
    titleLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, x + 16, y + 16 + i * 22);
    });

    // Description
    ctx.font = '400 14px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillStyle = '#6e6e73';
    const descLines = wrapText(ctx, node.description, currentWidth - 32);
    descLines.slice(0, 3).forEach((line, i) => {
      ctx.fillText(line, x + 16, y + 60 + i * 20);
    });

    // Probability badge
    const probText = `${node.probability}%`;
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
    const probMetrics = ctx.measureText(probText);
    const pillWidth = probMetrics.width + 16;
    const pillHeight = 22;
    const pillX = x + 16;
    const pillY = y + currentHeight - pillHeight - 12;

    ctx.fillStyle = '#f5f5f7';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 11);
    ctx.fill();

    ctx.fillStyle = '#1d1d1f';
    ctx.fillText(probText, pillX + 8, pillY + 5);

    // Tags
    if (node.tags.length > 0) {
      const tagsX = pillX + pillWidth + 8;
      ctx.font = '400 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#86868b';
      const tagText = node.tags.slice(0, 2).join(' · ');
      ctx.fillText(tagText, tagsX, pillY + 6);
    }
  }
}

// Draw expand button on leaf nodes - Apple-style
export function drawExpandButton(
  ctx: CanvasRenderingContext2D,
  node: Node,
  isHovered: boolean = false
): void {
  const buttonSize = 28;
  const buttonY = node.y - node.currentHeight / 2 - buttonSize - 12; // Above the node
  const centerX = node.x;
  const centerY = buttonY + buttonSize / 2;

  ctx.save();

  // Apple-style shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = isHovered ? 12 : 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // Circle background - Apple blue with subtle hover state
  ctx.fillStyle = isHovered ? '#0071e3' : '#007aff'; // Apple's blue shades
  ctx.beginPath();
  ctx.arc(centerX, centerY, buttonSize / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.save();

  // Plus sign - crisp and clean
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  const plusSize = 10;

  // Horizontal line
  ctx.beginPath();
  ctx.moveTo(centerX - plusSize / 2, centerY);
  ctx.lineTo(centerX + plusSize / 2, centerY);
  ctx.stroke();

  // Vertical line
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - plusSize / 2);
  ctx.lineTo(centerX, centerY + plusSize / 2);
  ctx.stroke();

  ctx.restore();
}

// Get expand button bounds for hit testing
export function getExpandButtonBounds(node: Node) {
  const buttonSize = 28;
  return {
    x: node.x - buttonSize / 2,
    y: node.y - node.currentHeight / 2 - buttonSize - 12,
    width: buttonSize,
    height: buttonSize,
    centerX: node.x,
    centerY: node.y - node.currentHeight / 2 - buttonSize / 2 - 12,
    radius: buttonSize / 2
  };
}

// Draw an edge (bezier curve) - from parent to child with tapered thickness
export function drawEdge(ctx: CanvasRenderingContext2D, fromNode: Node, toNode: Node): void {
  const fromX = fromNode.x;
  const fromY = fromNode.y - fromNode.currentHeight / 2; // Top of parent
  const toX = toNode.x;
  const toY = toNode.y + toNode.currentHeight / 2; // Bottom of child

  const controlOffset = Math.abs(toY - fromY) * 0.5;

  const startWidth = 8; // Thick at parent
  const endWidth = 2;   // Thin at child
  const segments = 20;

  ctx.save();

  // Green glow for growing edges
  if (toNode.isGrowing) {
    const glowIntensity = 0.6 + Math.sin(Date.now() / 200) * 0.4; // Pulsing effect
    ctx.shadowColor = `rgba(52, 211, 153, ${glowIntensity})`;
    ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(52, 211, 153, ${0.6 + glowIntensity * 0.2})`;
  } else {
    ctx.fillStyle = 'rgba(180, 180, 195, 1)'; // Light gray, solid and always visible
  }

  // Draw tapered path by creating a polygon along the bezier curve
  const points: { x: number; y: number; width: number }[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    // Bezier curve calculation
    const x = (1 - t) * (1 - t) * (1 - t) * fromX +
              3 * (1 - t) * (1 - t) * t * fromX +
              3 * (1 - t) * t * t * toX +
              t * t * t * toX;

    const y = (1 - t) * (1 - t) * (1 - t) * fromY +
              3 * (1 - t) * (1 - t) * t * (fromY - controlOffset) +
              3 * (1 - t) * t * t * (toY + controlOffset) +
              t * t * t * toY;

    // Linear width interpolation (thick to thin)
    const width = startWidth * (1 - t) + endWidth * t;

    points.push({ x, y, width });
  }

  // Create outline path for tapered shape
  ctx.beginPath();

  // Right side
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const angle = i < points.length - 1
      ? Math.atan2(points[i + 1].y - p.y, points[i + 1].x - p.x)
      : Math.atan2(p.y - points[i - 1].y, p.x - points[i - 1].x);

    const offsetX = Math.cos(angle + Math.PI / 2) * p.width / 2;
    const offsetY = Math.sin(angle + Math.PI / 2) * p.width / 2;

    if (i === 0) {
      ctx.moveTo(p.x + offsetX, p.y + offsetY);
    } else {
      ctx.lineTo(p.x + offsetX, p.y + offsetY);
    }
  }

  // Left side (reverse)
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    const angle = i < points.length - 1
      ? Math.atan2(points[i + 1].y - p.y, points[i + 1].x - p.x)
      : Math.atan2(p.y - points[i - 1].y, p.x - points[i - 1].x);

    const offsetX = Math.cos(angle - Math.PI / 2) * p.width / 2;
    const offsetY = Math.sin(angle - Math.PI / 2) * p.width / 2;

    ctx.lineTo(p.x + offsetX, p.y + offsetY);
  }

  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// Draw subtle grid with plus signs at intersections
function drawGrid(ctx: CanvasRenderingContext2D, camera: Camera2D): void {
  const { width, height } = ctx.canvas;

  // Calculate world bounds visible on screen
  const topLeft = camera.screenToWorld(0, 0);
  const bottomRight = camera.screenToWorld(width, height);

  const gridSize = 100; // Grid spacing in world units
  const plusSize = 3; // Size of plus sign

  ctx.save();

  // Calculate grid bounds (snap to grid)
  const startX = Math.floor(topLeft.x / gridSize) * gridSize;
  const startY = Math.floor(topLeft.y / gridSize) * gridSize;
  const endX = Math.ceil(bottomRight.x / gridSize) * gridSize;
  const endY = Math.ceil(bottomRight.y / gridSize) * gridSize;

  ctx.strokeStyle = 'rgba(190, 190, 200, 1)'; // Light gray, always visible
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  // Draw plus signs at grid intersections
  for (let x = startX; x <= endX; x += gridSize) {
    for (let y = startY; y <= endY; y += gridSize) {
      // Horizontal line of plus
      ctx.beginPath();
      ctx.moveTo(x - plusSize, y);
      ctx.lineTo(x + plusSize, y);
      ctx.stroke();

      // Vertical line of plus
      ctx.beginPath();
      ctx.moveTo(x, y - plusSize);
      ctx.lineTo(x, y + plusSize);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// Main render function
export function render(
  ctx: CanvasRenderingContext2D,
  camera: Camera2D,
  graph: Graph,
  hoveredNodeId: number | null,
  selectedNodeId: number | null,
  hoveredButtonNodeId: number | null
): void {
  const { width, height } = ctx.canvas;

  // Clear canvas with Apple-style light background
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#f5f5f7'; // Apple's light gray background
  ctx.fillRect(0, 0, width, height);

  // Apply camera transform
  camera.applyTransform(ctx);

  // Draw grid first (behind everything)
  drawGrid(ctx, camera);

  // Draw edges
  graph.edges.forEach(edge => {
    const fromNode = graph.nodes.find(n => n.id === edge.fromId);
    const toNode = graph.nodes.find(n => n.id === edge.toId);
    if (fromNode && toNode) {
      drawEdge(ctx, fromNode, toNode);
    }
  });

  // Draw nodes
  graph.nodes.forEach(node => {
    const isHovered = node.id === hoveredNodeId;
    const isSelected = node.id === selectedNodeId;
    drawBubble(ctx, node, isHovered, isSelected);
  });

  // Draw expand buttons on leaf nodes
  graph.nodes.forEach(node => {
    if (isLeafNode(node.id) && !node.expanded) {
      const isButtonHovered = node.id === hoveredButtonNodeId;
      drawExpandButton(ctx, node, isButtonHovered);
    }
  });
}
