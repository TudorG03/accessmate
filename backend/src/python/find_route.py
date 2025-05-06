#!/usr/bin/env python3
"""
Accessible Route Finding Script

This script finds an accessible route between two points,
considering obstacles and user preferences.

Usage:
  python find_route.py <graph_json> <origin_lat> <origin_lng> <dest_lat> <dest_lng> <obstacles_json> <preferences_json>
  
Output:
  Accessible route as JSON to stdout
"""

import sys
import json
import math
import networkx as nx
import osmnx as ox
from shapely.geometry import Point, LineString

# Default values
DEFAULT_WALKING_SPEED = 1.4  # meters per second
MAX_OBSTACLE_INFLUENCE = 100  # meters
MAX_WALKING_DISTANCE = 5000  # meters

def deserialize_graph(graph_json):
    """
    Deserialize a JSON representation of a graph to a NetworkX graph.
    
    Args:
        graph_json: JSON string representation of the graph
        
    Returns:
        NetworkX graph
    """
    try:
        data = json.loads(graph_json)
        graph = nx.node_link_graph(data)
        return graph
    except Exception as e:
        print(f"Error deserializing graph: {e}", file=sys.stderr)
        return None

def calculate_obstacle_weights(graph, obstacles, user_preferences=None):
    """
    Apply obstacle weights to the graph edges.
    
    Args:
        graph: NetworkX graph
        obstacles: List of obstacles with location and type
        user_preferences: Dictionary of user preferences
        
    Returns:
        Graph with updated weights
    """
    # Initialize user preferences with defaults if not provided
    if user_preferences is None:
        user_preferences = {}
    
    max_slope = user_preferences.get('maxSlope', 0.08)  # 8% by default
    avoid_stairs = user_preferences.get('avoidStairs', True)
    minimum_width = user_preferences.get('minimumWidth', 1.2)  # meters
    
    # Obstacle type weights
    obstacle_weights = {
        'STAIRS': 1000,
        'NARROW_PATH': 800,
        'STEEP_INCLINE': 900,
        'UNEVEN_SURFACE': 700,
        'OBSTACLE_IN_PATH': 1000,
        'POOR_LIGHTING': 500,
        'CONSTRUCTION': 900,
        'MISSING_RAMP': 800,
        'MISSING_CROSSWALK': 700,
        'OTHER': 600
    }
    
    # Create custom weight attribute
    for u, v, k, data in graph.edges(keys=True, data=True):
        # Start with the length as base weight
        length = data.get('length', 0)
        data['weight'] = length
        
        # Apply user preference penalties
        
        # Stairs penalty based on user preference
        if avoid_stairs and data.get('stairs') == 'yes':
            data['weight'] += length * 100  # Extreme penalty
        
        # Width penalty
        edge_width = data.get('width', 2.0)
        if edge_width < minimum_width:
            # Apply penalty proportional to how narrow it is
            width_penalty = (minimum_width - edge_width) / minimum_width
            data['weight'] += length * width_penalty * 10
        
        # Slope penalty
        edge_grade = abs(data.get('grade', 0))
        if edge_grade > max_slope:
            # Apply penalty proportional to how steep it is
            slope_penalty = (edge_grade - max_slope) / max_slope
            data['weight'] += length * slope_penalty * 20
        
        # Get original obstacle score
        data['original_obstacle_score'] = data.get('obstacle_score', 0)
    
    # Apply obstacle penalties
    for obstacle in obstacles:
        obstacle_type = obstacle.get('obstacleType', 'OTHER')
        obstacle_score = obstacle.get('obstacleScore', 1)
        obstacle_weight = obstacle_weights.get(obstacle_type, 600) * obstacle_score
        
        # Get obstacle location
        location = obstacle.get('location', {})
        lat = location.get('latitude', 0)
        lng = location.get('longitude', 0)
        
        if lat == 0 and lng == 0:
            continue
        
        # Find nearest edges to the obstacle
        obstacle_point = (lat, lng)
        try:
            nearest_edges = ox.distance.nearest_edges(graph, lng, lat, return_dist=True)
            
            # Apply penalty to nearby edges based on distance
            for edge, dist in nearest_edges:
                if dist <= MAX_OBSTACLE_INFLUENCE:
                    u, v, k = edge
                    
                    # Calculate penalty based on distance (inverse relationship)
                    distance_factor = 1 - (dist / MAX_OBSTACLE_INFLUENCE)
                    edge_penalty = obstacle_weight * distance_factor
                    
                    # Add to existing weight
                    graph[u][v][k]['weight'] += edge_penalty
                    graph[u][v][k]['obstacle_score'] = graph[u][v][k].get('obstacle_score', 0) + edge_penalty
        except Exception as e:
            print(f"Error applying obstacle {obstacle_type}: {e}", file=sys.stderr)
    
    return graph

def find_accessible_route(graph, origin, destination):
    """
    Find an accessible route between two points.
    
    Args:
        graph: NetworkX graph with weights
        origin: (latitude, longitude) tuple
        destination: (latitude, longitude) tuple
        
    Returns:
        List of route points
    """
    try:
        # Find nearest nodes to origin and destination
        origin_node = ox.distance.nearest_nodes(graph, origin[1], origin[0])
        dest_node = ox.distance.nearest_nodes(graph, destination[1], destination[0])
        
        # Find shortest path using Dijkstra's algorithm
        path = nx.shortest_path(graph, origin_node, dest_node, weight='weight')
        
        # Extract coordinates for each node in the path
        route_points = []
        for node in path:
            lat = graph.nodes[node]['y']
            lng = graph.nodes[node]['x']
            route_points.append({'latitude': lat, 'longitude': lng})
        
        # Calculate route stats
        route_length = 0
        route_obstacles = False
        for i in range(1, len(path)):
            u = path[i-1]
            v = path[i]
            edge_data = graph.get_edge_data(u, v, 0)
            route_length += edge_data.get('length', 0)
            if edge_data.get('obstacle_score', 0) > 0 or edge_data.get('original_obstacle_score', 0) > 0:
                route_obstacles = True
        
        # Calculate estimated duration
        duration_seconds = route_length / DEFAULT_WALKING_SPEED
        duration_minutes = math.ceil(duration_seconds / 60)
        
        # Format the duration string
        if duration_minutes < 60:
            duration_str = f"{duration_minutes} mins"
        else:
            hours = math.floor(duration_minutes / 60)
            mins = duration_minutes % 60
            duration_str = f"{hours} hours {mins} mins"
        
        # Format the distance
        distance_km = round(route_length / 1000, 2)
        
        # Create route result
        result = {
            'points': route_points,
            'distance': distance_km,
            'duration': duration_str,
            'hasObstacles': route_obstacles,
            'steps': [
                {
                    'instructions': 'Follow the accessible path.',
                    'distance': f"{round(route_length)} m",
                    'duration': duration_str,
                    'startLocation': route_points[0],
                    'endLocation': route_points[-1]
                }
            ]
        }
        
        return result
    except Exception as e:
        print(f"Error finding route: {e}", file=sys.stderr)
        return None

def main():
    """
    Main function to find an accessible route.
    """
    if len(sys.argv) < 6:
        print("Usage: python find_route.py <graph_json> <origin_lat> <origin_lng> <dest_lat> <dest_lng> [obstacles_json] [preferences_json]", file=sys.stderr)
        sys.exit(1)
    
    try:
        graph_json = sys.argv[1]
        origin_lat = float(sys.argv[2])
        origin_lng = float(sys.argv[3])
        dest_lat = float(sys.argv[4])
        dest_lng = float(sys.argv[5])
        
        # Parse obstacles and preferences
        obstacles = []
        user_preferences = {}
        
        if len(sys.argv) > 6:
            obstacles_json = sys.argv[6]
            try:
                obstacles = json.loads(obstacles_json)
            except:
                print("Warning: Could not parse obstacles JSON", file=sys.stderr)
        
        if len(sys.argv) > 7:
            preferences_json = sys.argv[7]
            try:
                user_preferences = json.loads(preferences_json)
            except:
                print("Warning: Could not parse preferences JSON", file=sys.stderr)
        
        # Deserialize graph
        graph = deserialize_graph(graph_json)
        if graph is None:
            sys.exit(1)
        
        # Apply obstacle weights
        graph = calculate_obstacle_weights(graph, obstacles, user_preferences)
        
        # Find route
        route = find_accessible_route(graph, (origin_lat, origin_lng), (dest_lat, dest_lng))
        if route is None:
            sys.exit(1)
        
        # Return route as JSON
        print(json.dumps(route))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 