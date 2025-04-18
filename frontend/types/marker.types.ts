/**
 * Location coordinates for a marker
 */
export type MarkerLocation = {
    latitude: number;
    longitude: number;
};

/**
 * Data structure for creating a new marker
 */
export type MarkerCreate = {
    location: MarkerLocation;
    obstacleType: string;
    obstacleScore?: number;
    description?: string;
    images?: string[];
};

/**
 * Data structure for updating an existing marker
 */
export type MarkerUpdate = Partial<Omit<MarkerCreate, "location">> & {
    location?: MarkerLocation;
};

/**
 * Complete marker data structure as returned from the API
 */
export type Marker = {
    id: string;
    userId: string;
    location: MarkerLocation;
    obstacleType: string;
    obstacleScore: number;
    description?: string;
    images?: string[];
    createdAt: string;
    updatedAt: string;
};

/**
 * Enumeration of obstacle types
 */
export enum ObstacleType {
    STAIRS = "stairs",
    STEEP_RAMP = "steep_ramp",
    NARROW_PASSAGE = "narrow_passage",
    CONSTRUCTION = "construction",
    UNEVEN_SURFACE = "uneven_surface",
    NO_SIDEWALK = "no_sidewalk",
    HIGH_CURB = "high_curb",
    TEMPORARY = "temporary",
    OTHER = "other",
}
