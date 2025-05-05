import { Marker } from "@/types/marker.types";
import { getDirections } from "./places.service";

// Constants for the grid-based path finding
const GRID_CELL_SIZE = 1; // meters - size of each grid cell (finer grid)
const GRID_EXPANSION = 50; // meters - how far to expand the grid from the original route
const DETOUR_COST_PER_METER = 0.00001; // Negligible detour cost
const MAX_DETOUR_DISTANCE = 10000; // Allow very large detours
const ROAD_SEARCH_RADIUS = 50; // meters - how far to search for road nodes
const MAX_ROAD_DISTANCE = 100; // meters - maximum allowed distance to road

// Obstacle type weights (base costs)
const OBSTACLE_WEIGHTS = {
    STAIRS: 1000000,
    NARROW_PATH: 1000000,
    STEEP_INCLINE: 1000000,
    UNEVEN_SURFACE: 1000000,
    OBSTACLE_IN_PATH: 1000000,
    POOR_LIGHTING: 1000000,
    CONSTRUCTION: 1000000,
    MISSING_RAMP: 1000000,
    MISSING_CROSSWALK: 1000000,
    OTHER: 1000000,
};

interface Point {
    latitude: number;
    longitude: number;
}

interface GridNode {
    latitude: number;
    longitude: number;
    g: number; // Cost from start to this node
    h: number; // Heuristic cost to end
    f: number; // Total cost (g + h)
    parent: GridNode | null;
    isRoad: boolean;
    obstacleCost: number;
}

interface RoadSegment {
    start: Point;
    end: Point;
    points: Point[];
}

/**
 * Main function to get an accessible route avoiding obstacles
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
    console.log("Starting accessible route calculation...");

    // If not walking or no obstacles, use regular directions
    if (transportMode !== "walking" || obstacles.length === 0) {
        console.log("Using regular directions (no walking or no obstacles)");
        // Return the API response as-is
        return getDirections(origin, destination, transportMode);
    }

    try {
        // Get base route from Google Directions API
        const baseRoute = await getDirections(
            origin,
            destination,
            transportMode,
        );
        const routeDistance = calculatePathDistance(baseRoute.points);

        // Debug log: base route points
        console.log("Base route points:", baseRoute.points.length);
        console.log("Obstacles provided:", obstacles.length);

        // For very long routes (>3km), skip accessibility routing
        if (routeDistance > 3000) {
            console.log("Route too long, using regular directions");
            // Return the API response as-is
            return baseRoute;
        }

        // Filter obstacles to those near the route
        const relevantObstacles = obstacles.filter((obstacle) =>
            baseRoute.points.some((point) =>
                haversineDistance(obstacle.location, point) <= GRID_EXPANSION
            )
        );

        // Debug log: relevant obstacles
        console.log(
            "Relevant obstacles:",
            relevantObstacles.length,
            relevantObstacles,
        );

        if (relevantObstacles.length === 0) {
            console.log("No relevant obstacles, using regular directions");
            // Return the API response as-is
            return baseRoute;
        }

        // Create grid around the route
        const grid = createGrid(baseRoute.points, relevantObstacles);

        // Find accessible path using A* algorithm
        const accessiblePath = await findAccessiblePath(
            origin,
            destination,
            grid,
            baseRoute.points,
        );

        // Calculate new metrics for the custom route
        const accessibleDistance = calculatePathDistance(accessiblePath);
        const averageWalkingSpeed = 1.4; // meters per second
        const accessibleDurationSeconds = accessibleDistance /
            averageWalkingSpeed;
        const accessibleDurationMinutes = Math.round(
            accessibleDurationSeconds / 60,
        );

        // Convert distance from meters to kilometers for consistency with other API responses
        const accessibleDistanceKm = accessibleDistance / 1000;

        return {
            points: accessiblePath,
            distance: accessibleDistanceKm,
            duration: accessibleDurationMinutes < 60
                ? `${accessibleDurationMinutes} mins`
                : `${Math.floor(accessibleDurationMinutes / 60)} hours ${
                    accessibleDurationMinutes % 60
                } mins`,
            steps: [
                {
                    instructions: "Follow the accessible path.",
                    distance: `${Math.round(accessibleDistance)} m`,
                    duration: `${accessibleDurationMinutes} mins`,
                    startLocation: accessiblePath[0],
                    endLocation: accessiblePath[accessiblePath.length - 1],
                },
            ],
        };
    } catch (error) {
        console.error("Error in accessible routing:", error);
        // Return the API response as-is on error
        return getDirections(origin, destination, transportMode);
    }
}

/**
 * Create a grid around the route for path finding
 */
function createGrid(routePoints: Point[], obstacles: Marker[]): GridNode[][] {
    // Get bounding box of the route
    const { minLat, maxLat, minLng, maxLng } = getBoundingBox(routePoints);

    // Calculate grid dimensions with higher precision
    const latStep = GRID_CELL_SIZE / 111000; // Approximate meters to degrees
    const lngStep = GRID_CELL_SIZE /
        (111000 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180));

    const gridWidth = Math.ceil((maxLng - minLng) / lngStep) + 2;
    const gridHeight = Math.ceil((maxLat - minLat) / latStep) + 2;

    // Initialize grid
    const grid: GridNode[][] = [];
    for (let i = 0; i < gridHeight; i++) {
        grid[i] = [];
        for (let j = 0; j < gridWidth; j++) {
            const lat = minLat + (i - 1) * latStep;
            const lng = minLng + (j - 1) * lngStep;

            // Calculate obstacle cost for this cell
            const obstacleCost = calculateCellObstacleCost(
                { latitude: lat, longitude: lng },
                obstacles,
            );

            grid[i][j] = {
                latitude: lat,
                longitude: lng,
                g: Infinity,
                h: 0,
                f: Infinity,
                parent: null,
                isRoad: true, // Allow all cells to be traversable for now
                obstacleCost,
            };
        }
    }

    // (Optional) Still mark road nodes for future use, but all cells are traversable
    // const roadSegments = extractRoadSegments(routePoints);
    // markRoadNetwork(grid, roadSegments);

    return grid;
}

/**
 * Extract road segments from route points
 */
function extractRoadSegments(routePoints: Point[]): RoadSegment[] {
    const segments: RoadSegment[] = [];

    for (let i = 1; i < routePoints.length; i++) {
        const start = routePoints[i - 1];
        const end = routePoints[i];

        // Create intermediate points for better road representation
        const points = interpolatePoints(start, end, GRID_CELL_SIZE);

        segments.push({
            start,
            end,
            points,
        });
    }

    return segments;
}

/**
 * Interpolate points between two coordinates
 */
function interpolatePoints(
    start: Point,
    end: Point,
    stepSize: number,
): Point[] {
    const points: Point[] = [];
    const distance = haversineDistance(start, end);
    const steps = Math.ceil(distance / stepSize);

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        points.push({
            latitude: start.latitude + t * (end.latitude - start.latitude),
            longitude: start.longitude + t * (end.longitude - start.longitude),
        });
    }

    return points;
}

/**
 * Mark road network in the grid
 */
function markRoadNetwork(
    grid: GridNode[][],
    roadSegments: RoadSegment[],
): void {
    // First pass: mark all road points
    for (const segment of roadSegments) {
        for (const point of segment.points) {
            const node = findClosestGridNode(point, grid);
            if (node) {
                node.isRoad = true;
            }
        }
    }

    // Second pass: connect road segments
    for (let i = 0; i < roadSegments.length - 1; i++) {
        const currentSegment = roadSegments[i];
        const nextSegment = roadSegments[i + 1];

        // Connect end of current segment to start of next segment
        const endNode = findClosestGridNode(currentSegment.end, grid);
        const startNode = findClosestGridNode(nextSegment.start, grid);

        if (endNode && startNode) {
            // Mark nodes along the connection as road nodes
            const connectionPoints = interpolatePoints(
                { latitude: endNode.latitude, longitude: endNode.longitude },
                {
                    latitude: startNode.latitude,
                    longitude: startNode.longitude,
                },
                GRID_CELL_SIZE,
            );

            for (const point of connectionPoints) {
                const node = findClosestGridNode(point, grid);
                if (node) {
                    node.isRoad = true;
                }
            }
        }
    }
}

/**
 * Calculate obstacle cost for a grid cell
 */
function calculateCellObstacleCost(point: Point, obstacles: Marker[]): number {
    let maxCost = 0;

    for (const obstacle of obstacles) {
        const distance = haversineDistance(point, obstacle.location);
        if (distance <= GRID_CELL_SIZE) {
            // Calculate weighted cost based on obstacle type and severity
            const baseCost = OBSTACLE_WEIGHTS[obstacle.obstacleType] ||
                OBSTACLE_WEIGHTS.OTHER;
            const severityWeight = obstacle.obstacleScore / 5; // Normalize to 0-1
            const weightedCost = baseCost * severityWeight;

            // Apply distance decay
            const distanceDecay = 1 - (distance / GRID_CELL_SIZE);
            const finalCost = weightedCost * distanceDecay;

            maxCost = Math.max(maxCost, finalCost);
        }
    }

    if (maxCost > 0) {
        console.log("Obstacle cost at", point, ":", maxCost);
    }

    return maxCost;
}

/**
 * Find accessible path using A* algorithm
 */
async function findAccessiblePath(
    start: Point,
    end: Point,
    grid: GridNode[][],
    originalRoute: Point[],
): Promise<Point[]> {
    const openSet: GridNode[] = [];
    const closedSet: Set<GridNode> = new Set();

    // Find start and end nodes that are on roads
    const startNode = findClosestRoadNode(start, grid);
    const endNode = findClosestRoadNode(end, grid);

    if (!startNode || !endNode) {
        // If we can't find valid road nodes, try to find the closest points on the original route
        const closestStart = findClosestPointOnRoute(start, originalRoute);
        const closestEnd = findClosestPointOnRoute(end, originalRoute);

        if (!closestStart || !closestEnd) {
            throw new Error(
                `Could not find valid road nodes. Start distance: ${
                    startNode ? "valid" : "too far"
                }, ` +
                    `End distance: ${endNode ? "valid" : "too far"}. ` +
                    `Please try a different route or adjust your start/end points.`,
            );
        }

        // Use the closest points on the original route
        return originalRoute;
    }

    // Initialize start node
    startNode.g = 0;
    startNode.h = heuristic(startNode, endNode);
    startNode.f = startNode.h;
    openSet.push(startNode);

    while (openSet.length > 0) {
        // Get node with lowest f score
        const current = getLowestFScore(openSet);

        // Check if we've reached the end
        if (current === endNode) {
            return reconstructPath(current);
        }

        // Move current from open to closed set
        openSet.splice(openSet.indexOf(current), 1);
        closedSet.add(current);

        // Get neighbors that are on roads and connected to current node
        const neighbors = getConnectedRoadNeighbors(current, grid);

        for (const neighbor of neighbors) {
            if (closedSet.has(neighbor)) continue;

            // Calculate tentative g score with higher penalty for non-road nodes
            const distance = haversineDistance(current, neighbor);
            const detourCost = calculateDetourCost(neighbor, originalRoute);
            const obstacleCost = neighbor.obstacleCost;

            // Very high penalty for non-road nodes
            const roadPenalty = neighbor.isRoad ? 1 : 10000;

            const tentativeG = current.g +
                distance * (1 + obstacleCost + detourCost) * roadPenalty;

            if (!openSet.includes(neighbor)) {
                openSet.push(neighbor);
            } else if (tentativeG >= neighbor.g) {
                continue;
            }

            // This path is better
            neighbor.parent = current;
            neighbor.g = tentativeG;
            neighbor.h = heuristic(neighbor, endNode);
            neighbor.f = neighbor.g + neighbor.h;
        }
    }

    // If no path found, return the original route
    console.warn("No accessible path found, falling back to original route");
    return originalRoute;
}

/**
 * Find closest node that is on a road
 */
function findClosestRoadNode(
    point: Point,
    grid: GridNode[][],
): GridNode | null {
    // Now, just find the closest grid node (all are traversable)
    return findClosestGridNode(point, grid);
}

/**
 * Get neighbors that are on roads and connected to the current node
 */
function getConnectedRoadNeighbors(
    node: GridNode,
    grid: GridNode[][],
): GridNode[] {
    const neighbors: GridNode[] = [];
    const [row, col] = findNodePosition(node, grid);

    if (!row) return neighbors;

    // Check 8 surrounding cells
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;

            const newRow = row + i;
            const newCol = col + j;

            if (
                newRow >= 0 && newRow < grid.length &&
                newCol >= 0 && newCol < grid[0].length
            ) {
                const neighbor = grid[newRow][newCol];
                // Remove road-only restriction: allow all cells
                // if (neighbor.isRoad) {
                //     // Check if the path between nodes is clear
                //     const pathPoints = interpolatePoints(
                //         { latitude: node.latitude, longitude: node.longitude },
                //         { latitude: neighbor.latitude, longitude: neighbor.longitude },
                //         GRID_CELL_SIZE / 2
                //     );
                //     if (pathPoints.every(point => {
                //         const pathNode = findClosestGridNode(point, grid);
                //         return pathNode?.isRoad;
                //     })) {
                //         neighbors.push(neighbor);
                //     }
                // }
                neighbors.push(neighbor);
            }
        }
    }

    return neighbors;
}

/**
 * Calculate detour cost based on distance from original route
 */
function calculateDetourCost(node: GridNode, originalRoute: Point[]): number {
    const minDistance = findMinimumDistanceToRoute(node, originalRoute);
    return Math.min(
        minDistance * DETOUR_COST_PER_METER,
        MAX_DETOUR_DISTANCE * DETOUR_COST_PER_METER,
    );
}

/**
 * Get neighboring nodes for A* algorithm
 */
function getNeighbors(node: GridNode, grid: GridNode[][]): GridNode[] {
    const neighbors: GridNode[] = [];
    const [row, col] = findNodePosition(node, grid);

    if (!row) return neighbors;

    // Check 8 surrounding cells
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;

            const newRow = row + i;
            const newCol = col + j;

            if (
                newRow >= 0 && newRow < grid.length &&
                newCol >= 0 && newCol < grid[0].length
            ) {
                neighbors.push(grid[newRow][newCol]);
            }
        }
    }

    return neighbors;
}

/**
 * Heuristic function for A* (Euclidean distance)
 */
function heuristic(a: GridNode, b: GridNode): number {
    return haversineDistance(a, b);
}

/**
 * Reconstruct path from end node
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
 * Get bounding box of a set of points
 */
function getBoundingBox(
    points: Point[],
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const point of points) {
        minLat = Math.min(minLat, point.latitude);
        maxLat = Math.max(maxLat, point.latitude);
        minLng = Math.min(minLng, point.longitude);
        minLng = Math.min(minLng, point.longitude);
    }

    return { minLat, maxLat, minLng, maxLng };
}

/**
 * Find closest grid node to a point
 */
function findClosestGridNode(
    point: Point,
    grid: GridNode[][],
): GridNode | null {
    let closest: GridNode | null = null;
    let minDistance = Infinity;

    for (const row of grid) {
        for (const node of row) {
            const distance = haversineDistance(point, node);
            if (distance < minDistance) {
                minDistance = distance;
                closest = node;
            }
        }
    }

    return closest;
}

/**
 * Find position of a node in the grid
 */
function findNodePosition(
    node: GridNode,
    grid: GridNode[][],
): [number, number] | [null, null] {
    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[i].length; j++) {
            if (grid[i][j] === node) {
                return [i, j];
            }
        }
    }
    return [null, null];
}

/**
 * Get node with lowest f score
 */
function getLowestFScore(nodes: GridNode[]): GridNode {
    return nodes.reduce((min, node) => node.f < min.f ? node : min);
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(point1: Point, point2: Point): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLng = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(point1.latitude * Math.PI / 180) *
            Math.cos(point2.latitude * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Find minimum distance from a point to any point on a route
 */
function findMinimumDistanceToRoute(point: Point, route: Point[]): number {
    let minDistance = Infinity;

    for (let i = 1; i < route.length; i++) {
        const distance = perpendicularDistance(
            point,
            route[i - 1],
            route[i],
        );
        minDistance = Math.min(minDistance, distance);
    }

    return minDistance;
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
function perpendicularDistance(
    point: Point,
    lineStart: Point,
    lineEnd: Point,
): number {
    const A = point.latitude - lineStart.latitude;
    const B = point.longitude - lineStart.longitude;
    const C = lineEnd.latitude - lineStart.latitude;
    const D = lineEnd.longitude - lineStart.longitude;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;

    if (len_sq !== 0) {
        param = dot / len_sq;
    }

    let xx, yy;

    if (param < 0) {
        xx = lineStart.latitude;
        yy = lineStart.longitude;
    } else if (param > 1) {
        xx = lineEnd.latitude;
        yy = lineEnd.longitude;
    } else {
        xx = lineStart.latitude + param * C;
        yy = lineStart.longitude + param * D;
    }

    return haversineDistance(point, { latitude: xx, longitude: yy });
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
 * Adjust duration based on distance ratio
 */
function adjustDuration(duration: string, ratio: number): string {
    // Parse duration string (e.g., "5 mins" or "1 hour 30 mins")
    const parts = duration.split(" ");
    let totalMinutes = 0;

    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === "hour" || parts[i] === "hours") {
            totalMinutes += parseInt(parts[i - 1]) * 60;
        } else if (parts[i] === "min" || parts[i] === "mins") {
            totalMinutes += parseInt(parts[i - 1]);
        }
    }

    // Apply ratio and round to nearest minute
    const newMinutes = Math.round(totalMinutes * ratio);

    // Format back to string
    if (newMinutes < 60) {
        return `${newMinutes} mins`;
    } else {
        const hours = Math.floor(newMinutes / 60);
        const minutes = newMinutes % 60;
        if (minutes === 0) {
            return `${hours} ${hours === 1 ? "hour" : "hours"}`;
        } else {
            return `${hours} ${hours === 1 ? "hour" : "hours"} ${minutes} mins`;
        }
    }
}

/**
 * Find the closest point on a route to a given point
 */
function findClosestPointOnRoute(point: Point, route: Point[]): Point | null {
    let closestPoint: Point | null = null;
    let minDistance = Infinity;

    for (const routePoint of route) {
        const distance = haversineDistance(point, routePoint);
        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = routePoint;
        }
    }

    return closestPoint;
}
