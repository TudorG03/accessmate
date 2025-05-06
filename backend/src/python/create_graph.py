#!/usr/bin/env python3
"""
OSMNX Graph Creation Script

This script creates a graph from OpenStreetMap data for a specific region,
optimized for accessibility routing.

Usage:
  python create_graph.py <north> <south> <east> <west> <network_type>
  
Output:
  Serialized NetworkX graph as JSON to stdout
"""

import sys
import json
import osmnx as ox
import networkx as nx
from shapely.geometry import Point, LineString, Polygon

# Configure osmnx
ox.config(use_cache=True, log_console=False)

def create_graph(north, south, east, west, network_type='walk'):
    """
    Create a graph from OpenStreetMap data for a specific region.
    
    Args:
        north, south, east, west: Bounding box coordinates
        network_type: Type of network to extract ('walk', 'drive', etc.)
        
    Returns:
        NetworkX graph
    """
    try:
        # Get graph from OSM
        graph = ox.graph_from_bbox(
            north, south, east, west, 
            network_type=network_type,
            simplify=True,
            retain_all=False,
            truncate_by_edge=True
        )
        
        # Add elevation data if available
        try:
            graph = ox.elevation.add_node_elevations_google(graph)
            # Calculate edge grades (slopes)
            graph = ox.elevation.add_edge_grades(graph)
        except Exception as e:
            # Elevation data couldn't be added
            print(f"Warning: Elevation data couldn't be added: {e}", file=sys.stderr)
            # Add default grades of 0
            for u, v, k, data in graph.edges(keys=True, data=True):
                data['grade'] = 0
        
        # Add additional edge attributes for accessibility
        for u, v, k, data in graph.edges(keys=True, data=True):
            # Initialize accessibility attributes
            data['stairs'] = 'no'  # Default: no stairs
            data['width'] = 2.0    # Default width in meters
            data['surface'] = 'unknown'
            data['lit'] = 'unknown'
            data['obstacle_score'] = 0
            
            # Extract tags from OSM if available
            if 'tags' in data:
                tags = data.get('tags', {})
                
                # Check for stairs
                if tags.get('highway') == 'steps' or tags.get('stairs') == 'yes':
                    data['stairs'] = 'yes'
                    data['obstacle_score'] += 100
                
                # Check for width
                if 'width' in tags:
                    try:
                        width_str = tags['width']
                        # Handle different formats (e.g., "2.5 m", "2.5", "250cm")
                        width_str = width_str.replace('m', '').replace('meters', '').strip()
                        if 'cm' in width_str:
                            width_str = width_str.replace('cm', '')
                            data['width'] = float(width_str) / 100
                        else:
                            data['width'] = float(width_str)
                    except ValueError:
                        # Default width if parsing fails
                        data['width'] = 2.0
                
                # Check for surface quality
                if 'surface' in tags:
                    data['surface'] = tags['surface']
                    # Add obstacle score for problematic surfaces
                    problematic_surfaces = ['cobblestone', 'gravel', 'dirt', 'sand', 'mud']
                    if data['surface'] in problematic_surfaces:
                        data['obstacle_score'] += 50
                
                # Check for lighting
                if 'lit' in tags:
                    data['lit'] = tags['lit']
                    if data['lit'] == 'no':
                        data['obstacle_score'] += 20
            
            # Add slope-based obstacle score
            if 'grade' in data and data['grade'] is not None:
                grade = abs(data['grade'])
                if grade > 0.08:  # More than 8% grade
                    data['obstacle_score'] += min(100, int(grade * 100))  # Cap at 100
        
        return graph
        
    except Exception as e:
        print(f"Error creating graph: {e}", file=sys.stderr)
        return None

def serialize_graph(graph):
    """
    Serialize a NetworkX graph to JSON.
    
    Args:
        graph: NetworkX graph
        
    Returns:
        JSON string representation of the graph
    """
    # Convert to node-link format
    data = nx.node_link_data(graph)
    
    # Serialize to JSON
    return json.dumps(data)

def main():
    """
    Main function to create and serialize a graph.
    """
    if len(sys.argv) < 5:
        print("Usage: python create_graph.py <north> <south> <east> <west> [network_type]", file=sys.stderr)
        sys.exit(1)
    
    try:
        north = float(sys.argv[1])
        south = float(sys.argv[2])
        east = float(sys.argv[3])
        west = float(sys.argv[4])
        network_type = sys.argv[5] if len(sys.argv) > 5 else 'walk'
        
        graph = create_graph(north, south, east, west, network_type)
        if graph is None:
            sys.exit(1)
        
        serialized = serialize_graph(graph)
        print(serialized)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 