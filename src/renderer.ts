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

// Draw a single bubble (node)
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  node: Node,
  isHovered: boolean = false,
  isSelected: boolean = false
): void {
  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;
  const radius = 12;

  // Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = isHovered ? 20 : 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = isHovered ? 6 : 4;

  // Background gradient
  const gradient = ctx.createLinearGradient(x, y, x, y + node.height);
  const hue = (node.probability * 1.2) % 360;
  gradient.addColorStop(0, `hsl(${hue}, 70%, ${isHovered ? 65 : 60}%)`);
  gradient.addColorStop(1, `hsl(${hue}, 60%, ${isHovered ? 50 : 45}%)`);

  ctx.fillStyle = gradient;
  drawRoundedRect(ctx, x, y, node.width, node.height, radius);
  ctx.fill();

  // Border
  if (isSelected) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (isHovered) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();

  // Text
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Title
  ctx.font = 'bold 16px sans-serif';
  const titleLines = wrapText(ctx, node.title, node.width - 20);
  titleLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, x + 10, y + 10 + i * 20);
  });

  // Description
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  const descLines = wrapText(ctx, node.description, node.width - 20);
  descLines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, x + 10, y + 50 + i * 18);
  });

  // Probability
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText(`${node.probability}%`, x + 10, y + node.height - 25);

  // Tags
  if (node.tags.length > 0) {
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const tagText = node.tags.slice(0, 2).join(', ');
    ctx.fillText(tagText, x + 10, y + node.height - 10);
  }
}

// Draw expand button on leaf nodes
export function drawExpandButton(
  ctx: CanvasRenderingContext2D,
  node: Node,
  isHovered: boolean = false
): void {
  const buttonSize = 32;
  const buttonX = node.x - buttonSize / 2;
  const buttonY = node.y - node.height / 2 - buttonSize - 10; // Above the node

  ctx.save();

  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = isHovered ? 10 : 5;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // Circle background
  ctx.fillStyle = isHovered ? 'rgba(102, 126, 234, 1)' : 'rgba(80, 100, 200, 0.9)';
  ctx.beginPath();
  ctx.arc(node.x, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Plus sign
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  const plusSize = 12;
  const centerX = node.x;
  const centerY = buttonY + buttonSize / 2;

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
  const buttonSize = 32;
  return {
    x: node.x - buttonSize / 2,
    y: node.y - node.height / 2 - buttonSize - 10,
    width: buttonSize,
    height: buttonSize,
    centerX: node.x,
    centerY: node.y - node.height / 2 - buttonSize / 2 - 10,
    radius: buttonSize / 2
  };
}

// Draw an edge (bezier curve) - from parent (bottom) to child (top)
export function drawEdge(ctx: CanvasRenderingContext2D, fromNode: Node, toNode: Node): void {
  const fromX = fromNode.x;
  const fromY = fromNode.y - fromNode.height / 2; // Top of parent
  const toX = toNode.x;
  const toY = toNode.y + toNode.height / 2; // Bottom of child

  const controlOffset = Math.abs(toY - fromY) * 0.5;

  ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
  ctx.lineWidth = 2;
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

  // Clear canvas
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a1a2e';
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
