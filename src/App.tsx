import { useEffect, useRef, useState } from 'react';
import { Camera2D } from './Camera2D';
import { graph, initializeGraph, updatePhysics, addNode, createNode, isLeafNode, Node, physicsConfig } from './graph';
import { render, getExpandButtonBounds } from './renderer';
import { generateChildScenariosStreaming } from './openai';
import { Skeleton } from './Skeleton';
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
  const [editForm, setEditForm] = useState({
    title: '',
    change: '',
    ageYears: 0,
    ageWeeks: 0,
    location: '',
    relationshipStatus: '',
    livingSituation: '',
    careerSituation: '',
    monthlyIncome: 0
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
      console.log('Drag state:', dragStateRef.current.type);

      // Update physics simulation
      updatePhysics();

      // Update skeleton
      if (skeletonRef.current) {
        // Update character left hand position when dragging (before physics update)
        if (dragStateRef.current.type === 'character') {
          console.log('Dragging character! Mouse pos:', mouseWorldPosRef.current);

          // Detach from node
          if (skeletonRef.current.currentNode !== null) {
            console.log('Detaching from node');
            skeletonRef.current.currentNode = null;
          }

          // Get left hand particle (index 15 in particles array)
          const leftHand = skeletonRef.current.particles[15];
          if (leftHand) {
            // Pin left hand to mouse position
            leftHand.x = mouseWorldPosRef.current.x;
            leftHand.y = mouseWorldPosRef.current.y;
            leftHand.oldX = mouseWorldPosRef.current.x;
            leftHand.oldY = mouseWorldPosRef.current.y;
            leftHand.z = 50; // Keep at a reasonable height
            leftHand.oldZ = 50;
            console.log('Left hand at:', leftHand.x, leftHand.y);
          }
        }

        skeletonRef.current.update();
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

      // Render
      render(ctx, camera, graph, hoveredNodeId, selectedNodeId, hoveredButtonNodeId);

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

    console.log('Mouse down at world pos:', worldPos);
    console.log('Skeleton head at:', skeleton?.head.x, skeleton?.head.y, skeleton?.head.z);

    // Priority: Character > Node > Canvas
    const hitChar = hitTestCharacter(worldPos.x, worldPos.y);
    console.log('Hit character?', hitChar);

    if (hitChar && skeleton) {
      console.log('Setting drag state to CHARACTER');
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
        console.log('Setting drag state to NODE');
        // Grab node
        setDraggedNodeId(node.id);
        dragStateRef.current = { type: 'node', nodeId: node.id };
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grabbing';
        }
      } else {
        console.log('Setting drag state to CANVAS');
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
          setSelectedNodeId(node.id);
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
      monthlyIncome: node.monthlyIncome
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

    setEditingNodeId(null);
  };

  // Handle cancel from modal
  const handleCancelEdit = () => {
    setEditingNodeId(null);
  };

  return (
    <div className="app">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
      <div className="sidebar">
        <h1>Life Sim</h1>

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
            </div>
            <div className="modal-actions">
              <button className="cancel-button" onClick={handleCancelEdit}>Cancel</button>
              <button className="save-button" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
