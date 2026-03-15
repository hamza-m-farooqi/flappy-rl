import type { NetworkGraphData } from './GameCanvas';

type NetworkGraphProps = {
  network: NetworkGraphData | null | undefined;
  title: string;
};

type PositionedNode = NetworkGraphData['nodes'][number] & {
  x: number;
  y: number;
};

export function NetworkGraph({ network, title }: NetworkGraphProps) {
  if (!network || network.nodes.length === 0) {
    return (
      <div className="network-empty">
        <p>No network snapshot is available yet.</p>
      </div>
    );
  }

  const width = 760;
  const height = 420;
  const padding = { top: 36, right: 48, bottom: 32, left: 48 };
  const layers = Array.from(new Set(network.nodes.map((node) => node.layer))).sort(
    (a, b) => a - b,
  );
  const outputLayer = layers[layers.length - 1];
  const layerWidth = Math.max(layers.length - 1, 1);
  const positionedNodes = network.nodes.map((node) => {
    const sameLayer = network.nodes
      .filter((candidate) => candidate.layer === node.layer)
      .sort((a, b) => a.id - b.id);
    const index = sameLayer.findIndex((candidate) => candidate.id === node.id);
    const x =
      padding.left + ((node.layer - layers[0]) / layerWidth) * (width - padding.left - padding.right);
    const y =
      padding.top +
      ((index + 1) / (sameLayer.length + 1)) * (height - padding.top - padding.bottom);
    return { ...node, x, y };
  });

  const nodeById = new Map<number, PositionedNode>(positionedNodes.map((node) => [node.id, node]));

  return (
    <div className="network-shell">
      <div className="network-header">
        <div>
          <h3>{title}</h3>
          <p>Connection color shows sign, opacity reflects current signal strength.</p>
        </div>
        <div className="network-meta">
          <span>{network.stats.node_count} nodes</span>
          <span>{network.stats.connection_count} links</span>
          <span>{network.stats.hidden_count} hidden</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="network-graph"
        role="img"
        aria-label={title}
      >
        {layers.map((layer) => {
          const layerX =
            padding.left + ((layer - layers[0]) / layerWidth) * (width - padding.left - padding.right);
          return (
            <g key={layer}>
              <line
                x1={layerX}
                y1={padding.top - 12}
                x2={layerX}
                y2={height - padding.bottom + 8}
                className="network-layer-line"
              />
              <text x={layerX} y={20} textAnchor="middle" className="network-layer-label">
                {layer === 0 ? 'Input' : layer === outputLayer ? 'Output' : `Layer ${layer}`}
              </text>
            </g>
          );
        })}

        {network.connections.map((connection) => {
          const source = nodeById.get(connection.in);
          const target = nodeById.get(connection.out);
          if (!source || !target) {
            return null;
          }

          const signalStrength = Math.min(Math.abs(connection.signal) / 2, 1);
          const stroke = connection.weight >= 0 ? 'rgba(18, 97, 255, 0.88)' : 'rgba(193, 66, 66, 0.82)';
          return (
            <line
              key={connection.innovation}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={stroke}
              strokeOpacity={0.2 + signalStrength * 0.8}
              strokeWidth={1 + Math.min(Math.abs(connection.weight), 3)}
            />
          );
        })}

        {positionedNodes.map((node) => {
          const fill =
            node.type === 'input'
              ? '#0f1728'
              : node.type === 'output'
                ? '#1261ff'
                : '#ffffff';
          const stroke = node.type === 'hidden' ? '#8a98ad' : fill;
          const valueOpacity = Math.min(Math.abs(node.value), 1);
          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <circle
                r="20"
                fill={fill}
                stroke={stroke}
                strokeWidth="2"
                className="network-node"
              />
              <circle
                r={8 + valueOpacity * 8}
                fill={node.type === 'hidden' ? 'rgba(18, 97, 255, 0.18)' : 'rgba(255,255,255,0.18)'}
              />
              <text
                y="-28"
                textAnchor="middle"
                className="network-node-label"
              >
                {node.label}
              </text>
              <text
                y="6"
                textAnchor="middle"
                className={`network-node-value ${node.type === 'hidden' ? 'dark' : 'light'}`}
              >
                {node.value.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
