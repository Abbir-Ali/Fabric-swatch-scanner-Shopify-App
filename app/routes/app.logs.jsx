import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { getScanLogs } from "../models/logs.server";
import { Page, Layout, Card, IndexTable, Badge, Text, TextField, Pagination, BlockStack, InlineStack, Button } from "@shopify/polaris";
import { useState, useCallback } from "react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const query = url.searchParams.get("query") || "";
  
  const { logs, pagination } = await getScanLogs(session.shop, { page, query });
  return { logs, pagination, query };
};

export default function Logs() {
  const { logs, pagination, query: initialQuery } = useLoaderData();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(initialQuery);

  const handleSearchChange = useCallback((value) => setSearchValue(value), []);
  
  const handleSearchSubmit = () => {
    const params = new URLSearchParams(searchParams);
    if (searchValue) params.set("query", searchValue);
    else params.delete("query");
    params.set("page", "1");
    navigate(`?${params.toString()}`);
  };

  const handlePagination = (newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    navigate(`?${params.toString()}`);
  };

  const resourceName = {
    singular: 'log',
    plural: 'logs',
  };

  const rowMarkup = logs.map(
    ({ id, orderId, status, scannedBy, staffEmail, timestamp, details }, index) => (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" tone="subdued" as="span">{(pagination.page - 1) * 10 + index + 1}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">{new Date(timestamp).toLocaleString()}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{orderId || '-'}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={status === 'fulfilled' ? 'success' : 'info'}>{status}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="0">
            <Text variant="bodyMd" fontWeight="bold">{scannedBy || 'System'}</Text>
            {staffEmail && <Text variant="bodySm" tone="subdued">{staffEmail}</Text>}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{details}</IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <Page title="Scan Logs">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="start" gap="200">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Search Orders or Staff"
                    labelHidden
                    value={searchValue}
                    onChange={handleSearchChange}
                    onClearButtonClick={() => { setSearchValue(""); navigate("?"); }}
                    autoComplete="off"
                    placeholder="Search by Order ID, Staff Name or Email..."
                  />
                </div>
                <Button onClick={handleSearchSubmit}>Search</Button>
              </InlineStack>

              <IndexTable
                resourceName={resourceName}
                itemCount={logs.length}
                headings={[
                  { title: '#' },
                  { title: 'Time' },
                  { title: 'Order ID' },
                  { title: 'Status' },
                  { title: 'Scanned By' },
                  { title: 'Details' },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
              
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <Pagination
                  hasPrevious={pagination.page > 1}
                  onPrevious={() => handlePagination(pagination.page - 1)}
                  hasNext={pagination.page < pagination.totalPages}
                  onNext={() => handlePagination(pagination.page + 1)}
                  label={`Page ${pagination.page} of ${pagination.totalPages}`}
                />
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
