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
  vx: number; // velocity x
  vy: number; // velocity y
  width: number;
  height: number;
  expanded: boolean;
}

export interface Edge {
  fromId: number;
  toId: number;
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
      // Start near parent with small random offset
      initialX = parent.x + (Math.random() - 0.5) * 100;
      initialY = parent.y - 200 + (Math.random() - 0.5) * 50;
    }
  }
  
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
    width: 250,
    height: 150,
    expanded: false,
  };
}

// Edge structure
export function createEdge(fromId: number, toId: number): Edge {
  return {
    fromId,
    toId,
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

// Physics-based force simulation parameters
const REPULSION_STRENGTH = 50000; // Repulsion force between nodes
const SPRING_STRENGTH = 0.01; // Spring force for parent-child connections
const SPRING_LENGTH = 200; // Desired distance between parent-child
const FRICTION = 0.85; // Damping factor (0-1, lower = more friction)
const GRAVITY_Y = 0.5; // Upward gravity (very low)
const MIN_DISTANCE = 10; // Minimum distance for repulsion calculation
const MAX_VELOCITY = 20; // Cap velocity to prevent instability

// Physics simulation - update node positions based on forces
export function updatePhysics(): void {
  if (graph.nodes.length === 0) return;

  const dt = 1; // timestep

  // Calculate forces for each node
  const forces: { x: number; y: number }[] = graph.nodes.map(() => ({ x: 0, y: 0 }));

  // 1. Repulsion between all nodes (prevent overlap)
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      const nodeA = graph.nodes[i];
      const nodeB = graph.nodes[j];

      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < MIN_DISTANCE) continue;

      // Coulomb-like repulsion (inverse square)
      const force = REPULSION_STRENGTH / (distance * distance);
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      forces[i].x -= fx;
      forces[i].y -= fy;
      forces[j].x += fx;
      forces[j].y += fy;
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

    // Hooke's law: F = k * (distance - restLength)
    const force = SPRING_STRENGTH * (distance - SPRING_LENGTH);
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;

    const parentIndex = graph.nodes.findIndex(n => n.id === parent.id);
    const childIndex = graph.nodes.findIndex(n => n.id === child.id);

    if (parentIndex !== -1) {
      forces[parentIndex].x += fx;
      forces[parentIndex].y += fy;
    }
    if (childIndex !== -1) {
      forces[childIndex].x -= fx;
      forces[childIndex].y -= fy;
    }
  });

  // 3. Apply upward gravity (to orient tree upward)
  graph.nodes.forEach((_node, i) => {
    forces[i].y -= GRAVITY_Y; // Negative y is upward
  });

  // Update velocities and positions
  graph.nodes.forEach((node, i) => {
    // Apply forces to velocity
    node.vx += forces[i].x * dt;
    node.vy += forces[i].y * dt;

    // Apply friction
    node.vx *= FRICTION;
    node.vy *= FRICTION;

    // Clamp velocity
    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (speed > MAX_VELOCITY) {
      node.vx = (node.vx / speed) * MAX_VELOCITY;
      node.vy = (node.vy / speed) * MAX_VELOCITY;
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
