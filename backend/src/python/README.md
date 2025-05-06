# Accessible Routing Python Scripts

These Python scripts provide the backbone for the AccessMate application's
accessible routing capabilities. They use OpenStreetMap data through the OSMNX
library to create and analyze road networks that are optimized for
accessibility.

## Files

- `create_graph.py`: Creates a graph from OpenStreetMap data for a specific
  region
- `find_route.py`: Finds an accessible route between two points, avoiding
  obstacles
- `requirements.txt`: Lists the required Python dependencies

## Setup

1. Install Python 3.8 or newer
2. Install required dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

These scripts are meant to be called from the Node.js backend using the
`child_process` module. They accept parameters and return serialized data via
stdout.

### create_graph.py

Creates a graph from OpenStreetMap data for a specific region.

```
python create_graph.py <north> <south> <east> <west> [network_type]
```

Parameters:

- `north`, `south`, `east`, `west`: Bounding box coordinates
- `network_type` (optional): Type of network to extract ('walk', 'drive', etc.)

Returns:

- JSON string representation of the graph

### find_route.py

Finds an accessible route between two points, considering obstacles and user
preferences.

```
python find_route.py <graph_json> <origin_lat> <origin_lng> <dest_lat> <dest_lng> [obstacles_json] [preferences_json]
```

Parameters:

- `graph_json`: JSON string representation of the graph
- `origin_lat`, `origin_lng`: Origin coordinates
- `dest_lat`, `dest_lng`: Destination coordinates
- `obstacles_json` (optional): JSON string representation of obstacles
- `preferences_json` (optional): JSON string representation of user preferences

Returns:

- JSON object containing the route information

## Accessibility Features

These scripts analyze OpenStreetMap data for accessibility features, including:

1. **Stairs detection**: Identifies and penalizes stairs in the route
2. **Slope analysis**: Calculates and penalizes steep slopes
3. **Width consideration**: Considers path width for wheelchair accessibility
4. **Surface quality**: Analyzes surface type and quality
5. **Lighting conditions**: Considers lighting for safety
6. **Obstacle avoidance**: Routes around user-reported obstacles

## Integration

The backend service in `graph.service.ts` interacts with these scripts to
provide accessible routing functionality to the frontend application.
