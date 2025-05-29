'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { GraphData, GraphNode, GraphLink } from './types';

// Dynamically import ForceGraph2D with no SSR to avoid window is not defined error
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphViewProps {
  graphData: GraphData;
  onNodeClick: (node: any) => void;
  focusNodeId?: string | null;
  showOnlyConnected: boolean;
  onToggleConnectionView: () => void;
}

export default function GraphView({ 
  graphData, 
  onNodeClick, 
  focusNodeId, 
  showOnlyConnected,
  onToggleConnectionView 
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const graphRef = useRef<any>(null);
  const positionsRef = useRef<Map<string, {x: number, y: number}>>(new Map());
  const [isStabilized, setIsStabilized] = useState(false);
  const nodesStabilizedRef = useRef(false);

  // Process and filter the graph data based on focus node and view mode
  const processedData = useCallback(() => {
    // Default full data processing
    let nodes = graphData.nodes.map(node => {
      // Preserve node positions if they exist
      const savedPos = positionsRef.current.get(String(node.id));
      return {
        id: node.id,
        name: node.name,
        val: node.val || 1,
        color: node.color,
        group: node.group,
        // Add stored position if available
        ...(savedPos ? { x: savedPos.x, y: savedPos.y } : {})
      };
    });
    
    let links = graphData.links.map(link => {
      // Ensure source and target are always strings
      const source = typeof (link.source as any) === 'object' 
        ? (link.source as any).id 
        : link.source;
      const target = typeof (link.target as any) === 'object' 
        ? (link.target as any).id 
        : link.target;
      
      return {
        source,
        target,
        value: link.value || 1,
        color: link.color
      };
    });
    
    // If we have a focus node and showOnlyConnected is true, filter to show only related nodes
    if (focusNodeId && showOnlyConnected) {
      // Find all links that contain the focus node
      const connectedLinks = links.filter(link => 
        link.source === focusNodeId || link.target === focusNodeId
      );
      
      // Get all node IDs connected to the focus node
      const connectedNodeIds = new Set<string>();
      connectedNodeIds.add(focusNodeId);
      
      connectedLinks.forEach(link => {
        if (link.source === focusNodeId) {
          connectedNodeIds.add(link.target as string);
        } else if (link.target === focusNodeId) {
          connectedNodeIds.add(link.source as string);
        }
      });
      
      // Filter nodes to only include connected nodes
      nodes = nodes.filter(node => connectedNodeIds.has(node.id));
      
      // Filter links to only include links between connected nodes
      links = connectedLinks;
    }
    
    return { nodes, links };
  }, [graphData, focusNodeId, showOnlyConnected]);

  // Update dimensions when container size changes
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    // Initial size
    updateDimensions();

    // Listen for resize events
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  // Save node positions on engine stop
  const handleEngineStop = useCallback(() => {
    if (!graphRef.current || nodesStabilizedRef.current) return;
    
    try {
      // Wait a bit to ensure the graph has stabilized
      setTimeout(() => {
        // Check if graphRef is still valid
        if (graphRef.current) {
          // Get the current nodes from the graph instance
          const currentNodes = graphRef.current._state.nodes;
          if (Array.isArray(currentNodes)) {
            currentNodes.forEach((node: any) => {
              if (node.id && typeof node.x === 'number' && typeof node.y === 'number') {
                positionsRef.current.set(String(node.id), { x: node.x, y: node.y });
              }
            });
            // Mark as stabilized
            nodesStabilizedRef.current = true;
            setIsStabilized(true);
          }
        }
      }, 100);
    } catch (err) {
      console.error("Error in handleEngineStop:", err);
    }
  }, []);
  
  // When component mounts or focus changes, stop physics after a delay
  useEffect(() => {
    if (!graphRef.current) return;
    
    const timer = setTimeout(() => {
      if (graphRef.current && !isStabilized) {
        // Mark as stabilized after a delay to allow initial positioning
        setIsStabilized(true);
      }
    }, 3000); // Allow 3 seconds for initial positioning
    
    return () => clearTimeout(timer);
  }, [isStabilized]);
  
  // Center the graph on the focus node when it changes
  useEffect(() => {
    if (focusNodeId && graphRef.current) {
      const node = graphData.nodes.find(node => node.id === focusNodeId);
      if (node) {
        const pos = positionsRef.current.get(String(focusNodeId));
        if (pos) {
          // If we have saved position, center on it
          graphRef.current.centerAt(pos.x, pos.y, 1000);
        } else {
          // Otherwise center and then zoom
          graphRef.current.centerAt(0, 0, 1000);
        }
        
        setTimeout(() => {
          graphRef.current.zoomToFit(400, 150);
        }, 700);
      }
    }
  }, [focusNodeId, graphData.nodes]);

  // Custom node click handler
  const handleNodeClick = (node: any) => {
    if (node && onNodeClick) {
      onNodeClick(node);
    }
  };
  
  // Save position when node is dragged
  const handleNodeDragEnd = (node: any) => {
    if (node && node.id && typeof node.x === 'number' && typeof node.y === 'number') {
      positionsRef.current.set(String(node.id), { x: node.x, y: node.y });
    }
  };
  
  // Save position during node drag
  const handleNodeDrag = (node: any) => {
    if (node && node.id && typeof node.x === 'number' && typeof node.y === 'number') {
      positionsRef.current.set(String(node.id), { x: node.x, y: node.y });
    }
  };

  // Get the data to render
  const data = processedData();

  return (
    <div className="relative h-full w-full" ref={containerRef}>
      {focusNodeId && (
        <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur-sm p-2 rounded-md shadow-md">
          <button
            onClick={onToggleConnectionView}
            className="text-xs px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md font-medium transition-colors"
          >
            {showOnlyConnected ? 'Show All Nodes' : 'Show Only Connected Nodes'}
          </button>
        </div>
      )}
      
      {isStabilized && (
        <div className="absolute top-4 right-4 z-10 bg-white/80 backdrop-blur-sm p-2 rounded-md shadow-md">
          <button
            onClick={() => {
              nodesStabilizedRef.current = false;
              setIsStabilized(false);
            }}
            className="text-xs px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-md font-medium transition-colors"
          >
            Recalculate Layout
          </button>
        </div>
      )}
      
      {typeof window !== 'undefined' && (
        <ForceGraph2D
          ref={graphRef}
          graphData={data}
          nodeLabel="name"
          nodeColor={(node: any) => node.color}
          nodeVal={(node: any) => node.val}
          linkWidth={(link: any) => link.value / 2}
          linkColor={(link: any) => link.color || '#b0b0b0'} 
          onNodeClick={handleNodeClick}
          onNodeDragEnd={handleNodeDragEnd}
          onNodeDrag={handleNodeDrag}
          width={dimensions.width}
          height={dimensions.height}
          cooldownTicks={isStabilized ? 0 : 100} // No cooling when stabilized
          warmupTicks={isStabilized ? 0 : 50} // No warmup when stabilized
          cooldownTime={isStabilized ? 0 : 2000} // No cooldown time when stabilized
          onEngineStop={handleEngineStop} // Save positions when physics stops
          enableNodeDrag={true} // Always allow node dragging
        />
      )}
    </div>
  );
} 