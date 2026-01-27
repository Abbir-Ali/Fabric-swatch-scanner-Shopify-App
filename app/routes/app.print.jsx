import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { getFabricInventory } from "../services/order.server";
import BarcodeImage from "../components/BarcodeImage";
import { useEffect } from "react";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const { edges } = await getFabricInventory(admin);
  return { products: edges };
};

export default function PrintLabels() {
  const { products } = useLoaderData();

  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ padding: "0", background: "white", minHeight: "100vh" }}>
       <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
        .label-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 15px; 
          padding: 10px;
        }
        .label-card { 
          border: 1px dashed #ccc; 
          padding: 20px; 
          text-align: center; 
          page-break-inside: avoid;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
      `}} />

      <div className="no-print" style={{ padding: "10px", background: "#EAEAEA", textAlign: "center" }}>
        <p>Preparing Print Dialog... If it doesn't open, click the button below.</p>
        <button onClick={() => window.print()}>Manual Print</button>
      </div>

      <div className="label-grid">
        {products.map(({ node: product }, idx) => {
          const variant = product.variants.edges[0]?.node;
          const barcode = variant?.barcode || "";
          if (!barcode) return null;

          return (
            <div key={`${product.id}-${idx}`} className="label-card">
              <div style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "8px" }}>
                {product.title}
              </div>
              <BarcodeImage value={barcode} />
              <div style={{ fontSize: "12px", marginTop: "8px", color: "#666" }}>
                STOCK: {product.totalInventory}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
