import { useEffect, useRef, useState } from 'react';
import { Camera2D } from './Camera2D';
import { graph, initializeGraph, updatePhysics, addNode, createNode, isLeafNode, Node } from './graph';
import { render, getExpandButtonBounds } from './renderer';
import { generateChildScenariosStreaming } from './openai';
import { Skeleton } from './Skeleton';
import { generateLifeImage } from './gemini';
import greenptLogo from './assets/logo-greenpt.png';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera2D | null>(null);
  const animationRef = useRef<number | null>(null);
  const skeletonRef = useRef<Skeleton | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  const [hoveredButtonNodeId, setHoveredButtonNodeId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isImageEnlarged, setIsImageEnlarged] = useState(false);
  const [isGeneratingLifeBook, setIsGeneratingLifeBook] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    change: '',
    ageYears: 0,
    ageWeeks: 0,
    location: '',
    relationshipStatus: '',
    livingSituation: '',
    careerSituation: '',
    monthlyIncome: 0,
    hairColor: '',
    hairStyle: '',
    eyeColor: '',
    facialHair: '',
    glasses: '',
    build: ''
  });
  // Drag state types
  type DragStateIdle = { type: 'idle' };
  type DragStateNode = { type: 'node'; nodeId: number };
  type DragStateCharacter = { type: 'character'; offsetX: number; offsetY: number };
  type DragStateCanvas = { type: 'canvas' };
  type DragState = DragStateIdle | DragStateNode | DragStateCharacter | DragStateCanvas;

  const dragStateRef = useRef<DragState>({ type: 'idle' });
  const mouseWorldPosRef = useRef({ x: 0, y: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const DRAG_THRESHOLD = 5;

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔄 [STATE] isGeneratingImage changed to:', isGeneratingImage);
  }, [isGeneratingImage]);

  useEffect(() => {
    console.log('🔄 [STATE] generatedImage changed to:', generatedImage ? `${generatedImage.substring(0, 50)}...` : 'null');
  }, [generatedImage]);

  useEffect(() => {
    console.log('🔄 [STATE] selectedNodeId changed to:', selectedNodeId);

    // Load saved image from node when selection changes
    if (selectedNodeId !== null) {
      const selectedNode = graph.nodes.find(n => n.id === selectedNodeId);
      if (selectedNode && selectedNode.generatedImageUrl) {
        console.log('🖼️ [LOAD] Loading saved image from node:', selectedNodeId);
        setGeneratedImage(selectedNode.generatedImageUrl);
      } else {
        console.log('🖼️ [LOAD] No saved image for node:', selectedNodeId);
        setGeneratedImage(null);
      }
    }
  }, [selectedNodeId]);

  // ESC key handler to close enlarged image
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isImageEnlarged) {
        console.log('🖼️ [MODAL] ESC pressed - closing enlarged image');
        setIsImageEnlarged(false);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isImageEnlarged]);

  // Initialize graph and camera
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize camera and graph
    cameraRef.current = new Camera2D(canvas);
    initializeGraph();
    // Set initial selected node to root
    setSelectedNodeId(0);

    // Initialize skeleton at root node position (world coordinates)
    const rootNode = graph.nodes[0];
    if (rootNode) {
      skeletonRef.current = new Skeleton(rootNode.x, rootNode.y);
      skeletonRef.current.setNode(rootNode);
    }

    // Add wheel listener directly to canvas (not through React) to allow preventDefault
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const camera = cameraRef.current;
      if (!camera) return;
      camera.zoomAt(e.clientX, e.clientY, -e.deltaY);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Render loop with physics update
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const camera = cameraRef.current;
    if (!ctx || !camera) return;

    const renderLoop = () => {
      // Update physics simulation
      updatePhysics();

      // Update skeleton
      if (skeletonRef.current) {
        const isDragging = dragStateRef.current.type === 'character';

        // Update character left hand position when dragging (before physics update)
        if (isDragging) {
          // Detach from node completely
          skeletonRef.current.currentNode = null;

          // Get left hand particle (index 15 in particles array)
          const leftHand = skeletonRef.current.particles[15];
          if (leftHand) {
            // Pin left hand directly to mouse position (no offset)
            // Account for z-projection: screenY = worldY - z, so worldY = screenY + z
            const targetZ = 50;
            leftHand.x = mouseWorldPosRef.current.x;
            leftHand.y = mouseWorldPosRef.current.y + targetZ;
            leftHand.z = targetZ;
            leftHand.oldX = leftHand.x;
            leftHand.oldY = leftHand.y;
            leftHand.oldZ = leftHand.z;
          }
        }

        skeletonRef.current.update(1, isDragging);
      }

      // Update dragged node position every frame
      if (dragStateRef.current.type === 'node') {
        const node = graph.nodes.find(n => n.id === dragStateRef.current.nodeId);
        if (node) {
          node.x = mouseWorldPosRef.current.x;
          node.y = mouseWorldPosRef.current.y;
          node.vx = 0;
          node.vy = 0;
        }
      }

      // Get character node ID for gold path rendering
      const characterNodeId = skeletonRef.current?.currentNode?.id ?? null;

      // Render
      render(ctx, camera, graph, hoveredNodeId, selectedNodeId, hoveredButtonNodeId, characterNodeId);

      // Render skeleton in world space (affected by camera)
      if (skeletonRef.current) {
        skeletonRef.current.render(ctx);
      }

      animationRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [hoveredNodeId, selectedNodeId, hoveredButtonNodeId, draggedNodeId]);

  // Hit test to find node at position
  const hitTest = (worldX: number, worldY: number): Node | null => {
    for (let i = graph.nodes.length - 1; i >= 0; i--) {
      const node = graph.nodes[i];
      const halfW = node.currentWidth / 2;
      const halfH = node.currentHeight / 2;

      if (
        worldX >= node.x - halfW &&
        worldX <= node.x + halfW &&
        worldY >= node.y - halfH &&
        worldY <= node.y + halfH
      ) {
        return node;
      }
    }
    return null;
  };

  // Hit test for expand button
  const hitTestExpandButton = (worldX: number, worldY: number): Node | null => {
    for (let i = graph.nodes.length - 1; i >= 0; i--) {
      const node = graph.nodes[i];
      if (isLeafNode(node.id) && !node.expanded && !node.isGrowing) {
        const bounds = getExpandButtonBounds(node);
        const dx = worldX - bounds.centerX;
        const dy = worldY - bounds.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= bounds.radius) {
          return node;
        }
      }
    }
    return null;
  };

  // Hit test for skeleton character (check head area)
  const hitTestCharacter = (worldX: number, worldY: number): boolean => {
    const skeleton = skeletonRef.current;
    if (!skeleton || !skeleton.head) return false;

    const headScreenY = skeleton.head.y - skeleton.head.z;
    const dx = worldX - skeleton.head.x;
    const dy = worldY - headScreenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Hit test a larger area around the head (radius ~40 for easier grabbing)
    return distance <= 50;
  };

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const camera = cameraRef.current;
    const skeleton = skeletonRef.current;
    if (!camera) return;

    const worldPos = camera.screenToWorld(e.clientX, e.clientY);
    mouseWorldPosRef.current = worldPos;

    if (dragStateRef.current.type === 'canvas') {
      // Dragging canvas
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      camera.pan(-dx, -dy);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    } else if (dragStateRef.current.type === 'idle') {
      // Update hover states
      const buttonNode = hitTestExpandButton(worldPos.x, worldPos.y);
      if (buttonNode) {
        setHoveredButtonNodeId(buttonNode.id);
        setHoveredNodeId(null);
      } else {
        setHoveredButtonNodeId(null);
        const node = hitTest(worldPos.x, worldPos.y);
        setHoveredNodeId(node ? node.id : null);
      }
    }
  };

  // Mouse down handler
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const camera = cameraRef.current;
    const skeleton = skeletonRef.current;
    if (!camera) return;

    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    const worldPos = camera.screenToWorld(e.clientX, e.clientY);
    mouseWorldPosRef.current = worldPos;

    // Priority: Character > Node > Canvas
    const hitChar = hitTestCharacter(worldPos.x, worldPos.y);

    if (hitChar && skeleton) {
      // Grab character - detach from node
      skeleton.currentNode = null;
      const headScreenY = skeleton.head.y - skeleton.head.z;
      dragStateRef.current = {
        type: 'character',
        offsetX: skeleton.head.x - worldPos.x,
        offsetY: headScreenY - worldPos.y
      };
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grabbing';
      }
    } else {
      const node = hitTest(worldPos.x, worldPos.y);
      if (node) {
        // Grab node
        setDraggedNodeId(node.id);
        dragStateRef.current = { type: 'node', nodeId: node.id };
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grabbing';
        }
      } else {
        // Grab canvas
        dragStateRef.current = { type: 'canvas' };
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grabbing';
        }
      }
    }
  };

  // Mouse up handler
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const camera = cameraRef.current;
    const skeleton = skeletonRef.current;
    if (!camera) return;

    const dx = e.clientX - mouseDownPosRef.current.x;
    const dy = e.clientY - mouseDownPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const wasClick = distance < DRAG_THRESHOLD;

    // Handle click (not drag)
    if (wasClick && dragStateRef.current.type !== 'character') {
      const worldPos = camera.screenToWorld(e.clientX, e.clientY);

      // Check for button click first
      const buttonNode = hitTestExpandButton(worldPos.x, worldPos.y);
      if (buttonNode) {
        expandNode(buttonNode.id);
      } else {
        // Check for node click
        const node = hitTest(worldPos.x, worldPos.y);
        if (node) {
          console.log('🖱️ [CLICK] Node clicked:', node.id, node.title);
          setSelectedNodeId(node.id);
          // The useEffect will handle loading the saved image from the node
        } else {
          console.log('🖱️ [CLICK] Click detected but no node hit');
        }
      }
    }

    // If we were dragging the character, snap to nearest node
    if (dragStateRef.current.type === 'character' && skeleton) {
      const headScreenY = skeleton.head.y - skeleton.head.z;

      // Find nearest node
      let nearestNode = null;
      let minDistance = Infinity;

      for (const node of graph.nodes) {
        const dx = node.x - skeleton.head.x;
        const dy = node.y - headScreenY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDistance) {
          minDistance = dist;
          nearestNode = node;
        }
      }

      if (nearestNode) {
        skeleton.setNode(nearestNode);
      }
    }

    // Reset drag states
    setDraggedNodeId(null);
    dragStateRef.current = { type: 'idle' };

    // Update cursor based on hover
    const hasHover = hoveredNodeId !== null || hoveredButtonNodeId !== null;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hasHover ? 'pointer' : 'grab';
    }
  };

  // Update cursor based on hover state
  useEffect(() => {
    if (canvasRef.current && dragStateRef.current.type === 'idle') {
      const hasHover = hoveredNodeId !== null || hoveredButtonNodeId !== null;
      canvasRef.current.style.cursor = hasHover ? 'pointer' : 'grab';
    }
  }, [hoveredNodeId, hoveredButtonNodeId]);

  // Expand node - generate children with streaming
  const expandNode = async (nodeId: number) => {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node || node.expanded) return;

    // Mark as expanded
    node.expanded = true;

    // Create 3 placeholder nodes immediately
    const placeholderNodes: Node[] = [];
    for (let i = 0; i < 3; i++) {
      const childId = graph.nodes.length;
      const child = createNode(
        childId,
        'Loading...',
        'Generating scenario...',
        node.ageYears,
        node.ageWeeks,
        node.location,
        node.relationshipStatus,
        node.livingSituation,
        node.careerSituation,
        node.monthlyIncome,
        node.hairColor,
        node.hairStyle,
        node.eyeColor,
        node.facialHair,
        node.glasses,
        node.build,
        nodeId
      );
      addNode(child);
      placeholderNodes.push(child);
    }

    try {
      // Stream scenarios from OpenAI - updates happen as they arrive
      let nodeIndex = 0;
      await generateChildScenariosStreaming(node, 3, (scenario) => {
        if (nodeIndex < placeholderNodes.length) {
          const child = placeholderNodes[nodeIndex];
          child.title = scenario.title;
          child.change = scenario.change;
          child.ageYears = scenario.ageYears;
          child.ageWeeks = scenario.ageWeeks;
          child.location = scenario.location;
          child.relationshipStatus = scenario.relationshipStatus;
          child.livingSituation = scenario.livingSituation;
          child.careerSituation = scenario.careerSituation;
          child.monthlyIncome = scenario.monthlyIncome;
          // Set isGrowing to false for this node
          child.isGrowing = false;
          nodeIndex++;
        }
      });

    } catch (error) {
      console.error('Failed to generate scenarios:', error);
      // Remove placeholder nodes on error
      placeholderNodes.forEach(child => {
        const nodeIndex = graph.nodes.findIndex(n => n.id === child.id);
        if (nodeIndex !== -1) {
          graph.nodes.splice(nodeIndex, 1);
        }
        const edgeIndex = graph.edges.findIndex(e => e.toId === child.id);
        if (edgeIndex !== -1) {
          graph.edges.splice(edgeIndex, 1);
        }
      });
      // Revert expanded state on error
      node.expanded = false;
    }
  };

  // Handle edit button click
  const handleEditClick = (nodeId: number) => {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return;

    setEditForm({
      title: node.title,
      change: node.change,
      ageYears: node.ageYears,
      ageWeeks: node.ageWeeks,
      location: node.location,
      relationshipStatus: node.relationshipStatus,
      livingSituation: node.livingSituation,
      careerSituation: node.careerSituation,
      monthlyIncome: node.monthlyIncome,
      hairColor: node.hairColor,
      hairStyle: node.hairStyle,
      eyeColor: node.eyeColor,
      facialHair: node.facialHair,
      glasses: node.glasses,
      build: node.build
    });
    setEditingNodeId(nodeId);
  };

  // Handle save from modal
  const handleSaveEdit = () => {
    if (editingNodeId === null) return;

    const node = graph.nodes.find(n => n.id === editingNodeId);
    if (!node) return;

    node.title = editForm.title;
    node.change = editForm.change;
    node.ageYears = editForm.ageYears;
    node.ageWeeks = editForm.ageWeeks;
    node.location = editForm.location;
    node.relationshipStatus = editForm.relationshipStatus;
    node.livingSituation = editForm.livingSituation;
    node.careerSituation = editForm.careerSituation;
    node.monthlyIncome = editForm.monthlyIncome;
    node.hairColor = editForm.hairColor;
    node.hairStyle = editForm.hairStyle;
    node.eyeColor = editForm.eyeColor;
    node.facialHair = editForm.facialHair;
    node.glasses = editForm.glasses;
    node.build = editForm.build;

    setEditingNodeId(null);
  };

  // Handle cancel from modal
  const handleCancelEdit = () => {
    setEditingNodeId(null);
  };

  // Generate image for a node
  const generateImageForNode = async (node: Node) => {
    console.log('🖼️ [APP] Image generation requested for node:', node.id, node.title);
    setIsGeneratingImage(true);
    setGeneratedImage(null); // Clear previous image

    try {
      console.log('🖼️ [APP] Calling generateLifeImage...');
      const imageDataUrl = await generateLifeImage(node);
      console.log('🖼️ [APP] generateLifeImage returned:', imageDataUrl ? 'SUCCESS (image data received)' : 'NULL (no image)');

      if (imageDataUrl) {
        // Save to node
        node.generatedImageUrl = imageDataUrl;
        console.log('🖼️ [APP] Image saved to node:', node.id);

        setGeneratedImage(imageDataUrl);
        console.log('🖼️ [APP] Image state updated successfully');
      } else {
        console.warn('🖼️ [APP] No image data returned from generateLifeImage');
      }
    } catch (error) {
      console.error('🖼️ [APP] ❌ Failed to generate image:', error);
    } finally {
      setIsGeneratingImage(false);
      console.log('🖼️ [APP] Image generation process complete');
    }
  };

  // Get path from root to selected node
  const getPathToNode = (nodeId: number): Node[] => {
    const path: Node[] = [];
    let currentId: number | null = nodeId;

    while (currentId !== null) {
      const node = graph.nodes.find(n => n.id === currentId);
      if (!node) break;
      path.unshift(node); // Add to beginning to get root-to-node order
      currentId = node.parentId;
    }

    console.log('📖 [LIFEBOOK] Path from root to node', nodeId, ':', path.map(n => n.id));
    return path;
  };

  // Generate life book
  const generateLifeBook = async () => {
    // Get skeleton's current node
    const characterNodeId = skeletonRef.current?.currentNode?.id;

    if (characterNodeId === undefined || characterNodeId === null) {
      console.warn('📖 [LIFEBOOK] Character not on any node');
      return;
    }

    console.log('📖 [LIFEBOOK] Starting life book generation for character node:', characterNodeId);
    setIsGeneratingLifeBook(true);

    try {
      // Get path from root to character's current node
      const path = getPathToNode(characterNodeId);
      console.log('📖 [LIFEBOOK] Path contains', path.length, 'nodes');

      // Generate images for nodes that don't have them
      console.log('📖 [LIFEBOOK] Generating missing images...');
      for (let i = 0; i < path.length; i++) {
        const node = path[i];
        if (!node.generatedImageUrl) {
          console.log(`📖 [LIFEBOOK] Generating image for node ${node.id}: ${node.title}`);
          const imageDataUrl = await generateLifeImage(node);
          if (imageDataUrl) {
            node.generatedImageUrl = imageDataUrl;
            console.log(`📖 [LIFEBOOK] ✓ Image generated for node ${node.id}`);
          } else {
            console.warn(`📖 [LIFEBOOK] ⚠️ Failed to generate image for node ${node.id}`);
          }
        } else {
          console.log(`📖 [LIFEBOOK] ✓ Node ${node.id} already has image`);
        }
      }

      // Create HTML life book
      console.log('📖 [LIFEBOOK] Creating HTML life book...');
      const lifeBookHTML = createLifeBookHTML(path);

      // Open in new window
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(lifeBookHTML);
        newWindow.document.close();
        console.log('📖 [LIFEBOOK] ✅ Life book opened in new window');
      } else {
        console.error('📖 [LIFEBOOK] ❌ Failed to open new window');
      }
    } catch (error) {
      console.error('📖 [LIFEBOOK] ❌ Error generating life book:', error);
    } finally {
      setIsGeneratingLifeBook(false);
      console.log('📖 [LIFEBOOK] Life book generation complete');
    }
  };

  // Create HTML for life book
  const createLifeBookHTML = (path: Node[]): string => {
    const imagesPerPage = 6;
    const pages: Node[][] = [];

    // Split nodes into pages
    for (let i = 0; i < path.length; i += imagesPerPage) {
      pages.push(path.slice(i, i + imagesPerPage));
    }

    console.log('📖 [LIFEBOOK] Creating', pages.length, 'pages');

    const pagesHTML = pages.map((pageNodes, pageIndex) => {
      const itemsHTML = pageNodes.map(node => `
        <div class="life-book-item">
          <div class="life-book-image-container">
            ${node.generatedImageUrl
              ? `<img src="${node.generatedImageUrl}" alt="${node.title}" class="life-book-image" />`
              : `<div class="life-book-placeholder">No image</div>`
            }
          </div>
          <p class="life-book-description">${node.change}</p>
        </div>
      `).join('');

      return `
        <div class="life-book-page">
          <div class="life-book-grid">
            ${itemsHTML}
          </div>
          <div class="page-number">Page ${pageIndex + 1} of ${pages.length}</div>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Life Book</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
            background: #f5f5f7;
            padding: 20px;
          }

          .life-book-page {
            width: 210mm;
            min-height: 297mm;
            background: white;
            margin: 0 auto 20px;
            padding: 20mm;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            position: relative;
            page-break-after: always;
          }

          .life-book-page:last-child {
            margin-bottom: 0;
          }

          .life-book-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15mm;
          }

          .life-book-item {
            break-inside: avoid;
          }

          .life-book-image-container {
            width: 100%;
            aspect-ratio: 16/9;
            background: #f5f5f7;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .life-book-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .life-book-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #86868b;
            font-size: 14px;
          }

          .life-book-description {
            font-size: 11px;
            line-height: 1.5;
            color: #1d1d1f;
            font-style: italic;
          }

          .page-number {
            position: absolute;
            bottom: 10mm;
            right: 10mm;
            font-size: 10px;
            color: #86868b;
          }

          @media print {
            body {
              background: white;
              padding: 0;
            }

            .life-book-page {
              margin: 0;
              box-shadow: none;
              width: 210mm;
              height: 297mm;
            }
          }
        </style>
      </head>
      <body>
        ${pagesHTML}
      </body>
      </html>
    `;
  };

  return (
    <div className="app">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />

      {/* Powered by GreenPT Logo */}
      <div className="powered-by-logo">
        <span className="powered-by-text">Powered by</span>
        <img src={greenptLogo} alt="GreenPT" className="greenpt-logo" />
      </div>

      <div className="sidebar">
        <h1>LifeTree AI</h1>

        {/* Generate Life Book Button */}
        <button
          className="generate-lifebook-button"
          onClick={generateLifeBook}
          disabled={isGeneratingLifeBook}
        >
          {isGeneratingLifeBook ? (
            <>
              <span className="lifebook-spinner"></span>
              Generating Life Book...
            </>
          ) : (
            <>
              <span className="lifebook-icon">📖</span>
              Generate Life Book
            </>
          )}
        </button>

        {/* Image Display Section */}
        {selectedNodeId !== null && (
          <div className="image-section">
            {!isGeneratingImage && !generatedImage && (
              <button
                className="generate-image-button"
                onClick={() => {
                  const selectedNode = graph.nodes.find(n => n.id === selectedNodeId);
                  if (selectedNode) {
                    console.log('🖱️ [BUTTON] Generate Image button clicked');
                    generateImageForNode(selectedNode);
                  }
                }}
              >
                Generate Image
              </button>
            )}
            {isGeneratingImage && (
              <div className="image-loading">
                <div className="loading-spinner"></div>
                <p>Generating life illustration...</p>
              </div>
            )}
            {!isGeneratingImage && generatedImage && (
              <div className="generated-image-container">
                <img
                  src={generatedImage}
                  alt="Life situation illustration"
                  className="generated-image"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    console.log('🖼️ [MODAL] Image clicked - opening enlarged view');
                    setIsImageEnlarged(true);
                  }}
                  onLoad={() => console.log('🖼️ [UI] Image loaded successfully in DOM')}
                  onError={(e) => console.error('🖼️ [UI] Image failed to load:', e)}
                  title="Click to enlarge"
                />
                <button
                  className="regenerate-image-button"
                  onClick={() => {
                    const selectedNode = graph.nodes.find(n => n.id === selectedNodeId);
                    if (selectedNode) {
                      console.log('🖱️ [BUTTON] Regenerate Image button clicked');
                      generateImageForNode(selectedNode);
                    }
                  }}
                >
                  Regenerate Image
                </button>
              </div>
            )}
          </div>
        )}

        {selectedNodeId !== null && (() => {
          const selectedNode = graph.nodes.find(n => n.id === selectedNodeId);
          if (selectedNode) {
            const isLeaf = isLeafNode(selectedNode.id);
            return (
              <div className="selected-node">
                <h3>Current Scenario</h3>
                <div className="node-details">
                  <h4>{selectedNode.title}</h4>
                  <p className="description">{selectedNode.change}</p>
                  <div className="node-metadata">
                    <div className="probability">
                      <span className="label">Age:</span>
                      <span className="value">{selectedNode.ageYears}y {selectedNode.ageWeeks}w</span>
                    </div>
                    <div className="probability">
                      <span className="label">Location:</span>
                      <span className="value">{selectedNode.location}</span>
                    </div>
                    <div className="probability">
                      <span className="label">Relationship:</span>
                      <span className="value">{selectedNode.relationshipStatus}</span>
                    </div>
                    <div className="probability">
                      <span className="label">Living:</span>
                      <span className="value">{selectedNode.livingSituation}</span>
                    </div>
                    <div className="probability">
                      <span className="label">Career:</span>
                      <span className="value">{selectedNode.careerSituation}</span>
                    </div>
                    <div className="probability">
                      <span className="label">Income:</span>
                      <span className="value">${selectedNode.monthlyIncome}/mo</span>
                    </div>
                  </div>

                  {/* Physical Appearance Section */}
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1d1d1f' }}>Physical Appearance</h4>
                    <div className="node-metadata">
                      <div className="probability">
                        <span className="label">Hair:</span>
                        <span className="value">{selectedNode.hairColor}, {selectedNode.hairStyle}</span>
                      </div>
                      <div className="probability">
                        <span className="label">Eyes:</span>
                        <span className="value">{selectedNode.eyeColor}</span>
                      </div>
                      <div className="probability">
                        <span className="label">Facial Hair:</span>
                        <span className="value">{selectedNode.facialHair}</span>
                      </div>
                      <div className="probability">
                        <span className="label">Glasses:</span>
                        <span className="value">{selectedNode.glasses}</span>
                      </div>
                      <div className="probability">
                        <span className="label">Build:</span>
                        <span className="value">{selectedNode.build}</span>
                      </div>
                    </div>
                  </div>

                  {isLeaf && (
                    <button className="edit-button" onClick={() => handleEditClick(selectedNode.id)}>
                      Edit Scenario
                    </button>
                  )}
                </div>
              </div>
            );
          }
        })()}
      </div>

      {/* Edit Modal */}
      {editingNodeId !== null && (
        <div className="modal-overlay" onClick={handleCancelEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Scenario</h2>
            <div className="modal-form">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editForm.change}
                  onChange={(e) => setEditForm({ ...editForm, change: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Age (Years)</label>
                  <input
                    type="number"
                    value={editForm.ageYears}
                    onChange={(e) => setEditForm({ ...editForm, ageYears: Number(e.target.value) })}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Age (Weeks)</label>
                  <input
                    type="number"
                    value={editForm.ageWeeks}
                    onChange={(e) => setEditForm({ ...editForm, ageWeeks: Number(e.target.value) })}
                    min="0"
                    max="51"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Relationship Status</label>
                <input
                  type="text"
                  value={editForm.relationshipStatus}
                  onChange={(e) => setEditForm({ ...editForm, relationshipStatus: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Living Situation</label>
                <input
                  type="text"
                  value={editForm.livingSituation}
                  onChange={(e) => setEditForm({ ...editForm, livingSituation: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Career Situation</label>
                <input
                  type="text"
                  value={editForm.careerSituation}
                  onChange={(e) => setEditForm({ ...editForm, careerSituation: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Monthly Income ($)</label>
                <input
                  type="number"
                  value={editForm.monthlyIncome}
                  onChange={(e) => setEditForm({ ...editForm, monthlyIncome: Number(e.target.value) })}
                  min="0"
                />
              </div>

              {/* Appearance Fields */}
              <h3 style={{ marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: '600', color: '#1d1d1f' }}>Physical Appearance</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Hair Color</label>
                  <input
                    type="text"
                    value={editForm.hairColor}
                    onChange={(e) => setEditForm({ ...editForm, hairColor: e.target.value })}
                    placeholder="e.g., Dark brown"
                  />
                </div>
                <div className="form-group">
                  <label>Hair Style</label>
                  <input
                    type="text"
                    value={editForm.hairStyle}
                    onChange={(e) => setEditForm({ ...editForm, hairStyle: e.target.value })}
                    placeholder="e.g., Short and neat"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Eye Color</label>
                  <input
                    type="text"
                    value={editForm.eyeColor}
                    onChange={(e) => setEditForm({ ...editForm, eyeColor: e.target.value })}
                    placeholder="e.g., Brown"
                  />
                </div>
                <div className="form-group">
                  <label>Facial Hair</label>
                  <input
                    type="text"
                    value={editForm.facialHair}
                    onChange={(e) => setEditForm({ ...editForm, facialHair: e.target.value })}
                    placeholder="e.g., Clean shaven"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Glasses</label>
                  <input
                    type="text"
                    value={editForm.glasses}
                    onChange={(e) => setEditForm({ ...editForm, glasses: e.target.value })}
                    placeholder="e.g., Black-framed glasses"
                  />
                </div>
                <div className="form-group">
                  <label>Build/Body Type</label>
                  <input
                    type="text"
                    value={editForm.build}
                    onChange={(e) => setEditForm({ ...editForm, build: e.target.value })}
                    placeholder="e.g., Average build"
                  />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="cancel-button" onClick={handleCancelEdit}>Cancel</button>
              <button className="save-button" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Image Modal */}
      {isImageEnlarged && generatedImage && (
        <div
          className="image-modal-overlay"
          onClick={() => {
            console.log('🖼️ [MODAL] Overlay clicked - closing enlarged image');
            setIsImageEnlarged(false);
          }}
        >
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="image-modal-close"
              onClick={() => {
                console.log('🖼️ [MODAL] Close button clicked');
                setIsImageEnlarged(false);
              }}
              aria-label="Close"
            >
              ×
            </button>
            <img
              src={generatedImage}
              alt="Life situation illustration (enlarged)"
              className="enlarged-image"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
