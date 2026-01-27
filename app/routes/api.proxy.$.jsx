import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getFabricInventory, getFabricOrders, getFulfilledFabricOrders } from "../services/order.server";
import { validateAdminAuth, validateStaffAuth } from "../models/settings.server";
import { createScanLog } from "../models/logs.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.public.appProxy(request);
  const { shop } = session;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  console.log(`[Proxy GET] type: ${type}, shop: ${shop}`);

  try {
    switch (type) {
      case "auth": {
        const identifier = url.searchParams.get("identifier");
        const pin = url.searchParams.get("pin");

        // Try admin first
        let user = await validateAdminAuth(shop, identifier, pin);
        if (user) {
          return json({ data: { valid: true, staff: user } });
        }

        // Try staff
        user = await validateStaffAuth(shop, identifier, pin);
        if (user) {
          return json({ data: { valid: true, staff: user } });
        }

        return json({ data: { valid: false } });
      }

      case "inventory": {
        const cursor = url.searchParams.get("cursor");
        const direction = url.searchParams.get("direction") || "next";
        const sortKey = url.searchParams.get("sortKey") || "CREATED_AT";
        const reverse = url.searchParams.get("reverse") === "true";
        
        const result = await getFabricInventory(admin, cursor, { sortKey, reverse, direction });
        return json({ data: result });
      }

      case "orders": {
        const cursor = url.searchParams.get("cursor");
        const direction = url.searchParams.get("direction") || "next";
        
        const result = await getFabricOrders(admin, cursor, direction);
        return json({ data: result });
      }

      case "fulfilled": {
        const cursor = url.searchParams.get("cursor");
        const direction = url.searchParams.get("direction") || "next";
        
        const result = await getFulfilledFabricOrders(admin, cursor, direction);
        return json({ data: result });
      }

      default:
        return json({ error: "Unknown type" }, { status: 400 });
    }
  } catch (error) {
    console.error(`Proxy Loader Error (${type}):`, error);
    return json({ error: error.message }, { status: 500 });
  }
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.public.appProxy(request);
  const { shop } = session;

  try {
    const body = await request.json();
    const { orderId, staffData } = body;

    console.log(`[Proxy POST] fulfillment, shop: ${shop}, orderId: ${orderId}`);

    // 1. Get fulfillment orders
    const foResponse = await admin.graphql(
      `#graphql
      query getFulfillmentOrders($id: ID!) {
        order(id: $id) {
          fulfillmentOrders(first: 10) {
            edges {
              node {
                id
                status
              }
            }
          }
        }
      }`,
      { variables: { id: orderId } }
    );
    
    const foData = await foResponse.json();
    const openFO = foData.data?.order?.fulfillmentOrders?.edges.find(e => e.node.status === "OPEN");

    if (!openFO) {
      return json({ success: false, error: "No open fulfillment order found" });
    }

    // 2. Create fulfillment
    const fv2Response = await admin.graphql(
      `#graphql
      mutation fulfillmentCreateV2($id: ID!) {
        fulfillmentCreateV2(fulfillment: { lineItemsByFulfillmentOrder: [{ fulfillmentOrderId: $id }] }) {
          fulfillment { id }
          userErrors { field message }
        }
      }`,
      { variables: { id: openFO.node.id } }
    );

    const fv2Data = await fv2Response.json();
    if (fv2Data.data?.fulfillmentCreateV2?.userErrors?.length > 0) {
      return json({ success: false, error: fv2Data.data.fulfillmentCreateV2.userErrors[0].message });
    }

    // 3. Log it
    console.log('[FULFILLMENT] Staff data received:', staffData);
    console.log('[FULFILLMENT] Creating scan log with:', {
      orderId,
      status: "FULFILLED",
      scannedBy: staffData.name,
      staffEmail: staffData.email,
    });
    
    await createScanLog(shop, {
      orderId,
      status: "FULFILLED",
      scannedBy: staffData.name,
      staffEmail: staffData.email,
      details: "Fulfillment via Scanner UI"
    });

    return json({ success: true });
  } catch (error) {
    console.error("Proxy Action Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};
