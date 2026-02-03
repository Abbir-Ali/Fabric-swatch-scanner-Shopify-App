import { useLoaderData, useFetcher, useNavigate, useSearchParams, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { 
  Page, Layout, Card, IndexTable, Button, BlockStack, Badge, 
  InlineStack, Thumbnail, Text, Pagination, Box, IndexFilters, useSetIndexFiltersMode, TextField
} from "@shopify/polaris";
import { ArrowRightIcon, EditIcon, CheckIcon, XIcon } from "@shopify/polaris-icons";
import { useState, useEffect, useCallback } from "react";
import { getFabricInventory, getShopLocations } from "../services/order.server";
import BarcodeImage from "../components/BarcodeImage";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || "next";
  const page = parseInt(url.searchParams.get("page") || "1");
  const query = url.searchParams.get("query") || "";
  const sortKey = url.searchParams.get("sortKey") || "CREATED_AT";
  const reverse = url.searchParams.get("reverse") === "true";

  const { edges, pageInfo } = await getFabricInventory(admin, cursor, { query, sortKey, reverse, direction });
  
  const shopDomain = session.shop.replace(".myshopify.com", "");
  const locations = await getShopLocations(admin);
  const locationId = locations[0]?.id || null;

  return {
    products: edges,
    pageInfo,
    page,
    shopDomain,
    locationId,
    initialQuery: query,
    initialSort: sortKey,
    initialReverse: reverse
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const actionType = formData.get("actionType");

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
          variables: {
            ownerId: productId,
            value: binValue || ""
          }
        }
      );
      
      const resData = await response.json();
      const errors = resData.data?.metafieldsSet?.userErrors || [];
      
      if (errors.length > 0) {
        return { success: false, error: errors[0].message };
      }

      return { success: true, field: "bin", updatedValue: binValue };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: "Invalid action type" };
};

export default function FabricInventory() {
  const { products, pageInfo, page, shopDomain, locationId, initialSort, initialReverse } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const { mode, setMode } = useSetIndexFiltersMode();

  const sortOptions = [
    { label: 'Newest first', value: 'CREATED_AT:true', directionLabel: 'Descending' },
    { label: 'Oldest first', value: 'CREATED_AT:false', directionLabel: 'Ascending' },
    { label: 'Alphabetical (A-Z)', value: 'TITLE:false', directionLabel: 'Ascending' },
    { label: 'Alphabetical (Z-A)', value: 'TITLE:true', directionLabel: 'Descending' },
    { label: 'Stock (Low to High)', value: 'INVENTORY_TOTAL:false', directionLabel: 'Ascending' },
    { label: 'Stock (High to Low)', value: 'INVENTORY_TOTAL:true', directionLabel: 'Descending' },
  ];

  const [sortSelected, setSortSelected] = useState([`${initialSort}:${initialReverse}`]);

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

  const handlePagination = (cursor, direction) => {
    const params = new URLSearchParams(searchParams);
    if (cursor) {
      params.set("cursor", cursor);
      params.set("direction", direction);
      params.set("page", direction === "next" ? (page + 1).toString() : (page - 1).toString());
    } else {
      params.delete("cursor");
      params.delete("direction");
      params.set("page", "1");
    }
    navigate(`?${params.toString()}`);
  };

  const resourceName = { singular: 'product', plural: 'products' };
  const isLoading = navigation.state === "loading";

  const rowMarkup = products.map(({ node }, index) => {
    const { title, id, legacyResourceId, featuredImage, variants, totalInventory, metafields: metaEdges } = node;
    const variant = variants.edges[0]?.node;
    const sku = variant?.sku || "N/A";
    const barcode = variant?.barcode || "";
    
    const binMeta = metaEdges?.edges.find(e => e.node.key === "bin_number")?.node;
    const adminUrl = `https://admin.shopify.com/store/${shopDomain}/products/${legacyResourceId}`;
    
    const itemIndex = (page - 1) * 10 + index + 1;

    return (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
           <Text variant="bodyMd" fontWeight="bold" tone="subdued" as="span">{itemIndex}</Text>
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
           <Badge tone={totalInventory > 0 ? "success" : "critical"}>{totalInventory} available</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BinEditor productId={id} initialBin={binMeta?.value || ""} />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ zoom: 0.7, opacity: barcode ? 1 : 0.4 }}>
             <BarcodeImage value={barcode} />
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
           <div style={{ textAlign: 'right' }}>
              <Button 
                icon={ArrowRightIcon} 
                variant="plain" 
                target="_blank" 
                url={adminUrl} 
                accessibilityLabel="Admin View" 
              />
           </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Swatch Item Inventory" fullWidth>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexFilters
              sortOptions={sortOptions}
              sortSelected={sortSelected}
              onSort={handleSortChange}
              tabs={[]}
              selected={0}
              onSelect={() => {}}
              mode={mode}
              setMode={setMode}
              loading={isLoading}
              filters={[]}
              canCreateNewView={false}
              hideQueryField
            />
            
            <IndexTable
              resourceName={resourceName}
              itemCount={products.length}
              headings={[
                { title: '#' },
                { title: 'Image' },
                { title: 'Product Detail' },
                { title: 'Stock Status' },
                { title: 'Bin Location' },
                { title: 'Barcode Ref' },
                { title: 'View', alignment: 'end' },
              ]}
              selectable={false}
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
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

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
      setTempBin(fetcher.data.updatedValue);
      setIsEditing(false);
    }
  }, [fetcher.data]);

  const isLoading = fetcher.state !== "idle";
  const error = fetcher.data?.success === false ? fetcher.data.error : null;

  if (isEditing) {
    return (
      <InlineStack gap="100" wrap={false}>
          <div style={{ width: '90px' }}>
              <TextField 
                  value={tempBin} 
                  onChange={setTempBin} 
                  autoComplete="off"
                  labelHidden
                  label="Bin"
                  disabled={isLoading}
              />
          </div>
          <Button icon={CheckIcon} variant="primary" onClick={() => fetcher.submit({ actionType: "updateBin", productId, binValue: tempBin }, { method: "post" })} loading={isLoading} size="slim" />
          <Button icon={XIcon} onClick={() => setIsEditing(false)} disabled={isLoading} size="slim" />
      </InlineStack>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <button 
        onClick={() => setIsEditing(true)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          background: bin ? '#f0fdf4' : '#fff',
          padding: '6px 10px', 
          borderRadius: '8px',
          cursor: 'pointer',
          border: '1px solid #e1e4e8',
          width: 'fit-content'
        }}
      >
          <Text fontWeight="bold" tone={bin ? "success" : "subdued"}>{bin || "Set Bin"}</Text>
          <EditIcon style={{ width: '12px', opacity: 0.6 }} />
      </button>
      {error && <Text tone="critical" variant="bodyXs">{error}</Text>}
    </div>
  );
}
