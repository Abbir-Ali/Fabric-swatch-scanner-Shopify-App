import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function BarcodeImage({ value }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format: "CODE128",
          width: 1.2,
          height: 40,
          displayValue: true,
          fontSize: 10,
          margin: 0
        });
      } catch (e) {
        console.error("Barcode generation failed", e);
      }
    }
  }, [value]);

  return value ? <svg ref={barcodeRef}></svg> : <div style={{color: 'red'}}>No Barcode</div>;
}
