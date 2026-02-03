import db from "../db.server";

export async function createScanLog(shop, data) {
  return await db.scanLog.create({
    data: {
      shop,
      orderId: data.orderId,
      status: data.status,
      scannedBy: data.scannedBy,
      staffEmail: data.staffEmail,
      details: data.details,
    },
  });
}

export async function getScanLogs(shop, { page = 1, limit = 10, query = "" } = {}) {
  const skip = (page - 1) * limit;
  const where = { 
    shop,
    ...(query ? {
      OR: [
        { orderId: { contains: query } },
        { scannedBy: { contains: query } },
        { staffEmail: { contains: query } },
      ]
    } : {})
  };

  const [logs, totalCount] = await Promise.all([
    db.scanLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: skip,
    }),
    db.scanLog.count({ where })
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    }
  };
}

export async function getDashboardStats(shop) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [scansToday, fulfilledGroups] = await Promise.all([
    db.scanLog.count({
      where: {
        shop,
        status: { equals: "FULFILLED" },
        timestamp: { gte: today },
      },
    }),
    db.scanLog.groupBy({
      by: ['orderId'],
      where: {
        shop,
        status: "FULFILLED",
      },
    })
  ]);

  return { 
    scansToday, 
    totalFulfilled: fulfilledGroups.length 
  };
}

export async function getLogForOrder(shop, orderId) {
  return await db.scanLog.findFirst({
    where: { 
      shop, 
      orderId: { contains: orderId },
      OR: [
        { status: "FULFILLED" },
        { status: "PARTIALLY FULFILLED" }
      ]
    },
    orderBy: { timestamp: "desc" }
  });
}

export async function getLogsForOrder(shop, orderId) {
  return await db.scanLog.findMany({
    where: { 
      shop, 
      orderId: { contains: orderId },
      OR: [
        { status: "FULFILLED" },
        { status: "PARTIALLY FULFILLED" }
      ]
    },
    orderBy: { timestamp: "desc" }
  });
}
