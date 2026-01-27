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
    return { edges: [], pageInfo: null };
  }
}
