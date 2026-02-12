import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { getAppSettings, updateAppSettings, getStaffMembers, createStaffMember, deleteStaffMember, updateStaffMember } from "../models/settings.server";
import { Page, Layout, Card, FormLayout, TextField, Button, Banner, BlockStack, Text, IndexTable, Modal, InlineStack, InlineGrid, Icon, Tabs, Box, Checkbox } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { DeleteIcon, ViewIcon, HideIcon, EditIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await getAppSettings(session.shop);
  const staff = await getStaffMembers(session.shop);
  return { settings, staff };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    if (actionType === "saveAdmin") {
      await updateAppSettings(session.shop, {
        adminPin: formData.get("adminPin"),
        adminName: formData.get("adminName"),
      });
    } else if (actionType === "saveBrand") {
      await updateAppSettings(session.shop, {
        brandLogo: formData.get("brandLogo"),
      });
    } else if (actionType === "createStaff") {
      await createStaffMember(session.shop, {
        name: formData.get("name"),
        email: formData.get("email"),
        pin: formData.get("pin"),
      });
    } else if (actionType === "updateStaff") {
      await updateStaffMember(session.shop, formData.get("id"), {
        name: formData.get("name"),
        email: formData.get("email"),
        pin: formData.get("pin"),
      });
    } else if (actionType === "deleteStaff") {
      await deleteStaffMember(session.shop, formData.get("id"));
    } else if (actionType === "saveFeatures") {
      await updateAppSettings(session.shop, {
        showStockTab: formData.get("showStockTab") === "true",
        showOrdersTab: formData.get("showOrdersTab") === "true",
        showHistoryTab: formData.get("showHistoryTab") === "true",
        enableScanButton: formData.get("enableScanButton") === "true",
        enableInventorySearch: formData.get("enableInventorySearch") === "true",
        enableInventorySort: formData.get("enableInventorySort") === "true",
        showStaffManagement: formData.get("showStaffManagement") === "true",
        showLogoutButton: formData.get("showLogoutButton") === "true",
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Action Error:", error);
    return { success: false, error: error.message };
  }
};

export default function Settings() {
  const { settings, staff } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [adminName, setAdminName] = useState(settings?.adminName || "");
  const [adminPin, setAdminPin] = useState(settings?.adminPin || "");
  const [showAdminPin, setShowAdminPin] = useState(false);

  const [brandLogo, setBrandLogo] = useState(settings?.brandLogo || "");
  const [showStockTab, setShowStockTab] = useState(settings?.showStockTab ?? true);
  const [showOrdersTab, setShowOrdersTab] = useState(settings?.showOrdersTab ?? true);
  const [showHistoryTab, setShowHistoryTab] = useState(settings?.showHistoryTab ?? true);
  const [enableScanButton, setEnableScanButton] = useState(settings?.enableScanButton ?? true);
  const [enableInventorySearch, setEnableInventorySearch] = useState(settings?.enableInventorySearch ?? true);
  const [enableInventorySort, setEnableInventorySort] = useState(settings?.enableInventorySort ?? true);
  const [showStaffManagement, setShowStaffManagement] = useState(settings?.showStaffManagement ?? true);
  const [showLogoutButton, setShowLogoutButton] = useState(settings?.showLogoutButton ?? true);
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'staff', content: 'Staff & Security', panelID: 'staff-panel' },
    { id: 'brand', content: 'Brand & Logo', panelID: 'brand-panel' },
    { id: 'features', content: 'Feature Visibility', panelID: 'features-panel' },
  ];

  useEffect(() => {
    if (settings) {
      setAdminName(settings.adminName || "");
      setAdminPin(settings.adminPin || "");
      setBrandLogo(settings.brandLogo || "");
      setShowStockTab(settings.showStockTab ?? true);
      setShowOrdersTab(settings.showOrdersTab ?? true);
      setShowHistoryTab(settings.showHistoryTab ?? true);
      setEnableScanButton(settings.enableScanButton ?? true);
      setEnableInventorySearch(settings.enableInventorySearch ?? true);
      setEnableInventorySort(settings.enableInventorySort ?? true);
      setShowStaffManagement(settings.showStaffManagement ?? true);
      setShowLogoutButton(settings.showLogoutButton ?? true);
    }
  }, [settings]);

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this staff member?")) {
      submit({ actionType: "deleteStaff", id }, { method: "post" });
    }
  };

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPin, setNewPin] = useState("");
  const [showNewPin, setShowNewPin] = useState(false);

  const handleModalSubmit = () => {
    const actionType = editingStaff ? "updateStaff" : "createStaff";
    const fd = new FormData();
    fd.append("actionType", actionType);
    fd.append("name", newName);
    fd.append("email", newEmail);
    fd.append("pin", newPin);
    if (editingStaff) fd.append("id", editingStaff.id);

    submit(fd, { method: "post" });
    setNewName(""); setNewEmail(""); setNewPin(""); setShowNewPin(false); setEditingStaff(null);
    setIsModalOpen(false);
  };

  const handleEdit = (member) => {
    setEditingStaff(member);
    setNewName(member.name);
    setNewEmail(member.email);
    setNewPin(member.pin);
    setIsModalOpen(true);
  };

  const staffRows = staff.map((member, index) => (
    <IndexTable.Row id={member.id.toString()} key={member.id} position={index}>
      <IndexTable.Cell><Text fontWeight="bold">{member.name}</Text></IndexTable.Cell>
      <IndexTable.Cell>{member.email}</IndexTable.Cell>
      <IndexTable.Cell><Text fontStyle="italic">****</Text></IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
           <Button icon={EditIcon} onClick={() => handleEdit(member)} variant="plain" />
           <Button icon={DeleteIcon} tone="critical" onClick={() => handleDelete(member.id)} variant="plain" />
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Settings & Staff Access">
      <Layout>
        <Layout.Section>
          {actionData?.success && <Banner tone="success">Changes saved successfully</Banner>}
          {actionData?.error && <Banner tone="critical">Error: {actionData.error}</Banner>}
          
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box padding="400">
              {selectedTab === 0 ? (
                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="400">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingMd" as="h2">Staff Members</Text>
                        <Button variant="primary" onClick={() => setIsModalOpen(true)}>Add Staff</Button>
                      </InlineStack>
                      <Text tone="subdued">Staff can log in to the Scanner using their Name or Email and PIN.</Text>
                      
                      {staff.length === 0 ? (
                        <Banner tone="info">No staff members configured. Use Admin credentials to login.</Banner>
                      ) : (
                        <IndexTable
                          resourceName={{ singular: 'staff', plural: 'staff' }}
                          itemCount={staff.length}
                          headings={[{ title: 'Name' }, { title: 'Email' }, { title: 'PIN' }, { title: 'Action' }]}
                          selectable={false}
                        >
                          {staffRows}
                        </IndexTable>
                      )}
                    </BlockStack>
                  </Card>
                  
                  <Card>
                    <BlockStack gap="400">
                      <Text variant="headingMd" as="h2">Global Admin Credentials</Text>
                      <Text tone="subdued">Set the primary Name and PIN for logging into the scanner app.</Text>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData();
                        fd.append("actionType", "saveAdmin");
                        fd.append("adminName", adminName);
                        fd.append("adminPin", adminPin);
                        submit(fd, { method: 'post' });
                      }}>
                        <FormLayout>
                          <InlineGrid columns={2} gap="400">
                            <TextField 
                              label="Admin Name" 
                              value={adminName}
                              onChange={setAdminName}
                              autoComplete="off" 
                              required 
                            />
                            <TextField 
                              label="Admin PIN" 
                              value={adminPin}
                              onChange={setAdminPin}
                              type={showAdminPin ? "text" : "password"} 
                              autoComplete="off" 
                              required 
                              suffix={
                                <Button 
                                  variant="plain" 
                                  icon={showAdminPin ? HideIcon : ViewIcon} 
                                  onClick={() => setShowAdminPin(!showAdminPin)}
                                />
                              }
                            />
                          </InlineGrid>
                          <Button submit variant="primary">Save Admin Credentials</Button>
                        </FormLayout>
                      </form>
                    </BlockStack>
                  </Card>
                </BlockStack>
              ) : selectedTab === 1 ? (
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">Brand Identity</Text>
                    <Text tone="subdued">Upload your brand logo for shipping labels.</Text>
                    
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData();
                      fd.append("actionType", "saveBrand");
                      fd.append("brandLogo", brandLogo);
                      submit(fd, { method: 'post' });
                    }}>
                      <FormLayout>
                        <BlockStack gap="400">
                          <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                            <div style={{ 
                              width: '160px', 
                              height: '160px', 
                              border: '2px dashed #ccc', 
                              borderRadius: '12px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              background: '#fff',
                              overflow: 'hidden',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                            }}>
                              {brandLogo ? (
                                <img src={brandLogo} alt="Logo Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                              ) : (
                                <div style={{ textAlign: 'center', padding: '10px' }}>
                                   <Text tone="subdued">No logo uploaded</Text>
                                </div>
                              )}
                            </div>
                            
                            <BlockStack gap="200">
                              <Text variant="bodyMd" as="p" tone="subdued">
                                Recommended size: 400x400px. <br/>
                                Supports PNG, JPG, SVG.
                              </Text>
                              <InlineStack gap="200">
                                <Button onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = (e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (readerEvent) => {
                                        setBrandLogo(readerEvent.target.result);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  };
                                  input.click();
                                }}>
                                  {brandLogo ? 'Change Logo' : 'Upload Logo'}
                                </Button>
                                {brandLogo && (
                                  <Button tone="critical" onClick={() => setBrandLogo("")}>
                                    Remove
                                  </Button>
                                )}
                              </InlineStack>
                            </BlockStack>
                          </div>
                        </BlockStack>
                        
                        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                          <Button submit variant="primary" disabled={settings?.brandLogo === brandLogo}>
                            Save Brand Settings
                          </Button>
                        </div>
                      </FormLayout>
                    </form>
                  </BlockStack>
                </Card>
              ) : (
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">Feature Visibility</Text>
                    <Text tone="subdued">Control which features are visible on the scanner frontend.</Text>
                    
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData();
                      fd.append("actionType", "saveFeatures");
                      fd.append("showStockTab", showStockTab.toString());
                      fd.append("showOrdersTab", showOrdersTab.toString());
                      fd.append("showHistoryTab", showHistoryTab.toString());
                      fd.append("enableScanButton", enableScanButton.toString());
                      fd.append("enableInventorySearch", enableInventorySearch.toString());
                      fd.append("enableInventorySort", enableInventorySort.toString());
                      fd.append("showStaffManagement", showStaffManagement.toString());
                      fd.append("showLogoutButton", showLogoutButton.toString());
                      submit(fd, { method: 'post' });
                    }}>
                      <FormLayout>
                        <BlockStack gap="200">
                          <Checkbox
                            label="Show Stock Tab"
                            checked={showStockTab}
                            onChange={setShowStockTab}
                          />
                          <Checkbox
                            label="Show Orders Tab"
                            checked={showOrdersTab}
                            onChange={setShowOrdersTab}
                          />
                          <Checkbox
                            label="Show History Tab"
                            checked={showHistoryTab}
                            onChange={setShowHistoryTab}
                          />
                          <Checkbox
                            label="Enable Scan Button"
                            checked={enableScanButton}
                            onChange={setEnableScanButton}
                          />
                          <Checkbox
                            label="Enable Inventory Search"
                            checked={enableInventorySearch}
                            onChange={setEnableInventorySearch}
                          />
                          <Checkbox
                            label="Enable Inventory Sort"
                            checked={enableInventorySort}
                            onChange={setEnableInventorySort}
                          />
                          <Checkbox
                            label="Show Staff Management"
                            checked={showStaffManagement}
                            onChange={setShowStaffManagement}
                          />
                          <Checkbox
                            label="Show Logout Button"
                            checked={showLogoutButton}
                            onChange={setShowLogoutButton}
                          />
                        </BlockStack>
                        <Button submit variant="primary">Save Visibility Settings</Button>
                      </FormLayout>
                    </form>
                  </BlockStack>
                </Card>
              )}
            </Box>
          </Tabs>
        </Layout.Section>
      </Layout>

      <Modal
        open={isModalOpen}
        onClose={() => { setIsModalOpen(false); setNewName(""); setNewEmail(""); setNewPin(""); setShowNewPin(false); setEditingStaff(null); }}
        title={editingStaff ? "Edit Staff Member" : "Add New Staff Member"}
        primaryAction={{
          content: editingStaff ? "Update Member" : "Create Member",
          onAction: handleModalSubmit,
        }}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Name" value={newName} onChange={setNewName} autoComplete="off" required />
            <TextField label="Email" value={newEmail} onChange={setNewEmail} type="email" autoComplete="off" required />
            <TextField 
              label="PIN (4-6 digits)" 
              value={newPin} 
              onChange={setNewPin} 
              type={showNewPin ? "text" : "password"} 
              autoComplete="off" 
              required 
              suffix={
                <Button 
                  variant="plain" 
                  icon={showNewPin ? HideIcon : ViewIcon} 
                  onClick={() => setShowNewPin(!showNewPin)}
                />
              }
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
