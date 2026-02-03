# Partial Fulfillment Fix

## New Approach (Shopify Recommended)

Instead of splitting the fulfillment order and then fulfilling, we use the direct approach:

### Key Changes:
1. **No splitting needed** - `fulfillmentCreate` can handle partial fulfillment directly
2. **Pass specific line items** - Use `fulfillmentOrderLineItems` array with `id` and `quantity`
3. **Simpler logic** - One mutation instead of split + fulfill

### Implementation:

```javascript
// Build fulfillmentOrderLineItems array  
const verifiedItemIds = (verifiedItems || []).map(item => item.id);
const fulfillmentOrderLineItems = [];

foLineItems.forEach(foLineItem => {
  if (verifiedItemIds.includes(foLineItem.lineItem.id)) {
    const verifiedItem = verifiedItems.find(v => v.id === foLineItem.lineItem.id);
    fulfillmentOrderLineItems.push({
      id: foLineItem.id,  // FulfillmentOrderLineItem ID
      quantity: verifiedItem?.quantity || foLineItem.totalQuantity
    });
  }
});

// Create fulfillment
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
```

## What to Replace

Replace lines 182-281 in `api.proxy.$.jsx` with this simpler approach.
