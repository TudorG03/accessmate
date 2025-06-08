import { Context } from "https://deno.land/x/oak/mod.ts";
import { getFormattedPlaceTypes } from "../../utils/places-api-types.utils.ts";

/**
 * Get all place types with formatted labels
 */
export const getPlaceTypes = async (ctx: Context) => {
  try {
    console.log("🏷️ Type endpoint called - fetching place types...");
    const types = await getFormattedPlaceTypes();
    console.log("🏷️ Fetched place types:", types.length);
    console.log("🏷️ First 3 types:", types.slice(0, 3));

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      types,
    };
    console.log("🏷️ Response sent successfully");
  } catch (error) {
    console.error("❌ Error fetching place types:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Failed to fetch place types",
    };
  }
};
