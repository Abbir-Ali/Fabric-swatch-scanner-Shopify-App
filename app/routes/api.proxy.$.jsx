import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getFabricInventory, getFabricOrders, getFulfilledFabricOrders, getPartiallyFulfilledOrders } from "../services/order.server";
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
          const settings = await import("../models/settings.server").then(m => m.getAppSettings(shop));
          return json({ data: { valid: true, staff: { 
            ...user, 
            brandLogo: settings.brandLogo,
            showStockTab: settings.showStockTab,
            showOrdersTab: settings.showOrdersTab,
            showHistoryTab: settings.showHistoryTab,
            enableScanButton: settings.enableScanButton,
            enableInventorySearch: settings.enableInventorySearch,
            enableInventorySort: settings.enableInventorySort,
            showStaffManagement: settings.showStaffManagement,
            showLogoutButton: settings.showLogoutButton
          } } });
        }

        // Try staff
        user = await validateStaffAuth(shop, identifier, pin);
        if (user) {
          const settings = await import("../models/settings.server").then(m => m.getAppSettings(shop));
          return json({ data: { valid: true, staff: { 
            ...user, 
            brandLogo: settings.brandLogo,
            showStockTab: settings.showStockTab,
            showOrdersTab: settings.showOrdersTab,
            showHistoryTab: settings.showHistoryTab,
            enableScanButton: settings.enableScanButton,
            enableInventorySearch: settings.enableInventorySearch,
            enableInventorySort: settings.enableInventorySort,
            showStaffManagement: settings.showStaffManagement,
            showLogoutButton: settings.showLogoutButton
          } } });
        }

        return json({ data: { valid: false } });
      }

      case "inventory": {
        const cursor = url.searchParams.get("cursor");
        const query = url.searchParams.get("query") || "";
        const direction = url.searchParams.get("direction") || "next";
        const sortKey = url.searchParams.get("sortKey") || "CREATED_AT";
        const reverse = url.searchParams.get("reverse") === "true";
        
        const result = await getFabricInventory(admin, cursor, { query, sortKey, reverse, direction });
        return json({ data: result });
      }

      case "orders": {
        const cursor = url.searchParams.get("cursor");
        const direction = url.searchParams.get("direction") || "next";
        
        const result = await getFabricOrders(admin, cursor, direction);
        
        // Enhance with log data
        const { getLogsForOrder } = await import("../models/logs.server");
        const enhancedEdges = await Promise.all(result.edges.map(async (edge) => {
          const logs = await getLogsForOrder(shop, edge.node.id);
          return {
            ...edge,
            logs: logs ? logs.map(l => ({ 
              scannedBy: l.scannedBy, 
              staffEmail: l.staffEmail, 
              status: l.status,
              details: l.details,
              timestamp: l.timestamp 
            })) : []
          };
        }));

        return json({ data: { ...result, edges: enhancedEdges } });
      }

      case "fulfilled": {
        const cursor = url.searchParams.get("cursor");
        const direction = url.searchParams.get("direction") || "next";
        
        const result = await getFulfilledFabricOrders(admin, cursor, direction);
        
        // Enhance with log data
        const { getLogForOrder } = await import("../models/logs.server");
        const enhancedEdges = await Promise.all(result.edges.map(async (edge) => {
          const log = await getLogForOrder(shop, edge.node.id);
          return {
            ...edge,
            log: log ? { scannedBy: log.scannedBy, staffEmail: log.staffEmail } : null
          };
        }));

        return json({ data: { ...result, edges: enhancedEdges } });
      }

      case "partial": {
        const cursor = url.searchParams.get("cursor");
        const direction = url.searchParams.get("direction") || "next";
        
        const result = await getPartiallyFulfilledOrders(admin, cursor, direction);
        
        // Enhance with log data
        const { getLogsForOrder } = await import("../models/logs.server");
        const enhancedEdges = await Promise.all(result.edges.map(async (edge) => {
          const logs = await getLogsForOrder(shop, edge.node.id);
          return {
            ...edge,
            logs: logs ? logs.map(l => ({ 
              scannedBy: l.scannedBy, 
              staffEmail: l.staffEmail, 
              status: l.status,
              details: l.details,
              timestamp: l.timestamp 
            })) : []
          };
        }));

        return json({ data: { ...result, edges: enhancedEdges } });
      }

      case "settings": {
        const settings = await import("../models/settings.server").then(m => m.getAppSettings(shop));
        return json({ 
          data: { 
            brandLogo: settings.brandLogo,
            showStockTab: settings.showStockTab,
            showOrdersTab: settings.showOrdersTab,
            showHistoryTab: settings.showHistoryTab,
            enableScanButton: settings.enableScanButton,
            enableInventorySearch: settings.enableInventorySearch,
            enableInventorySort: settings.enableInventorySort,
            showStaffManagement: settings.showStaffManagement,
            showLogoutButton: settings.showLogoutButton
          } 
        });
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
    const { orderId, verifiedItems, staffData } = body;
    console.log(`[Proxy POST] fulfillment, shop: ${shop}, orderId: ${orderId}, verifiedCount: ${verifiedItems?.length}`);

    // 1. Get fulfillment orders and their line items
    const foResponse = await admin.graphql(
      `#graphql
      query getFulfillmentOrders($id: ID!) {
        order(id: $id) {
          fulfillmentOrders(first: 10) {
            edges {
              node {
                id
                status
                lineItems(first: 50) {
                  edges {
                    node {
                      id
                      totalQuantity
                      remainingQuantity
                      lineItem {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { variables: { id: orderId } }
    );
    
    const foData = await foResponse.json();
    
    // Check for GraphQL errors
    if (foData.errors || foData.body?.errors?.graphQLErrors) {
      const errorDetails = foData.errors || foData.body?.errors?.graphQLErrors || [];
      console.error(`[Fulfillment] GraphQL Error:`, JSON.stringify(errorDetails, null, 2));
      
      const errorMessage = Array.isArray(errorDetails) 
        ? errorDetails.map(e => e.message).join(', ')
        : (errorDetails[0]?.message || JSON.stringify(errorDetails));
      
      return json({ 
        success: false, 
        error: `GraphQL Error: ${errorMessage}` 
      });
    }
    
    console.log(`[Fulfillment] FO Data:`, JSON.stringify(foData.data, null, 2));
    
    const fulfillmentOrders = foData.data?.order?.fulfillmentOrders?.edges || [];
    console.log(`[Fulfillment] Found ${fulfillmentOrders.length} fulfillment orders`);
    
    // Try to find an open or scheduled fulfillment order
    const openFO = fulfillmentOrders.find(e => 
      e.node.status === "OPEN" || e.node.status === "SCHEDULED" || e.node.status === "ON_HOLD" || e.node.status === "IN_PROGRESS"
    );

    if (!openFO) {
      const availableStatuses = fulfillmentOrders.map(e => `${e.node.status} (${e.node.id})`).join(', ');
      console.error(`[Fulfillment] No fulfillable FO found. Available statuses: ${availableStatuses}`);
      return json({ 
        success: false, 
        error: `No fulfillable orders found. Statuses: ${availableStatuses || 'none'}` 
      });
    }

    const foNode = openFO.node;
    const foLineItems = foNode.lineItems.edges.map(e => e.node);
    console.log(`[Fulfillment] Using FO ${foNode.id} with status ${foNode.status}. Line items: ${foLineItems.length}`);
    
    // 2. Build fulfillmentOrderLineItems array for items to fulfill
    const verifiedItemIds = (verifiedItems || []).map(item => item.id);
    const fulfillmentOrderLineItems = [];
    
    foLineItems.forEach(foLineItem => {
      if (verifiedItemIds.includes(foLineItem.lineItem.id)) {
        const verifiedItem = verifiedItems.find(v => v.id === foLineItem.lineItem.id);
        fulfillmentOrderLineItems.push({
          id: foLineItem.id,
          quantity: Math.min(verifiedItem?.quantity || foLineItem.remainingQuantity, foLineItem.remainingQuantity)
        });
      }
    });
    
    if (fulfillmentOrderLineItems.length === 0) {
      console.error(`[Fulfillment] No matching fulfillment order line items found`);
      return json({ 
        success: false, 
        error: "No items to fulfill - verified items don't match fulfillment order" 
      });
    }
    
    const isPartialFulfillment = fulfillmentOrderLineItems.length < foLineItems.filter(i => i.remainingQuantity > 0).length;
    
    // Calculate precise quantities for the success message
    const totalRemainingBefore = foLineItems.reduce((acc, item) => acc + item.remainingQuantity, 0);
    const fulfilledNowCount = fulfillmentOrderLineItems.reduce((acc, item) => acc + item.quantity, 0);
    const totalRemainingAfter = Math.max(0, totalRemainingBefore - fulfilledNowCount);

    console.log(`[Fulfillment] Before: ${totalRemainingBefore}, Fulfilled: ${fulfilledNowCount}, Remaining: ${totalRemainingAfter}`);
    console.log(`[Fulfillment] Creating ${totalRemainingAfter > 0 ? 'PARTIAL' : 'FULL'} fulfillment for ${fulfillmentOrderLineItems.length} line items`);
    
    // 3. Create fulfillment using fulfillmentCreate (Shopify recommended)
    const fulfillmentResponse = await admin.graphql(
      `#graphql
      mutation CreateFulfillment($fulfillment: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
          fulfillment {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          fulfillment: {
            notifyCustomer: false,
            lineItemsByFulfillmentOrder: [
              {
                fulfillmentOrderId: foNode.id,
                fulfillmentOrderLineItems: fulfillmentOrderLineItems
              }
            ]
          }
        }
      }
    );

    const fulfillmentData = await fulfillmentResponse.json();
    console.log(`[Fulfillment] Create response:`, JSON.stringify(fulfillmentData, null, 2));
    
    if (fulfillmentData.data?.fulfillmentCreate?.userErrors?.length > 0) {
      const errorMsg = fulfillmentData.data.fulfillmentCreate.userErrors[0].message;
      console.error(`[Fulfillment] Create failed: ${errorMsg}`);
      return json({ 
        success: false, 
        error: `Unable to create fulfillment: ${errorMsg}` 
      });
    }
    
    console.log(`[Fulfillment] ${totalRemainingAfter > 0 ? 'Partial' : 'Full'} fulfillment created successfully for ${orderId}`);

    // 4. Log it
    const statusLabel = totalRemainingAfter > 0 ? "PARTIALLY FULFILLED" : "FULFILLED";
    const itemDetails = totalRemainingAfter > 0 
      ? `${fulfilledNowCount} items shipped. ${totalRemainingAfter} items remaining.` 
      : `All items fulfilled (${fulfilledNowCount} in this batch)`;
    
    // Store fulfilled item IDs in a metadata tag within details for per-item attribution
    const itemIdsMeta = `[ITEMS:${verifiedItemIds.join(',')}]`;
    
    await createScanLog(shop, {
      orderId,
      status: statusLabel,
      scannedBy: staffData.name,
      staffEmail: staffData.email,
      details: `${itemIdsMeta} ${statusLabel} via Scanner UI - ${itemDetails}. [${new Date().toLocaleString()}]`
    });

    return json({ 
      success: true, 
      partiallyFulfilled: totalRemainingAfter > 0,
      message: totalRemainingAfter > 0 
        ? `${fulfilledNowCount} items shipped. ${totalRemainingAfter} items remaining.`
        : `Order fulfilled successfully! All ${fulfilledNowCount} items in this batch shipped.`
    });
  } catch (error) {
    console.error("[Proxy POST Error]", error);
    return json({ success: false, error: error.message });
  }
};
