import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import logger from "https://deno.land/x/oak_logger/mod.ts";
import routerAuth from "./routes/auth/auth.router.ts";
import routerMarker from "./routes/marker/marker.router.ts";
import routerRouting from "./routes/routing/routing.router.ts";
import routerReview from "./routes/review/review.router.ts";
import routerNavigationHistory from "./routes/history/navigation-history.router.ts";
import routerType from "./routes/type/type.router.ts";
import routerRecommendation from "./routes/recommendation/recommendation.router.ts";

const app = new Application();

// CORS middleware
app.use(oakCors({
  origin: [
    "http://localhost:3000",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "https://accessmate.app",
    "exp://localhost:8081",
  ],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

app.use(logger.logger);
app.use(logger.responseTime);

// Main Router
const mainRouter = new Router();
mainRouter
  .get("/", (ctx) => {
    ctx.response.body = "Default Oak endpoint!";
  })
  .use("/auth", routerAuth.routes())
  .use("/api/markers", routerMarker.routes())
  .use("/api/routing", routerRouting.routes())
  .use("/api/reviews", routerReview.routes())
  .use("/api/navigation-history", routerNavigationHistory.routes())
  .use("/api/type", routerType.routes())
  .use("/api/recommendations", routerRecommendation.routes());

// Apply routers
app.use(mainRouter.routes());
app.use(mainRouter.allowedMethods());

export default app;
