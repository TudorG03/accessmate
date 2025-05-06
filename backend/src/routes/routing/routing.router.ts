import { Router } from "https://deno.land/x/oak/mod.ts";
import routingController from "./routing.controller.ts";

const router = new Router();

/**
 * @route POST /api/routing/accessible-route
 * @description Find an accessible route between two points
 * @access Public
 */
router.post("/accessible-route", routingController.findAccessibleRoute);

/**
 * @route GET /api/routing/obstacles
 * @description Get obstacles within a bounding box
 * @access Public
 */
router.get("/obstacles", routingController.getObstaclesInBoundingBox);

export default router;
