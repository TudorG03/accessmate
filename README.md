# AccessMate

**Empowering Movement. Enhancing Independence. Creating Impact.**

AccessMate is an accessibility-first mobile application designed to support individuals with mobility impairments, particularly wheelchair users. It provides smart navigation, accessibility reviews, and personalized activity recommendations based on user needs and real-time data.

---

## 🌟 Features

- 🔍 **Accessible Navigation**: Find the most wheelchair-friendly routes using crowd-sourced data and elevation-aware pathfinding.
- 🗺️ **Map View**: View accessible locations, ramps, elevators, and hazard areas in your city.
- 📝 **Accessibility Reviews**: Rate and review locations based on detailed accessibility criteria (e.g. entrance width, bathroom access, step-free access).
- 🎯 **Activity Recommendations**: Get custom suggestions for accessible places and events based on your preferences, location, and accessibility needs.
- 🧠 **AI-Powered Engine**: Uses machine learning for personalized recommendations and real-time accessibility scoring.
- 🔐 **Authentication & Roles**: Secure login system with JWT-based authentication, user roles (admin, user, staff), and protected routes.
- 🌗 **Dark/Light Mode Support**

---

## 🚀 Tech Stack

| Layer       | Technology               |
|-------------|---------------------------|
| Frontend    | React Native + Expo       |
| State Mgmt  | Zustand + MMKV            |
| Backend     | Deno + Oak         |
| Database    | MongoDB (Mongoose ODM)    |
| Auth        | JWT (Access & Refresh)    |
| ML / AI     | Content Based Filtering Recommendation System |
| Navigation  | Expo Router               |
| Maps        | OpenStreetMap API / Google Maps API  |
