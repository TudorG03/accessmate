import { Context } from "https://deno.land/x/oak/mod.ts";
import { getFormattedPlaceTypes } from "../../utils/places-api-types.utils.ts";

/**
 * Get all place types with formatted labels
 */
export const getPlaceTypes = async (ctx: Context) => {
  try {
    const types = await getFormattedPlaceTypes();

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      types,
    };
  } catch (error) {
    console.error("Error fetching place types:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Failed to fetch place types",
    };
  }
};
