import { Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";

/**
 * Extract data from request body
 * @param ctx Oak context
 * @returns Parsed request body data
 */
export const getDataFromBody = async (ctx: Context): Promise<any> => {
  try {
    if (!ctx.request.hasBody) {
      return {};
    }

    return await ctx.request.body.json();
  } catch (error) {
    console.error("Error parsing request body:", error);
    return {};
  }
};
