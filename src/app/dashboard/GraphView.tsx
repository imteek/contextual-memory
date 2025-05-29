'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { GraphData } from './types';

// We need to dynamically import ForceGraph2D with no SSR to avoid hydration issues
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
  const [isStabilized, setIsStabilized] = useState(false);

  // Process and filter the graph data based on focus node and view mode
  const processedData = useCallback(() => {
    // Default full data processing
    let nodes = graphData.nodes.map(node => ({
      ...node,
      // Add fixed coordinates for more stability once graph is stabilized
      ...(isStabilized && node.fx !== undefined && node.fy !== undefined ? { fx: node.fx, fy: node.fy } : {})
    }));
    
    let links = [...graphData.links];
    
    // If we have a focus node and showOnlyConnected is true, filter to show only related nodes
    if (focusNodeId && showOnlyConnected) {
      // Find all links that contain the focus node
      const connectedLinks = links.filter(link => {
        const source = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const target = typeof link.target === 'object' ? (link.target as any).id : link.target;
        return source === focusNodeId || target === focusNodeId;
      });
      
      // Get all node IDs connected to the focus node
      const connectedNodeIds = new Set<string>();
      connectedNodeIds.add(focusNodeId);
      
      connectedLinks.forEach(link => {
        const source = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const target = typeof link.target === 'object' ? (link.target as any).id : link.target;
        
        if (source === focusNodeId) {
          connectedNodeIds.add(target as string);
        } else if (target === focusNodeId) {
          connectedNodeIds.add(source as string);
        }
      });
      
      // Filter nodes to only include connected nodes
      nodes = nodes.filter(node => connectedNodeIds.has(node.id));
      
      // Filter links to only include links between connected nodes
      links = connectedLinks;
    }
    
    return { nodes, links };
  }, [graphData, focusNodeId, showOnlyConnected, isStabilized]);

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
  
  // Center the graph on the focus node when it changes
  useEffect(() => {
    if (focusNodeId && graphRef.current) {
      const node = graphData.nodes.find(node => node.id === focusNodeId);
      if (node) {
        graphRef.current.centerAt(0, 0, 1000);
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.zoomToFit(400, 150);
          }
        }, 700);
      }
    }
  }, [focusNodeId, graphData.nodes]);
  
  // Stabilize the graph after initial layout
  useEffect(() => {
    if (graphRef.current && !isStabilized) {
      const simulationEndTimeout = setTimeout(() => {
        // Save node positions after graph is stabilized
        if (graphRef.current && graphRef.current.graphData) {
          const data = graphRef.current.graphData();
          if (data.nodes) {
            // Store fixed positions on the original graph data
            data.nodes.forEach((node: any) => {
              const originalNode = graphData.nodes.find(n => n.id === node.id);
              if (originalNode) {
                originalNode.fx = node.x;
                originalNode.fy = node.y;
              }
            });
            setIsStabilized(true);
          }
        }
      }, 2000); // Let the simulation run for 2 seconds before fixing positions
      
      return () => clearTimeout(simulationEndTimeout);
    }
  }, [graphData.nodes, isStabilized]);

  // Custom node click handler
  const handleNodeClick = (node: any) => {
    if (node && onNodeClick) {
      onNodeClick(node);
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
      
      {typeof window !== 'undefined' && (
        <ForceGraph2D
          ref={graphRef}
          graphData={data}
          nodeLabel="name"
          nodeColor={(node) => node.color}
          nodeVal={(node) => node.val}
          linkWidth={(link) => link.value / 2}
          linkColor={(link) => link.color || '#b0b0b0'} 
          onNodeClick={handleNodeClick}
          width={dimensions.width}
          height={dimensions.height}
          cooldownTime={3000}
          onEngineStop={() => {
            if (!isStabilized) setIsStabilized(true);
          }}
          nodeRelSize={6}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.25}
          warmupTicks={50}
          cooldownTicks={100}
        />
      )}
    </div>
  );
} 