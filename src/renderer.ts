// Canvas rendering functions
import { isLeafNode, Node, Graph, getPathToNode } from './graph';
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

// Draw a single bubble (node) - Comic book panel style
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  node: Node,
  isHovered: boolean = false,
  isSelected: boolean = false,
  isOnCharacterPath: boolean = false
): void {
  // Use current dimensions directly
  const currentWidth = node.currentWidth;
  const currentHeight = node.currentHeight;

  const x = node.x - currentWidth / 2;
  const y = node.y - currentHeight / 2;
  const radius = 6; // Less rounded for comic book style

  ctx.save();

  // AMPLIFIED effects for character path and growing nodes
  if (isOnCharacterPath) {
    // AMPLIFIED Terracotta glow for character path (the main storyline)
    const glowIntensity = 0.85 + Math.sin(Date.now() / 250) * 0.15; // Stronger, smoother pulsing

    // Multiple layered glows for intense effect
    ctx.shadowColor = `rgba(184, 119, 94, ${glowIntensity})`;
    ctx.shadowBlur = 50;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw multiple passes for stronger glow
    for (let i = 0; i < 3; i++) {
      ctx.shadowBlur = 50 - i * 10;
      drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
      ctx.fill();
    }
  } else if (node.isGrowing) {
    // AMPLIFIED Sage green glow for growing nodes with particle effect
    const time = Date.now();
    const glowIntensity = 0.8 + Math.sin(time / 150) * 0.2; // Faster, stronger pulse
    const scaleEffect = 1 + Math.sin(time / 200) * 0.03; // Breathing effect

    // Strong multi-layer glow
    ctx.shadowColor = `rgba(138, 154, 135, ${glowIntensity})`;
    ctx.shadowBlur = 45;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.scale(scaleEffect, scaleEffect);
    ctx.translate(-node.x, -node.y);

    // Multiple glow layers
    for (let i = 0; i < 3; i++) {
      ctx.shadowBlur = 45 - i * 12;
      drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
      ctx.fill();
    }

    ctx.restore();
  } else {
    // Offset shadow for comic depth
    const shadowOffset = isHovered ? 6 : 4;
    ctx.shadowColor = 'rgba(51, 51, 51, 0.3)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = shadowOffset;
    ctx.shadowOffsetY = shadowOffset;
  }

  // White panel background (like a comic panel)
  ctx.fillStyle = isHovered ? '#FFFFFF' : '#FFFEF8';
  drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
  ctx.fill();

  ctx.restore();
  ctx.save();

  // AMPLIFIED border effects with character path support
  if (isOnCharacterPath) {
    // AMPLIFIED Terracotta border for character path (the main storyline)
    const borderPulse = 1 + Math.sin(Date.now() / 300) * 0.15;

    // Outer glow border
    ctx.strokeStyle = `rgba(184, 119, 94, 0.4)`;
    ctx.lineWidth = 8 * borderPulse;
    drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
    ctx.stroke();

    // Middle highlight border
    ctx.strokeStyle = `rgba(255, 200, 150, 0.6)`;
    ctx.lineWidth = 5 * borderPulse;
    drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
    ctx.stroke();

    // Solid main border
    ctx.strokeStyle = '#B8775E';
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
    ctx.stroke();
  } else if (isSelected) {
    // Sage green for selected (the chosen path)
    ctx.strokeStyle = '#8A9A87';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
    ctx.stroke();
  } else if (node.isGrowing) {
    // AMPLIFIED Green border for growing nodes
    const borderPulse = 1 + Math.sin(Date.now() / 200) * 0.2;

    // Outer glow
    ctx.strokeStyle = `rgba(138, 154, 135, 0.5)`;
    ctx.lineWidth = 6 * borderPulse;
    drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
    ctx.stroke();

    // Main border
    ctx.strokeStyle = '#8A9A87';
    ctx.lineWidth = 3.5;
    drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#333333'; // Charcoal for comic panel border
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x, y, currentWidth, currentHeight, radius);
    ctx.stroke();
  }

  // Comic panel corner marks
  if (!node.isGrowing) {
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    const cornerSize = 10;

    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(x + cornerSize, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + cornerSize);
    ctx.stroke();

    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(x + currentWidth - cornerSize, y + currentHeight);
    ctx.lineTo(x + currentWidth, y + currentHeight);
    ctx.lineTo(x + currentWidth, y + currentHeight - cornerSize);
    ctx.stroke();
  }

  ctx.restore();

  // Draw text content
  if (node.growthProgress >= 1) {
    // Text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Title (allow 2 lines) - Comic book handwritten font
    ctx.font = '700 18px "Patrick Hand", "Architects Daughter", cursive';
    ctx.fillStyle = '#333333'; // Charcoal
    const titleLines = wrapText(ctx, node.title, currentWidth - 32);
    const displayedTitleLines = titleLines.slice(0, 2);
    displayedTitleLines.forEach((line, i) => {
      ctx.fillText(line, x + 16, y + 16 + i * 24);
    });

    // Change description (adjust position based on title line count) - Serif for readability
    const titleHeight = displayedTitleLines.length * 24;
    ctx.font = '400 14px "Lora", "Merriweather", serif';
    ctx.fillStyle = '#7D6B5C'; // Sepia for secondary text
    const changeLines = wrapText(ctx, node.change, currentWidth - 32);
    changeLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, x + 16, y + 16 + titleHeight + 8 + i * 19);
    });

    // Age badge - Comic style
    const ageText = `${node.ageYears}y ${node.ageWeeks}w`;
    ctx.font = '700 11px "Patrick Hand", cursive';
    const ageMetrics = ctx.measureText(ageText);
    const pillWidth = ageMetrics.width + 16;
    const pillHeight = 22;
    const pillX = x + 16;
    const pillY = y + currentHeight - pillHeight - 10;

    // Comic style badge with border
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 4);
    ctx.fill();

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#333333';
    ctx.fillText(ageText, pillX + 8, pillY + 6);

    // Income badge - Comic style
    const incomeText = `$${node.monthlyIncome}`;
    const incomeMetrics = ctx.measureText(incomeText);
    const incomePillWidth = incomeMetrics.width + 16;
    const incomePillX = pillX + pillWidth + 8;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(incomePillX, pillY, incomePillWidth, pillHeight, 4);
    ctx.fill();

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#8A9A87'; // Sage green for income
    ctx.fillText(incomeText, incomePillX + 8, pillY + 6);
  }
}

// Draw expand button on leaf nodes - Comic book style
export function drawExpandButton(
  ctx: CanvasRenderingContext2D,
  node: Node,
  isHovered: boolean = false
): void {
  const buttonSize = 30;
  const buttonY = node.y - node.currentHeight / 2 - buttonSize - 12; // Above the node
  const centerX = node.x;
  const centerY = buttonY + buttonSize / 2;

  ctx.save();

  // Comic book shadow effect
  const shadowOffset = isHovered ? 4 : 3;
  ctx.shadowColor = 'rgba(51, 51, 51, 0.4)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = shadowOffset;
  ctx.shadowOffsetY = shadowOffset;

  // Circle background - Sage green with hover state
  ctx.fillStyle = isHovered ? '#9AAA97' : '#8A9A87';
  ctx.beginPath();
  ctx.arc(centerX, centerY, buttonSize / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.save();

  // Comic book border
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, buttonSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Plus sign - bold comic style
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
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
  const buttonSize = 30;
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

// Draw an edge (bezier curve) - Comic book style connector with character path support
export function drawEdge(ctx: CanvasRenderingContext2D, fromNode: Node, toNode: Node, isOnCharacterPath: boolean = false): void {
  const fromX = fromNode.x;
  const fromY = fromNode.y - fromNode.currentHeight / 2; // Top of parent
  const toX = toNode.x;
  const toY = toNode.y + toNode.currentHeight / 2; // Bottom of child

  const controlOffset = Math.abs(toY - fromY) * 0.5;

  // SUPER AMPLIFIED Character path gets much thicker lines
  const startWidth = isOnCharacterPath ? 18 : 6; // Even thicker for maximum visibility
  const endWidth = isOnCharacterPath ? 6 : 2;   // Thicker at child for character path
  const segments = 20;

  // Calculate bezier points first (before save/restore)
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

  // Helper function to draw the edge path
  const drawEdgePath = () => {
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
  };

  ctx.save();

  // SUPER AMPLIFIED multi-layer glow for character path edges
  if (isOnCharacterPath) {
    const time = Date.now();
    const glowIntensity = 0.95 + Math.sin(time / 250) * 0.05; // Intense, smooth pulsing

    // Layer 1: Outermost glow (warm highlight)
    ctx.shadowColor = `rgba(255, 200, 150, ${glowIntensity * 0.8})`;
    ctx.shadowBlur = 50;
    ctx.fillStyle = `rgba(255, 200, 150, 0.4)`;
    drawEdgePath();
    ctx.fill();

    // Layer 2: Middle glow (terracotta)
    ctx.shadowColor = `rgba(184, 119, 94, ${glowIntensity})`;
    ctx.shadowBlur = 35;
    ctx.fillStyle = `rgba(184, 119, 94, 0.85)`;
    drawEdgePath();
    ctx.fill();

    // Layer 3: Inner core (solid terracotta)
    ctx.shadowColor = `rgba(184, 119, 94, ${glowIntensity})`;
    ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(184, 119, 94, 0.95)`;
    drawEdgePath();
    ctx.fill();
  } else if (toNode.isGrowing) {
    // AMPLIFIED Sage green glow for growing edges
    const glowIntensity = 0.8 + Math.sin(Date.now() / 150) * 0.2;
    ctx.shadowColor = `rgba(138, 154, 135, ${glowIntensity})`;
    ctx.shadowBlur = 25;
    ctx.fillStyle = `rgba(138, 154, 135, ${0.8 + glowIntensity * 0.2})`;
  } else {
    ctx.fillStyle = 'rgba(125, 107, 92, 0.4)'; // Sepia/brown sketch color
  }

  // For non-character-path edges, draw once (using the helper function)
  if (!isOnCharacterPath) {
    drawEdgePath();
    ctx.fill();
  }

  ctx.restore();
}

// Draw enhanced paper background with texture and effects
function drawPaperBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();

  // Base paper color
  ctx.fillStyle = '#F8F5F2';
  ctx.fillRect(0, 0, width, height);

  // Paper noise/grain texture
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 8;
    data[i] += noise;     // R
    data[i + 1] += noise; // G
    data[i + 2] += noise; // B
  }
  ctx.putImageData(imageData, 0, 0);

  // Vignette effect (darker edges)
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
  gradient.addColorStop(0, 'rgba(125, 107, 92, 0)');
  gradient.addColorStop(1, 'rgba(125, 107, 92, 0.12)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

// Draw ruled lines (notebook paper effect)
function drawRuledLines(ctx: CanvasRenderingContext2D, camera: Camera2D): void {
  const { width, height } = ctx.canvas;
  const topLeft = camera.screenToWorld(0, 0);
  const bottomRight = camera.screenToWorld(width, height);

  const lineSpacing = 150; // Spacing between ruled lines in world units

  ctx.save();
  ctx.strokeStyle = 'rgba(125, 107, 92, 0.06)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  const startY = Math.floor(topLeft.y / lineSpacing) * lineSpacing;
  const endY = Math.ceil(bottomRight.y / lineSpacing) * lineSpacing;

  for (let y = startY; y <= endY; y += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(topLeft.x, y);
    ctx.lineTo(bottomRight.x, y);
    ctx.stroke();
  }

  ctx.restore();
}

// Draw margin line (red notebook margin)
function drawMarginLine(ctx: CanvasRenderingContext2D, camera: Camera2D): void {
  const { height } = ctx.canvas;
  const topLeft = camera.screenToWorld(0, 0);
  const bottomRight = camera.screenToWorld(0, height);

  const marginX = topLeft.x + 200; // 200 world units from left edge

  ctx.save();
  ctx.strokeStyle = 'rgba(184, 119, 94, 0.15)'; // Terracotta for margin
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(marginX, topLeft.y);
  ctx.lineTo(marginX, bottomRight.y);
  ctx.stroke();

  ctx.restore();
}

// Draw irregular hand-drawn grid with crosses
function drawGrid(ctx: CanvasRenderingContext2D, camera: Camera2D): void {
  const { width, height } = ctx.canvas;

  // Calculate world bounds visible on screen
  const topLeft = camera.screenToWorld(0, 0);
  const bottomRight = camera.screenToWorld(width, height);

  const gridSize = 100; // Grid spacing in world units

  ctx.save();

  // Calculate grid bounds (snap to grid)
  const startX = Math.floor(topLeft.x / gridSize) * gridSize;
  const startY = Math.floor(topLeft.y / gridSize) * gridSize;
  const endX = Math.ceil(bottomRight.x / gridSize) * gridSize;
  const endY = Math.ceil(bottomRight.y / gridSize) * gridSize;

  ctx.strokeStyle = 'rgba(125, 107, 92, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';

  // Draw hand-drawn crosses at grid intersections (static positions for clean look)
  for (let x = startX; x <= endX; x += gridSize) {
    for (let y = startY; y <= endY; y += gridSize) {
      // Use deterministic "random" values based on position (so crosses don't move)
      const hash = (x * 73856093) ^ (y * 19349663);
      const pseudoRand1 = ((hash & 0xFFFF) / 0xFFFF - 0.5) * 2;
      const pseudoRand2 = (((hash >> 16) & 0xFFFF) / 0xFFFF - 0.5) * 2;
      const pseudoRand3 = ((hash & 0xFF) / 0xFF);

      const offsetX = pseudoRand1;
      const offsetY = pseudoRand2;
      const crossSize = 2.5 + pseudoRand3 * 1.5;

      const cx = x + offsetX;
      const cy = y + offsetY;

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(cx - crossSize, cy);
      ctx.lineTo(cx + crossSize, cy);
      ctx.stroke();

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(cx, cy - crossSize);
      ctx.lineTo(cx, cy + crossSize);
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
  hoveredButtonNodeId: number | null,
  characterNodeId: number | null
): void {
  const { width, height } = ctx.canvas;

  // Enhanced paper background with texture and vignette
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawPaperBackground(ctx, width, height);

  // Apply camera transform for world-space elements
  camera.applyTransform(ctx);

  // Draw notebook-style background elements
  drawRuledLines(ctx, camera);
  drawMarginLine(ctx, camera);
  drawGrid(ctx, camera);

  // Get character path for gold highlighting
  const characterPath = characterNodeId !== null ? getPathToNode(characterNodeId) : [];
  const characterPathSet = new Set(characterPath);

  // Draw edges
  graph.edges.forEach(edge => {
    const fromNode = graph.nodes.find(n => n.id === edge.fromId);
    const toNode = graph.nodes.find(n => n.id === edge.toId);
    if (fromNode && toNode) {
      // Check if this edge is on the character path
      const isOnCharacterPath = characterPathSet.has(edge.fromId) && characterPathSet.has(edge.toId);
      drawEdge(ctx, fromNode, toNode, isOnCharacterPath);
    }
  });

  // Draw nodes
  graph.nodes.forEach(node => {
    const isHovered = node.id === hoveredNodeId;
    const isSelected = node.id === selectedNodeId;
    const isOnCharacterPath = characterPathSet.has(node.id);
    drawBubble(ctx, node, isHovered, isSelected, isOnCharacterPath);
  });

  // Draw expand buttons on leaf nodes (only if not growing)
  graph.nodes.forEach(node => {
    if (isLeafNode(node.id) && !node.expanded && !node.isGrowing) {
      const isButtonHovered = node.id === hoveredButtonNodeId;
      drawExpandButton(ctx, node, isButtonHovered);
    }
  });
}
