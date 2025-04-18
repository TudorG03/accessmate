import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import logger from "https://deno.land/x/oak_logger/mod.ts";
import routerAuth from "./routes/auth/auth.router.ts";
import routerMarker from "./routes/marker/marker.router.ts";

const app = new Application();

// Middleware
app.use(oakCors());
app.use(logger.logger);
app.use(logger.responseTime);

// Main Router
const mainRouter = new Router();
mainRouter
  .get("/", (ctx) => {
    ctx.response.body = "Default Oak endpoint!";
  })
  .use("/auth", routerAuth.routes())
  .use("/api/markings", routerMarker.routes());

// Apply routers
app.use(mainRouter.routes());
app.use(mainRouter.allowedMethods());

export default app;
