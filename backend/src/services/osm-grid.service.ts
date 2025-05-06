/**
 * OSM Grid Service
 * Creates grid-based road networks from OpenStreetMap data
 * and provides path finding algorithms for accessible routing
 */

import { haversineDistanceInMeters } from "./graph.service.ts";

// Define types for the OSM grid system
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

interface OsmRelation {
  id: number;
  members: Array<{
    type: "node" | "way" | "relation";
    ref: number;
    role: string;
  }>;
  tags: Record<string, string>;
}

interface OsmData {
  nodes: Record<number, OsmNode>;
  ways: OsmWay[];
  relations?: OsmRelation[];
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

interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface Point {
  latitude: number;
  longitude: number;
}

interface Obstacle {
  location: Point;
  obstacleType: string;
  obstacleScore: number;
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
    const relations: OsmRelation[] = [];

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
  const numCellsLat = Math.ceil(latRange * 111000 / grid.cellSize); // 1 degree = ~111km
  const numCellsLon = Math.ceil(
    lonRange * 111000 * Math.cos(lat * Math.PI / 180) / grid.cellSize,
  );

  // Calculate the grid coordinates
  const x = Math.floor((lon - grid.bbox.west) / lonRange * numCellsLon);
  const y = Math.floor((grid.bbox.north - lat) / latRange * numCellsLat);

  return { x, y };
}

/**
 * Get the lat/lon coordinates of a grid cell's center
 */
function getLatLonFromGrid(
  x: number,
  y: number,
  grid: Grid,
): { latitude: number; longitude: number } {
  const latRange = grid.bbox.north - grid.bbox.south;
  const lonRange = grid.bbox.east - grid.bbox.west;

  // Calculate the number of cells in each direction
  const numCellsLat = Math.ceil(latRange * 111000 / grid.cellSize);
  const numCellsLon = Math.ceil(
    lonRange * 111000 *
      Math.cos((grid.bbox.north + grid.bbox.south) / 2 * Math.PI / 180) /
      grid.cellSize,
  );

  // Calculate the lat/lon coordinates
  const latitude = grid.bbox.north - (y + 0.5) / numCellsLat * latRange;
  const longitude = grid.bbox.west + (x + 0.5) / numCellsLon * lonRange;

  return { latitude, longitude };
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

  console.log(
    `Creating grid with ${numCellsLat} x ${numCellsLon} cells (${cellSize}m cell size)`,
  );

  // Initialize the grid
  const cells: GridCell[][] = [];
  for (let y = 0; y < numCellsLat; y++) {
    cells[y] = [];
    for (let x = 0; x < numCellsLon; x++) {
      const { latitude, longitude } = getLatLonFromGrid(x, y, {
        cells: [],
        cellSize,
        bbox,
        minX: 0,
        minY: 0,
        maxX: numCellsLon - 1,
        maxY: numCellsLat - 1,
      });

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
 * Map OSM roads to grid cells
 */
function mapRoadsToGrid(osmData: OsmData, grid: Grid): void {
  console.log("Mapping roads to grid...");

  const validHighwayTypes = [
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "residential",
    "unclassified",
    "service",
    "footway",
    "path",
    "pedestrian",
    "living_street",
    "cycleway",
    "bridleway",
    "steps",
    "track",
  ];

  // Process each way
  for (const way of osmData.ways) {
    // Skip non-road ways
    if (!way.tags.highway || !validHighwayTypes.includes(way.tags.highway)) {
      continue;
    }

    // Get the nodes for this way
    const nodes = way.nodes.map((nodeId) => osmData.nodes[nodeId])
      .filter((node) => node !== undefined);

    if (nodes.length < 2) {
      continue;
    }

    // For each segment of the way
    for (let i = 0; i < nodes.length - 1; i++) {
      const startNode = nodes[i];
      const endNode = nodes[i + 1];

      // Perform line rasterization to mark all grid cells that the way passes through
      rasterizeLine(
        startNode.lat,
        startNode.lon,
        endNode.lat,
        endNode.lon,
        grid,
        way,
      );
    }
  }

  // Connect adjacent road cells
  console.log("Creating connections between road cells...");
  connectRoadCells(grid);
}

/**
 * Use Bresenham's line algorithm to rasterize a line onto the grid with enhanced precision
 */
function rasterizeLine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  grid: Grid,
  way: OsmWay,
): void {
  const { x: x1, y: y1 } = getGridCoordinates(lat1, lon1, grid);
  const { x: x2, y: y2 } = getGridCoordinates(lat2, lon2, grid);

  // Calculate road properties to store with cells
  const roadWidth = getRoadWidth(way);
  const roadType = way.tags.highway || way.tags.footway || way.tags.path ||
    "path";
  const isOneway = way.tags.oneway === "yes";
  const isSurfacePaved = isPavedSurface(way);

  // Use enhanced Bresenham algorithm with width consideration
  const linePoints = bresenhamWideLine(
    x1,
    y1,
    x2,
    y2,
    Math.max(1, Math.ceil(roadWidth / grid.cellSize)),
  );

  // Check bounds and mark cells
  const isInBounds = (x: number, y: number) =>
    x >= 0 && x <= grid.maxX && y >= 0 && y <= grid.maxY;

  for (const point of linePoints) {
    if (isInBounds(point.x, point.y)) {
      // Mark this cell as a road with detailed properties
      const cell = grid.cells[point.y][point.x];
      cell.isRoad = true;
      cell.wayId = way.id;
      cell.roadType = roadType;
      cell.oneway = isOneway;

      // Apply special weights for different road types
      if (
        roadType === "footway" || roadType === "path" ||
        roadType === "pedestrian"
      ) {
        // Pedestrian ways are preferred
        cell.obstacleWeight = -0.2; // Negative weight to encourage use
      } else if (roadType === "steps") {
        // Steps might be difficult for some users
        cell.obstacleWeight = 0.8;
      } else if (!isSurfacePaved) {
        // Unpaved surfaces might be more difficult
        cell.obstacleWeight = 0.5;
      }
    }
  }
}

/**
 * Generate points for a line with width consideration
 */
function bresenhamWideLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
): { x: number; y: number }[] {
  // Start with basic Bresenham line
  const basePoints = bresenhamLine(x1, y1, x2, y2);

  // If width is 1, return the base line
  if (width <= 1) return basePoints;

  // Otherwise, expand the line to have width
  const wideLine: { x: number; y: number }[] = [];

  // Calculate the perpendicular direction
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    // Just a point, add surrounding points in a square
    for (let ox = -Math.floor(width / 2); ox <= Math.ceil(width / 2); ox++) {
      for (let oy = -Math.floor(width / 2); oy <= Math.ceil(width / 2); oy++) {
        wideLine.push({ x: x1 + ox, y: y1 + oy });
      }
    }
    return wideLine;
  }

  // Normalize and find perpendicular
  const ndx = dx / length;
  const ndy = dy / length;
  const perpX = -ndy;
  const perpY = ndx;

  // For each point in the base line, add points perpendicular to the line
  for (const point of basePoints) {
    wideLine.push(point); // Add the center point

    // Add points perpendicular to the line
    for (let i = 1; i <= Math.floor(width / 2); i++) {
      wideLine.push({
        x: Math.round(point.x + perpX * i),
        y: Math.round(point.y + perpY * i),
      });
      wideLine.push({
        x: Math.round(point.x - perpX * i),
        y: Math.round(point.y - perpY * i),
      });
    }
  }

  // Remove duplicates
  return Array.from(new Set(wideLine.map((p) => `${p.x},${p.y}`)))
    .map((str) => {
      const [x, y] = str.split(",");
      return { x: parseInt(x), y: parseInt(y) };
    });
}

/**
 * Basic Bresenham line algorithm
 */
function bresenhamLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];

  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  let x = x1;
  let y = y1;

  while (true) {
    points.push({ x, y });

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

  return points;
}

/**
 * Determine road width in meters based on type
 */
function getRoadWidth(way: OsmWay): number {
  if (way.tags.width && !isNaN(parseFloat(way.tags.width))) {
    return parseFloat(way.tags.width);
  }

  // Default widths based on road type
  const roadType = way.tags.highway || "";

  switch (roadType) {
    case "motorway":
      return 12;
    case "trunk":
    case "primary":
      return 8;
    case "secondary":
      return 6;
    case "tertiary":
    case "residential":
      return 5;
    case "unclassified":
    case "service":
      return 4;
    case "footway":
    case "path":
    case "pedestrian":
    case "cycleway":
      return 2;
    case "steps":
      return 1.5;
    default:
      return 3;
  }
}

/**
 * Check if a road has a paved surface
 */
function isPavedSurface(way: OsmWay): boolean {
  const pavedSurfaces = [
    "paved",
    "asphalt",
    "concrete",
    "paving_stones",
    "sett",
    "cobblestone",
    "metal",
    "wood",
  ];

  if (!way.tags.surface) return true; // Assume paved by default

  return pavedSurfaces.includes(way.tags.surface);
}

/**
 * Connect adjacent road cells to create a navigable network
 */
function connectRoadCells(grid: Grid): void {
  const directions = [
    { dx: 0, dy: -1 }, // North
    { dx: 1, dy: -1 }, // Northeast
    { dx: 1, dy: 0 }, // East
    { dx: 1, dy: 1 }, // Southeast
    { dx: 0, dy: 1 }, // South
    { dx: -1, dy: 1 }, // Southwest
    { dx: -1, dy: 0 }, // West
    { dx: -1, dy: -1 }, // Northwest
  ];

  for (let y = 0; y <= grid.maxY; y++) {
    for (let x = 0; x <= grid.maxX; x++) {
      const cell = grid.cells[y][x];

      // Skip non-road cells
      if (!cell.isRoad) continue;

      // Connect to adjacent road cells
      for (const dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;

        // Check bounds
        if (nx < 0 || nx > grid.maxX || ny < 0 || ny > grid.maxY) continue;

        const neighbor = grid.cells[ny][nx];

        // Only connect to other road cells
        if (neighbor.isRoad) {
          // Check for oneway restrictions
          if (cell.oneway) {
            // For oneway roads, only allow connections in the forward direction
            // This is a simplification - in reality, we'd need to check the way's direction
            if (
              (dir.dx === -1 && cell.roadType !== "footway" &&
                cell.roadType !== "path")
            ) {
              continue;
            }
          }

          // Add connection if not already present
          if (!cell.connections.includes(neighbor)) {
            cell.connections.push(neighbor);
          }
        }
      }
    }
  }
}

/**
 * Apply obstacles to the grid with penalty weights
 */
function applyObstaclesToGrid(
  grid: Grid,
  obstacles: Obstacle[],
  proximityThreshold: number = 20,
): void {
  if (!obstacles || obstacles.length === 0) return;

  console.log(`Applying ${obstacles.length} obstacles to grid...`);

  for (const obstacle of obstacles) {
    // Skip invalid obstacles
    if (
      !obstacle.location ||
      typeof obstacle.location.latitude !== "number" ||
      typeof obstacle.location.longitude !== "number"
    ) {
      continue;
    }

    // Find the closest grid cell to the obstacle
    const { x, y } = getGridCoordinates(
      obstacle.location.latitude,
      obstacle.location.longitude,
      grid,
    );

    // Apply obstacle penalty to nearby cells
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        // Check bounds
        if (nx < 0 || nx > grid.maxX || ny < 0 || ny > grid.maxY) continue;

        const cell = grid.cells[ny][nx];
        const cellCenter = {
          latitude: cell.latitude,
          longitude: cell.longitude,
        };

        // Calculate distance to obstacle
        const distance = haversineDistanceInMeters(
          cell.latitude,
          cell.longitude,
          obstacle.location.latitude,
          obstacle.location.longitude,
        );

        // Apply penalty based on distance and obstacle score
        if (distance <= proximityThreshold) {
          const penaltyWeight = Math.max(0, obstacle.obstacleScore) *
            (1 - distance / proximityThreshold);

          // Update cell with obstacle information
          cell.hasObstacle = true;
          cell.obstacleWeight += penaltyWeight;

          // For severe obstacles, completely block the cell
          if (
            obstacle.obstacleScore >= 4 && distance <= proximityThreshold / 2
          ) {
            cell.isRoad = false; // This effectively blocks the cell
          }
        }
      }
    }
  }
}

/**
 * Find the nearest road cell to a given point
 */
function findNearestRoadCell(grid: Grid, point: Point): GridCell | null {
  // Get the closest grid cell
  const { x, y } = getGridCoordinates(point.latitude, point.longitude, grid);

  // If this cell is a road, return it
  if (
    x >= 0 && x <= grid.maxX && y >= 0 && y <= grid.maxY &&
    grid.cells[y][x].isRoad
  ) {
    return grid.cells[y][x];
  }

  // Otherwise, search in expanding circles
  for (let radius = 1; radius <= 20; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Only check cells on the perimeter of the circle
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

        const nx = x + dx;
        const ny = y + dy;

        // Check bounds
        if (nx < 0 || nx > grid.maxX || ny < 0 || ny > grid.maxY) continue;

        const cell = grid.cells[ny][nx];
        if (cell.isRoad) {
          return cell;
        }
      }
    }
  }

  console.log(
    `Could not find a road cell near (${point.latitude}, ${point.longitude})`,
  );
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
  if (!start || !goal) {
    console.error("Invalid start or goal cell");
    return [];
  }

  console.log(
    `Finding path from (${start.latitude}, ${start.longitude}) to (${goal.latitude}, ${goal.longitude})`,
  );

  // Initialize open and closed sets
  const openSet: GridCell[] = [start];
  const closedSet: GridCell[] = [];

  // Reset cell properties for pathfinding
  for (let y = 0; y <= grid.maxY; y++) {
    for (let x = 0; x <= grid.maxX; x++) {
      const cell = grid.cells[y][x];
      cell.f = Infinity;
      cell.g = Infinity;
      cell.h = 0;
      cell.parent = null;
    }
  }

  // Setup start node
  start.g = 0;
  start.h = heuristic(start, goal);
  start.f = start.h;

  while (openSet.length > 0) {
    // Sort openSet by f value
    openSet.sort((a, b) => a.f! - b.f!);

    // Get the node with lowest f value
    const current = openSet.shift()!;

    // Goal check
    if (current === goal) {
      console.log("Path found!");
      return reconstructPath(current);
    }

    closedSet.push(current);

    // Check neighbors
    for (const neighbor of current.connections) {
      // Skip if in closed set
      if (closedSet.includes(neighbor)) continue;

      // Skip if not a road (this shouldn't happen with proper connections)
      if (!neighbor.isRoad) continue;

      // Calculate tentative g score
      const distance = haversineDistanceInMeters(
        current.latitude,
        current.longitude,
        neighbor.latitude,
        neighbor.longitude,
      );

      // Apply obstacle penalty
      const obstaclePenalty = neighbor.hasObstacle
        ? 1 + neighbor.obstacleWeight
        : 1;

      // Calculate tentative g score
      const tentativeG = current.g! + distance * obstaclePenalty;

      // If not in open set, add it
      if (!openSet.includes(neighbor)) {
        openSet.push(neighbor);
      } else if (tentativeG >= neighbor.g!) {
        // If this path is worse than previous, skip
        continue;
      }

      // This path is better, update neighbor
      neighbor.parent = current;
      neighbor.g = tentativeG;
      neighbor.h = heuristic(neighbor, goal);
      neighbor.f = neighbor.g + neighbor.h;
    }
  }

  console.log("No path found!");
  return [];
}

/**
 * Heuristic function for A* (Haversine distance)
 */
function heuristic(a: GridCell, b: GridCell): number {
  return haversineDistanceInMeters(
    a.latitude,
    a.longitude,
    b.latitude,
    b.longitude,
  );
}

/**
 * Reconstruct path from goal to start
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
 * Smooth path to remove unnecessary zigzags while preserving important path details
 */
function smoothPath(path: GridCell[]): Point[] {
  if (path.length <= 2) {
    return path.map((cell) => ({
      latitude: cell.latitude,
      longitude: cell.longitude,
    }));
  }

  // Initial path includes the starting point
  const smoothed: Point[] = [];
  smoothed.push({
    latitude: path[0].latitude,
    longitude: path[0].longitude,
  });

  // Douglas-Peucker algorithm adapted for grid cells
  // This preserves the shape of the path while removing unnecessary points
  const rdpPoints = douglasPeuckerSimplify(path, 0.000015); // ~1.5 meters at equator

  // Add all simplified points except first and last (already added manually)
  for (let i = 1; i < rdpPoints.length - 1; i++) {
    smoothed.push({
      latitude: rdpPoints[i].latitude,
      longitude: rdpPoints[i].longitude,
    });
  }

  // Add the last point
  smoothed.push({
    latitude: path[path.length - 1].latitude,
    longitude: path[path.length - 1].longitude,
  });

  return smoothed;
}

/**
 * Apply Douglas-Peucker algorithm to simplify a path
 * This algorithm reduces the number of points while preserving path shape
 */
function douglasPeuckerSimplify(points: GridCell[], epsilon: number): Point[] {
  // Convert GridCells to Points for simplification
  const pathPoints: Point[] = points.map((cell) => ({
    latitude: cell.latitude,
    longitude: cell.longitude,
  }));

  // Base case
  if (pathPoints.length <= 2) {
    return pathPoints;
  }

  // Find the point with the maximum distance
  let maxDistance = 0;
  let maxIndex = 0;

  // Find point with maximum perpendicular distance from line
  for (let i = 1; i < pathPoints.length - 1; i++) {
    const distance = perpendicularDistance(
      pathPoints[i],
      pathPoints[0],
      pathPoints[pathPoints.length - 1],
    );

    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive simplification of the two segments
    const firstSegment = douglasPeuckerSimplify(
      points.slice(0, maxIndex + 1),
      epsilon,
    );
    const secondSegment = douglasPeuckerSimplify(
      points.slice(maxIndex),
      epsilon,
    );

    // Concatenate the results (remove duplicate point)
    return [...firstSegment.slice(0, -1), ...secondSegment];
  } else {
    // All points in this segment are within epsilon distance, so keep only endpoints
    return [pathPoints[0], pathPoints[pathPoints.length - 1]];
  }
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number {
  // Convert to flat coordinates for simplicity (approximation at small scales)
  const x = point.longitude;
  const y = point.latitude;
  const x1 = lineStart.longitude;
  const y1 = lineStart.latitude;
  const x2 = lineEnd.longitude;
  const y2 = lineEnd.latitude;

  // Line segment length squared
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lineLengthSq = dx * dx + dy * dy;

  if (lineLengthSq === 0) {
    // Line segment is actually a point
    return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
  }

  // Calculate projection of point onto line
  const t = ((x - x1) * dx + (y - y1) * dy) / lineLengthSq;

  if (t < 0) {
    // Point projects outside the line segment (beyond segmentStart)
    return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
  }

  if (t > 1) {
    // Point projects outside the line segment (beyond segmentEnd)
    return Math.sqrt((x - x2) * (x - x2) + (y - y2) * (y - y2));
  }

  // Point projects onto the line segment
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  // Return distance to projected point
  return Math.sqrt((x - projX) * (x - projX) + (y - projY) * (y - projY));
}

/**
 * Main function to find an accessible route using OSM road grid
 */
export async function findOsmGridRoute(
  origin: Point,
  destination: Point,
  obstacles: Obstacle[] = [],
  cellSize: number = 1, // Ultra-fine 1m grid for maximum precision
  bufferKm: number = 1.0, // 1km buffer around the route
): Promise<Point[]> {
  try {
    console.log(
      `Finding OSM grid route from (${origin.latitude}, ${origin.longitude}) to (${destination.latitude}, ${destination.longitude})`,
    );

    // 1. Calculate bounding box
    const bbox = calculateBoundingBox(origin, destination, bufferKm);

    // 2. Fetch OSM data
    const osmData = await fetchOsmData(bbox);
    if (Object.keys(osmData.nodes).length === 0 || osmData.ways.length === 0) {
      console.warn("No OSM data returned, cannot build road network");
      return createStraightLinePath(origin, destination);
    }

    // Use smaller cell size for short routes to improve accuracy
    const routeDistance = haversineDistanceInMeters(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    );

    // Ultra-fine adaptive cell size based on route length
    const adaptiveCellSize = routeDistance < 300
      ? 1
      : routeDistance < 500
      ? 1.5
      : routeDistance < 1000
      ? 2
      : routeDistance < 2000
      ? 3
      : 4;

    console.log(
      `Using ultra-fine adaptive cell size of ${adaptiveCellSize}m for ${
        routeDistance.toFixed(1)
      }m route`,
    );

    // 3. Create grid with adaptive cell size
    const grid = createGrid(bbox, adaptiveCellSize);

    // 4. Map roads to grid with extra precision
    mapRoadsToGrid(osmData, grid);

    // 5. Apply obstacles
    applyObstaclesToGrid(grid, obstacles);

    // 6. Find nearest road cells to origin and destination with improved precision
    const startCell = findExactNearestRoadCell(grid, origin, osmData);
    const endCell = findExactNearestRoadCell(grid, destination, osmData);

    if (!startCell || !endCell) {
      console.warn("Could not find road cells near origin or destination");
      return createStraightLinePath(origin, destination);
    }

    // 7. Find path using A*
    const path = findPathAStar(grid, startCell, endCell);

    if (path.length === 0) {
      console.warn("No path found, returning straight line");
      return createStraightLinePath(origin, destination);
    }

    // 8. Smooth path and ensure it includes exact origin and destination
    const smoothedPath = smoothPath(path);

    // 9. Post-process the path for better precision
    const postProcessedPath = postProcessPath(
      smoothedPath,
      osmData,
      origin,
      destination,
    );

    // 10. Apply advanced path refinement by mapping to actual road geometry
    const refinedPath = refinePathWithActualRoads(postProcessedPath, osmData);

    // 11. Apply spline interpolation for smooth curves
    const splinedPath = applySplineInterpolation(refinedPath);

    // 12. Final ultra-precise path with exact node matching
    const finalPath = performFinalPathRefinement(
      splinedPath,
      osmData,
      origin,
      destination,
    );

    console.log(`Final ultra-precise path has ${finalPath.length} points`);
    return finalPath;
  } catch (error) {
    console.error("Error in OSM grid routing:", error);
    return createStraightLinePath(origin, destination);
  }
}

/**
 * Find exact nearest road cell with precise node matching
 */
function findExactNearestRoadCell(
  grid: Grid,
  point: Point,
  osmData: OsmData,
): GridCell | null {
  // First try to find the closest OSM node directly
  const nearestNode = findNearbyOsmNode(point, osmData, 50);

  if (nearestNode) {
    // Found a close OSM node, now find the grid cell containing this node
    const { x, y } = getGridCoordinates(nearestNode.lat, nearestNode.lon, grid);

    // Check if the coordinates are valid and the cell is a road
    if (
      x >= 0 && x <= grid.maxX && y >= 0 && y <= grid.maxY &&
      grid.cells[y][x].isRoad
    ) {
      return grid.cells[y][x];
    }

    // If the exact cell isn't a road, search surrounding cells
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (
          nx >= 0 && nx <= grid.maxX && ny >= 0 && ny <= grid.maxY &&
          grid.cells[ny][nx].isRoad
        ) {
          return grid.cells[ny][nx];
        }
      }
    }
  }

  // Fall back to the original method if no node found
  return findNearestRoadCell(grid, point);
}

/**
 * Final precision refinement of the path
 */
function performFinalPathRefinement(
  path: Point[],
  osmData: OsmData,
  origin: Point,
  destination: Point,
): Point[] {
  if (path.length < 2) return path;

  // Make a deep copy of the path
  const refinedPath = [...path];

  // Special handling for the start and end points - replace with exact origin/destination
  refinedPath[0] = origin;
  refinedPath[refinedPath.length - 1] = destination;

  // For each point in the path (except first and last)
  for (let i = 1; i < refinedPath.length - 1; i++) {
    const point = refinedPath[i];

    // Find the nearest OSM node with a very tight radius (5 meters)
    const exactNode = findNearbyOsmNode(point, osmData, 5);

    if (exactNode) {
      // Replace with exact OSM node position
      refinedPath[i] = {
        latitude: exactNode.lat,
        longitude: exactNode.lon,
      };
    }
  }

  // Ensure points are not too close to each other
  return removeDuplicatePoints(refinedPath);
}

/**
 * Remove duplicate or very close points
 */
function removeDuplicatePoints(path: Point[]): Point[] {
  if (path.length <= 2) return path;

  const result: Point[] = [path[0]];
  const MIN_DISTANCE = 1; // minimum distance in meters

  for (let i = 1; i < path.length; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];

    // Calculate distance
    const distance = haversineDistanceInMeters(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude,
    );

    // Only add if not too close, except for the last point
    if (distance >= MIN_DISTANCE || i === path.length - 1) {
      result.push(curr);
    }
  }

  return result;
}

/**
 * Process a complete route for optimal visual and functional quality
 */
function postProcessPath(
  path: Point[],
  osmData: OsmData,
  origin: Point,
  destination: Point,
): Point[] {
  // Always ensure the exact origin and destination are included
  const processedPath = [...path];

  // Replace first and last points with exact origin and destination
  if (processedPath.length > 0) {
    processedPath[0] = origin;
    processedPath[processedPath.length - 1] = destination;
  }

  // If the path is suspiciously straight (indicating potential grid artifacts),
  // try to snap intermediate points to actual OSM nodes
  if (processedPath.length > 2) {
    for (let i = 1; i < processedPath.length - 1; i++) {
      const point = processedPath[i];

      // Try to find a nearby OSM node to snap to
      const nearbyNode = findNearbyOsmNode(point, osmData, 20); // 20 meters threshold

      if (nearbyNode) {
        // Update the point's coordinates to snap to the OSM node
        processedPath[i] = {
          latitude: nearbyNode.lat,
          longitude: nearbyNode.lon,
        };
      }
    }

    // Apply curve smoothing to make turns less sharp
    smoothCurves(processedPath);
  }

  // Add intermediate points on long straight segments for better visualization
  return addIntermediatePoints(processedPath);
}

/**
 * Smooth sharp turns in a path by creating smooth curves
 */
function smoothCurves(path: Point[]): void {
  if (path.length < 3) return;

  const smoothedPoints: Point[] = [];
  const CURVE_THRESHOLD_DEGREES = 30; // Angle threshold to apply smoothing (degrees)
  const CURVE_SEGMENTS = 3; // Number of points to insert for each curve

  // Process each vertex (except first and last)
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const current = path[i];
    const next = path[i + 1];

    // Calculate angle at this vertex
    const angle = calculateAngleDegrees(prev, current, next);

    // If angle indicates a sharp turn, create a smooth curve
    if (angle < (180 - CURVE_THRESHOLD_DEGREES)) {
      // Use Bézier curve interpolation for smoother turns
      const controlPoint = current;

      // Remove the sharp corner point
      path.splice(i, 1);

      // Insert multiple points to form a smooth curve
      const curvePoints = createBezierCurve(
        prev,
        controlPoint,
        next,
        CURVE_SEGMENTS,
      );

      // Insert all but the first and last curve points (they're duplicates)
      for (let j = 1; j < curvePoints.length - 1; j++) {
        path.splice(i + j - 1, 0, curvePoints[j]);
      }

      // Skip ahead to after the inserted points
      i += CURVE_SEGMENTS - 2;
    }
  }
}

/**
 * Calculate the angle in degrees at vertex B of three points A-B-C
 */
function calculateAngleDegrees(a: Point, b: Point, c: Point): number {
  // Convert to radians for calculation
  const AB = {
    x: b.longitude - a.longitude,
    y: b.latitude - a.latitude,
  };

  const BC = {
    x: c.longitude - b.longitude,
    y: c.latitude - b.latitude,
  };

  // Calculate angle using dot product
  const dotProduct = AB.x * BC.x + AB.y * BC.y;
  const magAB = Math.sqrt(AB.x * AB.x + AB.y * AB.y);
  const magBC = Math.sqrt(BC.x * BC.x + BC.y * BC.y);

  // Calculate angle in degrees
  const angleRad = Math.acos(dotProduct / (magAB * magBC));
  return angleRad * 180 / Math.PI;
}

/**
 * Create a simple quadratic Bézier curve between two points
 */
function createBezierCurve(
  start: Point,
  control: Point,
  end: Point,
  segments: number,
): Point[] {
  const points: Point[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    // Quadratic Bézier formula: B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
    const oneMinusT = 1 - t;

    const latitude = oneMinusT * oneMinusT * start.latitude +
      2 * oneMinusT * t * control.latitude +
      t * t * end.latitude;

    const longitude = oneMinusT * oneMinusT * start.longitude +
      2 * oneMinusT * t * control.longitude +
      t * t * end.longitude;

    points.push({
      latitude,
      longitude,
    });
  }

  return points;
}

/**
 * Refine the path using actual OSM road geometry for highest precision
 */
function refinePathWithActualRoads(path: Point[], osmData: OsmData): Point[] {
  if (path.length < 2) return path;

  const refinedPath: Point[] = [path[0]]; // Start with the origin point

  // For each segment in our path
  for (let i = 0; i < path.length - 1; i++) {
    const segmentStart = path[i];
    const segmentEnd = path[i + 1];

    // Try to find the actual road geometry between these points
    const roadSegment = findActualRoadBetweenPoints(
      segmentStart,
      segmentEnd,
      osmData,
    );

    if (roadSegment && roadSegment.length > 0) {
      // Add all intermediate points from the actual road (except first which is already added)
      refinedPath.push(...roadSegment.slice(1));
    } else {
      // If no actual road found, just add the end point of this segment
      // (unless it's the final point which we'll add outside the loop)
      if (i < path.length - 2) {
        refinedPath.push(segmentEnd);
      }
    }
  }

  // Always add the destination point
  refinedPath.push(path[path.length - 1]);

  // Apply one last smoothing pass
  const finalPath = refineSegmentConnections(refinedPath);

  return finalPath;
}

/**
 * Refine connections between segments to ensure smooth transitions
 */
function refineSegmentConnections(path: Point[]): Point[] {
  if (path.length < 4) return path;

  const result = [...path];
  const MAX_ANGLE = 120; // Maximum angle for direct connection (degrees)

  for (let i = 1; i < result.length - 2; i++) {
    const prev = result[i - 1];
    const current = result[i];
    const next = result[i + 1];

    // Calculate angle at this vertex
    const angle = calculateAngleDegrees(prev, current, next);

    // If we have a sharp angle between segments, smooth it
    if (angle < MAX_ANGLE) {
      // Create a small arc to smooth the transition
      const smoothing = createBezierCurve(prev, current, next, 3);

      // Replace the current point with the smoothed transition points
      result.splice(i, 1, ...smoothing.slice(1, -1));

      // Skip ahead past inserted points
      i += smoothing.length - 3;
    }
  }

  return result;
}

/**
 * Add intermediate points on long segments for smoother visualization
 * and ensure consistent point density throughout the route
 */
function addIntermediatePoints(path: Point[]): Point[] {
  if (path.length <= 1) return path;

  const enhancedPath: Point[] = [path[0]];
  const MIN_POINT_SPACING = 20; // Minimum spacing between points (meters)
  const MAX_SEGMENT_LENGTH = 40; // Maximum segment length (meters)

  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i];
    const end = path[i + 1];

    // Calculate segment length
    const segmentLength = haversineDistanceInMeters(
      start.latitude,
      start.longitude,
      end.latitude,
      end.longitude,
    );

    if (segmentLength > MAX_SEGMENT_LENGTH) {
      // Calculate how many points to add based on segment length
      // Ensure more points on longer segments for smoother appearance
      const numPoints = Math.max(
        Math.ceil(segmentLength / MIN_POINT_SPACING),
        Math.ceil(segmentLength / MAX_SEGMENT_LENGTH),
      );

      // Add intermediate points
      for (let j = 1; j < numPoints; j++) {
        const ratio = j / numPoints;
        enhancedPath.push({
          latitude: start.latitude + (end.latitude - start.latitude) * ratio,
          longitude: start.longitude +
            (end.longitude - start.longitude) * ratio,
        });
      }
    }

    // Add the end point (except for the last segment where we'll add it outside the loop)
    if (i < path.length - 2) {
      enhancedPath.push(end);
    }
  }

  // Add the final destination point
  enhancedPath.push(path[path.length - 1]);

  return enhancedPath;
}

/**
 * Find a nearby OSM node for snapping
 */
function findNearbyOsmNode(
  point: Point,
  osmData: OsmData,
  maxDistanceMeters: number,
): OsmNode | null {
  let closestNode: OsmNode | null = null;
  let minDistance = Infinity;

  // Check all nodes
  for (const nodeId in osmData.nodes) {
    const node = osmData.nodes[nodeId];

    // Calculate distance
    const distance = haversineDistanceInMeters(
      point.latitude,
      point.longitude,
      node.lat,
      node.lon,
    );

    // Update if this is closer
    if (distance < minDistance && distance <= maxDistanceMeters) {
      minDistance = distance;
      closestNode = node;
    }
  }

  return closestNode;
}

/**
 * Calculate bounding box around two points with a buffer
 */
function calculateBoundingBox(
  point1: Point,
  point2: Point,
  bufferKm: number = 0.5,
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
  const latBuffer = bufferKm / 111;
  const avgLat = (minLat + maxLat) / 2;
  const lonBuffer = bufferKm / (111 * Math.cos(avgLat * Math.PI / 180));

  return {
    north: maxLat + latBuffer,
    south: minLat - latBuffer,
    east: maxLon + lonBuffer,
    west: minLon - lonBuffer,
  };
}

/**
 * Create a simple straight line path between two points
 */
function createStraightLinePath(origin: Point, destination: Point): Point[] {
  // Create a straight line with 10 interpolated points
  const path: Point[] = [origin];

  for (let i = 1; i <= 8; i++) {
    const t = i / 10;
    path.push({
      latitude: origin.latitude + (destination.latitude - origin.latitude) * t,
      longitude: origin.longitude +
        (destination.longitude - origin.longitude) * t,
    });
  }

  path.push(destination);
  return path;
}

/**
 * Find actual road geometry between two points by identifying the closest way
 * and extracting the relevant segment of that way with ultra-high precision
 */
function findActualRoadBetweenPoints(
  start: Point,
  end: Point,
  osmData: OsmData,
  maxDistanceMeters: number = 15, // Reduced from 30m to 15m for higher precision
): Point[] | null {
  // First, find OSM ways that contain both points nearby
  const candidateWays = findCandidateWays(
    start,
    end,
    osmData,
    maxDistanceMeters,
  );

  if (candidateWays.length === 0) return null;

  // Sort ways by relevance (pedestrian ways first, then by distance)
  const sortedWays = sortWaysByRelevance(candidateWays, start, end, osmData);

  // Try each way until we find a valid path
  for (const way of sortedWays) {
    // Get the nodes for this way
    const wayNodes = way.nodes
      .map((nodeId) => osmData.nodes[nodeId])
      .filter((node) => node !== undefined);

    if (wayNodes.length < 2) continue;

    // Find the sections of the way closest to our start and end points with ultra precision
    const startInfo = findClosestPointOnWay(start, wayNodes);
    const endInfo = findClosestPointOnWay(end, wayNodes);

    if (!startInfo || !endInfo) continue;

    // Extract the relevant segment
    let segment: Point[] = [];

    // If both points project onto the same segment
    if (startInfo.segmentIndex === endInfo.segmentIndex) {
      // Create interpolated points along this single segment
      const node1 = wayNodes[startInfo.segmentIndex];
      const node2 = wayNodes[startInfo.segmentIndex + 1];

      // Insert exact projection points
      segment = createPreciseSegment(
        node1,
        node2,
        startInfo.projection,
        endInfo.projection,
        10, // Higher density of points
      );
    } else {
      // Handle multi-segment path

      // Add the start projection point
      segment.push(startInfo.projection);

      // Add inner nodes
      const startIdx = startInfo.segmentIndex + 1;
      const endIdx = endInfo.segmentIndex;

      // If there are intermediate nodes
      if (startIdx <= endIdx) {
        for (let i = startIdx; i <= endIdx; i++) {
          segment.push({
            latitude: wayNodes[i].lat,
            longitude: wayNodes[i].lon,
          });
        }
      }

      // Add the end projection point
      segment.push(endInfo.projection);
    }

    // Success if we have points
    if (segment.length > 0) {
      return segment;
    }
  }

  // No valid path found
  return null;
}

/**
 * Create a precise segment between two nodes with projections
 */
function createPreciseSegment(
  node1: OsmNode,
  node2: OsmNode,
  startProj: Point,
  endProj: Point,
  numPoints: number,
): Point[] {
  const segment: Point[] = [startProj];

  // Use linear interpolation with high density
  for (let i = 1; i < numPoints - 1; i++) {
    const t = i / numPoints;

    // Calculate position along segment
    segment.push({
      latitude: startProj.latitude +
        t * (endProj.latitude - startProj.latitude),
      longitude: startProj.longitude +
        t * (endProj.longitude - startProj.longitude),
    });
  }

  segment.push(endProj);
  return segment;
}

/**
 * Find candidate ways for path
 */
function findCandidateWays(
  start: Point,
  end: Point,
  osmData: OsmData,
  maxDistanceMeters: number,
): OsmWay[] {
  const candidates: OsmWay[] = [];

  for (const way of (osmData.ways || [])) {
    // Skip ways with fewer than 2 nodes
    if (way.nodes.length < 2) continue;

    // Get all nodes for this way
    const nodes = way.nodes
      .map((nodeId) => osmData.nodes[nodeId])
      .filter((node) => node !== undefined);

    if (nodes.length < 2) continue;

    // Calculate distances to start and end points
    const startDistance = minDistanceToWay(start, nodes);
    const endDistance = minDistanceToWay(end, nodes);

    // If both points are close to this way, add it as candidate
    if (
      startDistance <= maxDistanceMeters && endDistance <= maxDistanceMeters
    ) {
      candidates.push(way);
    }
  }

  return candidates;
}

/**
 * Sort ways by relevance for pedestrian routing
 */
function sortWaysByRelevance(
  ways: OsmWay[],
  start: Point,
  end: Point,
  osmData: OsmData,
): OsmWay[] {
  // Define priority for road types (lower number = higher priority)
  const typePriority: { [key: string]: number } = {
    "footway": 1,
    "path": 2,
    "pedestrian": 3,
    "steps": 4,
    "cycleway": 5,
    "residential": 6,
    "service": 7,
    "unclassified": 8,
    "tertiary": 9,
    "secondary": 10,
    "primary": 11,
    "trunk": 12,
    "motorway": 13,
  };

  return [...ways].sort((a, b) => {
    // First check highway type
    const typeA = a.tags.highway || "";
    const typeB = b.tags.highway || "";

    const priorityA = typePriority[typeA] || 100;
    const priorityB = typePriority[typeB] || 100;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // If same type, compare average distance
    const nodesA = a.nodes.map((id) => osmData.nodes[id]).filter((n) => n);
    const nodesB = b.nodes.map((id) => osmData.nodes[id]).filter((n) => n);

    const distA =
      (minDistanceToWay(start, nodesA) + minDistanceToWay(end, nodesA)) / 2;
    const distB =
      (minDistanceToWay(start, nodesB) + minDistanceToWay(end, nodesB)) / 2;

    return distA - distB;
  });
}

/**
 * Find the closest point on a way to a given point with precise projection
 */
function findClosestPointOnWay(point: Point, nodes: OsmNode[]): {
  segmentIndex: number;
  projection: Point;
  distance: number;
} | null {
  if (nodes.length < 2) return null;

  let closestSegmentIndex = 0;
  let closestProjection: Point = {
    latitude: nodes[0].lat,
    longitude: nodes[0].lon,
  };
  let minDistance = Infinity;

  // Check each segment
  for (let i = 0; i < nodes.length - 1; i++) {
    const node1 = nodes[i];
    const node2 = nodes[i + 1];

    const n1Point = { latitude: node1.lat, longitude: node1.lon };
    const n2Point = { latitude: node2.lat, longitude: node2.lon };

    // Calculate projection and distance to segment
    const projection = projectPointOnSegment(point, n1Point, n2Point);
    const distance = haversineDistanceInMeters(
      point.latitude,
      point.longitude,
      projection.latitude,
      projection.longitude,
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestSegmentIndex = i;
      closestProjection = projection;
    }
  }

  return {
    segmentIndex: closestSegmentIndex,
    projection: closestProjection,
    distance: minDistance,
  };
}

/**
 * Project a point onto a line segment
 */
function projectPointOnSegment(
  point: Point,
  segmentStart: Point,
  segmentEnd: Point,
): Point {
  // Convert to flat coordinates for simplicity (approximation at small scales)
  const x = point.longitude;
  const y = point.latitude;
  const x1 = segmentStart.longitude;
  const y1 = segmentStart.latitude;
  const x2 = segmentEnd.longitude;
  const y2 = segmentEnd.latitude;

  // Line segment length squared
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lineLengthSq = dx * dx + dy * dy;

  if (lineLengthSq === 0) {
    // Line segment is actually a point
    return segmentStart;
  }

  // Calculate projection of point onto line
  const t = ((x - x1) * dx + (y - y1) * dy) / lineLengthSq;

  if (t < 0) {
    // Point projects outside the line segment (beyond segmentStart)
    return segmentStart;
  }

  if (t > 1) {
    // Point projects outside the line segment (beyond segmentEnd)
    return segmentEnd;
  }

  // Point projects onto the line segment - calculate exact projection point
  return {
    latitude: y1 + t * dy,
    longitude: x1 + t * dx,
  };
}

/**
 * Apply cubic spline interpolation for ultra-smooth paths
 */
function applySplineInterpolation(path: Point[]): Point[] {
  if (path.length < 4) return path;

  const result: Point[] = [path[0]]; // Keep the exact start point

  // Number of interpolation points between each pair of control points
  const INTERPOLATION_POINTS = 5;

  // For each set of 4 consecutive points, create a cubic spline segment
  for (let i = 0; i < path.length - 3; i++) {
    const p0 = path[i];
    const p1 = path[i + 1];
    const p2 = path[i + 2];
    const p3 = path[i + 3];

    // Skip very close points to avoid over-smoothing
    if (
      haversineDistanceInMeters(
        p1.latitude,
        p1.longitude,
        p2.latitude,
        p2.longitude,
      ) < 5
    ) {
      result.push(p1);
      continue;
    }

    // Create spline segment from p1 to p2 (using p0 and p3 as control points)
    const splinePoints = createCatmullRomSpline(
      p0,
      p1,
      p2,
      p3,
      INTERPOLATION_POINTS,
    );

    // Add all points of the spline except the last one (will be added in next segment)
    // But for the last segment, add all points
    if (i < path.length - 4) {
      result.push(...splinePoints.slice(0, -1));
    } else {
      result.push(...splinePoints);
    }
  }

  // Add the last two points if they haven't been added
  if (path.length >= 2 && result[result.length - 1] !== path[path.length - 1]) {
    result.push(path[path.length - 2], path[path.length - 1]);
  } else if (result[result.length - 1] !== path[path.length - 1]) {
    result.push(path[path.length - 1]);
  }

  return result;
}

/**
 * Create a Catmull-Rom spline segment between two points
 * This provides a smooth curve that passes through the control points
 */
function createCatmullRomSpline(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  segments: number,
): Point[] {
  const points: Point[] = [];
  const alpha = 0.5; // Tension parameter, 0.5 for centripetal Catmull-Rom

  // Helper function to calculate spline point
  function catmullRom(
    t: number,
    p0: number,
    p1: number,
    p2: number,
    p3: number,
  ): number {
    const t2 = t * t;
    const t3 = t2 * t;

    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  // Generate the spline points with greater precision
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    const latitude = catmullRom(
      t,
      p0.latitude,
      p1.latitude,
      p2.latitude,
      p3.latitude,
    );
    const longitude = catmullRom(
      t,
      p0.longitude,
      p1.longitude,
      p2.longitude,
      p3.longitude,
    );

    points.push({
      latitude,
      longitude,
    });
  }

  return points;
}

/**
 * Calculate minimum distance from a point to any segment of a way
 */
function minDistanceToWay(point: Point, nodes: OsmNode[]): number {
  let minDistance = Infinity;
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const node1 = nodes[i];
    const node2 = nodes[i + 1];
    
    // Calculate distance from point to this segment
    const p1 = { latitude: node1.lat, longitude: node1.lon };
    const p2 = { latitude: node2.lat, longitude: node2.lon };
    
    const projPoint = projectPointOnSegment(point, p1, p2);
    
    // Calculate the haversine distance to the projection
    const distance = haversineDistanceInMeters(
      point.latitude, 
      point.longitude, 
      projPoint.latitude, 
      projPoint.longitude
    );
    
    minDistance = Math.min(minDistance, distance);
  }
  
  return minDistance;
}

export default {
  findOsmGridRoute,
  fetchOsmData,
  createGrid,
  applyObstaclesToGrid,
  findPathAStar,
};
