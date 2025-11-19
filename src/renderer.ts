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
  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;
  const radius = 16; // Larger radius for smoother corners

  ctx.save();

  // Apple-style shadow (softer, more diffused)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = isHovered ? 30 : 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = isHovered ? 8 : 4;

  // White/gray card background
  const bgGray = isHovered ? 252 : 255;
  ctx.fillStyle = `rgb(${bgGray}, ${bgGray}, ${bgGray})`;
  drawRoundedRect(ctx, x, y, node.width, node.height, radius);
  ctx.fill();

  ctx.restore();
  ctx.save();

  // Subtle border
  if (isSelected) {
    // Apple blue accent for selection
    ctx.strokeStyle = 'rgba(0, 122, 255, 0.8)';
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, x, y, node.width, node.height, radius);
    ctx.stroke();
  } else {
    // Very subtle gray border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, y, node.width, node.height, radius);
    ctx.stroke();
  }

  ctx.restore();

  // Text - dark gray for good contrast on white
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Title - SF Pro-like font (using system font stack)
  ctx.font = '600 17px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
  ctx.fillStyle = '#1d1d1f'; // Apple's dark text color
  const titleLines = wrapText(ctx, node.title, node.width - 32);
  titleLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, x + 16, y + 16 + i * 22);
  });

  // Description - lighter gray
  ctx.font = '400 14px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
  ctx.fillStyle = '#6e6e73'; // Apple's secondary text color
  const descLines = wrapText(ctx, node.description, node.width - 32);
  descLines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, x + 16, y + 60 + i * 20);
  });

  // Probability badge (Apple-style pill)
  const probText = `${node.probability}%`;
  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
  const probMetrics = ctx.measureText(probText);
  const pillWidth = probMetrics.width + 16;
  const pillHeight = 22;
  const pillX = x + 16;
  const pillY = y + node.height - pillHeight - 12;

  // Pill background (light gray)
  ctx.fillStyle = '#f5f5f7';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 11);
  ctx.fill();

  // Pill text
  ctx.fillStyle = '#1d1d1f';
  ctx.fillText(probText, pillX + 8, pillY + 5);

  // Tags (if space allows)
  if (node.tags.length > 0) {
    const tagsX = pillX + pillWidth + 8;
    ctx.font = '400 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#86868b'; // Very light gray for tags
    const tagText = node.tags.slice(0, 2).join(' · ');
    ctx.fillText(tagText, tagsX, pillY + 6);
  }
}

// Draw expand button on leaf nodes - Apple-style
export function drawExpandButton(
  ctx: CanvasRenderingContext2D,
  node: Node,
  isHovered: boolean = false
): void {
  const buttonSize = 28;
  const buttonY = node.y - node.height / 2 - buttonSize - 12; // Above the node
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
    y: node.y - node.height / 2 - buttonSize - 12,
    width: buttonSize,
    height: buttonSize,
    centerX: node.x,
    centerY: node.y - node.height / 2 - buttonSize / 2 - 12,
    radius: buttonSize / 2
  };
}

// Draw an edge (bezier curve) - from parent to child with tapered thickness
export function drawEdge(ctx: CanvasRenderingContext2D, fromNode: Node, toNode: Node): void {
  const fromX = fromNode.x;
  const fromY = fromNode.y - fromNode.height / 2; // Top of parent
  const toX = toNode.x;
  const toY = toNode.y + toNode.height / 2; // Bottom of child

  const controlOffset = Math.abs(toY - fromY) * 0.5;

  // Create gradient for tapered effect (thick at parent, thin at child)
  const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.18)'); // Slightly darker at parent
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.08)'); // Lighter at child

  ctx.save();

  // Draw multiple bezier curves with decreasing width for taper effect
  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    const width = 3.5 - (t * 2); // From 3.5px to 1.5px
    const alpha = 0.15 - (t * 0.05); // Fade slightly

    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(
      fromX,
      fromY - controlOffset,
      toX,
      toY + controlOffset,
      toX,
      toY
    );
    ctx.stroke();
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
