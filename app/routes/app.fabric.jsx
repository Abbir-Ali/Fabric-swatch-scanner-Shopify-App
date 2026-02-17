import { useLoaderData, useFetcher, useNavigate, useSearchParams, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { 
  Page, Layout, Card, IndexTable, Button, BlockStack, Badge, 
  InlineStack, Thumbnail, Text, Pagination, Box, IndexFilters, TextField, Select, useSetIndexFiltersMode,
  Popover, Banner, Spinner
} from "@shopify/polaris";
import { ArrowRightIcon, EditIcon, CheckIcon, XIcon, ExportIcon } from "@shopify/polaris-icons";
import { useState, useEffect, useCallback, useMemo } from "react";
import { getFabricInventory, getShopLocations } from "../services/order.server";
import { adjustInventory, setInventory } from "../services/inventory.server";

import BarcodeImage from "../components/BarcodeImage";

/**
 * LOADER
 * Fetches fabric products, pagination info, and shop locations.
 */
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || "next";
  const page = parseInt(url.searchParams.get("page") || "1");
  const query = url.searchParams.get("query") || "";
  const sortKey = url.searchParams.get("sortKey") || "CREATED_AT";
  const reverse = url.searchParams.get("reverse") === "true";

  const locations = await getShopLocations(admin);
  const primaryLocation = locations.find(loc => loc.isPrimary) || locations[0];
  const locationId = url.searchParams.get("locationId") || primaryLocation?.id || null;
  
  const { edges, pageInfo } = await getFabricInventory(admin, cursor, { 
    query, sortKey, reverse, direction, locationId 
  });
  
  const shopDomain = session.shop.replace(".myshopify.com", "");

  return {
    products: edges,
    pageInfo,
    page,
    shopDomain,
    locations,
    currentLocationId: locationId,
    initialQuery: query,
    initialSort: sortKey,
    initialReverse: reverse
  };
};

/**
 * ACTION
 * Handles inventory adjustments, bulk updates, and CSV imports.
 */
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const actionType = formData.get("actionType");
  console.log(`[ACTION] Received action: ${actionType}`, Object.fromEntries(formData.entries()));

  if (actionType === "updateBin") {
    const productId = formData.get("productId");
    const binValue = formData.get("binValue");

    try {
      const response = await admin.graphql(
        `#graphql
        mutation updateBin($ownerId: ID!, $value: String!) {
          metafieldsSet(metafields: [
            {
              ownerId: $ownerId,
              namespace: "custom",
              key: "bin_number",
              type: "single_line_text_field",
              value: $value
            }
          ]) {
            metafields { id value }
            userErrors { field message }
          }
        }`,
        {
          variables: { ownerId: productId, value: binValue || "" }
        }
      );
      
      const resData = await response.json();
      const errors = resData.data?.metafieldsSet?.userErrors || [];
      if (errors.length > 0) return { success: false, error: errors[0].message };
      return { success: true, field: "bin", updatedValue: binValue };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (actionType === "adjustInventory") {
    const inventoryItemId = formData.get("inventoryItemId");
    const locationId = formData.get("locationId");
    const delta = formData.get("delta");

    try {
      await adjustInventory(admin, inventoryItemId, locationId, delta);
      return { success: true, message: "Inventory adjusted successfully" };
    } catch (error) {
      console.error("[ACTION] Adjust Error:", error);
      return { success: false, error: error.message };
    }
  }

  if (actionType === "setInventory") {
    const inventoryItemId = formData.get("inventoryItemId");
    const locationId = formData.get("locationId");
    const quantity = formData.get("quantity");

    console.log(`[ACTION] Setting Inventory: Item=${inventoryItemId}, Location=${locationId}, Qty=${quantity}`);

    try {
      await setInventory(admin, inventoryItemId, locationId, quantity);
      return { success: true, message: "Inventory set successfully" };
    } catch (error) {
      console.error("[ACTION] Set Error:", error);
      return { success: false, error: error.message };
    }
  }


  return { success: false, error: "Invalid action type" };
};

/**
 * COMPONENT: FabricInventory
 * Main page component.
 */
export default function FabricInventory() {
  const { products: rawProducts, pageInfo, page, shopDomain, locations, currentLocationId, initialQuery, initialSort, initialReverse } = useLoaderData();
  const products = rawProducts || [];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const { mode, setMode } = useSetIndexFiltersMode();


  const locationOptions = useMemo(() => {
    if (!locations || locations.length === 0) return [{ label: "No locations found", value: "" }];
    return locations.map(loc => ({ label: loc.name, value: loc.id }));
  }, [locations]);

  const sortOptions = [
    { label: 'Newest first', value: 'CREATED_AT:true' },
    { label: 'Oldest first', value: 'CREATED_AT:false' },
    { label: 'Alphabetical (A-Z)', value: 'TITLE:false' },
    { label: 'Alphabetical (Z-A)', value: 'TITLE:true' },
    { label: 'Stock (Low to High)', value: 'INVENTORY_TOTAL:false' },
    { label: 'Stock (High to Low)', value: 'INVENTORY_TOTAL:true' },
  ];

  const [sortSelected, setSortSelected] = useState([`${initialSort}:${initialReverse}`]);
  const [queryValue, setQueryValue] = useState(initialQuery || "");

  useEffect(() => {
    setQueryValue(initialQuery || "");
  }, [initialQuery]);

  const handleQueryChange = useCallback((value) => setQueryValue(value), []);

  useEffect(() => {
    const urlQuery = searchParams.get("query") || "";
    if (queryValue === urlQuery) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (queryValue) params.set("query", queryValue);
      else params.delete("query");
      params.delete("cursor");
      params.delete("direction");
      params.set("page", "1");
      navigate(`?${params.toString()}`, { replace: true });
    }, 600);

    return () => clearTimeout(timer);
  }, [queryValue, searchParams, navigate]);

  const handleQueryClear = useCallback(() => {
    setQueryValue("");
    const params = new URLSearchParams(searchParams);
    params.delete("query");
    params.delete("cursor");
    params.delete("direction");
    params.set("page", "1");
    navigate(`?${params.toString()}`);
  }, [searchParams, navigate]);

  const handleSortChange = useCallback((value) => {
    setSortSelected(value);
    const [key, rev] = value[0].split(":");
    const params = new URLSearchParams(searchParams);
    params.set("sortKey", key);
    params.set("reverse", rev);
    params.delete("cursor");
    params.delete("direction");
    params.set("page", "1");
    navigate(`?${params.toString()}`);
  }, [searchParams, navigate]);

  const handleLocationChange = useCallback((value) => {
    const params = new URLSearchParams(searchParams);
    params.set("locationId", value);
    navigate(`?${params.toString()}`);
  }, [searchParams, navigate]);

  const handlePagination = (cursor, direction) => {
    const params = new URLSearchParams(searchParams);
    if (cursor) {
      params.set("cursor", cursor);
      params.set("direction", direction);
      params.set("page", direction === "next" ? (page + 1).toString() : (page - 1).toString());
    }
    navigate(`?${params.toString()}`);
  };

  const handlePrint = (barcode, title, sku) => {
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    
    if (!printWindow) {
      alert("Please allow popups to print barcodes.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode - ${barcode}</title>
          <style>
            @page {
              size: 58mm 30mm;
              margin: 0;
            }
            html, body {
              width: 58mm;
              height: 30mm;
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            body {
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: monospace;
              box-sizing: border-box;
            }
            .barcode-container {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 2mm;
              box-sizing: border-box;
            }
            svg {
              max-width: 54mm;
              max-height: 26mm;
              height: auto;
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
        </head>
        <body>
          <div class="barcode-container">
            <svg id="barcode"></svg>
          </div>
          <script>
            window.onload = function() {
              if (window.JsBarcode) {
                JsBarcode("#barcode", "${barcode}", {
                  format: "CODE128",
                  width: 2,
                  height: 60,
                  displayValue: true,
                  fontSize: 14,
                  margin: 0
                });
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 600);
              }
            };
          <\/script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };


  const resourceName = { singular: 'product', plural: 'products' };
  const isLoading = navigation.state === "loading" || fetcher.state !== "idle";

  const rowMarkup = products.map(({ node }, index) => {
    const { title, id, legacyResourceId, featuredImage, variants, metafields: metaEdges } = node;
    const variant = variants.edges[0]?.node;
    const sku = variant?.sku || "N/A";
    const barcode = variant?.barcode || "";
    const inventoryItemId = variant?.inventoryItem?.id;
    const binMeta = metaEdges?.edges.find(e => e.node.key === "bin_number")?.node;
    const adminUrl = `https://admin.shopify.com/store/${shopDomain}/products/${legacyResourceId}`;
    
    // Find the inventory level matching the selected locationId
    const levels = variant?.inventoryItem?.inventoryLevels?.edges || [];
    const matchingLevel = levels.find(l => l.node.location.id === currentLocationId);
    const available = matchingLevel?.node?.quantities?.find(q => q.name === "available")?.quantity || 0;

    return (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold">{index + 1}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Thumbnail source={featuredImage?.url || ""} alt={title} size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ maxWidth: '250px' }}>
            <Text variant="bodyMd" fontWeight="bold" breakWord>{title}</Text>
            <Text variant="bodyXs" tone="subdued">SKU: {sku}</Text>
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge tone={available > 0 ? "success" : "critical"}>{available} available</Badge>
              <InventoryAdjuster inventoryItemId={inventoryItemId} locationId={currentLocationId} />
           </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BinEditor productId={id} initialBin={binMeta?.value || ""} />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ transform: 'scale(0.6)', transformOrigin: 'left', opacity: barcode ? 1 : 0.4, minWidth: '80px', height: '35px' }}>
               <BarcodeImage value={barcode} />
            </div>
            {barcode && (
              <Button 
                icon={ExportIcon} 
                variant="plain" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  handlePrint(barcode, title, sku); 
                }} 
                size="slim"
                accessibilityLabel="Print Label"
              />
            )}
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
            <div style={{ textAlign: 'right' }}>
              <Button 
                icon={ArrowRightIcon} 
                variant="plain" 
                external 
                target="_blank" 
                url={adminUrl} 
                onClick={(e) => e.stopPropagation()} 
              />
            </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Swatch Item Inventory" fullWidth>
      <Layout>
        {fetcher.data?.message && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => fetcher.data.message = null}>
              <p>{fetcher.data.message}</p>
            </Banner>
          </Layout.Section>
        )}
        
        {fetcher.data?.error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => fetcher.data.error = null}>
              <p>{fetcher.data.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
           <Card>
              <InlineStack align="space-between" blockAlign="center">
                <Box minWidth="300px">
                   <Select
                      label="Select Warehouse / Location"
                      options={locationOptions}
                      onChange={handleLocationChange}
                      value={currentLocationId}
                   />
                </Box>
                <Text tone="subdued">Inventory actions will apply to the selected location.</Text>
              </InlineStack>
           </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card padding="0">
            <Box minHeight="400px">
            <IndexFilters
              sortOptions={sortOptions}
              sortSelected={sortSelected}
              onSort={handleSortChange}
              onQueryChange={handleQueryChange}
              onQueryClear={handleQueryClear}
              queryValue={queryValue}
              tabs={[]}
              selected={0}
              onSelect={() => {}}
              mode={mode}
              setMode={setMode}
              loading={isLoading}
              filters={[]}
              canCreateNewView={false}
              queryPlaceholder="Search products..."
            />
            
            <IndexTable
              resourceName={resourceName}
              itemCount={products.length}
              selectable={false}
              headings={[
                { title: 'No.' },
                { title: 'Image' },
                { title: 'Product Detail' },
                { title: 'Stock Status' },
                { title: 'Bin Location' },
                { title: 'Barcode Ref' },
                { title: 'View', alignment: 'end' },
              ]}
              hasMoreItems={pageInfo?.hasNextPage}
              loading={isLoading}
            >
              {rowMarkup}
            </IndexTable>
            
            <Box padding="400">
               <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Pagination
                      hasPrevious={pageInfo?.hasPreviousPage}
                      onPrevious={() => handlePagination(pageInfo.startCursor, "prev")}
                      hasNext={pageInfo?.hasNextPage}
                      onNext={() => handlePagination(pageInfo.endCursor, "next")}
                  />
               </div>
            </Box>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>

    </Page>
  );
}

/**
 * HELPER: InventoryAdjuster
 */
function InventoryAdjuster({ inventoryItemId, locationId }) {
  const fetcher = useFetcher();
  const [active, setActive] = useState(false);
  const [value, setValue] = useState("0");
  const [mode, setMode] = useState("adjust"); // 'adjust' or 'set'

  const toggleActive = useCallback(() => setActive((prev) => !prev), []);

  const handleSync = () => {
    const actionType = mode === "adjust" ? "adjustInventory" : "setInventory";
    const fieldName = mode === "adjust" ? "delta" : "quantity";
    
    fetcher.submit(
      { actionType, inventoryItemId, locationId, [fieldName]: value },
      { method: "post" }
    );
    setActive(false);
    setValue("0");
  };

  const isLoading = fetcher.state !== "idle";

  return (
    <Popover
      active={active}
      activator={<Button icon={EditIcon} variant="plain" onClick={(e) => { e.stopPropagation(); toggleActive(); }} size="slim" />}
      onClose={toggleActive}
      sectioned
    >
      <BlockStack gap="300">
        <Text variant="headingXs">Inventory Management</Text>
        
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          <Button 
            size="slim" 
            pressed={mode === 'adjust'} 
            onClick={() => { setMode('adjust'); setValue("0"); }}
          >
            Adjust by
          </Button>
          <Button 
            size="slim" 
            pressed={mode === 'set'} 
            onClick={() => { setMode('set'); setValue("0"); }}
          >
            New
          </Button>
        </div>

        <TextField 
          label={mode === 'adjust' ? "Adjust by quantity" : "Set New Quantity"} 
          type="number" 
          value={value} 
          onChange={setValue} 
          autoComplete="off" 
          helpText={mode === 'adjust' ? "Use + or - values (e.g. 5, -3)" : "Overrides current stock"}
        />
        
        <Button 
          size="slim" 
          onClick={(e) => { e.stopPropagation(); handleSync(); }} 
          loading={isLoading} 
          variant="primary" 
          fullWidth
        >
          {mode === 'adjust' ? 'Adjust Stock' : 'Set Stock'}
        </Button>
      </BlockStack>
    </Popover>
  );
}


/**
 * HELPER: BinEditor
 */
function BinEditor({ productId, initialBin }) {
  const fetcher = useFetcher();
  const [bin, setBin] = useState(initialBin);
  const [tempBin, setTempBin] = useState(initialBin);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setBin(initialBin);
    setTempBin(initialBin);
  }, [initialBin]);

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.field === "bin") {
      setBin(fetcher.data.updatedValue);
      setIsEditing(false);
    }
  }, [fetcher.data]);

  if (isEditing) {
    return (
      <InlineStack gap="100" wrap={false}>
        <TextField value={tempBin} onChange={setTempBin} autoComplete="off" labelHidden label="Bin" size="slim" />
        <Button icon={CheckIcon} variant="primary" onClick={(e) => { e.stopPropagation(); fetcher.submit({ actionType: "updateBin", productId, binValue: tempBin }, { method: "post" }); }} size="slim" />
        <Button icon={XIcon} onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} size="slim" />
      </InlineStack>
    );
  }

  return (
    <Button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} icon={EditIcon} size="slim" variant="secondary">
      {bin || "Set Bin"}
    </Button>
  );
}
