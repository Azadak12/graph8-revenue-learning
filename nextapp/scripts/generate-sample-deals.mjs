// Generates scripts/data/graph8-sample-deals.json: a fictional but realistic
// set of B2B deals (companies, buying committees, meeting notes, stage paths
// and won/lost outcomes) for loading into a Graph8 test workspace with
// scripts/graph8-seed.mjs. Deterministic: the same file every run.
//
// Usage (from the nextapp folder): node scripts/generate-sample-deals.mjs

import { mkdirSync, writeFileSync } from "node:fs";

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => Math.round(lo + rand() * (hi - lo));
const roundTo = (n, step) => Math.round(n / step) * step;

const FIRST = ["Maya", "Daniel", "Priya", "Owen", "Sofia", "Ethan", "Leah", "Marcus", "Aisha", "Tom", "Grace", "Omar", "Hannah", "Victor", "Nina", "Caleb", "Rosa", "Kenji", "Elena", "Samuel", "Irene", "Jonah", "Farah", "Lucas", "Mei", "Andre", "Clara", "Ravi", "Zoe", "Felix"];
const LAST = ["Okafor", "Lindqvist", "Ramirez", "Chen", "Patel", "Novak", "Brennan", "Haddad", "Kowalski", "Mensah", "Ortiz", "Fischer", "Tanaka", "Abara", "Moreau", "Singh", "Duarte", "Kim", "Walsh", "Ibrahim", "Rossi", "Nguyen", "Sato", "Keller", "Adeyemi", "Larsen", "Costa", "Hughes", "Varga", "Bauer"];
const CITIES = [["Chicago", "US"], ["Austin", "US"], ["Denver", "US"], ["Boston", "US"], ["Atlanta", "US"], ["Toronto", "CA"], ["London", "GB"], ["Dublin", "IE"], ["Seattle", "US"], ["Charlotte", "US"]];

const INDUSTRIES = {
  "Financial Services": { segment: "enterprise", names: ["Harborline Bank", "Keystone Ridge Credit Union", "Pinecrest Capital", "Bayview Mutual", "Granite Peak Financial", "Lakeshore Savings", "Northgate Trust", "Silverline Bancorp", "Clearwater Lending", "Oakmont Capital Partners", "Redfield Bank", "Stonegate Financial", "Westmere Credit Union", "Fairhaven Trust", "Copperleaf Bank", "Tidewater Financial", "Ironbridge Capital", "Maplecrest Bank", "Ashford Lending Group", "Crestview Savings", "Summerfield Trust", "Brightwater Bancorp"], employees: [2500, 12000] },
  Healthcare: { segment: "enterprise", names: ["Riverbend Health System", "Cedar Valley Medical", "Northfield Clinics", "Sagebrush Health", "Lakeview Hospital Group", "Pinehurst Medical Partners", "Meadowbrook Health", "Summit Ridge Care", "Willowcreek Health Network", "Blue Heron Medical", "Starling Health", "Evergreen Care Alliance", "Halcyon Health"], employees: [1500, 9000] },
  SaaS: { segment: "mid_market", names: ["Brightloop", "Quillstack", "Nimbusly", "Taskwise", "Orbitly", "Ledgerleaf", "Frameworkd", "Pulsegrid", "Shipcraft", "Datavane", "Formsmith", "Relaybase", "Clearpath Apps", "Wavecast"], employees: [150, 700] },
  Retail: { segment: "smb", names: ["Juniper & Co", "Copper Kettle Goods", "Northwind Outfitters", "Fernleaf Home", "Bluebell Boutique", "Harbor Street Market", "Oak & Anchor Supply", "Sundial Gifts", "Marigold Mercantile", "Pebble Lane Shoes", "Tallgrass Provisions", "Wren & Willow"], employees: [15, 50] },
  Manufacturing: { segment: "mid_market", names: ["Ironclad Fabrication", "Precision Forge Works", "Delta Valve Systems", "Northstar Composites", "Keel Industrial", "Anvil Ridge Metals", "Sterling Tooling", "Brightcast Plastics", "Vector Machining", "Summit Packaging Co"], employees: [200, 900] },
  Technology: { segment: "smb", names: ["Byteforge Labs", "Pixelridge", "Cloudnine Devices", "Signalworks", "Lumen Circuit", "Kitebase", "Nodewise", "Sparkline Studio", "Hexa Robotics", "Quantaloop"], employees: [12, 50] },
};

const AMOUNTS = { enterprise: [110000, 320000, 5000], mid_market: [28000, 95000, 1000], smb: [6000, 24000, 500] };
const PRODUCTS = { enterprise: ["Enterprise Platform", "Enterprise Rollout", "Platform Expansion", "Identity & Access Suite"], mid_market: ["Growth Plan", "Analytics Suite", "Operations Platform", "Team Plan"], smb: ["Starter Plan", "Standard Plan", "Team Plan", "Essentials"] };

// ---------------------------------------------------------------- stories
// Each story returns meeting summaries, internal notes, a close reason, how far
// the deal got (0 New Meeting .. 4 Verbal Commit) and the buying committee.
const committee = (seg) =>
  seg === "enterprise"
    ? [["VP Engineering", "champion"], ["CISO", "decision_maker"], ["IT Security Analyst", "influencer"]]
    : seg === "mid_market"
      ? [["Head of Operations", "champion"], ["CFO", "decision_maker"], ["Operations Manager", "end_user"]]
      : [["Founder", "decision_maker"], ["Office Manager", "end_user"]];

const LOSS = {
  scim_gap: (c) => ({
    stage: 3,
    meetings: [
      "Discovery call. Buyer described an identity-governance initiative and listed security requirements for all new vendors.",
      "Technical deep-dive with IT Security. They asked whether we support automated user provisioning and deprovisioning via SCIM for their identity provider.",
      `Security review. The CISO asked directly: 'Do you support SCIM 2.0?' We confirmed SCIM is not supported today, only manual CSV provisioning.`,
      "Buyer's security team flagged manual provisioning as a blocker for their access-review audit control.",
    ],
    notes: ["Buyer's requirements doc lists SCIM 2.0 provisioning as mandatory, tier 1."],
    close: `Lost - security review failed because SCIM / automated provisioning is not supported.`,
  }),
  late_dm: (c) => ({
    stage: 3,
    meetings: [
      "Discovery with the champion, strong interest in the platform and a clear use case.",
      "Demo for the working team went well; champion asked for a proposal.",
      "Proposal review. The economic buyer joined for the first time and questioned why this was a priority this year.",
    ],
    notes: ["Internal note: we never met the economic buyer before the proposal stage."],
    close: "Lost - decision maker joined late and did not prioritize the project.",
  }),
  pricing: (c) => ({
    stage: 3,
    meetings: [
      "Discovery call, buyer liked the product and the onboarding story.",
      `Proposal walkthrough. Buyer said our list price is ${between(25, 45)}% above their budget for this year.`,
      "We could not offer a smaller tier; buyer picked a cheaper tool.",
    ],
    notes: ["Budget was never discussed in discovery."],
    close: "Lost - price above the buyer's budget.",
  }),
  packaging: (c) => ({
    stage: 3,
    meetings: [
      "Discovery call. Buyer only needed one module for a single team.",
      "Proposal sent for the full-suite bundle, which is the only package we sell to this segment.",
      "Buyer asked for a modular or a la carte option and a quarterly term; we only offer annual-only contracts.",
    ],
    notes: [],
    close: "Lost - rigid full-suite packaging and annual-only contract term did not fit the buyer.",
  }),
  competitor: (c) => ({
    stage: 3,
    meetings: [
      "Discovery call, buyer comparing three vendors.",
      "Demo went well on the core workflow, but buyer asked for industry-specific templates we don't have.",
      "Buyer told us they selected a competitor, a vertical specialist with purpose-built workflows for their industry.",
    ],
    notes: [],
    close: "Lost to a competitor - vertical specialist with purpose-built workflows.",
  }),
  proposal_delay: (c) => ({
    stage: 3,
    meetings: [
      "Great demo, buyer ready to move and asked for a proposal the same week.",
      `Proposal sent ${between(5, 9)} days late because of an internal approval backlog on our side.`,
      "Buyer signed with another vendor in the meantime.",
    ],
    notes: ["Internal note: proposal was stuck in manager review past the SLA."],
    close: "Lost - proposal delayed by internal approval backlog; buyer moved on.",
  }),
  freeze: (c) => ({
    stage: 4,
    meetings: [
      "Strong technical fit confirmed and security requirements validated.",
      "Verbal commit from the champion; contract in legal review.",
      "Champion told us the company announced a company-wide spending freeze; all new vendor contracts are on hold.",
    ],
    notes: ["Champion: 'This has nothing to do with your product.'"],
    close: "Lost - buyer-side spending freeze, unrelated to product fit.",
  }),
  dark: (c) => ({
    stage: 1,
    meetings: ["Single discovery call, buyer engaged.", "Demo delivered; buyer stopped replying to follow-ups."],
    notes: ["Rep note: deal went dark after the demo, no response to four follow-up emails. Reason unclear."],
    close: "Lost - buyer went unresponsive, no reason given.",
  }),
};

const WIN = [
  () => ["Discovery call. The economic decision maker engaged from the first call and set clear success criteria.", "Demo addressed every stated requirement.", "Proposal accepted after one round of review."],
  () => ["Discovery with a strong internal champion who ran a structured evaluation.", "Champion brought the decision maker in early, before the proposal.", "Clear ROI case accepted by the CFO."],
  () => ["Buyer surfaced budget early in discovery.", "We matched a modular package to their actual need instead of the full suite.", "Signed on a quarterly term."],
  () => ["Great demo; proposal sent same day, which kept buying momentum.", "Decision maker engaged within two weeks.", "Closed on schedule."],
  () => ["Security review: buyer uses SSO only; SCIM was confirmed not required early in the evaluation.", "Economic buyer engaged early and ran a TCO comparison.", "Won on implementation speed and support."],
];

// How many of each outcome per industry: [story, count] for losses; wins count.
const PLAN = {
  "Financial Services": { lost: [["scim_gap", 6], ["late_dm", 2], ["freeze", 1], ["dark", 1]], won: 8, open: 4 },
  Healthcare: { lost: [["competitor", 3], ["scim_gap", 2], ["late_dm", 1]], won: 5, open: 2 },
  SaaS: { lost: [["packaging", 3], ["pricing", 2], ["late_dm", 1]], won: 5, open: 3 },
  Retail: { lost: [["pricing", 3], ["proposal_delay", 2]], won: 4, open: 2 },
  Manufacturing: { lost: [["competitor", 2], ["packaging", 1], ["freeze", 1]], won: 4, open: 1 },
  Technology: { lost: [["proposal_delay", 2], ["pricing", 1], ["dark", 1]], won: 4, open: 0 },
};

const OPEN_STORIES = {
  enterprise: [
    ["Discovery call. Buyer's security questionnaire asks about SCIM 2.0 provisioning; not answered yet.", "Champion engaged; no decision maker identified yet."],
    ["Technical evaluation in progress; IT Security will review provisioning requirements next week."],
  ],
  mid_market: [["Discovery done; buyer asked whether we offer a smaller module instead of the full suite."], ["Demo scheduled; CFO not yet involved."]],
  smb: [["Founder interested; asked for pricing before the demo."]],
};

const deals = [];
let n = 0;
for (const [industry, plan] of Object.entries(PLAN)) {
  const info = INDUSTRIES[industry];
  const names = [...info.names];
  const nextCompany = () => names.shift() || `${pick(["Nova", "Alder", "Juno"])} ${industry} ${++n}`;
  const base = (company, outcome) => {
    const seg = info.segment;
    const [lo, hi, step] = AMOUNTS[seg];
    const [city, country] = pick(CITIES);
    const opened = between(70, 160);
    const contacts = committee(seg).map(([title, role], i) => [`${pick(FIRST)} ${pick(LAST)}`, title, role, opened - i * 5]);
    return {
      name: `${company} - ${pick(PRODUCTS[seg])}`,
      company_name: company,
      domain: `${company.toLowerCase().replace(/[^a-z0-9]+/g, "")}-sample.com`,
      industry,
      segment: seg,
      employee_count: String(roundTo(between(...info.employees), 10)),
      city,
      country,
      amount: roundTo(between(lo, hi), step),
      currency: "USD",
      outcome,
      opened_days_ago: opened,
      closed_days_ago: outcome === "open" ? null : between(3, 60),
      contacts,
    };
  };
  const timeline = (texts, opened, closed) =>
    texts.map((t, i) => [Math.max((closed ?? 2) + 1, Math.round(opened - ((opened - (closed ?? 2)) * (i + 1)) / (texts.length + 1))), t]);

  for (const [story, count] of plan.lost) {
    for (let i = 0; i < count; i++) {
      const d = base(nextCompany(), "lost");
      const s = LOSS[story](d);
      Object.assign(d, {
        story,
        stage_reached: s.stage,
        meetings: timeline(s.meetings, d.opened_days_ago, d.closed_days_ago),
        notes: timeline(s.notes, d.opened_days_ago, d.closed_days_ago),
        close_reason_raw: s.close,
      });
      deals.push(d);
    }
  }
  for (let i = 0; i < plan.won; i++) {
    const d = base(nextCompany(), "won");
    const texts = WIN[i % WIN.length]();
    Object.assign(d, {
      story: "won",
      stage_reached: 4,
      meetings: timeline(texts, d.opened_days_ago, d.closed_days_ago),
      notes: [],
      close_reason_raw: "Won",
    });
    deals.push(d);
  }
  for (let i = 0; i < plan.open; i++) {
    const d = base(nextCompany(), "open");
    const texts = OPEN_STORIES[info.segment][i % OPEN_STORIES[info.segment].length];
    Object.assign(d, {
      story: "open",
      stage_reached: between(1, 3),
      meetings: timeline(texts, d.opened_days_ago, 2),
      notes: [],
      close_reason_raw: null,
    });
    deals.push(d);
  }
}

mkdirSync(new URL("./data/", import.meta.url), { recursive: true });
const out = new URL("./data/graph8-sample-deals.json", import.meta.url);
writeFileSync(out, JSON.stringify({ generated_by: "scripts/generate-sample-deals.mjs", fictional: true, deals }, null, 1));
const count = (o) => deals.filter((d) => d.outcome === o).length;
console.log(`Wrote ${deals.length} deals (${count("won")} won, ${count("lost")} lost, ${count("open")} open) to scripts/data/graph8-sample-deals.json`);
