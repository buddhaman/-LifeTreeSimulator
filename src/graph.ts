// Type definitions
export interface Node {
  id: number;
  title: string;
  change: string; // One sentence describing what changed
  ageYears: number; // Whole years of age after the event
  ageWeeks: number; // Weeks beyond the years (0-51)
  location: string; // Current location
  relationshipStatus: string; // Relationship status
  livingSituation: string; // Living situation (e.g., renting, own house)
  careerSituation: string; // Career situation (e.g., student, working)
  monthlyIncome: number; // Net monthly income
  // Physical appearance for image generation
  hairColor: string; // Hair color (e.g., brown, blonde, black)
  hairStyle: string; // Hair style (e.g., short, long, curly)
  eyeColor: string; // Eye color (e.g., brown, blue, green)
  facialHair: string; // Facial hair (e.g., none, beard, mustache)
  glasses: string; // Glasses (e.g., none, prescription, sunglasses)
  build: string; // Build/body type (e.g., slim, average, athletic)
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
  isLoading: boolean; // True when waiting for API data
  growthProgress: number; // 0 to 1
  generatedImageUrl: string | null; // Stored generated image data URL
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

// Get growth factor for physics - 0 to 1
export function getGrowthFactor(node: Node): number {
  return node.growthProgress;
}

// Node structure
export function createNode(
  id: number,
  title: string,
  change: string,
  ageYears: number,
  ageWeeks: number,
  location: string,
  relationshipStatus: string,
  livingSituation: string,
  careerSituation: string,
  monthlyIncome: number,
  hairColor: string,
  hairStyle: string,
  eyeColor: string,
  facialHair: string,
  glasses: string,
  build: string,
  parentId: number | null = null
): Node {
  // Initialize near parent if it exists
  let initialX = 0;
  let initialY = 0;

  if (parentId !== null) {
    const parent = findNode(parentId);
    if (parent) {
      // Start close to parent with small offset
      initialX = parent.x + (Math.random() - 0.5) * 100;
      initialY = parent.y - 150; // Start close to parent, will grow away
    }
  }

  const isNew = parentId !== null;

  return {
    id,
    title,
    change,
    ageYears,
    ageWeeks,
    location,
    relationshipStatus,
    livingSituation,
    careerSituation,
    monthlyIncome,
    hairColor,
    hairStyle,
    eyeColor,
    facialHair,
    glasses,
    build,
    parentId,
    x: initialX,
    y: initialY,
    vx: 0,
    vy: 0,
    targetWidth: 270,
    targetHeight: 160,
    currentWidth: isNew ? 0 : 270,
    currentHeight: isNew ? 0 : 160,
    expanded: false,
    isGrowing: isNew,
    isLoading: false,
    growthProgress: isNew ? 0 : 1,
    generatedImageUrl: null,
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
const GROWTH_DURATION = 1.5; // 1.5 seconds for size animation

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
    if (node.isGrowing && node.growthProgress < 1) {
      node.growthProgress += deltaTime / GROWTH_DURATION;
      if (node.growthProgress >= 1) {
        node.growthProgress = 1;
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

      // Simple repulsion force multiplied by growth factors
      const growthFactorA = getGrowthFactor(nodeA);
      const growthFactorB = getGrowthFactor(nodeB);
      const combinedGrowth = growthFactorA * growthFactorB;

      const force = physicsConfig.repulsionStrength / (distance * distance) * combinedGrowth;
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

    // Hooke's law using current edge length (grows during animation)
    const growthFactor = getGrowthFactor(child);
    const force = physicsConfig.springStrength * (distance - edge.currentLength) * growthFactor;
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

    // Apply upward force when within margin, multiplied by growth factor
    if (yDiff > -UPWARD_MARGIN) {
      const growthFactor = getGrowthFactor(node);
      const strength = (yDiff + UPWARD_MARGIN) * physicsConfig.gravityStrength * growthFactor;
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

  // Root node - starting point (only node at initialization)
  const root = createNode(
    0,
    'Your Life Today',
    'Fresh graduate ready to start your career journey',
    22, // 22 years old
    0,  // 0 weeks
    'Boston, MA',
    'Single',
    'Living with roommates',
    'Recent CS Graduate',
    0, // $0/month - just graduated
    'Dark brown', // Hair color
    'Short and neat', // Hair style
    'Brown', // Eye color
    'Clean shaven', // Facial hair
    'Black-framed glasses', // Glasses
    'Average build' // Build/body type
  );
  addNode(root);

  // Physics will handle layout dynamically
}
