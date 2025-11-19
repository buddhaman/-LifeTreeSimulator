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
  return {
    id,
    title,
    description,
    probability,
    tags,
    parentId,
    x: 0,
    y: 0,
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

// Tree layout algorithm - positions children under their parents
export function layoutGraph(): void {
  if (graph.nodes.length === 0) return;

  const verticalGap = 250;
  const horizontalGap = 80;

  // Find root nodes (no parent)
  const roots = graph.nodes.filter(node => node.parentId === null);

  // Calculate subtree width for each node (post-order traversal)
  const subtreeWidths = new Map<number, number>();

  function calculateSubtreeWidth(nodeId: number): number {
    if (subtreeWidths.has(nodeId)) {
      return subtreeWidths.get(nodeId)!;
    }

    const node = findNode(nodeId);
    if (!node) return 0;

    const children = getChildren(nodeId);

    if (children.length === 0) {
      // Leaf node - width is just the node's own width
      subtreeWidths.set(nodeId, node.width);
      return node.width;
    }

    // Calculate total width needed for all children
    let totalChildrenWidth = 0;
    children.forEach(child => {
      totalChildrenWidth += calculateSubtreeWidth(child.id);
    });

    // Add gaps between children
    totalChildrenWidth += (children.length - 1) * horizontalGap;

    // Subtree width is the max of node width or children width
    const width = Math.max(node.width, totalChildrenWidth);
    subtreeWidths.set(nodeId, width);
    return width;
  }

  // Position nodes recursively
  function positionNode(nodeId: number, x: number, y: number): void {
    const node = findNode(nodeId);
    if (!node) return;

    node.x = x;
    node.y = y;

    const children = getChildren(nodeId);
    if (children.length === 0) return;

    // Calculate total width needed for children
    const subtreeWidth = subtreeWidths.get(nodeId) || 0;
    let currentX = x - subtreeWidth / 2;

    children.forEach(child => {
      const childWidth = subtreeWidths.get(child.id) || 0;
      const childX = currentX + childWidth / 2;
      positionNode(child.id, childX, y - verticalGap);
      currentX += childWidth + horizontalGap;
    });
  }

  // Layout each root tree
  let rootX = 0;
  roots.forEach((root, i) => {
    calculateSubtreeWidth(root.id);
    const rootWidth = subtreeWidths.get(root.id) || 0;

    if (i > 0) {
      rootX += rootWidth / 2 + horizontalGap;
    }

    positionNode(root.id, rootX, 0);
    rootX += rootWidth / 2;
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

  layoutGraph();
}
