import { useMemo } from 'react';

export type NetworkNode = {
  id: number;
  type: 'input' | 'hidden' | 'output';
  bias?: number;
  response?: number;
  activation?: string;
};

export type NetworkConnection = {
  in: number;
  out: number;
  weight: number;
  enabled: boolean;
};

export type NetworkTopology = {
  nodes: NetworkNode[];
  connections: NetworkConnection[];
};

type NetworkVisualizerProps = {
  network: NetworkTopology | null | undefined;
  width?: number;
  height?: number;
};

export function NetworkVisualizer({ network, width = 300, height = 200 }: NetworkVisualizerProps) {
  const renderedElements = useMemo(() => {
    if (!network || network.nodes.length === 0) return null;

    const layers: Record<string, NetworkNode[]> = {
      input: [],
      hidden: [],
      output: [],
    };

    network.nodes.forEach((node) => {
      if (node.type in layers) {
        layers[node.type].push(node);
      }
    });

    // Simple vertical layout calculation
    const padding = 40;
    const layerXs = {
      input: padding,
      hidden: width / 2,
      output: width - padding,
    };

    const nodePositions = new Map<number, { x: number; y: number }>();

    ['input', 'hidden', 'output'].forEach((layerKey) => {
      const type = layerKey as keyof typeof layers;
      const layerNodes = layers[type];

      if (layerNodes.length === 0) return;

      const spacing = (height - padding * 2) / layerNodes.length;

      layerNodes.forEach((node, index) => {
        const x = layerXs[type as keyof typeof layerXs];
        // Center nodes vertically
        const y = padding + (index * spacing) + (spacing / 2);
        nodePositions.set(node.id, { x, y });
      });
    });

    return { nodePositions, layers };
  }, [network, width, height]);

  if (!network || !renderedElements) {
    return (
      <div className="network-visualizer-empty" style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', borderRadius: '4px', border: '1px solid #ddd' }}>
        <p style={{ color: '#888', fontSize: '14px' }}>No network topology available</p>
      </div>
    );
  }

  const { nodePositions } = renderedElements;

  return (
    <div className="network-visualizer" style={{ width, height, backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #eee', overflow: 'hidden' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Draw Connections */}
        {network.connections.map((conn, idx) => {
          if (!conn.enabled) return null;
          const source = nodePositions.get(conn.in);
          const target = nodePositions.get(conn.out);
          if (!source || !target) return null;

          const color = conn.weight > 0 ? 'rgba(76, 175, 80, 0.7)' : 'rgba(244, 67, 54, 0.7)';
          const strokeWidth = Math.max(1, Math.min(5, Math.abs(conn.weight) * 2));

          return (
            <line
              key={`conn-${idx}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={color}
              strokeWidth={strokeWidth}
            />
          );
        })}

        {/* Draw Nodes */}
        {network.nodes.map((node) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;

          const fillColor =
            node.type === 'input' ? '#2196F3' :
            node.type === 'output' ? '#FF9800' :
            '#9C27B0';

          return (
            <circle
              key={`node-${node.id}`}
              cx={pos.x}
              cy={pos.y}
              r={6}
              fill={fillColor}
              stroke="#fff"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>
    </div>
  );
}
