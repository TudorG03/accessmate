import { Marker } from "@/types/marker.types";
import { getDirections } from "./places.service";

// Define obstacle cost weights
const OBSTACLE_TYPE_WEIGHTS = {
    STAIRS: 10,
    NARROW_PATH: 7,
    STEEP_INCLINE: 8,
    UNEVEN_SURFACE: 6,
    OBSTACLE_IN_PATH: 5,
    POOR_LIGHTING: 4,
    CONSTRUCTION: 9,
    MISSING_RAMP: 10,
    MISSING_CROSSWALK: 9,
    OTHER: 5,
};

// Define our grid parameters
const GRID_CELL_SIZE = 5; // meters
const ROUTE_BUFFER_DISTANCE = 50; // meters on each side of route
const DEVIATION_PENALTY_PER_10_METERS = 2; // cost penalty for each 10m deviation

interface Point {
    latitude: number;
    longitude: number;
}

interface GridNode {
    latitude: number;
    longitude: number;
    cost: number;
    obstacle: Marker | null;
    g: number; // A* path cost from start
    h: number; // A* heuristic to goal
    f: number; // A* total cost
    parent: GridNode | null;
}

/**
 * Calculates an accessible route that avoids obstacles
 * @param origin Starting location
 * @param destination Ending location
 * @param obstacles List of obstacle markers to avoid
 * @param transportMode Walking or driving
 * @returns Optimized route coordinates
 */
export async function getAccessibleRoute(
    origin: Point,
    destination: Point,
    obstacles: Marker[],
    transportMode: "walking" | "driving" = "walking",
): Promise<{
    points: Point[];
    distance: number;
    duration: string;
    steps: Array<{
        instructions: string;
        distance: string;
        duration: string;
        startLocation: Point;
        endLocation: Point;
    }>;
}> {
    // If not walking or no obstacles, just use regular directions
    if (transportMode !== "walking" || obstacles.length === 0) {
        return getDirections(origin, destination);
    }

    // Get base route from Google
    const baseRoute = await getDirections(origin, destination);

    // Create grid around the route
    const grid = createGridAroundRoute(baseRoute.points, obstacles);

    // Run A* algorithm to find accessible path
    const optimizedPath = findAccessiblePath(
        origin,
        destination,
        grid,
        baseRoute.points,
    );

    // Simplify path to reduce unnecessary points
    const simplifiedPath = simplifyPath(optimizedPath);

    // Calculate new distance and duration (approximate)
    const distanceRatio = calculateDistanceRatio(
        simplifiedPath,
        baseRoute.points,
    );

    return {
        points: simplifiedPath,
        // Adjust the distance based on the ratio of path lengths
        distance: baseRoute.distance * distanceRatio,
        duration: adjustDurationString(baseRoute.duration, distanceRatio),
        steps: baseRoute.steps, // Keep original steps for now, could be improved in the future
    };
}

/**
 * Creates a grid of nodes around the route
 */
function createGridAroundRoute(
    routePoints: Point[],
    obstacles: Marker[],
): GridNode[][] {
    // Find bounding box of route with buffer
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    routePoints.forEach((point) => {
        minLat = Math.min(minLat, point.latitude);
        maxLat = Math.max(maxLat, point.latitude);
        minLng = Math.min(minLng, point.longitude);
        maxLng = Math.max(maxLng, point.longitude);
    });

    // Add buffer around route (convert meters to approximate degrees)
    // ~0.0001 degrees is about 11 meters at the equator
    const bufferDegrees = ROUTE_BUFFER_DISTANCE * 0.00001;
    minLat -= bufferDegrees;
    maxLat += bufferDegrees;
    minLng -= bufferDegrees;
    maxLng += bufferDegrees;

    // Calculate grid dimensions
    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;

    // Convert grid cell size from meters to approximate degrees
    const cellSizeDegrees = GRID_CELL_SIZE * 0.00001;

    // Calculate grid dimensions
    const rows = Math.ceil(latRange / cellSizeDegrees);
    const cols = Math.ceil(lngRange / cellSizeDegrees);

    // Initialize grid with nodes
    const grid: GridNode[][] = [];
    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
            const latitude = minLat + (r * cellSizeDegrees);
            const longitude = minLng + (c * cellSizeDegrees);

            grid[r][c] = {
                latitude,
                longitude,
                cost: 1, // Base cost
                obstacle: null,
                g: Infinity,
                h: 0,
                f: Infinity,
                parent: null,
            };
        }
    }

    // Apply obstacle costs to grid
    obstacles.forEach((obstacle) => {
        // Calculate which grid cells are affected by this obstacle
        const obstacleCost = calculateObstacleCost(obstacle);
        const obstacleRadius = Math.max(5, obstacle.obstacleScore * 3); // meters
        const radiusDegrees = obstacleRadius * 0.00001;

        // Find affected grid cells
        const r1 = Math.max(
            0,
            Math.floor(
                (obstacle.location.latitude - minLat - radiusDegrees) /
                    cellSizeDegrees,
            ),
        );
        const r2 = Math.min(
            rows - 1,
            Math.ceil(
                (obstacle.location.latitude - minLat + radiusDegrees) /
                    cellSizeDegrees,
            ),
        );
        const c1 = Math.max(
            0,
            Math.floor(
                (obstacle.location.longitude - minLng - radiusDegrees) /
                    cellSizeDegrees,
            ),
        );
        const c2 = Math.min(
            cols - 1,
            Math.ceil(
                (obstacle.location.longitude - minLng + radiusDegrees) /
                    cellSizeDegrees,
            ),
        );

        // Apply costs to affected cells
        for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
                const node = grid[r][c];
                const distance = haversineDistance(
                    { latitude: node.latitude, longitude: node.longitude },
                    {
                        latitude: obstacle.location.latitude,
                        longitude: obstacle.location.longitude,
                    },
                );

                // Apply inverse-square falloff for cost
                if (distance <= obstacleRadius) {
                    // If node already has an obstacle with higher cost, keep that one
                    const newCost = obstacleCost *
                        (1 - (distance / obstacleRadius));

                    if (node.obstacle === null || newCost > node.cost) {
                        node.cost = newCost;
                        node.obstacle = obstacle;
                    }
                }
            }
        }
    });

    return grid;
}

/**
 * Finds an accessible path using A* algorithm
 */
function findAccessiblePath(
    start: Point,
    end: Point,
    grid: GridNode[][],
    originalRoute: Point[],
): Point[] {
    if (grid.length === 0 || grid[0].length === 0) {
        return originalRoute; // No grid, return original path
    }

    // Find grid indices of start and end points
    const startNode = findClosestGridNode(start, grid);
    const endNode = findClosestGridNode(end, grid);

    if (!startNode || !endNode) {
        return originalRoute;
    }

    // Initialize A* algorithm
    const openSet: GridNode[] = [];
    const closedSet = new Set<GridNode>();

    // Set start node properties
    startNode.g = 0;
    startNode.h = heuristic(startNode, endNode);
    startNode.f = startNode.g + startNode.h;
    startNode.parent = null;

    openSet.push(startNode);

    // A* main loop
    while (openSet.length > 0) {
        // Find node with lowest f score
        let current = openSet[0];
        let currentIndex = 0;

        for (let i = 1; i < openSet.length; i++) {
            if (openSet[i].f < current.f) {
                current = openSet[i];
                currentIndex = i;
            }
        }

        // Remove current from open set and add to closed set
        openSet.splice(currentIndex, 1);
        closedSet.add(current);

        // If we reached the end node, reconstruct and return the path
        if (current === endNode) {
            return reconstructPath(current);
        }

        // Get neighbors
        const neighbors = getNeighbors(current, grid);

        for (const neighbor of neighbors) {
            // Skip if already evaluated
            if (closedSet.has(neighbor)) continue;

            // Calculate tentative g score
            // Base distance cost + obstacle cost + deviation penalty
            const distCost = haversineDistance(
                { latitude: current.latitude, longitude: current.longitude },
                { latitude: neighbor.latitude, longitude: neighbor.longitude },
            );

            // Calculate deviation penalty based on distance to original route
            const closestRoutePoint = findClosestPointOnRoute(
                { latitude: neighbor.latitude, longitude: neighbor.longitude },
                originalRoute,
            );
            const deviationDist = haversineDistance(
                { latitude: neighbor.latitude, longitude: neighbor.longitude },
                closestRoutePoint,
            );
            const deviationPenalty = (deviationDist / 10) *
                DEVIATION_PENALTY_PER_10_METERS;

            // Total segment cost
            const totalSegmentCost = distCost + (neighbor.cost * 50) +
                deviationPenalty;
            const tentativeG = current.g + totalSegmentCost;

            // Skip if this path to neighbor is worse
            if (tentativeG >= neighbor.g) continue;

            // This path is better, record it
            neighbor.parent = current;
            neighbor.g = tentativeG;
            neighbor.h = heuristic(neighbor, endNode);
            neighbor.f = neighbor.g + neighbor.h;

            // Add to open set if not already there
            if (!openSet.includes(neighbor)) {
                openSet.push(neighbor);
            }
        }
    }

    // No path found, return original
    return originalRoute;
}

/**
 * Find closest grid node to a point
 */
function findClosestGridNode(
    point: Point,
    grid: GridNode[][],
): GridNode | null {
    let closestNode: GridNode | null = null;
    let minDistance = Infinity;

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const node = grid[r][c];
            const distance = haversineDistance(
                point,
                { latitude: node.latitude, longitude: node.longitude },
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestNode = node;
            }
        }
    }

    return closestNode;
}

/**
 * Get neighboring nodes in the grid
 */
function getNeighbors(node: GridNode, grid: GridNode[][]): GridNode[] {
    const neighbors: GridNode[] = [];

    // Find row and column indices of the node
    let nodeRow = -1, nodeCol = -1;

    outerLoop:
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] === node) {
                nodeRow = r;
                nodeCol = c;
                break outerLoop;
            }
        }
    }

    if (nodeRow === -1 || nodeCol === -1) {
        return neighbors; // Node not found in grid
    }

    // Check 8 directions
    const directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1], // Cardinal
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1], // Diagonal
    ];

    for (const [dr, dc] of directions) {
        const r = nodeRow + dr;
        const c = nodeCol + dc;

        if (r >= 0 && r < grid.length && c >= 0 && c < grid[r].length) {
            neighbors.push(grid[r][c]);
        }
    }

    return neighbors;
}

/**
 * Calculate heuristic (straight-line distance to goal)
 */
function heuristic(a: GridNode, b: GridNode): number {
    return haversineDistance(
        { latitude: a.latitude, longitude: a.longitude },
        { latitude: b.latitude, longitude: b.longitude },
    );
}

/**
 * Reconstruct path from A* result
 */
function reconstructPath(endNode: GridNode): Point[] {
    const path: Point[] = [];
    let current: GridNode | null = endNode;

    while (current) {
        path.unshift({
            latitude: current.latitude,
            longitude: current.longitude,
        });
        current = current.parent;
    }

    return path;
}

/**
 * Find closest point on route to a given point
 */
function findClosestPointOnRoute(point: Point, route: Point[]): Point {
    let closestPoint = route[0];
    let minDistance = haversineDistance(point, route[0]);

    for (let i = 1; i < route.length; i++) {
        const distance = haversineDistance(point, route[i]);
        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = route[i];
        }
    }

    return closestPoint;
}

/**
 * Simplifies a path by removing unnecessary points
 * Uses Douglas-Peucker algorithm to reduce points while preserving the path shape
 */
function simplifyPath(path: Point[]): Point[] {
    if (path.length <= 2) return path;

    // Threshold distance in meters
    const threshold = 2;

    // Find the point with the maximum distance from line segment
    const findFurthestPoint = (
        start: number,
        end: number,
    ): { index: number; distance: number } => {
        let maxDist = 0;
        let index = 0;

        for (let i = start + 1; i < end; i++) {
            const dist = perpendicularDistance(path[i], path[start], path[end]);
            if (dist > maxDist) {
                maxDist = dist;
                index = i;
            }
        }

        return { index, distance: maxDist };
    };

    // Douglas-Peucker recursive function
    const douglasPeucker = (start: number, end: number): Point[] => {
        // Find furthest point and its distance
        const { index, distance } = findFurthestPoint(start, end);

        // If max distance is greater than threshold, recursively simplify
        if (distance > threshold) {
            // Recursive call
            const firstHalf = douglasPeucker(start, index);
            const secondHalf = douglasPeucker(index, end);

            // Join the two halves (excluding duplicate middle point)
            return [...firstHalf.slice(0, -1), ...secondHalf];
        } else {
            // Below threshold - use just the endpoints
            return [path[start], path[end]];
        }
    };

    // Start recursion with first and last points
    return douglasPeucker(0, path.length - 1);
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
function perpendicularDistance(
    point: Point,
    lineStart: Point,
    lineEnd: Point,
): number {
    // If start and end are the same point, return distance to that point
    if (
        lineStart.latitude === lineEnd.latitude &&
        lineStart.longitude === lineEnd.longitude
    ) {
        return haversineDistance(point, lineStart);
    }

    // Calculate perpendicular distance using the formula:
    // d = |cross_product(end-start, point-start)| / |end-start|

    // Convert lat/lng to Cartesian coordinates for simplicity
    // This is an approximation, but works well for short distances
    const earthRadius = 6371000; // meters

    // Convert to radians
    const p = {
        x: point.longitude * Math.PI / 180,
        y: point.latitude * Math.PI / 180,
    };
    const s = {
        x: lineStart.longitude * Math.PI / 180,
        y: lineStart.latitude * Math.PI / 180,
    };
    const e = {
        x: lineEnd.longitude * Math.PI / 180,
        y: lineEnd.latitude * Math.PI / 180,
    };

    // Calculate vectors
    const vs = {
        x: s.x * earthRadius * Math.cos(s.y),
        y: s.y * earthRadius,
    };
    const ve = {
        x: e.x * earthRadius * Math.cos(e.y),
        y: e.y * earthRadius,
    };
    const vp = {
        x: p.x * earthRadius * Math.cos(p.y),
        y: p.y * earthRadius,
    };

    // Line vector
    const lineVec = {
        x: ve.x - vs.x,
        y: ve.y - vs.y,
    };

    // Point vector from start
    const pointVec = {
        x: vp.x - vs.x,
        y: vp.y - vs.y,
    };

    // Line length
    const lineLength = Math.sqrt(lineVec.x * lineVec.x + lineVec.y * lineVec.y);

    // Cross product magnitude
    const crossProduct = Math.abs(
        lineVec.x * pointVec.y - lineVec.y * pointVec.x,
    );

    // Perpendicular distance
    return crossProduct / lineLength;
}

/**
 * Calculate ratio of new path distance to original
 */
function calculateDistanceRatio(
    newPath: Point[],
    originalPath: Point[],
): number {
    const newDistance = calculatePathDistance(newPath);
    const originalDistance = calculatePathDistance(originalPath);
    return newDistance / originalDistance;
}

/**
 * Calculate total distance of a path
 */
function calculatePathDistance(path: Point[]): number {
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
        distance += haversineDistance(path[i - 1], path[i]);
    }
    return distance;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(point1: Point, point2: Point): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = point1.latitude * Math.PI / 180;
    const φ2 = point2.latitude * Math.PI / 180;
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

/**
 * Adjusts a distance value based on a ratio
 */
function adjustDistanceString(distanceStr: string, ratio: number): string {
    // Extract numeric part from distance string (e.g., "5.2 km" -> 5.2)
    const match = distanceStr.match(/(\d+(\.\d+)?)/);
    if (!match) return distanceStr;

    const value = parseFloat(match[0]);
    return (value * ratio).toFixed(1);
}

/**
 * Adjust duration string based on ratio
 */
function adjustDurationString(durationStr: string, ratio: number): string {
    // Parse duration like "15 mins" or "1 hour 20 mins"
    const hourMatch = durationStr.match(/(\d+)\s*hour/);
    const minMatch = durationStr.match(/(\d+)\s*min/);

    let minutes = 0;
    if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
    if (minMatch) minutes += parseInt(minMatch[1]);

    const newMinutes = Math.round(minutes * ratio);

    if (newMinutes >= 60) {
        const hours = Math.floor(newMinutes / 60);
        const mins = newMinutes % 60;
        return `${hours} hour${hours > 1 ? "s" : ""} ${
            mins > 0 ? `${mins} min${mins > 1 ? "s" : ""}` : ""
        }`;
    }

    return `${newMinutes} min${newMinutes > 1 ? "s" : ""}`;
}

/**
 * Calculate combined obstacle cost based on type and severity
 */
export function calculateObstacleCost(obstacle: Marker): number {
    const typeWeight = OBSTACLE_TYPE_WEIGHTS[
        obstacle.obstacleType as keyof typeof OBSTACLE_TYPE_WEIGHTS
    ] || 5;
    return typeWeight * (obstacle.obstacleScore / 5); // Normalize score to a 0-1 scale
}
