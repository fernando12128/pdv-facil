import type { ReceiptPreview } from "../services/fiscalService";

const escapeHtml = (input: string) => input.replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character] || character));
const format = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const safe = (value: string | null | undefined) => escapeHtml(value || "");

export function renderNonFiscalReceipt(target: Window, document: ReceiptPreview) {
  const width = document.receiptWidth === 58 ? 58 : 80;
  const items = document.sale.items.map(item => `
    <tr><td>${escapeHtml(item.name)}<br/><small>${item.quantity} x ${format(item.unitPrice)}</small></td>
        <td style="text-align:right;white-space:nowrap">${format(item.total)}</td></tr>
  `).join("");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
    <title>Comprovante não fiscal - PDV Fácil</title>
    <style>
      * { box-sizing:border-box } body { font-family:Arial,Helvetica,sans-serif; color:#111; margin:0; padding:12px; }
      .receipt { width:${width}mm; max-width:100%; margin:0 auto; }
      h1 { font-size:17px; text-align:center; margin:0 0 8px }
      p { font-size:11px; text-align:center; margin:4px 0 }
      .notice { border:2px solid #111; padding:7px; font-weight:bold; font-size:12px; margin:12px 0; text-align:center; }
      table { width:100%;border-collapse:collapse;font-size:11px } td {padding:6px 0;border-bottom:1px dashed #888}
      .total {font-weight:bold;font-size:14px} small {font-size:10px}
      @page { size: ${width}mm auto; margin:2mm; }
      @media print { body {padding:0} .controls {display:none} }
    </style></head><body><div class="receipt">
    <h1>${safe(document.seller.name)}</h1>
    ${document.seller.cnpj ? `<p>CNPJ: ${safe(document.seller.cnpj)}</p>` : ""}
    ${document.seller.address ? `<p>${safe(document.seller.address)}</p>` : ""}
    <div class="notice">COMPROVANTE NÃO FISCAL<br/>NÃO É NFC-e / NF-e / DANFE</div>
    <p>Venda: ${safe(document.sale.id.slice(0, 12))}</p>
    <p>${new Date(document.sale.createdAt).toLocaleString("pt-BR")}</p>
    <table><tbody>${items}</tbody></table>
    <table><tbody><tr><td>Subtotal</td><td align="right">${format(document.sale.subtotal)}</td></tr>
    <tr><td>Desconto</td><td align="right">- ${format(document.sale.discount)}</td></tr>
    <tr><td class="total">TOTAL</td><td class="total" align="right">${format(document.sale.total)}</td></tr></tbody></table>
    <p>Pagamento: ${safe(document.sale.paymentMethod)}</p>
    <p>Documento informativo sem validade fiscal. Não substitui emissão obrigatória.</p>
    <div class="controls" style="text-align:center;margin:20px"><button onclick="window.print()">Imprimir comprovante</button></div>
    </div></body></html>`;
  target.document.open();
  target.document.write(html);
  target.document.close();
}
