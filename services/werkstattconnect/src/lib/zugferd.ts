import { PDFDocument, AFRelationship } from "pdf-lib";
import type { PdfDoc } from "./pdf/types";
import { customerDisplayName } from "./customer-name";

/**
 * Erzeugt eine minimale Factur-X-XML (BASIC-profile) und embedded sie
 * ins PDF als `zugferd-invoice.xml` (AFRelationship.Alternative).
 * Das ergibt keine PDF/A-3 (dazu wären ICC-profile + XMP-metadata nötig),
 * aber ist ZUGFeRD-lesbar für die meisten viewers/tools (DATEV, lexoffice etc).
 */
export async function embedZugferdXml(pdfBytes: Buffer, doc: PdfDoc): Promise<Buffer> {
  const pdf = await PDFDocument.load(new Uint8Array(pdfBytes));
  const xml = buildFacturXBasic(doc);

  await pdf.attach(new TextEncoder().encode(xml), "zugferd-invoice.xml", {
    mimeType: "application/xml",
    description: "Factur-X BASIC invoice data",
    creationDate: doc.issuedAt,
    modificationDate: doc.issuedAt,
    afRelationship: AFRelationship.Alternative,
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function toEur(cent: number) {
  return (cent / 100).toFixed(2);
}

function buildFacturXBasic(doc: PdfDoc): string {
  const w = doc.workshop;
  const c = doc.customer;
  const cName = customerDisplayName(c);

  const vatGroups = new Map<number, { net: number; vat: number }>();
  for (const p of doc.positions) {
    const g = vatGroups.get(p.vatPercent) ?? { net: 0, vat: 0 };
    g.net += p.netTotalCent;
    g.vat += p.vatTotalCent;
    vatGroups.set(p.vatPercent, g);
  }

  const taxSubtotals = [...vatGroups.entries()]
    .map(
      ([rate, g]) => `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${toEur(g.vat)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${toEur(g.net)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${rate.toFixed(2)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`
    )
    .join("\n");

  const lineItems = doc.positions
    .map((p, i) => `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(p.name)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${toEur(p.netPriceCent)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${p.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${p.vatPercent.toFixed(2)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${toEur(p.netTotalCent)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(doc.number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${iso(doc.issuedAt)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lineItems}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(w.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escapeXml(w.zip ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(w.street ?? "")}</ram:LineOne>
          <ram:CityName>${escapeXml(w.city ?? "")}</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        ${w.taxId ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(w.taxId)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(cName)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escapeXml(c.zip ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(c.street ?? "")}</ram:LineOne>
          <ram:CityName>${escapeXml(c.city ?? "")}</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
${taxSubtotals}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${toEur(doc.subtotalNetCent)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${toEur(doc.subtotalNetCent)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${toEur(doc.totalVatCent)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${toEur(doc.totalGrossCent)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${toEur(doc.totalGrossCent)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
