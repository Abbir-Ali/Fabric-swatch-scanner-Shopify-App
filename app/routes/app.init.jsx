import { authenticate } from "../shopify.server";
import { getAppSettings } from "../models/settings.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  // Ensure settings exist
  const settings = await getAppSettings(session.shop);
  
  return json({ 
    initialized: true,
    adminName: settings.adminName,
    hasPin: !!settings.adminPin
  });
};
