// Type definitions
export interface Node {
  id: number;
  title: string;
  description: string;
  probability: number;
  tags: string[];
  parentId: number | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetWidth: number;
  targetHeight: number;
  currentWidth: number;
  currentHeight: number;
  expanded: boolean;
  isGrowing: boolean;
  growthProgress: number; // 0 to 1
}

export interface Edge {
  fromId: number;
  toId: number;
  currentLength: number; // Current visual length (for animation)
  targetLength: number; // Target length (spring length)
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
  initialized: boolean;
}

// Simple graph structure
export const graph: Graph = {
  nodes: [],
  edges: [],
  initialized: false,
};

// Node structure
export function createNode(
  id: number,
  title: string,
  description: string,
  probability: number,
  tags: string[] = [],
  parentId: number | null = null
): Node {
  // Initialize near parent if it exists
  let initialX = 0;
  let initialY = 0;
  
  if (parentId !== null) {
    const parent = findNode(parentId);
    if (parent) {
      // Start at final spring length distance from parent
      initialX = parent.x + (Math.random() - 0.5) * 100;
      initialY = parent.y - physicsConfig.springLength; // Start at spring length distance
    }
  }
  
  const isNew = parentId !== null;

  return {
    id,
    title,
    description,
    probability,
    tags,
    parentId,
    x: initialX,
    y: initialY,
    vx: 0,
    vy: 0,
    targetWidth: 250,
    targetHeight: 150,
    currentWidth: isNew ? 0 : 250,
    currentHeight: isNew ? 0 : 150,
    expanded: false,
    isGrowing: isNew,
    growthProgress: isNew ? 0 : 1,
  };
}

// Edge structure
export function createEdge(fromId: number, toId: number): Edge {
  return {
    fromId,
    toId,
    currentLength: 0, // Start at 0 for animation
    targetLength: physicsConfig.springLength,
  };
}

// Add a node to the graph
export function addNode(node: Node): void {
  graph.nodes.push(node);
  if (node.parentId !== null) {
    graph.edges.push(createEdge(node.parentId, node.id));
  }
}

// Find node by ID
export function findNode(id: number): Node | undefined {
  return graph.nodes.find(node => node.id === id);
}

// Get children of a node
export function getChildren(nodeId: number): Node[] {
  const childEdges = graph.edges.filter(edge => edge.fromId === nodeId);
  return childEdges.map(edge => findNode(edge.toId)).filter((node): node is Node => node !== undefined);
}

// Check if a node is a leaf node (has no children)
export function isLeafNode(nodeId: number): boolean {
  return getChildren(nodeId).length === 0;
}

// Physics configuration - exported so UI can modify
export interface PhysicsConfig {
  repulsionStrength: number;
  repulsionRange: number;
  springStrength: number;
  springLength: number;
  friction: number;
  gravityStrength: number;
  maxVelocity: number;
}

export const physicsConfig: PhysicsConfig = {
  repulsionStrength: 30000,
  repulsionRange: 400,
  springStrength: 0.076,
  springLength: 520,
  friction: 0.85,
  gravityStrength: 0.15,
  maxVelocity: 20,
};

const MIN_DISTANCE = 10;
const GROWTH_DURATION = 3.0; // 3 seconds

let lastUpdateTime = Date.now();

// Physics simulation - update node positions based on forces
export function updatePhysics(): void {
  if (graph.nodes.length === 0) return;

  const now = Date.now();
  const deltaTime = (now - lastUpdateTime) / 1000; // Convert to seconds
  lastUpdateTime = now;

  const dt = 1;

  // Update growing nodes
  graph.nodes.forEach(node => {
    if (node.isGrowing) {
      node.growthProgress += deltaTime / GROWTH_DURATION;
      if (node.growthProgress >= 1) {
        node.growthProgress = 1;
        node.isGrowing = false;
      }
      // Update size
      node.currentWidth = node.targetWidth * node.growthProgress;
      node.currentHeight = node.targetHeight * node.growthProgress;
    }
  });

  // Update growing edges
  graph.edges.forEach(edge => {
    if (edge.currentLength < edge.targetLength) {
      const growthRate = (edge.targetLength / GROWTH_DURATION) * deltaTime;
      edge.currentLength = Math.min(edge.currentLength + growthRate, edge.targetLength);
    }
  });

  // 1. Repulsion between all nodes (prevent overlap)
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      const nodeA = graph.nodes[i];
      const nodeB = graph.nodes[j];

      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < MIN_DISTANCE || distance > physicsConfig.repulsionRange) continue;

      // Simple repulsion force
      const force = physicsConfig.repulsionStrength / (distance * distance);
      const fx = (dx / distance) * force * dt;
      const fy = (dy / distance) * force * dt;

      nodeA.vx -= fx;
      nodeA.vy -= fy;
      nodeB.vx += fx;
      nodeB.vy += fy;
    }
  }

  // 2. Spring force between connected nodes (parent-child)
  graph.edges.forEach(edge => {
    const parent = findNode(edge.fromId);
    const child = findNode(edge.toId);

    if (!parent || !child) return;

    const dx = child.x - parent.x;
    const dy = child.y - parent.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < MIN_DISTANCE) return;

    // Hooke's law using current edge length (for animation)
    const force = physicsConfig.springStrength * (distance - edge.currentLength);
    const fx = (dx / distance) * force * dt;
    const fy = (dy / distance) * force * dt;

    // Apply impulse directly to velocities
    parent.vx += fx;
    parent.vy += fy;
    child.vx -= fx;
    child.vy -= fy;
  });

  // 3. Conditional upward gravity (only when too close to parent)
  const UPWARD_MARGIN = 200;

  graph.nodes.forEach((node) => {
    if (node.parentId === null) return;

    const parent = findNode(node.parentId);
    if (!parent) return;

    const yDiff = node.y - parent.y;

    // Apply upward force when within margin
    if (yDiff > -UPWARD_MARGIN) {
      const strength = (yDiff + UPWARD_MARGIN) * physicsConfig.gravityStrength;
      node.vy -= strength * dt;
    }
  });

  // Update positions and apply friction
  graph.nodes.forEach((node) => {
    // Apply friction
    node.vx *= physicsConfig.friction;
    node.vy *= physicsConfig.friction;

    // Clamp velocity
    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (speed > physicsConfig.maxVelocity) {
      node.vx = (node.vx / speed) * physicsConfig.maxVelocity;
      node.vy = (node.vy / speed) * physicsConfig.maxVelocity;
    }

    // Update position
    node.x += node.vx * dt;
    node.y += node.vy * dt;

    // Keep root node fixed at origin
    if (node.parentId === null) {
      node.x = 0;
      node.y = 0;
      node.vx = 0;
      node.vy = 0;
    }
  });
}

// Initialize with a sample tree
export function initializeGraph(): void {
  // Prevent double initialization
  if (graph.initialized) return;
  graph.initialized = true;

  // Clear existing graph
  graph.nodes = [];
  graph.edges = [];

  // Root node
  const root = createNode(
    0,
    'Your Life Today',
    'You are at a crossroads. What path will you take?',
    100,
    ['present', 'start']
  );
  addNode(root);

  // First level children
  const child1 = createNode(
    1,
    'Stay the Course',
    'Continue on your current path with minor adjustments.',
    75,
    ['stability', 'safe'],
    0
  );
  addNode(child1);

  const child2 = createNode(
    2,
    'Take a Risk',
    'Make a bold change that could transform everything.',
    45,
    ['risk', 'growth'],
    0
  );
  addNode(child2);

  const child3 = createNode(
    3,
    'Explore Options',
    'Research and consider new possibilities before deciding.',
    85,
    ['research', 'careful'],
    0
  );
  addNode(child3);

  // Second level children (from child1)
  const grandchild1 = createNode(
    4,
    'Career Focus',
    'Double down on your professional development.',
    70,
    ['career', 'ambition'],
    1
  );
  addNode(grandchild1);

  const grandchild2 = createNode(
    5,
    'Life Balance',
    'Prioritize work-life balance and personal wellness.',
    80,
    ['wellness', 'balance'],
    1
  );
  addNode(grandchild2);

  // Physics will handle layout dynamically
}
