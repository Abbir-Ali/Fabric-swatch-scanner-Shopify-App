
/**
 * Shopify Inventory Service
 * Handles individual and bulk inventory updates
 */

/**
 * Adjusts inventory level by balanced amount (e.g. +5 or -3)
 * @param {Object} admin - Shopify Admin API instance
 * @param {String} inventoryItemId - GID of the inventory item
 * @param {String} locationId - GID of the location
 * @param {Number} delta - Amount to adjust by
 */
export async function adjustInventory(admin, inventoryItemId, locationId, delta) {
  console.log(`[INVENTORY] Adjusting: Item=${inventoryItemId}, Location=${locationId}, Delta=${delta}`);
  
  const response = await admin.graphql(
    `#graphql
    mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        inventoryAdjustmentGroup {
          createdAt
          reason
          changes {
            name
            delta
            quantityAfterChange
          }
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        input: {
          reason: "correction",
          name: "available",
          changes: [
            {
              delta: parseInt(delta, 10),
              inventoryItemId: inventoryItemId,
              locationId: locationId
            }
          ]
        }
      }
    }
  );

  // TEMP: log raw body for Shopify Assistant
  const rawBody = await response.clone().text();
  console.log("RAW GRAPHQL RESPONSE (adjust):", rawBody);

  const resData = await response.json();
  console.log(`[INVENTORY] Response:`, JSON.stringify(resData, null, 2));

  if (resData.errors) {
    console.error(`[INVENTORY] GraphQL Errors:`, resData.errors);
    throw new Error(resData.errors[0].message);
  }
  
  const userErrors = resData.data?.inventoryAdjustQuantities?.userErrors || [];
  if (userErrors.length > 0) {
    console.error(`[INVENTORY] User Errors:`, userErrors);
    throw new Error(userErrors[0].message);
  }

  const group = resData.data.inventoryAdjustQuantities.inventoryAdjustmentGroup;
  const change = group?.changes?.find(c => c.name === "available");
  console.log(`[INVENTORY] Success: New available=${change?.quantityAfterChange}`);
  
  // Follow-up check as requested by Assistant
  try {
    await checkInventoryState(admin, inventoryItemId);
  } catch (e) {
    console.error("[INVENTORY] Check failed:", e);
  }

  return group;
}

/**
 * Debug helper to log the state of an inventory item across all locations
 */
async function checkInventoryState(admin, inventoryItemId) {
  const res = await admin.graphql(
    `#graphql
    query GetInventoryByItem($inventoryItemId: ID!) {
      inventoryItem(id: $inventoryItemId) {
        id
        inventoryLevels(first: 20) {
          edges {
            node {
              id
              location { id name }
              quantities(names: ["available"]) {
                name
                quantity
              }
            }
          }
        }
      }
    }`,
    { variables: { inventoryItemId } }
  );

  const body = await res.text();
  console.log("RAW GRAPHQL RESPONSE (check):", body);
}

/**
 * Sets inventory level to an absolute value
 */
export async function setInventory(admin, inventoryItemId, locationId, quantity) {
  const response = await admin.graphql(
    `#graphql
    mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        inventoryAdjustmentGroup {
          createdAt
          reason
          changes {
            name
            delta
            quantityAfterChange
          }
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        input: {
          reason: "correction",
          name: "available",
          quantities: [
            {
              quantity: parseInt(quantity, 10),
              inventoryItemId: inventoryItemId,
              locationId: locationId
            }
          ]
        }
      }
    }
  );

  // TEMP: log raw body for Shopify Assistant
  const rawBody = await response.clone().text();
  console.log("RAW GRAPHQL RESPONSE (set):", rawBody);

  const resData = await response.json();
  if (resData.errors) throw new Error(resData.errors[0].message);
  
  const userErrors = resData.data?.inventorySetQuantities?.userErrors || [];
  if (userErrors.length > 0) throw new Error(userErrors[0].message);

  const group = resData.data.inventorySetQuantities.inventoryAdjustmentGroup;
  try {
    await checkInventoryState(admin, inventoryItemId);
  } catch (e) {}

  return group;
}
