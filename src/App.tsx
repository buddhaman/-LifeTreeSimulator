import { useEffect, useRef, useState } from 'react';
import { Camera2D } from './Camera2D';
import { graph, initializeGraph, updatePhysics, addNode, createNode, isLeafNode, Node, physicsConfig } from './graph';
import { render, getExpandButtonBounds } from './renderer';
import { Scenario } from './api';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera2D | null>(null);
  const animationRef = useRef<number | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  const [hoveredButtonNodeId, setHoveredButtonNodeId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const isMouseDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const [nodeCount, setNodeCount] = useState(0);
  const [showPhysics, setShowPhysics] = useState(false);
  const [, forceUpdate] = useState(0); // Force re-render for sliders
  
  const DRAG_THRESHOLD = 5; // pixels

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
    setNodeCount(graph.nodes.length);
    // Set initial selected node to root
    setSelectedNodeId(0);

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
      
      // Render
      render(ctx, camera, graph, hoveredNodeId, selectedNodeId, hoveredButtonNodeId);
      animationRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [hoveredNodeId, selectedNodeId, hoveredButtonNodeId]);

  // Hit test to find node at position
  const hitTest = (worldX: number, worldY: number): Node | null => {
    for (let i = graph.nodes.length - 1; i >= 0; i--) {
      const node = graph.nodes[i];
      const halfW = node.width / 2;
      const halfH = node.height / 2;

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
      if (isLeafNode(node.id) && !node.expanded) {
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

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const camera = cameraRef.current;
    if (!camera) return;

    // Check if we should start dragging (threshold exceeded)
    if (isMouseDownRef.current && !isDraggingRef.current) {
      const dx = e.clientX - mouseDownPosRef.current.x;
      const dy = e.clientY - mouseDownPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > DRAG_THRESHOLD) {
        isDraggingRef.current = true;
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grabbing';
        }
      }
    }

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      camera.pan(-dx, -dy);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    } else {
      const worldPos = camera.screenToWorld(e.clientX, e.clientY);

      // Check for button hover first
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
    // Store initial position but don't start dragging yet
    isMouseDownRef.current = true;
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  // Mouse up handler
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasDragging = isDraggingRef.current;
    
    if (!wasDragging) {
      // Click event - only if we didn't drag
      const camera = cameraRef.current;
      if (!camera) return;

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

    // Reset all drag states
    isMouseDownRef.current = false;
    isDraggingRef.current = false;
    
    // Update cursor based on hover
    const hasHover = hoveredNodeId !== null || hoveredButtonNodeId !== null;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hasHover ? 'pointer' : 'grab';
    }
  };

  // Update cursor based on hover state
  useEffect(() => {
    if (canvasRef.current && !isDraggingRef.current) {
      const hasHover = hoveredNodeId !== null || hoveredButtonNodeId !== null;
      canvasRef.current.style.cursor = hasHover ? 'pointer' : 'grab';
    }
  }, [hoveredNodeId, hoveredButtonNodeId]);

  // Expand node - generate children
  const expandNode = (nodeId: number) => {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node || node.expanded) return;

    // Mark as expanded
    node.expanded = true;

    // Generate sample children (placeholder for Claude API)
    const scenarios = generateSampleScenarios(node);

    scenarios.forEach((scenario) => {
      const childId = graph.nodes.length;
      const child = createNode(
        childId,
        scenario.title,
        scenario.description,
        scenario.probability,
        scenario.tags,
        nodeId
      );
      addNode(child);
    });

    // Physics simulation will handle layout automatically
    setNodeCount(graph.nodes.length);
  };

  // Placeholder for Claude API - generates sample scenarios
  const generateSampleScenarios = (_parentNode: Node): Scenario[] => {
    const scenarios: Scenario[] = [
      {
        title: 'Career Advancement',
        description: 'You take a risk and pursue a promotion at work.',
        probability: 65,
        tags: ['career', 'growth'],
      },
      {
        title: 'New Skill',
        description: 'You decide to learn something completely new.',
        probability: 80,
        tags: ['education', 'personal'],
      },
      {
        title: 'Relationship Change',
        description: 'A significant change in your personal life.',
        probability: 45,
        tags: ['personal', 'social'],
      },
    ];

    return scenarios;
  };

  // Reset camera
  const handleReset = () => {
    if (cameraRef.current) {
      cameraRef.current.reset();
    }
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
        <div className="controls">
          <p>Nodes: {nodeCount}</p>
          <p>Zoom: {cameraRef.current ? (cameraRef.current.zoom * 100).toFixed(0) : 100}%</p>
          <button onClick={handleReset}>Reset View</button>
        </div>

        <div className="physics-controls">
          <h3 onClick={() => setShowPhysics(!showPhysics)} style={{ cursor: 'pointer' }}>
            Physics {showPhysics ? '▼' : '▶'}
          </h3>
          {showPhysics && (
            <div className="physics-sliders">
              <div className="slider-group">
                <label>Repulsion Strength: {physicsConfig.repulsionStrength.toFixed(0)}</label>
                <input
                  type="range"
                  min="0"
                  max="100000"
                  step="1000"
                  value={physicsConfig.repulsionStrength}
                  onChange={(e) => {
                    physicsConfig.repulsionStrength = Number(e.target.value);
                    forceUpdate(v => v + 1);
                  }}
                />
              </div>
              
              <div className="slider-group">
                <label>Repulsion Range: {physicsConfig.repulsionRange.toFixed(0)}</label>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="10"
                  value={physicsConfig.repulsionRange}
                  onChange={(e) => {
                    physicsConfig.repulsionRange = Number(e.target.value);
                    forceUpdate(v => v + 1);
                  }}
                />
              </div>
              
              <div className="slider-group">
                <label>Spring Strength: {physicsConfig.springStrength.toFixed(3)}</label>
                <input
                  type="range"
                  min="0"
                  max="0.1"
                  step="0.001"
                  value={physicsConfig.springStrength}
                  onChange={(e) => {
                    physicsConfig.springStrength = Number(e.target.value);
                    forceUpdate(v => v + 1);
                  }}
                />
              </div>
              
              <div className="slider-group">
                <label>Spring Length: {physicsConfig.springLength.toFixed(0)}</label>
                <input
                  type="range"
                  min="100"
                  max="600"
                  step="10"
                  value={physicsConfig.springLength}
                  onChange={(e) => {
                    physicsConfig.springLength = Number(e.target.value);
                    forceUpdate(v => v + 1);
                  }}
                />
              </div>
              
              <div className="slider-group">
                <label>Friction: {physicsConfig.friction.toFixed(2)}</label>
                <input
                  type="range"
                  min="0.5"
                  max="0.99"
                  step="0.01"
                  value={physicsConfig.friction}
                  onChange={(e) => {
                    physicsConfig.friction = Number(e.target.value);
                    forceUpdate(v => v + 1);
                  }}
                />
              </div>
              
              <div className="slider-group">
                <label>Gravity Strength: {physicsConfig.gravityStrength.toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={physicsConfig.gravityStrength}
                  onChange={(e) => {
                    physicsConfig.gravityStrength = Number(e.target.value);
                    forceUpdate(v => v + 1);
                  }}
                />
              </div>
              
              <div className="slider-group">
                <label>Max Velocity: {physicsConfig.maxVelocity.toFixed(0)}</label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={physicsConfig.maxVelocity}
                  onChange={(e) => {
                    physicsConfig.maxVelocity = Number(e.target.value);
                    forceUpdate(v => v + 1);
                  }}
                />
              </div>
            </div>
          )}
        </div>
        
        {selectedNodeId !== null && (() => {
          const selectedNode = graph.nodes.find(n => n.id === selectedNodeId);
          if (selectedNode) {
            return (
              <div className="selected-node">
                <h3>Selected Scenario</h3>
                <div className="node-details">
                  <h4>{selectedNode.title}</h4>
                  <p className="description">{selectedNode.description}</p>
                  <div className="node-metadata">
                    <div className="probability">
                      <span className="label">Probability:</span>
                      <span className="value">{selectedNode.probability}%</span>
                    </div>
                    {selectedNode.tags.length > 0 && (
                      <div className="tags">
                        <span className="label">Tags:</span>
                        <div className="tag-list">
                          {selectedNode.tags.map((tag, i) => (
                            <span key={i} className="tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
        })()}

        <div className="instructions">
          <h3>Controls</h3>
          <ul>
            <li>Drag to pan</li>
            <li>Scroll to zoom</li>
            <li>Click node to select</li>
            <li>Click + button to expand</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
