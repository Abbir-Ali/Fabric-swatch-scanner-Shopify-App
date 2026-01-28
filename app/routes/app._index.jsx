import { useLoaderData, useNavigate, useSearchParams, useRevalidator } from "@remix-run/react";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import { getFabricOrders, getFulfilledFabricOrders, getFulfilledOrdersCount } from "../services/order.server"; 
import { getDashboardStats, getLogForOrder } from "../models/logs.server";
import BarcodeImage from "../components/BarcodeImage";
import shopify from "../shopify.server";

// Components
import { Page, Layout, Card, BlockStack, Text, InlineGrid, Collapsible, Button, Badge, InlineStack, Thumbnail, Pagination, Icon } from "@shopify/polaris"; 
import { ChevronDownIcon, ChevronUpIcon, PersonIcon } from "@shopify/polaris-icons";
import { useState } from "react";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);

  // Ensure webhooks are registered for this shop
  try {
     await shopify.registerWebhooks({ session });
  } catch (e) {
     console.error("Webhook Registration Error:", e);
  }
  
  const pendingCursor = url.searchParams.get("pendingCursor");
  const pendingDir = url.searchParams.get("pendingDir") || "next";
  const fulfilledCursor = url.searchParams.get("fulfilledCursor");
  const fulfilledDir = url.searchParams.get("fulfilledDir") || "next";

  const [pendingData, fulfilledData, stats, liveFulfilledCount] = await Promise.all([
    getFabricOrders(admin, pendingCursor, pendingDir),
    getFulfilledFabricOrders(admin, fulfilledCursor, fulfilledDir),
    getDashboardStats(session.shop),
    getFulfilledOrdersCount(admin)
  ]);

  const fulfilledWithLogs = await Promise.all(fulfilledData.edges.map(async (edge) => {
    const log = await getLogForOrder(session.shop, edge.node.id);
    return { ...edge, log };
  }));
  
  return { 
    swatchOrders: pendingData.edges, 
    pendingPageInfo: pendingData.pageInfo,
    fulfilledOrders: fulfilledWithLogs, 
    fulfilledPageInfo: fulfilledData.pageInfo,
    stats: { ...stats, totalFulfilled: liveFulfilledCount } 
  };
};

export default function Index() {
  const { swatchOrders, fulfilledOrders, stats, pendingPageInfo, fulfilledPageInfo } = useLoaderData();
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

  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <InlineGrid columns={3} gap="400">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Total Scans Today</Text>
                <Text variant="heading2xl" as="p">{stats.scansToday}</Text>
                 <Text tone="subdued" variant="bodySm">Collective scans from all staff</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Total Pending Orders</Text>
                <Text variant="heading2xl" as="p">{swatchOrders.length === 10 ? "10+" : swatchOrders.length}</Text>
                <Text tone="subdued" variant="bodySm">Orders currently in queue</Text>
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
              <Text variant="headingMd" as="h2">Fulfilled History</Text>
              {fulfilledOrders.length === 0 ? (
                 <Text tone="subdued">No fulfilled orders found.</Text>
              ) : (
                <BlockStack gap="400">
                    {fulfilledOrders.map((edge, idx) => (
                      <OrderRow key={edge.node.id} order={edge.node} status="fulfilled" log={edge.log} index={(parseInt(searchParams.get("fulfilledPage") || "1") - 1) * 10 + idx + 1} />
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

function OrderRow({ order, status, log, index }) {
  const [open, setOpen] = useState(false);

  const fabricItems = order.lineItems.edges.filter(
    i => (status === 'fulfilled' || i.node.variant?.product?.productType?.toLowerCase() === "swatch item")
  );

  if (fabricItems.length === 0) return null;

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
                  {log?.scannedBy || log?.staffEmail || "Unknown"}
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
                   <Text alignment="center" as="span">Qty: {item.quantity}</Text>
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
