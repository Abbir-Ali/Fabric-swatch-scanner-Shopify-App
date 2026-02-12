import { useLoaderData, useNavigate, useSearchParams, useRevalidator } from "@remix-run/react";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import { getFabricOrders, getFulfilledFabricOrders, getPartiallyFulfilledOrders, getFulfilledOrdersCount } from "../services/order.server"; 
import BarcodeImage from "../components/BarcodeImage";

// Components
import { Page, Layout, Card, BlockStack, Text, InlineGrid, Collapsible, Button, Badge, InlineStack, Thumbnail, Pagination, Icon } from "@shopify/polaris"; 
import { ChevronDownIcon, ChevronUpIcon, PersonIcon } from "@shopify/polaris-icons";
import { useState } from "react";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { getDashboardStats, getLogsForOrder } = await import("../models/logs.server");
  const { getAppSettings } = await import("../models/settings.server");
  const { default: shopify } = await import("../shopify.server");
  const url = new URL(request.url);

  // Ensure webhooks are registered for this shop
  try {
     await shopify.registerWebhooks({ session });
  } catch (e) {
     console.error("Webhook Registration Error:", e);
  }
  
  const pendingCursor = url.searchParams.get("pendingCursor");
  const pendingDir = url.searchParams.get("pendingDir") || "next";
  const partialCursor = url.searchParams.get("partialCursor");
  const partialDir = url.searchParams.get("partialDir") || "next";
  const fulfilledCursor = url.searchParams.get("fulfilledCursor");
  const fulfilledDir = url.searchParams.get("fulfilledDir") || "next";

  const [pendingData, partialData, fulfilledData, stats, liveFulfilledCount, settings] = await Promise.all([
    getFabricOrders(admin, pendingCursor, pendingDir),
    getPartiallyFulfilledOrders(admin, partialCursor, partialDir),
    getFulfilledFabricOrders(admin, fulfilledCursor, fulfilledDir),
    getDashboardStats(session.shop),
    getFulfilledOrdersCount(admin),
    getAppSettings(session.shop)
  ]);

  const partialWithLogs = await Promise.all(partialData.edges.map(async (edge) => {
    const logs = await getLogsForOrder(session.shop, edge.node.id);
    return { ...edge, logs: logs || [] };
  }));

  const fulfilledWithLogs = await Promise.all(fulfilledData.edges.map(async (edge) => {
    const logs = await getLogsForOrder(session.shop, edge.node.id);
    return { ...edge, logs: logs || [] };
  }));
  
  // Filter out orders that are already in the partially fulfilled list to prevent duplicates on the dashboard
  const partialIds = new Set(partialData.edges.map(e => e.node.id));
  const pendingFiltered = pendingData.edges.filter(e => !partialIds.has(e.node.id));

  return { 
    swatchOrders: pendingFiltered, 
    pendingPageInfo: pendingData.pageInfo,
    partialOrders: partialWithLogs,
    partialPageInfo: partialData.pageInfo,
    fulfilledOrders: fulfilledWithLogs, 
    fulfilledPageInfo: fulfilledData.pageInfo,
    stats: { ...stats, totalFulfilled: liveFulfilledCount, totalPartial: partialData.edges.length },
    settings
  };
};

export default function Index() {
  const { swatchOrders, partialOrders, fulfilledOrders, stats, pendingPageInfo, partialPageInfo, fulfilledPageInfo, settings } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();

  // Auto-refresh the dashboard every 5 seconds to keep it sync with scanner activity
  useEffect(() => {
    const interval = setInterval(() => {
      // Only revalidate if the tab is visible and the app is not currently performing another navigation
      if (document.visibilityState === "visible" && revalidator.state === "idle") {
        revalidator.revalidate();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [revalidator]);

  const handlePendingNext = () => {
      if(pendingPageInfo?.hasNextPage) {
          const newParams = new URLSearchParams(searchParams);
          const currentPage = parseInt(searchParams.get("pendingPage") || "1");
          newParams.set("pendingCursor", pendingPageInfo.endCursor);
          newParams.set("pendingPage", (currentPage + 1).toString());
          newParams.set("pendingDir", "next");
          navigate(`?${newParams.toString()}`);
      }
  };

  const handlePendingPrev = () => {
      if(pendingPageInfo?.hasPreviousPage) {
          const newParams = new URLSearchParams(searchParams);
          const currentPage = parseInt(searchParams.get("pendingPage") || "1");
          newParams.set("pendingCursor", pendingPageInfo.startCursor);
          newParams.set("pendingPage", (currentPage - 1).toString());
          newParams.set("pendingDir", "prev");
          navigate(`?${newParams.toString()}`);
      } else {
          const newParams = new URLSearchParams(searchParams);
          newParams.delete("pendingCursor");
          newParams.delete("pendingPage");
          newParams.delete("pendingDir");
          navigate(`?${newParams.toString()}`);
      }
  };

  const handleFulfilledNext = () => {
      if(fulfilledPageInfo?.hasNextPage) {
          const newParams = new URLSearchParams(searchParams);
          const currentPage = parseInt(searchParams.get("fulfilledPage") || "1");
          newParams.set("fulfilledCursor", fulfilledPageInfo.endCursor);
          newParams.set("fulfilledPage", (currentPage + 1).toString());
          newParams.set("fulfilledDir", "next");
          navigate(`?${newParams.toString()}`);
      }
  };

  const handleFulfilledPrev = () => {
      if(fulfilledPageInfo?.hasPreviousPage) {
          const newParams = new URLSearchParams(searchParams);
          const currentPage = parseInt(searchParams.get("fulfilledPage") || "1");
          newParams.set("fulfilledCursor", fulfilledPageInfo.startCursor);
          newParams.set("fulfilledPage", (currentPage - 1).toString());
          newParams.set("fulfilledDir", "prev");
          navigate(`?${newParams.toString()}`);
      } else {
          const newParams = new URLSearchParams(searchParams);
          newParams.delete("fulfilledCursor");
          newParams.delete("fulfilledPage");
          newParams.delete("fulfilledDir");
          navigate(`?${newParams.toString()}`);
      }
  };

  const handlePartialNext = () => {
    if(partialPageInfo?.hasNextPage) {
      const newParams = new URLSearchParams(searchParams);
      const currentPage = parseInt(searchParams.get("partialPage") || "1");
      newParams.set("partialCursor", partialPageInfo.endCursor);
      newParams.set("partialPage", (currentPage + 1).toString());
      newParams.set("partialDir", "next");
      navigate(`?${newParams.toString()}`);
    }
  };

  const handlePartialPrev = () => {
    if(partialPageInfo?.hasPreviousPage) {
      const newParams = new URLSearchParams(searchParams);
      const currentPage = parseInt(searchParams.get("partialPage") || "1");
      newParams.set("partialCursor", partialPageInfo.startCursor);
      newParams.set("partialPage", (currentPage - 1).toString());
      newParams.set("partialDir", "prev");
      navigate(`?${newParams.toString()}`);
    } else {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("partialCursor");
      newParams.delete("partialPage");
      newParams.delete("partialDir");
      navigate(`?${newParams.toString()}`);
    }
  };

  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <InlineGrid columns={4} gap="400">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Total Scans Today</Text>
                <Text variant="heading2xl" as="p">{stats.scansToday}</Text>
                 <Text tone="subdued" variant="bodySm">Collective scans from all staff</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Pending Orders</Text>
                <Text variant="heading2xl" as="p">{swatchOrders.length === 10 ? "10+" : swatchOrders.length}</Text>
                <Text tone="subdued" variant="bodySm">Orders awaiting fulfillment</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Partially Fulfilled</Text>
                <Text variant="heading2xl" as="p" tone="warning">{stats.totalPartial || 0}</Text>
                <Text tone="subdued" variant="bodySm">Orders with items remaining</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Total Fulfilled</Text>
                <Text variant="heading2xl" as="p">{stats.totalFulfilled}</Text>
                <Text tone="subdued" variant="bodySm">Lifetime fulfilled via scanner</Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Pending Swatch Orders</Text>
              {swatchOrders.length === 0 ? (
                 <Text tone="subdued">No pending orders.</Text>
              ) : (
                <BlockStack gap="400">
                  {swatchOrders.map(({ node: order }, idx) => (
                    <OrderRow key={order.id} order={order} status="pending" index={(parseInt(searchParams.get("pendingPage") || "1") - 1) * 10 + idx + 1} />
                  ))}
                  <Pagination
                    hasPrevious={pendingPageInfo?.hasPreviousPage}
                    onPrevious={handlePendingPrev}
                    hasNext={pendingPageInfo?.hasNextPage}
                    onNext={handlePendingNext}
                    accessibilityLabel="Pending orders pagination"
                  />
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Partially Fulfilled Orders</Text>
              {partialOrders.length === 0 ? (
                 <Text tone="subdued">No partially fulfilled orders.</Text>
              ) : (
                <BlockStack gap="400">
                  {partialOrders.map(({ node: order, logs }, idx) => (
                    <PartialOrderRow 
                      key={order.id} 
                      order={order} 
                      logs={logs} 
                      index={(parseInt(searchParams.get("partialPage") || "1") - 1) * 10 + idx + 1} 
                    />
                  ))}
                  <Pagination
                    hasPrevious={partialPageInfo?.hasPreviousPage}
                    onPrevious={handlePartialPrev}
                    hasNext={partialPageInfo?.hasNextPage}
                    onNext={handlePartialNext}
                    accessibilityLabel="Partial orders pagination"
                  />
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Fulfilled History</Text>
              {fulfilledOrders.length === 0 ? (
                 <Text tone="subdued">No fulfilled orders found.</Text>
              ) : (
                <BlockStack gap="400">
                    {fulfilledOrders.map((edge, idx) => (
                      <OrderRow 
                        key={edge.node.id} 
                        order={edge.node} 
                        status="fulfilled" 
                        logs={edge.logs} 
                        index={(parseInt(searchParams.get("fulfilledPage") || "1") - 1) * 10 + idx + 1} 
                      />
                    ))}
                    <Pagination
                      hasPrevious={fulfilledPageInfo?.hasPreviousPage}
                      onPrevious={handleFulfilledPrev}
                      hasNext={fulfilledPageInfo?.hasNextPage}
                      onNext={handleFulfilledNext}
                      accessibilityLabel="Fulfilled orders pagination"
                    />
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function PartialOrderRow({ order, logs, index }) {
  const [open, setOpen] = useState(false);

  const fabricItems = order.lineItems.edges.filter(
    i => i.node.variant?.product?.productType?.toLowerCase() === "swatch item"
  );

  // Calculate fulfillment progress using fulfillmentOrders data
  // lineItem.fulfillmentStatus might not be reliable, so we check fulfillmentOrders
  const fulfilledLineItemIds = new Set();
  const unfulfilledLineItemIds = new Set();
  
  // Check fulfillmentOrders to see which items are fulfilled
  if (order.fulfillmentOrders?.edges) {
    order.fulfillmentOrders.edges.forEach(foEdge => {
      const fo = foEdge.node;
      if (fo.lineItems?.edges) {
        fo.lineItems.edges.forEach(foLineEdge => {
          const foLineItem = foLineEdge.node;
          const lineItemId = foLineItem.lineItem.id;
          const remainingQty = foLineItem.remainingQuantity || 0;
          const totalQty = foLineItem.totalQuantity || 0;
          
          // If remaining quantity is 0, the item is fully fulfilled
          if (remainingQty === 0 && totalQty > 0) {
            fulfilledLineItemIds.add(lineItemId);
            // Remove from unfulfilled if it was there (due to split FOs)
            unfulfilledLineItemIds.delete(lineItemId);
          } else if (remainingQty > 0 && !fulfilledLineItemIds.has(lineItemId)) {
            // Only add to unfulfilled if not already marked as fulfilled
            unfulfilledLineItemIds.add(lineItemId);
          }
        });
      }
    });
  }
  
  const fulfilledItems = fabricItems.filter(i => fulfilledLineItemIds.has(i.node.id));
  const unfulfilledItems = fabricItems.filter(i => unfulfilledLineItemIds.has(i.node.id));
  const progress = `${fulfilledItems.length}/${fabricItems.length}`;

  // Helper to find which staff member scanned a specific item
  const getStaffForItem = (lineItemId) => {
    if (!logs || logs.length === 0) return null;
    
    // Look through logs for one that contains this item ID in its details metadata
    const itemLog = logs.find(l => {
      // Regex to match [ITEMS:id1,id2]
      const match = l.details?.match(/\[ITEMS:(.*?)\]/);
      if (match && match[1]) {
        const itemIds = match[1].split(',');
        return itemIds.includes(lineItemId);
      }
      return false;
    });

    return itemLog ? itemLog.scannedBy : null;
  };

  // Find the primary log (the most recent one) for the header summary
  const primaryLog = logs?.[0];

  if (fabricItems.length === 0) return null;

  return (
    <div style={{ border: '2px solid #ff9900', borderRadius: '8px', overflow: 'hidden' }}>
      <div 
        onClick={() => setOpen(!open)}
        style={{ 
          padding: '12px 16px', 
          background: '#fff8e6', 
          cursor: 'pointer',
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <InlineStack gap="400">
          <Text variant="bodyMd" fontWeight="bold" tone="subdued" as="span">{index}.</Text>
          <Text variant="bodyMd" fontWeight="bold" as="span">{order.name}</Text>
          <Badge tone="warning">PARTIALLY FULFILLED</Badge>
          <Badge tone="info">{progress} items shipped</Badge>
          <Text tone="subdued" as="span">{new Date(order.updatedAt || order.createdAt).toLocaleString()}</Text>
        </InlineStack>

        <InlineStack gap="400" blockAlign="center">
           <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icon source={PersonIcon} tone="subdued" />
              <Text variant="bodySm" tone="subdued">
                {primaryLog?.scannedBy || primaryLog?.staffEmail || "Unknown"}
              </Text>
           </div>
           <Button icon={open ? ChevronUpIcon : ChevronDownIcon} variant="plain" />
        </InlineStack>
      </div>

      <Collapsible open={open} id={`collapse-${order.id}`}>
        <div style={{ padding: '16px', background: '#fff' }}>
          <BlockStack gap="400">
             <Text variant="headingSm" as="h4">Fulfilled Items ({fulfilledItems.length})</Text>
             {fulfilledItems.map(({ node: item }, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '60px 2fr 1fr 2fr', alignItems: 'center', gap: '20px', padding: '8px', background: '#f1f8f5', borderRadius: '4px' }}>
                   <Thumbnail source={item.variant?.product?.featuredImage?.url || ""} alt={item.title} size="small" />
                   <div>
                      <Text variant="bodyMd" fontWeight="bold">{item.title}</Text>
                      <Text variant="bodySm" tone="subdued">SKU: {item.sku || 'N/A'}</Text>
                   </div>
                   <div style={{ textAlign: 'center' }}>
                      <Badge tone="success">✓ Shipped</Badge>
                      {getStaffForItem(item.id) && (
                        <div style={{ marginTop: '4px' }}>
                          <Text variant="bodyXs" tone="subdued">By: {getStaffForItem(item.id)}</Text>
                        </div>
                      )}
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <BarcodeImage value={item.variant?.barcode} />
                   </div>
                </div>
             ))}

             <Text variant="headingSm" as="h4" tone="critical">Unfulfilled Items ({unfulfilledItems.length})</Text>
             {unfulfilledItems.map(({ node: item }, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '60px 2fr 1fr 2fr', alignItems: 'center', gap: '20px', padding: '8px', background: '#fff4f4', borderRadius: '4px' }}>
                   <Thumbnail source={item.variant?.product?.featuredImage?.url || ""} alt={item.title} size="small" />
                   <div>
                      <Text variant="bodyMd" fontWeight="bold">{item.title}</Text>
                      <Text variant="bodySm" tone="subdued">SKU: {item.sku || 'N/A'}</Text>
                   </div>
                   <div style={{ textAlign: 'center' }}>
                      <Badge tone="attention">Pending</Badge>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <BarcodeImage value={item.variant?.barcode} />
                   </div>
                </div>
             ))}
          </BlockStack>
        </div>
      </Collapsible>
    </div>
  );
}

function OrderRow({ order, status, logs, index }) {
  const [open, setOpen] = useState(false);

  const fabricItems = order.lineItems.edges.filter(
    i => (status === 'fulfilled' || i.node.variant?.product?.productType?.toLowerCase() === "swatch item")
  );

  if (fabricItems.length === 0) return null;

  // Helper to find which staff member scanned a specific item
  const getStaffForItem = (lineItemId) => {
    if (!logs || logs.length === 0) return null;
    const itemLog = logs.find(l => {
      const match = l.details?.match(/\[ITEMS:(.*?)\]/);
      if (match && match[1]) {
        const itemIds = match[1].split(',');
        return itemIds.includes(lineItemId);
      }
      return false;
    });
    return itemLog ? itemLog.scannedBy : null;
  };

  const primaryLog = logs?.[0];

  return (
    <div style={{ border: '1px solid #dfe3e8', borderRadius: '8px', overflow: 'hidden' }}>
      <div 
        onClick={() => setOpen(!open)}
        style={{ 
          padding: '12px 16px', 
          background: '#f9fafb', 
          cursor: 'pointer',
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <InlineStack gap="400">
          <Text variant="bodyMd" fontWeight="bold" tone="subdued" as="span">{index}.</Text>
          <Text variant="bodyMd" fontWeight="bold" as="span">{order.name}</Text>
          <Badge tone={status === 'fulfilled' ? 'success' : 'attention'}>{status.toUpperCase()}</Badge>
          <Text tone="subdued" as="span">{new Date(order.updatedAt || order.createdAt).toLocaleString()}</Text>
        </InlineStack>

        <InlineStack gap="400" blockAlign="center">
           {status === 'fulfilled' && (
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon source={PersonIcon} tone="subdued" />
                <Text variant="bodySm" tone="subdued">
                  {primaryLog?.scannedBy || primaryLog?.staffEmail || "Unknown"}
                </Text>
             </div>
           )}
           <Button icon={open ? ChevronUpIcon : ChevronDownIcon} variant="plain" />
        </InlineStack>
      </div>

      <Collapsible open={open} id={`collapse-${order.id}`}>
        <div style={{ padding: '16px' }}>
          <BlockStack gap="400">
             {fabricItems.map(({ node: item }, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '60px 2fr 1fr 2fr', alignItems: 'center', gap: '20px' }}>
                   <Thumbnail source={item.variant?.product?.featuredImage?.url || ""} alt={item.title} size="small" />
                   <div>
                      <Text variant="bodyMd" fontWeight="bold">{item.title}</Text>
                      <Text variant="bodySm" tone="subdued">SKU: {item.sku || 'N/A'}</Text>
                   </div>
                   <div style={{ textAlign: 'center' }}>
                      <Text alignment="center" as="span">Qty: {item.quantity}</Text>
                      {status === 'fulfilled' && getStaffForItem(item.id) && (
                        <div style={{ marginTop: '4px' }}>
                          <Text variant="bodyXs" tone="subdued">By: {getStaffForItem(item.id)}</Text>
                        </div>
                      )}
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <BarcodeImage value={item.variant?.barcode} />
                   </div>
                </div>
             ))}
          </BlockStack>
        </div>
      </Collapsible>
    </div>
  );
}
