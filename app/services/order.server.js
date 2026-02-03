export async function getFabricOrders(admin, cursor = null, direction = "next") {
  try {
    const paginationArgs = direction === "prev" ? `last: 10, before: "${cursor}"` : `first: 10, after: ${cursor ? `"${cursor}"` : "null"}`;
    const response = await admin.graphql(
      `#graphql
        query getFabricOrders($query: String) {
          orders(${paginationArgs}, reverse: true, query: $query) {
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            edges {
              node {
                id
                name
                createdAt
                displayFinancialStatus
                totalPriceSet { shopMoney { amount currencyCode } }
                subtotalPriceSet { shopMoney { amount } }
                totalTaxSet { shopMoney { amount } }
                shippingLine { title originalPriceSet { shopMoney { amount } } }
                shippingAddress { name address1 city zip provinceCode country }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      sku
                      originalUnitPriceSet { shopMoney { amount } }
                      variant {
                        barcode
                        sku
                        product {
                          productType
                          featuredImage { url }
                          metafields(first: 10) {
                            edges {
                              node {
                                namespace
                                key
                                value
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
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
                              title
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
      { variables: { query: "fulfillment_status:unfulfilled AND tag:swatch-only" } }
    );
    const responseJson = await response.json();
    return {
      edges: responseJson.data?.orders?.edges || [],
      pageInfo: responseJson.data?.orders?.pageInfo
    };
  } catch (error) {
    console.error("Unfulfilled Service Error:", error);
    return { edges: [], pageInfo: null };
  }
}

export async function getFulfilledFabricOrders(admin, cursor = null, direction = "next") {
  try {
    const paginationArgs = direction === "prev" ? `last: 10, before: "${cursor}"` : `first: 10, after: ${cursor ? `"${cursor}"` : "null"}`;
    const response = await admin.graphql(
      `#graphql
        query getFulfilledOrders {
          orders(${paginationArgs}, reverse: true, query: "fulfillment_status:fulfilled AND tag:swatch-only") {
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            edges {
              node {
                id
                name
                updatedAt
                displayFinancialStatus
                totalPriceSet { shopMoney { amount currencyCode } }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      sku
                      variant {
                         barcode
                         product { featuredImage { url } }
                      }
                    }
                  }
                }
              }
            }
          }
        }`
    );
    const responseJson = await response.json();
    return {
      edges: responseJson.data?.orders?.edges || [],
      pageInfo: responseJson.data?.orders?.pageInfo
    };
  } catch (error) {
    console.error("Fulfilled Service Error:", error);
    return { edges: [], pageInfo: null };
  }
}

export async function getFabricInventory(admin, cursor = null, { sortKey = "ID", reverse = false, direction = "next" } = {}) {
  try {
    const finalQuery = 'product_type:"Swatch Item"';

    const paginationArgs = direction === "prev" ? `last: 10, before: "${cursor}"` : `first: 10, after: ${cursor ? `"${cursor}"` : "null"}`;

    const response = await admin.graphql(
      `#graphql
      query getInventory($query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
        products(${paginationArgs}, query: $query, sortKey: $sortKey, reverse: $reverse) {
          pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
          edges {
            node {
              id
              legacyResourceId
              title
              description
              totalInventory
              featuredImage { url }
              metafields(first: 10) {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    sku
                    barcode
                  }
                }
              }
            }
          }
        }
      }`,
      { 
        variables: { 
          query: finalQuery,
          sortKey,
          reverse
        } 
      }
    );
    const resJson = await response.json();
    return {
      edges: resJson.data?.products?.edges || [],
      pageInfo: resJson.data?.products?.pageInfo
    };
  } catch (error) {
    console.error("Inventory Service Error:", error);
    return { edges: [], pageInfo: null, error: error.message };
  }
}
export async function getPartiallyFulfilledOrders(admin, cursor = null, direction = "next") {
  try {
    const paginationArgs = direction === "prev" ? `last: 10, before: "${cursor}"` : `first: 10, after: ${cursor ? `"${cursor}"` : "null"}`;
    const response = await admin.graphql(
      `#graphql
        query getPartiallyFulfilledOrders {
          orders(${paginationArgs}, reverse: true, query: "fulfillment_status:partial AND tag:swatch-only") {
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            edges {
              node {
                id
                name
                createdAt
                updatedAt
                displayFinancialStatus
                totalPriceSet { shopMoney { amount currencyCode } }
                lineItems(first: 50) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      sku
                      variant {
                        barcode
                        sku
                        product {
                          productType
                          featuredImage { url }
                          metafields(first: 10) {
                            edges {
                              node {
                                namespace
                                key
                                value
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
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
                              title
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`
    );
    const responseJson = await response.json();
    return {
      edges: responseJson.data?.orders?.edges || [],
      pageInfo: responseJson.data?.orders?.pageInfo
    };
  } catch (error) {
    console.error("Partially Fulfilled Service Error:", error);
    return { edges: [], pageInfo: null };
  }
}

export async function getFulfilledOrdersCount(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
        query getFulfilledCount {
          orders(first: 1, query: "fulfillment_status:fulfilled AND tag:swatch-only") {
             nodes { id }
          }
        }`
    );
    const resJson = await response.json();
    // In Shopify GraphQL, the total count is available if you request it via connection, 
    // but the simplest way here is to use the nodes count or a dedicated count query if allowed.
    // However, the standard way is to use the query above.
    // To get the ACTUAL total count efficiently:
    const countResponse = await admin.graphql(
      `#graphql
      query getCount {
        ordersCount(query: "fulfillment_status:fulfilled AND tag:swatch-only") {
          count
        }
      }`
    );
    const countData = await countResponse.json();
    return countData.data?.ordersCount?.count || 0;
  } catch (error) {
    console.error("Fulfilled Count Error:", error);
    return 0;
  }
}

export async function getShopLocations(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
      query getLocations {
        locations(first: 5) {
          nodes {
            id
            name
          }
        }
      }`
    );
    const resJson = await response.json();
    return resJson.data?.locations?.nodes || [];
  } catch (error) {
    console.error("Get Locations Error:", error);
    return [];
  }
}
