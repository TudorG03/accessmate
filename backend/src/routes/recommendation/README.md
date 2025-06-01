# Recommendation API Endpoints

This document describes the recommendation API endpoints that expose the machine learning-based recommendation system capabilities.

## Base URL
All recommendation endpoints are under: `/api/recommendations`

## Authentication
All endpoints require authentication using the `authMiddleware`. Include the authorization token in the request headers.

## Endpoints

### 1. Get Personalized Recommendations

**GET** `/api/recommendations/user/:userId`

Get personalized place recommendations for a user based on their location and preferences.

#### Parameters
- `userId` (path) - User ID (MongoDB ObjectId format)
- `latitude` (query, required) - User's current latitude (-90 to 90)
- `longitude` (query, required) - User's current longitude (-180 to 180)
- `radius` (query, optional) - Search radius in meters (100-50000, default: 5000)
- `maxResults` (query, optional) - Maximum number of recommendations (1-50, default: 20)
- `searchQuery` (query, optional) - Text search query to filter places
- `categories` (query, optional) - Comma-separated list of place categories to filter by
- `forceRefresh` (query, optional) - Force cache refresh (true/false, default: false)
- `deviceType` (query, optional) - Device type (mobile/tablet/desktop)
- `sessionId` (query, optional) - Session identifier for tracking
- `diversityBoost` (query, optional) - Diversity boost factor (0-1, default: 0.1)
- `qualityWeight` (query, optional) - Quality weight factor (0-1, default: 0.3)
- `temporalWeight` (query, optional) - Temporal weight factor (0-1, default: 0.2)
- `locationWeight` (query, optional) - Location weight factor (0-1, default: 0.3)
- `includeExplanations` (query, optional) - Include explanation texts (true/false, default: false)

#### Example Request
```
GET /api/recommendations/user/507f1f77bcf86cd799439011?latitude=40.7589&longitude=-73.9851&radius=2000&maxResults=10&includeExplanations=true
```

#### Response
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
        "placeName": "Google Sydney",
        "placeTypes": ["point_of_interest", "establishment"],
        "location": {
          "type": "Point",
          "coordinates": [-73.9851, 40.7589]
        },
        "score": 0.85,
        "reasoning": ["High rating match", "Frequently visited category"],
        "metadata": {
          "distance": 150,
          "matchedCategories": ["technology_company"],
          "temporalCompatibility": 0.8
        },
        "scoreBreakdown": {
          "categoryScore": 0.9,
          "locationScore": 0.8,
          "temporalScore": 0.7,
          "qualityScore": 0.9,
          "contextBonus": 0.1
        }
      }
    ],
    "metadata": {
      "fromCache": false,
      "cacheKey": "user_507f1f77bcf86cd799439011_40.7589_-73.9851_2000_1640995200",
      "executionTime": 1250,
      "userProfileAge": 2,
      "totalCandidates": 45,
      "userStats": {
        "totalVisits": 120,
        "profileCompleteness": 0.75,
        "topCategories": ["restaurant", "cafe", "gym"],
        "recommendationHistory": 15
      }
    }
  }
}
```

### 2. Get Recommendation Analytics

**GET** `/api/recommendations/user/:userId/analytics`

Get analytics and statistics about a user's recommendation system usage.

#### Parameters
- `userId` (path) - User ID (MongoDB ObjectId format)

#### Response
```json
{
  "success": true,
  "data": {
    "totalRecommendations": 42,
    "cachingEfficiency": 0.75,
    "averageExecutionTime": 1500,
    "feedbackStats": {
      "totalFeedback": 28,
      "positiveRate": 0.6,
      "engagementRate": 0.8
    },
    "profileStats": {
      "completeness": 0.75,
      "lastUpdated": "2023-12-01T10:30:00Z",
      "totalVisits": 120,
      "categoryDiversity": 12
    }
  }
}
```

### 3. Get Recommendation History

**GET** `/api/recommendations/user/:userId/history`

Get a user's recommendation cache history.

#### Parameters
- `userId` (path) - User ID (MongoDB ObjectId format)
- `limit` (query, optional) - Number of records to return (1-100, default: 20)
- `offset` (query, optional) - Number of records to skip (default: 0)
- `includeExpired` (query, optional) - Include expired cache entries (true/false, default: false)

#### Response
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "cacheKey": "user_507f1f77bcf86cd799439011_40.7589_-73.9851_5000_1640995200",
        "generatedAt": "2023-12-01T10:30:00Z",
        "expiresAt": "2023-12-01T11:00:00Z",
        "hitCount": 3,
        "lastAccessed": "2023-12-01T10:45:00Z",
        "requestContext": {
          "userLocation": {
            "type": "Point",
            "coordinates": [-73.9851, 40.7589]
          },
          "radius": 5000,
          "timestamp": "2023-12-01T10:30:00Z",
          "timeOfDay": 10,
          "dayOfWeek": 5
        }
      }
    ],
    "pagination": {
      "total": 15,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### 4. Record Recommendation Feedback

**POST** `/api/recommendations/feedback`

Record user feedback on recommendations to improve future suggestions.

#### Request Body
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "placeName": "Google Sydney",
  "placeTypes": ["point_of_interest", "establishment"],
  "action": "visited",
  "feedback": {
    "explicit": {
      "rating": 5,
      "liked": true,
      "comment": "Great place to work!"
    },
    "implicit": {
      "dwellTime": 300,
      "clickDepth": 3,
      "sessionPosition": 1
    }
  },
  "context": {
    "userLocation": {
      "longitude": -73.9851,
      "latitude": 40.7589
    },
    "timestamp": "2023-12-01T10:30:00Z",
    "timeOfDay": 10,
    "dayOfWeek": 5,
    "deviceType": "mobile",
    "sessionId": "session_123456"
  },
  "outcome": {
    "actualVisit": {
      "confirmed": true,
      "visitDuration": 120,
      "followUpActions": ["review", "photo"]
    },
    "satisfaction": {
      "score": 5,
      "wouldRecommend": true
    }
  },
  "metadata": {
    "recommendationScore": 0.85,
    "recommendationReasoning": ["High rating match", "Frequently visited category"]
  },
  "recommendationId": "507f1f77bcf86cd799439013"
}
```

#### Response
```json
{
  "success": true,
  "message": "Recommendation feedback recorded successfully",
  "feedbackId": "507f1f77bcf86cd799439014"
}
```

### 5. Clear Recommendation Cache

**DELETE** `/api/recommendations/user/:userId/cache`

Clear all cached recommendations for a user. This forces fresh recommendations on the next request.

#### Parameters
- `userId` (path) - User ID (MongoDB ObjectId format)

#### Response
```json
{
  "success": true,
  "message": "Recommendation cache cleared successfully",
  "deletedCount": 8,
  "userId": "507f1f77bcf86cd799439011"
}
```

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (in development mode)"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing or invalid auth token)
- `404` - Not Found (user not found)
- `500` - Internal Server Error

## Notes

1. **Authentication**: All endpoints require a valid authentication token.
2. **Rate Limiting**: Consider implementing rate limiting for the recommendations endpoint to prevent abuse.
3. **Caching**: Recommendations are automatically cached for 30 minutes to improve performance.
4. **Performance**: Large radius values or high maxResults may impact response time.
5. **Privacy**: User location data is used only for generating recommendations and is not stored permanently.
6. **Feedback Learning**: The system continuously learns from user feedback to improve recommendation quality. 