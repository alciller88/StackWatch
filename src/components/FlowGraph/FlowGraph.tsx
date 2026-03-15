import ReactFlow, { Background, Controls, MiniMap } from 'reactflow'
import 'reactflow/dist/style.css'
import { useStore } from '../../store/useStore'
import { useLayoutNodes } from './useLayoutNodes'
import { getNodeColor, getNodeIcon } from './flowUtils'

export const FlowGraph: React.FC = () => {
  const { flowNodes, flowEdges, services } = useStore()
  const { nodes, edges } = useLayoutNodes(flowNodes, flowEdges)

  // Build a map of serviceId -> confidence for node styling
  const confidenceMap = new Map<string, string>()
  for (const s of services) {
    confidenceMap.set(s.id, s.confidence ?? 'high')
  }

  if (flowNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        No flow data available. Analyze a repository to generate the architecture graph.
      </div>
    )
  }

  return (
    <div className="flex-1 relative" style={{ height: '100%' }}>
      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-gray-900/90 border border-gray-700 rounded-lg p-3 text-xs space-y-1.5">
        <div className="text-gray-400 font-medium mb-2">Edge Types</div>
        {[
          { color: 'bg-blue-500', label: 'Data' },
          { color: 'bg-green-500', label: 'Auth' },
          { color: 'bg-amber-500', label: 'Payment' },
          { color: 'bg-red-500', label: 'Webhook' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`w-4 h-0.5 ${item.color} inline-block`} />
            <span className="text-gray-400">{item.label}</span>
          </div>
        ))}
        <div className="border-t border-gray-700 pt-1.5 mt-1.5">
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 border-t border-dashed border-orange-500 inline-block" />
            <span className="text-gray-400">Low confidence</span>
          </div>
        </div>
      </div>

      <ReactFlow
        nodes={nodes.map((n) => {
          const serviceId = n.data.serviceId
          const confidence = serviceId ? confidenceMap.get(serviceId) : 'high'
          const isLowConfidence = confidence === 'low'

          return {
            ...n,
            style: isLowConfidence ? {
              ...n.style,
              borderStyle: 'dashed',
              borderColor: '#c2410c',
              opacity: 0.8,
            } : n.style,
            data: {
              ...n.data,
              label: (
                <div className="flex items-center gap-2" title={isLowConfidence ? 'Low confidence detection' : undefined}>
                  <span>{getNodeIcon(n.data.nodeType)}</span>
                  <span className="truncate">{n.data.label}</span>
                  {isLowConfidence && <span className="text-orange-400 text-[10px]">?</span>}
                </div>
              ),
            },
          }
        })}
        edges={edges}
        fitView
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#374151" gap={20} />
        <Controls
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
        />
        <MiniMap
          nodeColor={(node) =>
            getNodeColor(node.data?.nodeType ?? 'external')
          }
          style={{
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>
    </div>
  )
}
