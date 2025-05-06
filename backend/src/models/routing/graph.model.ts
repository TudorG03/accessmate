import mongoose from "npm:mongoose@^6.7";

/**
 * Represents a cached OSM graph for a specific region
 */
export interface IRoutingGraph {
  // Region identifier (usually city or area name)
  region: string;

  // Bounding box coordinates
  bbox: {
    north: number;
    south: number;
    east: number;
    west: number;
  };

  // Graph data (serialized NetworkX graph)
  graphData: string;

  // Metadata
  nodeCount: number;
  edgeCount: number;

  // When this graph was last updated
  lastUpdated: Date;

  // When this graph was last accessed (for cache management)
  lastAccessed: Date;
}

const routingGraphSchema = new mongoose.Schema<IRoutingGraph>({
  region: { type: String, required: true, index: true },
  bbox: {
    north: { type: Number, required: true },
    south: { type: Number, required: true },
    east: { type: Number, required: true },
    west: { type: Number, required: true },
  },
  graphData: { type: String, required: true },
  nodeCount: { type: Number, required: true },
  edgeCount: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now },
  lastAccessed: { type: Date, default: Date.now },
});

// Create a compound index on the bounding box for efficient spatial queries
routingGraphSchema.index({
  "bbox.north": 1,
  "bbox.south": 1,
  "bbox.east": 1,
  "bbox.west": 1,
});

export default mongoose.model<IRoutingGraph>(
  "RoutingGraph",
  routingGraphSchema,
);
