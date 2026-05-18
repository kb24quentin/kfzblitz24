/**
 * Label-print library — barrel module.
 *
 * Public surface for the retoure service. Consumers should import
 * from `@/lib/label-print` rather than the individual files.
 *
 * @example
 *   import { palletLabelZpl, sendZplToPrinter } from "@/lib/label-print";
 *
 *   const zpl = palletLabelZpl({
 *     palletCode: "PAL-2026-000042",
 *     partnerName: "Mustermann GmbH",
 *     createdAt: new Date(),
 *     maxOpenUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
 *   });
 *   const res = await sendZplToPrinter(zpl, "192.168.10.42");
 *   if (!res.ok) throw new Error(res.error);
 */

export * from "./zpl";
export * from "./print";
export * from "./templates";
