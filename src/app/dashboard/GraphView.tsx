'use client';

import { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GraphData, GraphNode, GraphLink } from './types';

interface GraphViewProps {
  graphData: GraphData;
  onNodeClick: (node: any) => void;
}

export default function GraphView({ graphData, onNodeClick }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const graphRef = useRef<any>(null);

  // Format graph data properly for D3 force graph
  const processedData = {
    nodes: graphData.nodes.map(node => ({
      id: node.id,
      name: node.name,
      val: node.val || 1,
      color: node.color,
      group: node.group
    })),
    links: graphData.links.map(link => {
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
    })
  };

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

  // Custom node click handler
  const handleNodeClick = (node: any) => {
    if (node && onNodeClick) {
      onNodeClick(node);
    }
  };

  return (
    <div ref={containerRef} className="h-full w-full">
      {typeof window !== 'undefined' && (
        <ForceGraph2D
          ref={graphRef}
          graphData={processedData}
          nodeLabel="name"
          nodeColor={(node: any) => node.color}
          nodeVal={(node: any) => node.val}
          linkWidth={(link: any) => link.value / 2}
          linkColor={(link: any) => link.color || '#b0b0b0'}
          onNodeClick={handleNodeClick}
          width={dimensions.width}
          height={dimensions.height}
          cooldownTime={2000}
          nodeRelSize={6}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          d3AlphaDecay={0.01}
          d3VelocityDecay={0.08}
        />
      )}
    </div>
  );
} 