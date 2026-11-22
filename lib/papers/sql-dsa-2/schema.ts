import type { Signature } from "@/lib/authoring/codegen";
import type { SqlTable } from "@/lib/types";

// ── DSA signatures (shared with the test generator) ──
export const SIGS: Record<string, Signature> = {
  dsa_profit: { method: "maxProfit", params: [{ name: "prices", type: "int[]" }], returns: "int" },
  dsa_pow: { method: "myPow", params: [{ name: "x", type: "double" }, { name: "n", type: "int" }], returns: "double" },
  dsa_calc: { method: "calculate", params: [{ name: "s", type: "string" }], returns: "int" },
  dsa_zeros: { method: "moveZeroes", params: [{ name: "nums", type: "int[]" }], returns: "void", inplace: "nums" },
};

// ── SQL schemas (shared with the test generator) ──
export const TABLES: Record<string, SqlTable[]> = {
  sql_ctr: [{ name: "app_events", columns: [{ name: "app_id", type: "INT" }, { name: "event_type", type: "VARCHAR" }, { name: "event_time", type: "TIMESTAMP" }] }],
  sql_median: [{ name: "search_frequency", columns: [{ name: "searches", type: "INT" }, { name: "num_users", type: "INT" }] }],
  sql_seller: [{
    name: "online_retail",
    columns: [
      { name: "invoiceno", type: "VARCHAR" }, { name: "stockcode", type: "VARCHAR" }, { name: "description", type: "VARCHAR" },
      { name: "quantity", type: "INT" }, { name: "invoicedate", type: "DATE" }, { name: "unitprice", type: "DOUBLE" },
      { name: "customerid", type: "INT" }, { name: "country", type: "VARCHAR" },
    ],
  }],
  sql_streak: [{ name: "sf_events", columns: [{ name: "record_date", type: "DATE" }, { name: "account_id", type: "VARCHAR" }, { name: "user_id", type: "VARCHAR" }] }],
};
