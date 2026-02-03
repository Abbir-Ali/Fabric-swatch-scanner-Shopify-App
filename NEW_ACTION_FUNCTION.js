// REPLACEMENT FOR api.proxy.$.jsx ACTION FUNCTION
// Replace the entire POST action from line ~107 to ~310

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

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
    
    // Check for GraphQL errors - Shopify returns them in multiple places
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
      e.node.status === "OPEN" || e.node.status === "SCHEDULED" || e.node.status === "ON_HOLD"
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
        // This item is verified, add it to fulfillment
        const verifiedItem = verifiedItems.find(v => v.id === foLineItem.lineItem.id);
        fulfillmentOrderLineItems.push({
          id: foLineItem.id,  // FulfillmentOrderLineItem ID (not LineItem ID!)
          quantity: verifiedItem?.quantity || foLineItem.totalQuantity
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
    
    const isPartialFulfillment = fulfillmentOrderLineItems.length < foLineItems.length;
    console.log(`[Fulfillment] Creating ${isPartialFulfillment ? 'PARTIAL' : 'FULL'} fulfillment for ${fulfillmentOrderLineItems.length} of ${foLineItems.length} items`);
    
    // 3. Create fulfillment using fulfillmentCreate (Shopify recommended approach)
    const fulfillmentResponse = await admin.graphql(
      `#graphql
      mutation CreateFulfillment($fulfillment: FulfillmentV2Input!) {
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
    
    console.log(`[Fulfillment] ${isPartialFulfillment ? 'Partial' : 'Full'} fulfillment created successfully for ${orderId}`);

    // 4. Log it
    const statusLabel = isPartialFulfillment ? "PARTIALLY FULFILLED" : "FULFILLED";
    const itemDetails = isPartialFulfillment 
      ? `${fulfillmentOrderLineItems.length} of ${foLineItems.length} items fulfilled` 
      : `All ${fulfillmentOrderLineItems.length} items fulfilled`;
    
    await createScanLog(shop, {
      orderId,
      status: statusLabel,
      scannedBy: staffData.name,
      staffEmail: staffData.email,
      details: `${statusLabel} via Scanner UI - ${itemDetails}. [${new Date().toLocaleString()}]`
    });

    return json({ 
      success: true, 
      partiallyFulfilled: isPartialFulfillment,
      message: isPartialFulfillment 
        ? `${fulfillmentOrderLineItems.length} items shipped. ${foLineItems.length - fulfillmentOrderLineItems.length} items remaining.`
        : `Order fulfilled successfully! All ${fulfillmentOrderLineItems.length} items shipped.`
    });
  } catch (error) {
    console.error("[Proxy POST Error]", error);
    return json({ success: false, error: error.message });
  }
};
