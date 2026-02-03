import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  console.log("[WEBHOOK] Raw request received at /webhooks/orders/updated");

  try {
    const { shop, topic, payload } = await authenticate.webhook(request);
    console.log(`[WEBHOOK] Verified signature for ${topic} on ${shop}`);
    console.log(`[WEBHOOK] Order ID: ${payload.id}, Fulfillment Status: ${payload.fulfillment_status}`);

    const orderGid = `gid://shopify/Order/${payload.id}`;

    // Handle different fulfillment statuses
    if (payload.fulfillment_status === "partial") {
        // Keep logs active for partially fulfilled orders - they're still in progress
        console.log(`[WEBHOOK] Order ${orderGid} is PARTIALLY FULFILLED - keeping logs active.`);
        
        // Update log status to indicate partial fulfillment
        const updateResult = await db.scanLog.updateMany({
            where: {
                shop,
                orderId: orderGid,
                status: "FULFILLED"
            },
            data: {
                status: "PARTIALLY FULFILLED",
                details: `Partial fulfillment detected via Shopify Sync. Some items shipped. [${new Date().toLocaleString()}]`
            }
        });
        
        console.log(`[WEBHOOK] Result: Updated ${updateResult.count} logs to PARTIALLY FULFILLED for ${orderGid}.`);
    } else if (payload.fulfillment_status === null || payload.fulfillment_status === "" || payload.fulfillment_status === "unfulfilled") {
        console.log(`[WEBHOOK] Action: Order ${orderGid} is being marked as UNFULFILLED in logs.`);
        
        const updateResult = await db.scanLog.updateMany({
            where: {
                shop,
                orderId: orderGid,
                OR: [
                    { status: "FULFILLED" },
                    { status: "PARTIALLY FULFILLED" }
                ]
            },
            data: {
                status: "VOID",
                details: `Auto-voided via Shopify Sync: Order reverted to ${payload.fulfillment_status || 'unfulfilled'} in Admin. [${new Date().toLocaleString()}]`
            }
        });
        
        console.log(`[WEBHOOK] Result: Updated ${updateResult.count} logs for ${orderGid}.`);
    } else {
        console.log(`[WEBHOOK] No action needed for status: ${payload.fulfillment_status}`);
    }

  } catch (error) {
    console.error(`[WEBHOOK ERROR] ${error.message}`);
    // return a 200 to prevent retries if it's a known non-critical error, 
    // but here we might want to know if it fails.
  }

  return new Response();
};
