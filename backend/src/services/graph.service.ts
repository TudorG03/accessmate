/**
 * Graph Service for accessible routing
 * Manages OSM grid-based routing for accessible path finding
 */

import { promisify } from "node:util";
import RoutingGraph, { IRoutingGraph } from "../models/routing/graph.model.ts";
import MarkerModel from "../models/marker/marker.mongo.ts";

// Constants for graph operations
const GRAPH_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const GRAPH_BUFFER = 1; // km - buffer around route for graph generation
const DEFAULT_NETWORK_TYPE = "walk";

// Obstacle weight configuration
const OBSTACLE_WEIGHTS = {
  STAIRS: 5,
  NARROW_PATH: 3,
  STEEP_INCLINE: 4,
  CONSTRUCTION: 5,
  POOR_LIGHTING: 2,
  UNEVEN_SURFACE: 3,
  CURB: 2,
  NO_CURB_CUTS: 4,
  NO_SIDEWALK: 4,
  CROSSWALK_WITHOUT_SIGNAL: 2,
  OTHER: 1,
};

// Maximum distance for graph-based routing in kilometers
const MAX_GRAPH_SIZE = 50; // Don't try to route paths longer than 50km

// Interface for routing parameters
interface RoutingParams {
  origin: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  avoidObstacles?: boolean;
  userPreferences?: {
    avoidStairs?: boolean;
    maxSlope?: number;
    minimumWidth?: number;
  };
}

// Interface for routing results
interface RoutingResult {
  points: Array<{ latitude: number; longitude: number }>;
  distance: number; // in kilometers
  duration: string;
  hasObstacles: boolean;
  steps: Array<{
    instructions: string;
    distance: string;
    duration: string;
    startLocation: { latitude: number; longitude: number };
    endLocation: { latitude: number; longitude: number };
    polyline?: string;
  }>;
}

// OSM Grid interfaces
interface Point {
  latitude: number;
  longitude: number;
}

interface Obstacle {
  location: Point;
  obstacleType: string;
  obstacleScore: number;
}

interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// OSM Node interfaces
interface OsmNode {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OsmWay {
  id: number;
  nodes: number[];
  tags: Record<string, string>;
}

interface OsmData {
  nodes: Record<number, OsmNode>;
  ways: OsmWay[];
  relations?: Array<{
    id: number;
    members: Array<{
      type: "node" | "way" | "relation";
      ref: number;
      role: string;
    }>;
    tags: Record<string, string>;
  }>;
}

interface GridCell {
  x: number;
  y: number;
  latitude: number;
  longitude: number;
  isRoad: boolean;
  hasObstacle: boolean;
  obstacleWeight: number;
  connections: GridCell[];
  parent?: GridCell | null;
  f?: number; // Total cost for A*
  g?: number; // Cost from start to current
  h?: number; // Heuristic (estimated cost to goal)
  wayId?: number; // Original OSM way ID if applicable
  roadType?: string; // Type of road (footway, path, etc.)
  oneway?: boolean; // Whether this is a one-way road
}

interface Grid {
  cells: GridCell[][];
  cellSize: number; // cell size in meters
  bbox: BoundingBox;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Get or create an OSM graph for a specific region
 */
async function getOrCreateGraph(
  bbox: BoundingBox,
  networkType: string = DEFAULT_NETWORK_TYPE,
): Promise<string> {
  try {
    // Check if we have a valid cached graph
    const cachedGraph = await RoutingGraph.findOne({
      "bbox.north": { $gte: bbox.north },
      "bbox.south": { $lte: bbox.south },
      "bbox.east": { $gte: bbox.east },
      "bbox.west": { $lte: bbox.west },
      lastUpdated: { $gte: new Date(Date.now() - GRAPH_CACHE_TTL) },
    });

    if (cachedGraph) {
      // Update last accessed time
      await RoutingGraph.updateOne(
        { _id: cachedGraph._id },
        { lastAccessed: new Date() },
      );
      return cachedGraph.graphData;
    }

    // No cached graph found, create a new one
    const graphData = JSON.stringify({
      placeholder:
        "This would be a serialized NetworkX graph in a real implementation",
    });

    // Try to store the new graph in the database (but don't stop if it fails)
    try {
      const newGraph = new RoutingGraph({
        region: `${bbox.north.toFixed(2)},${bbox.south.toFixed(2)},${
          bbox.east.toFixed(2)
        },${bbox.west.toFixed(2)}`,
        bbox,
        graphData,
        nodeCount: 0, // This would be actual node count in real implementation
        edgeCount: 0, // This would be actual edge count in real implementation
        lastUpdated: new Date(),
        lastAccessed: new Date(),
      });

      await newGraph.save();
    } catch (dbError) {
      console.warn(
        "Failed to save graph to database, continuing with in-memory graph:",
        dbError,
      );
    }

    return graphData;
  } catch (error) {
    console.error("Error in getOrCreateGraph:", error);
    // Return a default graph even if we had errors
    return JSON.stringify({
      placeholder: "Default fallback graph",
    });
  }
}

/**
 * Calculate a bounding box around two points
 */
function calculateBoundingBox(
  point1: Point,
  point2: Point,
  bufferInKm: number = GRAPH_BUFFER,
): BoundingBox {
  // Calculate the bounding box with buffer
  const lat1 = point1.latitude;
  const lon1 = point1.longitude;
  const lat2 = point2.latitude;
  const lon2 = point2.longitude;

  // Find min/max
  const minLat = Math.min(lat1, lat2);
  const maxLat = Math.max(lat1, lat2);
  const minLon = Math.min(lon1, lon2);
  const maxLon = Math.max(lon1, lon2);

  // Add buffer (approximate conversion from km to degrees)
  // 1 degree of latitude = ~111km, 1 degree of longitude = ~111km * cos(latitude)
  const latBuffer = bufferInKm / 111;
  const avgLat = (minLat + maxLat) / 2;
  const lonBuffer = bufferInKm / (111 * Math.cos(avgLat * Math.PI / 180));

  return {
    north: maxLat + latBuffer,
    south: minLat - latBuffer,
    east: maxLon + lonBuffer,
    west: minLon - lonBuffer,
  };
}

/**
 * Get obstacles within a bounding box
 */
async function getObstaclesInBbox(
  bbox: BoundingBox,
): Promise<any[]> {
  try {
    return await MarkerModel.find({
      "location.latitude": { $gte: bbox.south, $lte: bbox.north },
      "location.longitude": { $gte: bbox.west, $lte: bbox.east },
    }).lean();
  } catch (error) {
    console.error("Error getting obstacles:", error);
    return []; // Return empty array if there's an error
  }
}

/**
 * Check for obstacles near the route
 */
function checkForObstaclesNearRoute(
  routePoints: Array<Point>,
  obstacles: any[],
  thresholdDistanceMeters: number = 20,
): boolean {
  // No obstacles to check
  if (
    !obstacles || obstacles.length === 0 || !routePoints ||
    routePoints.length === 0
  ) {
    return false;
  }

  let nearbyObstacles = 0;

  // Check each obstacle against each point in the route
  for (const obstacle of obstacles) {
    if (
      !obstacle.location || !obstacle.location.latitude ||
      !obstacle.location.longitude
    ) {
      continue; // Skip invalid obstacles
    }

    // Check against each point in the route
    for (const point of routePoints) {
      try {
        const distance = haversineDistanceInMeters(
          point.latitude,
          point.longitude,
          obstacle.location.latitude,
          obstacle.location.longitude,
        );

        if (distance <= thresholdDistanceMeters) {
          nearbyObstacles++;
          console.log(
            `Found obstacle near route: ${
              obstacle.obstacleType || "unknown"
            } (score: ${obstacle.obstacleScore || "unknown"}) at distance: ${
              distance.toFixed(2)
            }m`,
          );
          return true; // Return early once we find any obstacle
        }
      } catch (error) {
        console.warn("Error calculating distance for obstacle check:", error);
      }
    }
  }

  console.log(`No obstacles found within ${thresholdDistanceMeters}m of route`);
  return false;
}

/**
 * Calculate distance between two points in meters using Haversine formula
 */
export function haversineDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Clean up old graph cache entries
 * This should be run periodically
 */
export async function cleanupGraphCache(
  maxAgeInDays: number = 30,
): Promise<void> {
  try {
    const cutoffDate = new Date(
      Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000),
    );

    await RoutingGraph.deleteMany({
      lastAccessed: { $lt: cutoffDate },
    });
  } catch (error) {
    console.error("Error cleaning up graph cache:", error);
    // Don't throw, as this is a background maintenance task
  }
}

/**
 * Filter OSM data to keep only pedestrian-relevant ways and their nodes
 */
function filterOsmDataForPedestrians(osmData: OsmData): OsmData {
  // Filter ways to keep only pedestrian-relevant ones with stricter validation
  const pedestrianWays = osmData.ways.filter((way) => {
    const tags = way.tags;

    // Exclude explicitly forbidden ways
    if (
      tags.foot === "no" || tags.access === "no" || tags.access === "private"
    ) {
      return false;
    }

    // Priority 1: Dedicated pedestrian infrastructure
    if (
      tags.highway === "footway" || tags.highway === "path" ||
      tags.highway === "pedestrian" || tags.highway === "steps" ||
      tags.footway || tags.path || tags.pedestrian
    ) {
      return true;
    }

    // Priority 2: Mixed-use paths that allow pedestrians
    if (tags.highway === "cycleway" && tags.foot !== "no") {
      return true;
    }

    // Priority 3: Low-traffic roads suitable for pedestrians
    if (
      tags.highway === "residential" || tags.highway === "living_street" ||
      tags.highway === "service" || tags.highway === "unclassified"
    ) {
      // Check if sidewalk exists or foot access is explicitly allowed
      if (tags.sidewalk || tags.foot === "yes" || !tags.foot) {
        return true;
      }
    }

    // Priority 4: Tertiary roads with sidewalks
    if (tags.highway === "tertiary" && (tags.sidewalk || tags.foot === "yes")) {
      return true;
    }

    // Priority 5: Tracks and service roads accessible to pedestrians
    if (tags.highway === "track" && (tags.foot === "yes" || !tags.foot)) {
      return true;
    }

    return false;
  });

  // Get all node IDs used by the filtered ways
  const usedNodeIds = new Set<number>();
  for (const way of pedestrianWays) {
    for (const nodeId of way.nodes) {
      usedNodeIds.add(nodeId);
    }
  }

  // Filter nodes to keep only those used by pedestrian ways
  const filteredNodes: Record<number, OsmNode> = {};
  for (const nodeId of usedNodeIds) {
    if (osmData.nodes[nodeId]) {
      filteredNodes[nodeId] = osmData.nodes[nodeId];
    }
  }

  return {
    nodes: filteredNodes,
    ways: pedestrianWays,
    relations: osmData.relations || [],
  };
}

/**
 * Calculate the total distance of a route in meters
 */
function calculateRouteDistance(
  points: Array<Point>,
): number {
  if (points.length < 2) return 0;

  let totalDistance = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    totalDistance += haversineDistanceInMeters(
      p1.latitude,
      p1.longitude,
      p2.latitude,
      p2.longitude,
    );
  }

  return totalDistance;
}

/**
 * Fetch OSM data from Overpass API for a given bounding box
 */
async function fetchOsmData(bbox: BoundingBox): Promise<OsmData> {
  try {
    // Enhanced Overpass API query to get more detailed road information
    const query = `
      [out:json];
      (
        way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["footway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["path"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["cycleway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["pedestrian"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["steps"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        relation["route"="foot"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        relation["route"="hiking"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      );
      (._;>;);
      out body;
    `;

    console.log("Fetching OSM data from Overpass API...");
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();

    // Process the Overpass API result into our format
    const nodes: Record<number, OsmNode> = {};
    const ways: OsmWay[] = [];
    const relations: Array<{
      id: number;
      members: Array<{
        type: "node" | "way" | "relation";
        ref: number;
        role: string;
      }>;
      tags: Record<string, string>;
    }> = [];

    for (const element of data.elements) {
      if (element.type === "node") {
        nodes[element.id] = {
          id: element.id,
          lat: element.lat,
          lon: element.lon,
          tags: element.tags,
        };
      } else if (element.type === "way") {
        // Check for all pedestrian-relevant tags
        if (
          element.tags &&
          (element.tags.highway ||
            element.tags.footway ||
            element.tags.path ||
            element.tags.cycleway ||
            element.tags.pedestrian ||
            element.tags.steps)
        ) {
          ways.push({
            id: element.id,
            nodes: element.nodes,
            tags: element.tags,
          });
        }
      } else if (element.type === "relation") {
        if (
          element.tags &&
          (element.tags.route === "foot" ||
            element.tags.route === "hiking")
        ) {
          relations.push({
            id: element.id,
            members: element.members,
            tags: element.tags,
          });
        }
      }
    }

    console.log(
      `Processed ${
        Object.keys(nodes).length
      } nodes, ${ways.length} ways, and ${relations.length} relations`,
    );
    return { nodes, ways, relations };
  } catch (error) {
    console.error("Error fetching OSM data:", error);
    // Return an empty dataset as fallback
    return { nodes: {}, ways: [] };
  }
}

/**
 * Create a grid based on the bounding box and cell size
 */
function createGrid(bbox: BoundingBox, cellSize: number): Grid {
  // Calculate the distance in meters
  const distanceNS = haversineDistanceInMeters(
    bbox.north,
    (bbox.east + bbox.west) / 2,
    bbox.south,
    (bbox.east + bbox.west) / 2,
  );

  const distanceEW = haversineDistanceInMeters(
    (bbox.north + bbox.south) / 2,
    bbox.east,
    (bbox.north + bbox.south) / 2,
    bbox.west,
  );

  // Calculate the number of cells in each direction
  const numCellsLat = Math.ceil(distanceNS / cellSize);
  const numCellsLon = Math.ceil(distanceEW / cellSize);

  // Memory safety check - prevent excessive memory usage
  const totalCells = numCellsLat * numCellsLon;
  const MAX_CELLS = 500000; // Maximum 500k cells to prevent memory overflow

  if (totalCells > MAX_CELLS) {
    throw new Error(
      `Grid too large: ${totalCells} cells (${numCellsLat}x${numCellsLon}) exceeds maximum ${MAX_CELLS}. ` +
        `Try reducing the area or increasing cell size from ${cellSize}m.`,
    );
  }

  console.log(
    `Creating grid: ${numCellsLat}x${numCellsLon} = ${totalCells} cells at ${cellSize}m resolution`,
  );

  // Initialize the grid with empty cells
  const cells: GridCell[][] = [];
  for (let y = 0; y < numCellsLat; y++) {
    cells[y] = [];
    for (let x = 0; x < numCellsLon; x++) {
      // Calculate the coordinates of the cell center
      const latRange = bbox.north - bbox.south;
      const lonRange = bbox.east - bbox.west;
      const latitude = bbox.north - (y + 0.5) / numCellsLat * latRange;
      const longitude = bbox.west + (x + 0.5) / numCellsLon * lonRange;

      cells[y][x] = {
        x,
        y,
        latitude,
        longitude,
        isRoad: false,
        hasObstacle: false,
        obstacleWeight: 0,
        connections: [],
      };
    }
  }

  return {
    cells,
    cellSize,
    bbox,
    minX: 0,
    minY: 0,
    maxX: numCellsLon - 1,
    maxY: numCellsLat - 1,
  };
}

/**
 * Map OSM roads to the grid
 */
function mapRoadsToGrid(osmData: OsmData, grid: Grid): void {
  console.log("Mapping OSM roads to grid...");

  // Process each way (road) in the OSM data
  for (const way of osmData.ways) {
    // Skip if the way has fewer than 2 nodes
    if (way.nodes.length < 2) continue;

    // Get all the nodes for this way
    const wayNodes = way.nodes
      .filter((nodeId) => osmData.nodes[nodeId])
      .map((nodeId) => osmData.nodes[nodeId]);

    // Skip if we don't have enough valid nodes
    if (wayNodes.length < 2) continue;

    // Process each segment of the way
    for (let i = 0; i < wayNodes.length - 1; i++) {
      const node1 = wayNodes[i];
      const node2 = wayNodes[i + 1];

      // Skip invalid nodes
      if (!node1 || !node2) continue;

      // Rasterize the line segment onto the grid
      rasterizeLine(node1.lat, node1.lon, node2.lat, node2.lon, grid, way);
    }
  }

  console.log("Finished mapping roads to grid");
}

/**
 * Rasterize a line segment onto the grid
 */
function rasterizeLine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  grid: Grid,
  way: OsmWay,
): void {
  // Get grid coordinates for the start and end points
  const start = getGridCoordinates(lat1, lon1, grid);
  const end = getGridCoordinates(lat2, lon2, grid);

  // Get the cells along the line using Bresenham's algorithm
  const roadWidth = getRoadWidth(way);
  const lineCells = bresenhamWideLine(
    start.x,
    start.y,
    end.x,
    end.y,
    roadWidth,
  );

  // Mark each cell as a road and add the way ID and road type
  for (const cell of lineCells) {
    const { x, y } = cell;
    if (x >= 0 && x <= grid.maxX && y >= 0 && y <= grid.maxY) {
      grid.cells[y][x].isRoad = true;
      grid.cells[y][x].wayId = way.id;

      // Set road type
      if (way.tags.highway) {
        grid.cells[y][x].roadType = way.tags.highway;
      } else if (way.tags.footway) {
        grid.cells[y][x].roadType = "footway";
      } else if (way.tags.path) {
        grid.cells[y][x].roadType = "path";
      } else if (way.tags.cycleway) {
        grid.cells[y][x].roadType = "cycleway";
      } else if (way.tags.pedestrian) {
        grid.cells[y][x].roadType = "pedestrian";
      } else {
        grid.cells[y][x].roadType = "unknown";
      }

      // Check if the road is one-way
      grid.cells[y][x].oneway = way.tags.oneway === "yes";
    }
  }
}

/**
 * Convert lat/lon coordinates to grid coordinates
 */
function getGridCoordinates(
  lat: number,
  lon: number,
  grid: Grid,
): { x: number; y: number } {
  const latRange = grid.bbox.north - grid.bbox.south;
  const lonRange = grid.bbox.east - grid.bbox.west;

  // Calculate the number of cells in each direction
  const numCellsLat = Math.ceil(
    haversineDistanceInMeters(
      grid.bbox.north,
      (grid.bbox.east + grid.bbox.west) / 2,
      grid.bbox.south,
      (grid.bbox.east + grid.bbox.west) / 2,
    ) / grid.cellSize,
  );

  const numCellsLon = Math.ceil(
    haversineDistanceInMeters(
      (grid.bbox.north + grid.bbox.south) / 2,
      grid.bbox.east,
      (grid.bbox.north + grid.bbox.south) / 2,
      grid.bbox.west,
    ) / grid.cellSize,
  );

  // Calculate the grid coordinates
  const x = Math.floor((lon - grid.bbox.west) / lonRange * numCellsLon);
  const y = Math.floor((grid.bbox.north - lat) / latRange * numCellsLat);

  return { x, y };
}

/**
 * Draw a thick line using Bresenham's algorithm
 */
function bresenhamWideLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
): { x: number; y: number }[] {
  // Get the basic line
  const baseLine = bresenhamLine(x1, y1, x2, y2);

  // If width is 1 or less, just return the base line
  if (width <= 1) {
    return baseLine;
  }

  // Calculate width on each side
  const halfWidth = Math.max(1, Math.floor(width / 2));
  const result: { x: number; y: number }[] = [...baseLine];

  // Calculate the perpendicular direction
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) return result;

  const normalX = -dy / length;
  const normalY = dx / length;

  // Add parallel lines on each side
  for (let w = 1; w <= halfWidth; w++) {
    const offsetX = Math.round(normalX * w);
    const offsetY = Math.round(normalY * w);

    // Add a line above the base line
    const above = bresenhamLine(
      x1 + offsetX,
      y1 + offsetY,
      x2 + offsetX,
      y2 + offsetY,
    );

    // Add a line below the base line
    const below = bresenhamLine(
      x1 - offsetX,
      y1 - offsetY,
      x2 - offsetX,
      y2 - offsetY,
    );

    result.push(...above, ...below);
  }

  // Remove duplicates
  const uniqueCells = new Map<string, { x: number; y: number }>();
  for (const cell of result) {
    const key = `${cell.x},${cell.y}`;
    uniqueCells.set(key, cell);
  }

  return Array.from(uniqueCells.values());
}

/**
 * Draw a line using Bresenham's algorithm
 */
function bresenhamLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];

  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;

  let err = dx - dy;
  let x = x1;
  let y = y1;

  while (true) {
    result.push({ x, y });

    if (x === x2 && y === y2) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return result;
}

/**
 * Determine the road width in grid cells based on OSM way tags
 */
function getRoadWidth(way: OsmWay): number {
  const tags = way.tags;

  // Default width (in grid cells)
  let width = 1;

  // Adjust width based on road type
  if (tags.highway) {
    switch (tags.highway) {
      case "motorway":
      case "trunk":
      case "primary":
        width = 4;
        break;
      case "secondary":
        width = 3;
        break;
      case "tertiary":
      case "residential":
      case "unclassified":
        width = 2;
        break;
      case "footway":
      case "path":
      case "track":
      case "steps":
        width = 1;
        break;
      default:
        width = 1;
    }
  }

  // Check if there's an explicit width tag
  if (tags.width && !isNaN(parseFloat(tags.width))) {
    const explicitWidth = parseFloat(tags.width);
    // Convert meters to grid cells (approximately)
    width = Math.max(1, Math.round(explicitWidth));
  }

  return width;
}

/**
 * Connect adjacent road cells in the grid to create the navigation graph
 */
function connectRoadCells(grid: Grid): void {
  console.log("Connecting road cells...");

  // Define neighbor directions (8-way connectivity)
  const directions = [
    { dx: 1, dy: 0 }, // right
    { dx: 1, dy: 1 }, // bottom-right
    { dx: 0, dy: 1 }, // bottom
    { dx: -1, dy: 1 }, // bottom-left
    { dx: -1, dy: 0 }, // left
    { dx: -1, dy: -1 }, // top-left
    { dx: 0, dy: -1 }, // top
    { dx: 1, dy: -1 }, // top-right
  ];

  // Connect each road cell to its neighboring road cells
  for (let y = 0; y <= grid.maxY; y++) {
    for (let x = 0; x <= grid.maxX; x++) {
      const cell = grid.cells[y][x];

      // Skip non-road cells
      if (!cell.isRoad) continue;

      // Clear any previous connections
      cell.connections = [];

      // Connect to neighboring road cells
      for (const dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;

        // Check if neighbor is within bounds
        if (nx >= 0 && nx <= grid.maxX && ny >= 0 && ny <= grid.maxY) {
          const neighbor = grid.cells[ny][nx];

          // Only connect to other road cells
          if (neighbor.isRoad) {
            cell.connections.push(neighbor);
          }
        }
      }
    }
  }

  console.log("Finished connecting road cells");
}

/**
 * Apply obstacles to the grid, increasing the weight of cells near obstacles
 */
function applyObstaclesToGrid(
  grid: Grid,
  obstacles: any[],
  proximityThreshold: number = 20, // meters
): void {
  if (!obstacles || obstacles.length === 0) return;

  console.log(`Applying ${obstacles.length} obstacles to grid...`);

  for (const obstacle of obstacles) {
    if (
      !obstacle.location || !obstacle.location.latitude ||
      !obstacle.location.longitude
    ) {
      continue;
    }

    // Get the obstacle type and score
    const obstacleType = obstacle.obstacleType || "OTHER";
    // Use type assertion to fix TypeScript error
    const obstacleScore = obstacle.obstacleScore ||
      (OBSTACLE_WEIGHTS[obstacleType as keyof typeof OBSTACLE_WEIGHTS] ||
        OBSTACLE_WEIGHTS.OTHER);

    // Get the grid coordinates for the obstacle
    const obsCoords = getGridCoordinates(
      obstacle.location.latitude,
      obstacle.location.longitude,
      grid,
    );

    // Define the radius of influence in grid cells
    // Based on the proximity threshold and cell size
    const influenceRadius = Math.ceil(proximityThreshold / grid.cellSize);

    // Apply obstacle weight to nearby cells with exponential decay
    for (let dy = -influenceRadius; dy <= influenceRadius; dy++) {
      for (let dx = -influenceRadius; dx <= influenceRadius; dx++) {
        const x = obsCoords.x + dx;
        const y = obsCoords.y + dy;

        // Skip if outside grid bounds
        if (x < 0 || x > grid.maxX || y < 0 || y > grid.maxY) continue;

        const cell = grid.cells[y][x];

        // Calculate distance from obstacle (in grid cells)
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Skip if outside influence radius
        if (distance > influenceRadius) continue;

        // Calculate weight based on distance (higher weight = more difficult)
        // Use exponential decay: weight decreases as distance increases
        const distanceRatio = 1 - (distance / influenceRadius);
        const weightContribution = obstacleScore * Math.pow(distanceRatio, 2);

        // Apply the obstacle weight
        cell.obstacleWeight += weightContribution;

        // Mark as having an obstacle if very close
        if (distance <= 1) {
          cell.hasObstacle = true;
        }
      }
    }
  }

  console.log("Finished applying obstacles to grid");
}

/**
 * Find the nearest road cell to a given point
 */
function findNearestRoadCell(grid: Grid, point: Point): GridCell | null {
  // Get the grid coordinates for the point
  const coords = getGridCoordinates(point.latitude, point.longitude, grid);

  // Search for the nearest road cell in increasing radius
  const maxSearchRadius = Math.max(grid.maxX, grid.maxY);

  for (let radius = 0; radius <= maxSearchRadius; radius++) {
    // Search in a square pattern around the point
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Only check cells at the current radius (perimeter)
        if (Math.abs(dx) < radius && Math.abs(dy) < radius) continue;

        const x = coords.x + dx;
        const y = coords.y + dy;

        // Check if within grid bounds
        if (x < 0 || x > grid.maxX || y < 0 || y > grid.maxY) continue;

        // Check if this is a road cell
        if (grid.cells[y][x].isRoad) {
          return grid.cells[y][x];
        }
      }
    }
  }

  // No road cell found within the maximum search radius
  return null;
}

/**
 * A* pathfinding algorithm
 */
function findPathAStar(
  grid: Grid,
  start: GridCell,
  goal: GridCell,
): GridCell[] {
  console.log(
    `Finding path from (${start.x},${start.y}) to (${goal.x},${goal.y})`,
  );

  // Create open and closed sets
  const openSet: GridCell[] = [start];
  const closedSet = new Set<string>();

  // Initialize start node
  start.g = 0;
  start.h = heuristic(start, goal);
  start.f = start.g + start.h;
  start.parent = null;

  let iterations = 0;
  const maxIterations = Math.min(
    grid.cells.length * grid.cells[0].length,
    100000,
  ); // Prevent infinite loops

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;
    // Find the node with the lowest f value
    let current = openSet[0];
    let currentIndex = 0;

    for (let i = 1; i < openSet.length; i++) {
      if ((openSet[i].f || Infinity) < (current.f || Infinity)) {
        current = openSet[i];
        currentIndex = i;
      }
    }

    // If we reached the goal, reconstruct and return the path
    if (current === goal) {
      console.log("Path found!");
      return reconstructPath(goal);
    }

    // Move current from open to closed set
    openSet.splice(currentIndex, 1);
    closedSet.add(`${current.x},${current.y}`);

    // Check all connections (neighbors)
    for (const neighbor of current.connections) {
      // Skip if neighbor is in closed set
      if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;

      // Calculate tentative g score
      const weight = 1 + (neighbor.obstacleWeight || 0);
      const tentativeG = (current.g || 0) + weight;

      // Check if neighbor is already in open set
      const neighborInOpenSet = openSet.find(
        (cell) => cell.x === neighbor.x && cell.y === neighbor.y,
      );

      if (!neighborInOpenSet) {
        // New node, add to open set
        neighbor.parent = current;
        neighbor.g = tentativeG;
        neighbor.h = heuristic(neighbor, goal);
        neighbor.f = neighbor.g + neighbor.h;
        openSet.push(neighbor);
      } else if (tentativeG < (neighborInOpenSet.g || Infinity)) {
        // This path is better than previous one
        neighborInOpenSet.parent = current;
        neighborInOpenSet.g = tentativeG;
        neighborInOpenSet.f = tentativeG + (neighborInOpenSet.h || 0);
      }
    }
  }

  // No path found
  if (iterations >= maxIterations) {
    console.log(
      `A* search terminated after ${iterations} iterations (max reached)`,
    );
  } else {
    console.log("No path found!");
  }
  return [];
}

/**
 * Heuristic function for A* (Euclidean distance)
 */
function heuristic(a: GridCell, b: GridCell): number {
  // Use Euclidean distance as heuristic
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Reconstruct the path from goal to start
 */
function reconstructPath(goal: GridCell): GridCell[] {
  const path: GridCell[] = [];
  let current: GridCell | null | undefined = goal;

  while (current) {
    path.unshift(current);
    current = current.parent;
  }

  return path;
}

/**
 * Convert grid path to precise route that follows actual OSM ways
 */
function snapRouteToRoads(
  gridPath: GridCell[],
  osmData: OsmData,
): Point[] {
  if (gridPath.length < 2) {
    return gridPath.map((cell) => ({
      latitude: cell.latitude,
      longitude: cell.longitude,
    }));
  }

  console.log("Snapping route to actual OSM roads...");

  // Convert grid cells to points
  const routePoints: Point[] = [];

  // Process each segment of the grid path
  for (let i = 0; i < gridPath.length - 1; i++) {
    const cellA = gridPath[i];
    const cellB = gridPath[i + 1];

    // Find the best matching OSM way for this grid segment
    const segmentWays = findSegmentOsmWays(
      { latitude: cellA.latitude, longitude: cellA.longitude },
      { latitude: cellB.latitude, longitude: cellB.longitude },
      osmData,
      20, // Maximum search distance in meters
    );

    if (segmentWays.length > 0) {
      // Get the nodes of the best matching way
      const wayPoints = getWayPoints(segmentWays[0], osmData);

      // If this isn't the first segment, skip the first way point to avoid duplicates
      if (i > 0 && wayPoints.length > 0) {
        routePoints.push(...wayPoints.slice(1));
      } else {
        routePoints.push(...wayPoints);
      }
    } else {
      // No matching way found, use the grid cell coordinates
      if (i === 0 || routePoints.length === 0) {
        routePoints.push({
          latitude: cellA.latitude,
          longitude: cellA.longitude,
        });
      }

      routePoints.push({
        latitude: cellB.latitude,
        longitude: cellB.longitude,
      });
    }
  }

  return routePoints;
}

/**
 * Find OSM ways that match a route segment
 */
function findSegmentOsmWays(
  pointA: Point,
  pointB: Point,
  osmData: OsmData,
  maxDistanceMeters: number = 20,
): OsmWay[] {
  const matchingWays: OsmWay[] = [];

  // Calculate midpoint of the segment for searching
  const midLat = (pointA.latitude + pointB.latitude) / 2;
  const midLon = (pointA.longitude + pointB.longitude) / 2;

  // Calculate segment length and direction
  const segmentLength = haversineDistanceInMeters(
    pointA.latitude,
    pointA.longitude,
    pointB.latitude,
    pointB.longitude,
  );

  // Skip very short segments
  if (segmentLength < 1) return matchingWays;

  // Check each way
  for (const way of osmData.ways) {
    // Skip ways with too few nodes
    if (way.nodes.length < 2) continue;

    let minDistance = Infinity;

    // Check distance from each way segment to our midpoint
    for (let i = 0; i < way.nodes.length - 1; i++) {
      const nodeId1 = way.nodes[i];
      const nodeId2 = way.nodes[i + 1];

      const node1 = osmData.nodes[nodeId1];
      const node2 = osmData.nodes[nodeId2];

      if (!node1 || !node2) continue;

      // Calculate the distance from the midpoint to this way segment
      const distance = distanceToSegment(
        midLat,
        midLon,
        node1.lat,
        node1.lon,
        node2.lat,
        node2.lon,
      );

      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    // If this way is close enough to our segment, include it
    if (minDistance <= maxDistanceMeters) {
      matchingWays.push(way);
    }
  }

  // Sort ways by relevance (pedestrian ways first, then by distance)
  return matchingWays.sort((a, b) => {
    // Prioritize pedestrian ways
    const aIsPedestrian = isPedestrianWay(a);
    const bIsPedestrian = isPedestrianWay(b);

    if (aIsPedestrian && !bIsPedestrian) return -1;
    if (!aIsPedestrian && bIsPedestrian) return 1;

    // If both are the same type, sort by distance
    return 0;
  });
}

/**
 * Check if a way is suitable for pedestrians
 */
function isPedestrianWay(way: OsmWay): boolean {
  const tags = way.tags;

  // Explicitly pedestrian-oriented ways
  if (
    tags.highway === "footway" ||
    tags.highway === "path" ||
    tags.highway === "pedestrian" ||
    tags.footway ||
    tags.path ||
    tags.pedestrian
  ) {
    return true;
  }

  // Residential streets and other walkable roads
  if (
    tags.highway === "residential" ||
    tags.highway === "living_street" ||
    tags.highway === "service" ||
    tags.highway === "track"
  ) {
    return true;
  }

  return false;
}

/**
 * Get the points for a way
 */
function getWayPoints(way: OsmWay, osmData: OsmData): Point[] {
  const points: Point[] = [];

  for (const nodeId of way.nodes) {
    const node = osmData.nodes[nodeId];
    if (node) {
      points.push({
        latitude: node.lat,
        longitude: node.lon,
      });
    }
  }

  return points;
}

/**
 * Calculate the distance from a point to a line segment
 */
function distanceToSegment(
  pointLat: number,
  pointLon: number,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
): number {
  // For very short segments, just return distance to start point
  if (startLat === endLat && startLon === endLon) {
    return haversineDistanceInMeters(pointLat, pointLon, startLat, startLon);
  }

  // Calculate projection of point onto line segment
  const dx = endLat - startLat;
  const dy = endLon - startLon;

  const t = ((pointLat - startLat) * dx + (pointLon - startLon) * dy) /
    (dx * dx + dy * dy);

  // If projection is outside the segment, return distance to nearest endpoint
  if (t < 0) {
    return haversineDistanceInMeters(pointLat, pointLon, startLat, startLon);
  }
  if (t > 1) {
    return haversineDistanceInMeters(pointLat, pointLon, endLat, endLon);
  }

  // Calculate the projected point
  const projLat = startLat + t * dx;
  const projLon = startLon + t * dy;

  // Return distance to projected point
  return haversineDistanceInMeters(pointLat, pointLon, projLat, projLon);
}

/**
 * Apply final post-processing to ensure route follows roads precisely
 */
function postProcessRoute(routePoints: Point[], osmData: OsmData): Point[] {
  console.log("Post-processing route for maximum precision...");

  if (routePoints.length < 2) return routePoints;

  // Remove duplicate consecutive points
  let processedPoints = removeDuplicatePoints(routePoints);

  // For each point, find the nearest OSM node or way point
  for (let i = 0; i < processedPoints.length; i++) {
    const point = processedPoints[i];

    // Don't snap the very first and last points
    if (i === 0 || i === processedPoints.length - 1) continue;

    // Find the nearest OSM node within 15 meters
    const nearestNode = findNearestOsmNode(point, osmData, 15);

    if (nearestNode) {
      // Replace the point with the precise OSM node location
      processedPoints[i] = {
        latitude: nearestNode.lat,
        longitude: nearestNode.lon,
      };
    } else {
      // If no node is found, try to snap to the nearest way
      const snapResult = snapPointToNearestWay(point, osmData, 20);

      if (snapResult) {
        processedPoints[i] = snapResult;
      }
    }
  }

  return processedPoints;
}

/**
 * Find the nearest OSM node to a point
 */
function findNearestOsmNode(
  point: Point,
  osmData: OsmData,
  maxDistanceMeters: number,
): OsmNode | null {
  let nearestNode: OsmNode | null = null;
  let minDistance = maxDistanceMeters;

  // Check each node
  for (const nodeId in osmData.nodes) {
    const node = osmData.nodes[nodeId];

    const distance = haversineDistanceInMeters(
      point.latitude,
      point.longitude,
      node.lat,
      node.lon,
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestNode = node;
    }
  }

  return nearestNode;
}

/**
 * Snap a point to the nearest OSM way
 */
function snapPointToNearestWay(
  point: Point,
  osmData: OsmData,
  maxDistanceMeters: number,
): Point | null {
  let minDistance = maxDistanceMeters;
  let bestProjection: Point | null = null;

  // Check each way
  for (const way of osmData.ways) {
    if (way.nodes.length < 2) continue;

    // Check each segment of the way
    for (let i = 0; i < way.nodes.length - 1; i++) {
      const node1 = osmData.nodes[way.nodes[i]];
      const node2 = osmData.nodes[way.nodes[i + 1]];

      if (!node1 || !node2) continue;

      // Calculate the projection of the point onto this segment
      const dx = node2.lat - node1.lat;
      const dy = node2.lon - node1.lon;

      const t = ((point.latitude - node1.lat) * dx +
        (point.longitude - node1.lon) * dy) /
        (dx * dx + dy * dy);

      // Clamp t to the segment bounds
      const clampedT = Math.max(0, Math.min(1, t));

      // Calculate the projected point
      const projLat = node1.lat + clampedT * dx;
      const projLon = node1.lon + clampedT * dy;

      // Calculate the distance to the projected point
      const distance = haversineDistanceInMeters(
        point.latitude,
        point.longitude,
        projLat,
        projLon,
      );

      // Update if this is the closest projection so far
      if (distance < minDistance) {
        minDistance = distance;
        bestProjection = {
          latitude: projLat,
          longitude: projLon,
        };
      }
    }
  }

  return bestProjection;
}

/**
 * Remove duplicate consecutive points in a route
 */
function removeDuplicatePoints(points: Point[]): Point[] {
  if (points.length <= 1) return points;

  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];

    // Check if this point is identical or very close to the previous one
    const distance = haversineDistanceInMeters(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude,
    );

    // Only add if the point is at least 1 meter away from the previous one
    if (distance >= 1) {
      result.push(curr);
    }
  }

  return result;
}

/**
 * Thorough road snapping that ensures routes follow actual roads
 */
function lightweightRoadSnap(
  points: Point[],
  osmData: OsmData,
  cellSize: number,
): Point[] {
  if (points.length < 2) return points;

  const maxSnapDistance = Math.min(cellSize * 1.5, 25); // Tighter snapping for higher precision
  const result: Point[] = [points[0]]; // Always keep exact origin

  // Process each segment to ensure it follows roads
  for (let i = 1; i < points.length; i++) {
    const prevPoint = result[result.length - 1];
    const currentPoint = points[i];

    // For the last point, don't snap (preserve exact destination)
    if (i === points.length - 1) {
      // Try to connect to destination via roads
      const roadPath = findRoadPath(
        prevPoint,
        currentPoint,
        osmData,
        maxSnapDistance,
      );
      if (roadPath.length > 1) {
        result.push(...roadPath.slice(1)); // Skip first point (already in result)
      } else {
        result.push(currentPoint);
      }
      break;
    }

    // Find the best road path between consecutive points
    const roadPath = findRoadPath(
      prevPoint,
      currentPoint,
      osmData,
      maxSnapDistance,
    );

    if (roadPath.length > 1) {
      // Add the road path points (skip first as it's already in result)
      result.push(...roadPath.slice(1));
    } else {
      // Fallback: snap current point to nearest road
      const snappedPoint = findNearestRoadPoint(
        currentPoint,
        osmData,
        maxSnapDistance,
      );
      result.push(snappedPoint || currentPoint);
    }
  }

  return result;
}

/**
 * Find the nearest point on any road within the specified distance
 */
function findNearestRoadPoint(
  point: Point,
  osmData: OsmData,
  maxDistance: number,
): Point | null {
  let nearestPoint: Point | null = null;
  let minDistance = maxDistance;

  // Check more ways for higher precision while maintaining reasonable performance
  const waysToCheck = osmData.ways.slice(
    0,
    Math.min(1000, osmData.ways.length),
  );

  for (const way of waysToCheck) {
    if (way.nodes.length < 2) continue;

    // Check each segment of the way
    for (let i = 0; i < way.nodes.length - 1; i++) {
      const node1 = osmData.nodes[way.nodes[i]];
      const node2 = osmData.nodes[way.nodes[i + 1]];

      if (!node1 || !node2) continue;

      // Calculate projection onto this segment
      const projected = projectPointOntoSegment(
        point,
        { latitude: node1.lat, longitude: node1.lon },
        { latitude: node2.lat, longitude: node2.lon },
      );

      const distance = haversineDistanceInMeters(
        point.latitude,
        point.longitude,
        projected.latitude,
        projected.longitude,
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = projected;
      }
    }
  }

  return nearestPoint;
}

/**
 * Find a path along roads between two points
 */
function findRoadPath(
  startPoint: Point,
  endPoint: Point,
  osmData: OsmData,
  maxSnapDistance: number,
): Point[] {
  // Find nearby roads for both start and end points
  const startRoadSegments = findNearbyRoadSegments(
    startPoint,
    osmData,
    maxSnapDistance,
  );
  const endRoadSegments = findNearbyRoadSegments(
    endPoint,
    osmData,
    maxSnapDistance,
  );

  if (startRoadSegments.length === 0 || endRoadSegments.length === 0) {
    return [startPoint, endPoint]; // Fallback to direct path
  }

  // Try to find a connected path through roads
  let bestPath: Point[] = [startPoint, endPoint];
  let shortestDistance = haversineDistanceInMeters(
    startPoint.latitude,
    startPoint.longitude,
    endPoint.latitude,
    endPoint.longitude,
  );

  // Check more combinations of start and end road segments for better path finding
  for (let i = 0; i < Math.min(5, startRoadSegments.length); i++) {
    for (let j = 0; j < Math.min(5, endRoadSegments.length); j++) {
      const startRoad = startRoadSegments[i];
      const endRoad = endRoadSegments[j];

      // Try to trace a path along roads
      const roadPath = traceRoadPath(startRoad, endRoad, osmData);

      if (roadPath.length > 2) {
        const pathDistance = calculateRouteDistance(roadPath);
        if (pathDistance < shortestDistance * 2) { // Don't accept paths more than 2x longer
          bestPath = roadPath;
          shortestDistance = pathDistance;
        }
      }
    }
  }

  return bestPath;
}

/**
 * Find road segments near a point
 */
function findNearbyRoadSegments(
  point: Point,
  osmData: OsmData,
  maxDistance: number,
): Array<{ way: OsmWay; segmentIndex: number; projectedPoint: Point }> {
  const segments: Array<
    { way: OsmWay; segmentIndex: number; projectedPoint: Point }
  > = [];

  for (const way of osmData.ways.slice(0, Math.min(300, osmData.ways.length))) {
    if (way.nodes.length < 2) continue;

    for (let i = 0; i < way.nodes.length - 1; i++) {
      const node1 = osmData.nodes[way.nodes[i]];
      const node2 = osmData.nodes[way.nodes[i + 1]];

      if (!node1 || !node2) continue;

      const projected = projectPointOntoSegment(
        point,
        { latitude: node1.lat, longitude: node1.lon },
        { latitude: node2.lat, longitude: node2.lon },
      );

      const distance = haversineDistanceInMeters(
        point.latitude,
        point.longitude,
        projected.latitude,
        projected.longitude,
      );

      if (distance <= maxDistance) {
        segments.push({
          way,
          segmentIndex: i,
          projectedPoint: projected,
        });
      }
    }
  }

  // Sort by distance
  segments.sort((a, b) => {
    const distA = haversineDistanceInMeters(
      point.latitude,
      point.longitude,
      a.projectedPoint.latitude,
      a.projectedPoint.longitude,
    );
    const distB = haversineDistanceInMeters(
      point.latitude,
      point.longitude,
      b.projectedPoint.latitude,
      b.projectedPoint.longitude,
    );
    return distA - distB;
  });

  return segments.slice(0, 8); // Return top 8 closest segments for better path options
}

/**
 * Trace a path between two road segments
 */
function traceRoadPath(
  startSegment: { way: OsmWay; segmentIndex: number; projectedPoint: Point },
  endSegment: { way: OsmWay; segmentIndex: number; projectedPoint: Point },
  osmData: OsmData,
): Point[] {
  // If it's the same way, trace along the way
  if (startSegment.way.id === endSegment.way.id) {
    return traceAlongWay(startSegment, endSegment, osmData);
  }

  // For different ways, try to find a simple connection
  // This is a simplified version - a full implementation would use graph algorithms
  return [startSegment.projectedPoint, endSegment.projectedPoint];
}

/**
 * Trace along a single way between two points
 */
function traceAlongWay(
  startSegment: { way: OsmWay; segmentIndex: number; projectedPoint: Point },
  endSegment: { way: OsmWay; segmentIndex: number; projectedPoint: Point },
  osmData: OsmData,
): Point[] {
  const way = startSegment.way;
  const path: Point[] = [startSegment.projectedPoint];

  const startIdx = startSegment.segmentIndex;
  const endIdx = endSegment.segmentIndex;

  // Determine direction
  if (startIdx < endIdx) {
    // Forward direction
    for (let i = startIdx + 1; i <= endIdx; i++) {
      const nodeId = way.nodes[i];
      const node = osmData.nodes[nodeId];
      if (node) {
        path.push({ latitude: node.lat, longitude: node.lon });
      }
    }
  } else if (startIdx > endIdx) {
    // Backward direction
    for (let i = startIdx; i >= endIdx + 1; i--) {
      const nodeId = way.nodes[i];
      const node = osmData.nodes[nodeId];
      if (node) {
        path.push({ latitude: node.lat, longitude: node.lon });
      }
    }
  }

  path.push(endSegment.projectedPoint);
  return path;
}

/**
 * Project a point onto a line segment
 */
function projectPointOntoSegment(
  point: Point,
  segStart: Point,
  segEnd: Point,
): Point {
  const dx = segEnd.latitude - segStart.latitude;
  const dy = segEnd.longitude - segStart.longitude;

  if (dx === 0 && dy === 0) {
    return segStart; // Segment is a point
  }

  const t = ((point.latitude - segStart.latitude) * dx +
    (point.longitude - segStart.longitude) * dy) / (dx * dx + dy * dy);

  // Clamp t to the segment bounds
  const clampedT = Math.max(0, Math.min(1, t));

  return {
    latitude: segStart.latitude + clampedT * dx,
    longitude: segStart.longitude + clampedT * dy,
  };
}

/**
 * Simplified route optimization to remove excessive points
 */
function simplifyRoute(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  // Use a conservative Douglas-Peucker simplification
  const simplified = douglasPeuckerSimplify(points, Math.max(tolerance, 3));

  // Ensure we don't over-simplify
  if (simplified.length < 3 && points.length > 2) {
    // If we simplified too much, use a larger tolerance or return more points
    return points.filter((_, index) =>
      index % 2 === 0 || index === points.length - 1
    );
  }

  return simplified;
}

/**
 * Fine-tune route for better precision and smoother transitions
 */
function fineTuneRoute(
  points: Point[],
  osmData: OsmData,
  cellSize: number,
): Point[] {
  if (points.length <= 2) return points;

  const fineTuned: Point[] = [points[0]]; // Keep exact start
  const maxAdjustment = Math.min(cellSize / 2, 10); // Maximum adjustment distance

  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const prevPoint = fineTuned[fineTuned.length - 1];
    const nextPoint = points[i + 1];

    // Try to find a better road position for this point considering its neighbors
    const improvedPoint = findBetterRoadPosition(
      point,
      prevPoint,
      nextPoint,
      osmData,
      maxAdjustment,
    );

    // Only use the improved point if it's not too far from the original
    const adjustment = haversineDistanceInMeters(
      point.latitude,
      point.longitude,
      improvedPoint.latitude,
      improvedPoint.longitude,
    );

    if (adjustment <= maxAdjustment) {
      fineTuned.push(improvedPoint);
    } else {
      fineTuned.push(point); // Keep original if adjustment is too large
    }
  }

  fineTuned.push(points[points.length - 1]); // Keep exact end
  return fineTuned;
}

/**
 * Find a better road position for a point considering its neighbors
 */
function findBetterRoadPosition(
  point: Point,
  prevPoint: Point,
  nextPoint: Point,
  osmData: OsmData,
  maxDistance: number,
): Point {
  // Find the best road segment that creates a smooth path between prev and next points
  let bestPoint = point;
  let bestScore = 0;

  // Check nearby road segments
  const nearbySegments = findNearbyRoadSegments(point, osmData, maxDistance);

  for (const segment of nearbySegments.slice(0, 3)) { // Check top 3 segments
    const candidate = segment.projectedPoint;

    // Calculate how well this point creates a smooth path
    const score = calculatePathSmoothness(prevPoint, candidate, nextPoint);

    if (score > bestScore) {
      bestScore = score;
      bestPoint = candidate;
    }
  }

  return bestPoint;
}

/**
 * Calculate how smooth a path is through three points
 */
function calculatePathSmoothness(p1: Point, p2: Point, p3: Point): number {
  // Calculate the angle at p2
  const angle1 = Math.atan2(
    p2.latitude - p1.latitude,
    p2.longitude - p1.longitude,
  );
  const angle2 = Math.atan2(
    p3.latitude - p2.latitude,
    p3.longitude - p2.longitude,
  );

  let angleDiff = Math.abs(angle2 - angle1);
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

  // Smoother paths have smaller angle differences
  // Return a score between 0 and 1, where 1 is perfectly smooth
  return 1 - (angleDiff / Math.PI);
}

/**
 * Smooth and simplify the path with high precision
 */
function smoothPath(gridPath: GridCell[]): Point[] {
  if (gridPath.length < 2) {
    return gridPath.map((cell) => ({
      latitude: cell.latitude,
      longitude: cell.longitude,
    }));
  }

  // Convert grid cells to points
  const points = gridPath.map((cell) => ({
    latitude: cell.latitude,
    longitude: cell.longitude,
  }));

  // Use a smaller epsilon value for better precision, but not too small to avoid over-simplification
  return douglasPeuckerSimplify(
    points,
    Math.max(1, gridPath[0]?.connections?.length ? 1 : 3),
  ); // Dynamic tolerance
}

/**
 * Douglas-Peucker algorithm for path simplification with improved precision
 */
function douglasPeuckerSimplify(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  // Find the point with the maximum distance
  let maxDistance = 0;
  let maxIndex = 0;

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], firstPoint, lastPoint);

    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive case
    const firstPart = douglasPeuckerSimplify(
      points.slice(0, maxIndex + 1),
      epsilon,
    );
    const secondPart = douglasPeuckerSimplify(
      points.slice(maxIndex),
      epsilon,
    );

    // Concatenate the two parts, removing the duplicate point
    return [...firstPart.slice(0, -1), ...secondPart];
  } else {
    // Base case
    return [firstPoint, lastPoint];
  }
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number {
  // Convert to meters first
  const p1Lat = lineStart.latitude;
  const p1Lon = lineStart.longitude;
  const p2Lat = lineEnd.latitude;
  const p2Lon = lineEnd.longitude;
  const pLat = point.latitude;
  const pLon = point.longitude;

  // Handle case where line start and end are the same point
  if (p1Lat === p2Lat && p1Lon === p2Lon) {
    return haversineDistanceInMeters(p1Lat, p1Lon, pLat, pLon);
  }

  // Calculate distances
  const lineLength = haversineDistanceInMeters(p1Lat, p1Lon, p2Lat, p2Lon);

  // Project the point onto the line segment
  // First, calculate the projection ratio
  const dx = p2Lat - p1Lat;
  const dy = p2Lon - p1Lon;

  // Calculate dot product for projection
  const t = ((pLat - p1Lat) * dx + (pLon - p1Lon) * dy) / (dx * dx + dy * dy);

  // Clamp to line segment
  const clampedT = Math.max(0, Math.min(1, t));

  // Calculate the projected point
  const projectedLat = p1Lat + clampedT * dx;
  const projectedLon = p1Lon + clampedT * dy;

  // Return the distance to the projected point
  return haversineDistanceInMeters(pLat, pLon, projectedLat, projectedLon);
}

/**
 * Find an accessible route
 */
export async function findAccessibleRoute(
  params: RoutingParams,
): Promise<RoutingResult> {
  try {
    const { origin, destination, avoidObstacles = true, userPreferences } =
      params;

    // Validate input parameters to prevent undefined values
    if (
      !origin || typeof origin.latitude !== "number" ||
      typeof origin.longitude !== "number" ||
      !destination || typeof destination.latitude !== "number" ||
      typeof destination.longitude !== "number"
    ) {
      throw new Error("Invalid origin or destination coordinates");
    }

    // Calculate bounding box for the route
    const bbox = calculateBoundingBox(origin, destination);

    // Check if route distance is too large (over MAX_GRAPH_SIZE)
    const routeDistanceKm = haversineDistanceInMeters(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    ) / 1000;

    if (routeDistanceKm > MAX_GRAPH_SIZE) {
      console.error(
        `Route distance ${
          routeDistanceKm.toFixed(2)
        }km exceeds maximum supported size of ${MAX_GRAPH_SIZE}km`,
      );
      throw new Error(
        `Route too long: ${
          routeDistanceKm.toFixed(2)
        }km exceeds maximum supported size`,
      );
    }

    // Get obstacles within the bounding box if needed
    let obstacles: any[] = [];
    if (avoidObstacles) {
      try {
        obstacles = await getObstaclesInBbox(bbox);
        console.log(`Found ${obstacles.length} obstacles in bounding box`);
      } catch (obstaclesError) {
        console.warn(
          "Failed to get obstacles, continuing without them:",
          obstaclesError,
        );
      }
    }

    console.log("Using OSM grid-based routing for accessible path...");

    // Check available memory before processing
    if (process.memoryUsage) {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      console.log(
        `Memory usage before OSM fetch: ${heapUsedMB}MB used / ${heapTotalMB}MB total`,
      );

      // If we're already using a lot of memory, be more conservative
      if (heapUsedMB > 1000) {
        console.warn("High memory usage detected, will use larger cell sizes");
      }
    }

    // Fetch OSM data for the bounding box
    const osmData = await fetchOsmData(bbox);

    // Validate OSM data - make sure we have at least some ways/nodes
    if (
      !osmData.ways || osmData.ways.length === 0 ||
      Object.keys(osmData.nodes).length === 0
    ) {
      console.error("Insufficient OSM data retrieved for routing");
      throw new Error("Could not retrieve sufficient map data for routing");
    }

    // Filter and optimize OSM data to reduce memory usage
    const filteredOsmData = filterOsmDataForPedestrians(osmData);
    console.log(
      `Filtered OSM data: ${
        Object.keys(filteredOsmData.nodes).length
      } nodes, ${filteredOsmData.ways.length} ways`,
    );

    // Try cell sizes - high precision for accurate road following
    const cellSizes = [5, 10, 20]; // meters
    let lastError = null;
    for (const cellSize of cellSizes) {
      try {
        console.log(`Trying grid cell size: ${cellSize}m`);
        const grid = createGrid(bbox, cellSize);
        mapRoadsToGrid(filteredOsmData, grid);
        connectRoadCells(grid);
        if (avoidObstacles && obstacles.length > 0) {
          applyObstaclesToGrid(grid, obstacles);
        }
        const startCell = findNearestRoadCell(grid, origin);
        const goalCell = findNearestRoadCell(grid, destination);
        if (!startCell || !goalCell) {
          throw new Error("No accessible roads near the origin or destination");
        }
        const gridPath = findPathAStar(grid, startCell, goalCell);
        if (gridPath.length === 0) {
          throw new Error("Could not find an accessible route");
        }

        console.log(`Grid path found with ${gridPath.length} cells`);

        // Convert grid path to lat/lon points with basic road alignment
        let routePoints: Point[] = gridPath.map((cell) => ({
          latitude: cell.latitude,
          longitude: cell.longitude,
        }));

        console.log(`Basic route conversion: ${routePoints.length} points`);

        // Apply lightweight road snapping to improve route quality
        routePoints = lightweightRoadSnap(
          routePoints,
          filteredOsmData,
          cellSize,
        );
        console.log(
          `After lightweight road snapping: ${routePoints.length} points`,
        );

        // Simplify route to remove excessive points while maintaining road alignment
        routePoints = simplifyRoute(routePoints, Math.max(cellSize / 3, 2)); // Higher precision simplification
        console.log(`After simplification: ${routePoints.length} points`);

        // Apply fine-tuning to improve route curves and transitions
        routePoints = fineTuneRoute(routePoints, osmData, cellSize);
        console.log(`After fine-tuning: ${routePoints.length} points`);

        // Ensure we start and end at the exact requested points
        if (routePoints.length > 0) {
          routePoints[0] = origin;
          routePoints[routePoints.length - 1] = destination;
        } else {
          routePoints = [origin, destination];
        }
        const finalDistance = calculateRouteDistance(routePoints) / 1000;
        const directDistance = routeDistanceKm;
        const routeDeviation = finalDistance / directDistance;

        // Debug logging to understand route characteristics
        console.log(`Route analysis for ${cellSize}m grid:`);
        console.log(`  Direct distance: ${directDistance.toFixed(3)}km`);
        console.log(`  Route distance: ${finalDistance.toFixed(3)}km`);
        console.log(`  Route deviation: ${routeDeviation.toFixed(2)}x`);
        console.log(`  Route points: ${routePoints.length}`);

        // Improved validation - ensure route is reasonable but not too strict
        if (finalDistance <= 0 || !isFinite(finalDistance)) {
          throw new Error("Invalid route distance calculated");
        }

        // Reject only if route is extremely unreasonable (more than 10x direct distance)
        if (routeDeviation > 10.0 && finalDistance > 0.1) {
          throw new Error(
            `Route deviation extremely high: ${
              routeDeviation.toFixed(2)
            }x - likely invalid`,
          );
        }

        console.log(
          `✅ Route accepted with ${routeDeviation.toFixed(2)}x deviation`,
        );
        const estimatedMinutes = Math.round(finalDistance * 15);
        const duration = `${estimatedMinutes} mins`;
        const hasObstacles = checkForObstaclesNearRoute(routePoints, obstacles);
        const steps = [{
          instructions: "Follow the accessible path.",
          distance: `${finalDistance.toFixed(2)} km`,
          duration: duration,
          startLocation: origin,
          endLocation: destination,
        }];
        return {
          points: routePoints,
          distance: Number(finalDistance.toFixed(2)),
          duration: duration,
          hasObstacles: hasObstacles,
          steps: steps,
        };
      } catch (err) {
        lastError = err;
        console.warn(
          `Routing failed with cell size ${cellSize}m:`,
          err instanceof Error ? err.message : err,
        );
        // Try next cell size - continue with larger cell sizes for better success rate
      }
    }
    // If all cell sizes fail, try to return a simplified fallback route
    console.warn(
      "All grid-based routing attempts failed, attempting fallback route",
    );

    try {
      // Create a simple direct route as fallback
      const fallbackPoints = [origin, destination];
      const fallbackDistance = calculateRouteDistance(fallbackPoints) / 1000;
      const estimatedMinutes = Math.round(fallbackDistance * 20); // Slower walking speed for accessibility
      const hasObstacles = checkForObstaclesNearRoute(
        fallbackPoints,
        obstacles,
        50,
      ); // Wider check for obstacles

      console.log(
        `Fallback route: ${fallbackDistance.toFixed(3)}km direct path with ${
          hasObstacles ? "potential" : "no"
        } obstacles`,
      );

      return {
        points: fallbackPoints,
        distance: Number(fallbackDistance.toFixed(2)),
        duration: `${estimatedMinutes} mins`,
        hasObstacles: hasObstacles,
        steps: [{
          instructions:
            "Follow the direct path (detailed routing unavailable).",
          distance: `${fallbackDistance.toFixed(2)} km`,
          duration: `${estimatedMinutes} mins`,
          startLocation: origin,
          endLocation: destination,
        }],
      };
    } catch (fallbackError) {
      console.error("Even fallback route failed:", fallbackError);
      throw lastError || new Error("Could not find any accessible route");
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("Error in OSM grid routing:", error);
    throw new Error(
      `Accessible routing failed: ${error.message || "Unknown error"}`,
    );
  }
}

export default {
  findAccessibleRoute,
  cleanupGraphCache,
};
