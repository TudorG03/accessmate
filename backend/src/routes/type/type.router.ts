import { Router } from "https://deno.land/x/oak/mod.ts";
import { getPlaceTypes } from "./type.controller.ts";

const router = new Router();

// GET - Retrieve all place types
router.get("/", getPlaceTypes);

export default router;
