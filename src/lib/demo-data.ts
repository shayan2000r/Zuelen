export const metrics = [
  { label: "Revenue", value: "€32,480", change: "+12.4%", tone: "positive" },
  { label: "Expenses", value: "€9,210", change: "28.4% of revenue", tone: "neutral" },
  { label: "Est. profit", value: "€23,270", change: "+€3,140 vs. last year", tone: "positive" },
  { label: "VAT position", value: "€1,470", change: "payable", tone: "warning" },
] as const;

export const attentionItems = [
  {
    type: "review",
    title: "Apple Store Luxembourg",
    detail: "€2,199.00 · Possible fixed asset",
    meta: "Confirm accounting treatment",
  },
  {
    type: "missing",
    title: "Card payment · €187.40",
    detail: "No supporting document attached",
    meta: "Upload receipt",
  },
  {
    type: "eu",
    title: "Adobe Ireland",
    detail: "€89.99 · EU supplier detected",
    meta: "Confirm reverse-charge treatment",
  },
] as const;

export const compliance = [
  { authority: "ACD", title: "IRC advance", date: "10 Sep", status: "next", amount: "€275" },
  { authority: "RBE", title: "Beneficial owner", date: "Up to date", status: "done", amount: "" },
  { authority: "AED", title: "Annual VAT", date: "1 Mar 2027", status: "future", amount: "" },
  { authority: "RCS", title: "Annual accounts", date: "31 Jul 2027", status: "future", amount: "" },
] as const;
