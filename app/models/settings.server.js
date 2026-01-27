import db from "../db.server";

export async function getAppSettings(shop) {
  let settings = await db.appSettings.findUnique({
    where: { shop },
  });

  if (!settings) {
    settings = await db.appSettings.create({
      data: {
        shop,
        adminPin: "1234",
        adminName: "Admin"
      },
    });
  }

  return settings;
}

export async function updateAppSettings(shop, data) {
  return await db.appSettings.upsert({
    where: { shop },
    update: data,
    create: {
      shop,
      ...data,
    },
  });
}

// --- STAFF MANAGEMENT ---

export async function getStaffMembers(shop) {
  return await db.staff.findMany({
    where: { shop },
    orderBy: { name: "asc" },
  });
}

export async function createStaffMember(shop, { name, email, pin }) {
  const existing = await db.staff.findFirst({
    where: {
      shop,
      OR: [
        { name: { equals: name } },
        { email: { equals: email } }
      ]
    }
  });

  if (existing) {
    throw new Error("Staff member with this Name or Email already exists.");
  }

  return await db.staff.create({
    data: { shop, name, email, pin },
  });
}

export async function updateStaffMember(shop, id, { name, email, pin }) {
  return await db.staff.update({
    where: { shop, id: parseInt(id) },
    data: { name, email, pin },
  });
}

export async function deleteStaffMember(shop, id) {
  return await db.staff.deleteMany({
    where: { shop, id: parseInt(id) },
  });
}

export async function validateStaffAuth(shop, identifier, pin) {
  const staff = await db.staff.findFirst({
    where: { 
      shop, 
      pin,
      OR: [
        { email: { equals: identifier } },
        { name: { equals: identifier } }
      ]
    },
  });
  return staff;
}

export async function validateAdminAuth(shop, identifier, pin) {
  const settings = await getAppSettings(shop);
  if ((settings.adminName.toLowerCase() === identifier.toLowerCase() || identifier.toLowerCase() === "admin") && settings.adminPin === pin) {
    return { name: settings.adminName, email: "admin@store.local", isAdmin: true };
  }
  return null;
}
