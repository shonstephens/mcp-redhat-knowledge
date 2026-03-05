#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const TOKEN_URL = "https://sso.redhat.com/auth/realms/redhat-external/protocol/openid-connect/token";
const KCS_BASE = "https://access.redhat.com/hydra/rest/search/kcs";
const CSAF_BASE = "https://access.redhat.com/hydra/rest/securitydata/csaf";
const CLIENT_ID = "rhsm-api";

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const offlineToken = process.env.REDHAT_TOKEN;
  if (!offlineToken) {
    throw new Error("REDHAT_TOKEN environment variable is required (Red Hat offline API token)");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: offlineToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function kcsSearch(query, { rows = 10, fields, fq } = {}) {
  const token = await getAccessToken();
  const params = new URLSearchParams({ q: query, rows: String(rows) });
  if (fields) params.set("fl", fields);
  if (fq) {
    const filters = Array.isArray(fq) ? fq : [fq];
    for (const f of filters) params.append("fq", f);
  }

  const res = await fetch(`${KCS_BASE}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KCS search failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function getErratumData(advisoryId) {
  const res = await fetch(`${CSAF_BASE}/${advisoryId}.json`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CSAF fetch failed (${res.status}): ${text}`);
  }

  return res.json();
}

// --- Product name mapping ---

const PRODUCT_ALIASES = {
  "openshift": "Red Hat OpenShift Container Platform",
  "ocp": "Red Hat OpenShift Container Platform",
  "rhel": "Red Hat Enterprise Linux",
  "enterprise linux": "Red Hat Enterprise Linux",
  "ansible": "Red Hat Ansible Automation Platform",
  "aap": "Red Hat Ansible Automation Platform",
  "satellite": "Red Hat Satellite",
  "idm": "Red Hat Enterprise Linux",
  "ipa": "Red Hat Enterprise Linux",
  "freeipa": "Red Hat Enterprise Linux",
  "directory server": "Red Hat Directory Server",
  "certificate system": "Red Hat Certificate System",
  "sso": "Red Hat Single Sign-On",
  "keycloak": "Red Hat build of Keycloak",
  "quay": "Red Hat Quay",
  "acm": "Red Hat Advanced Cluster Management for Kubernetes",
  "acs": "Red Hat Advanced Cluster Security for Kubernetes",
  "service mesh": "Red Hat OpenShift Service Mesh",
  "virtualization": "Red Hat OpenShift Virtualization",
  "openstack": "Red Hat OpenStack Platform",
  "ceph": "Red Hat Ceph Storage",
  "data grid": "Red Hat Data Grid",
  "amq": "Red Hat AMQ",
  "serverless": "Red Hat OpenShift Serverless",
  "pipelines": "Red Hat OpenShift Pipelines",
  "gitops": "Red Hat OpenShift GitOps",
  "logging": "Red Hat OpenShift Logging",
};

function resolveProduct(input) {
  if (!input) return undefined;
  return PRODUCT_ALIASES[input.toLowerCase()] || input;
}

// --- Formatting helpers ---

function formatSearchResults(data) {
  const docs = data?.response?.docs || [];
  if (docs.length === 0) return "No results found.";

  return docs.map((doc, i) => {
    const parts = [`${i + 1}. **${doc.title || "Untitled"}**`];
    if (doc.id) parts.push(`   ID: ${doc.id}`);
    if (doc.documentKind) parts.push(`   Type: ${doc.documentKind}`);
    if (doc.view_uri) parts.push(`   URL: ${doc.view_uri}`);
    if (doc.lastModifiedDate) parts.push(`   Modified: ${doc.lastModifiedDate}`);
    if (doc.abstract) parts.push(`   ${doc.abstract}`);
    return parts.join("\n");
  }).join("\n\n");
}

function formatArticle(doc) {
  const parts = [];
  if (doc.title) parts.push(`# ${doc.title}`);
  if (doc.id) parts.push(`**ID:** ${doc.id}`);
  if (doc.documentKind) parts.push(`**Type:** ${doc.documentKind}`);
  if (doc.view_uri) parts.push(`**URL:** ${doc.view_uri}`);
  if (doc.product) {
    const products = Array.isArray(doc.product) ? doc.product.join(", ") : doc.product;
    parts.push(`**Products:** ${products}`);
  }
  if (doc.createdDate) parts.push(`**Created:** ${doc.createdDate}`);
  if (doc.lastModifiedDate) parts.push(`**Modified:** ${doc.lastModifiedDate}`);

  const sections = [
    ["Issue", doc.issue],
    ["Environment", doc.solution_environment],
    ["Root Cause", doc.solution_rootcause],
    ["Resolution", doc.solution_resolution],
    ["Diagnostic Steps", doc.solution_diagnosticsteps],
  ];

  for (const [heading, content] of sections) {
    if (content) {
      parts.push(`\n## ${heading}\n${content}`);
    }
  }

  if (!sections.some(([, c]) => c) && doc.abstract) {
    parts.push(`\n## Summary\n${doc.abstract}`);
  }

  return parts.join("\n");
}

function formatErrata(csaf) {
  const parts = [];
  const doc = csaf.document || {};
  const title = doc.title || csaf.id || "Unknown Advisory";
  parts.push(`# ${title}`);

  if (doc.tracking?.id) parts.push(`**Advisory:** ${doc.tracking.id}`);
  if (doc.tracking?.initial_release_date) parts.push(`**Released:** ${doc.tracking.initial_release_date}`);
  if (doc.tracking?.current_release_date) parts.push(`**Updated:** ${doc.tracking.current_release_date}`);
  if (doc.aggregate_severity?.text) parts.push(`**Severity:** ${doc.aggregate_severity.text}`);

  // CVEs from vulnerabilities
  const vulns = csaf.vulnerabilities || [];
  if (vulns.length > 0) {
    const cves = vulns.map(v => v.cve).filter(Boolean);
    if (cves.length > 0) {
      parts.push(`\n## CVEs (${cves.length})\n${cves.join(", ")}`);
    }
  }

  // Notes (description, summary)
  const notes = doc.notes || [];
  for (const note of notes) {
    if (note.category === "description" || note.category === "summary") {
      parts.push(`\n## ${note.category === "description" ? "Description" : "Summary"}\n${note.text}`);
    }
  }

  // Affected products from product_tree
  const tree = csaf.product_tree || {};
  const branches = tree.branches || [];
  const products = [];
  function collectProducts(branch) {
    if (branch.product) products.push(branch.product.name);
    if (branch.branches) branch.branches.forEach(collectProducts);
  }
  branches.forEach(collectProducts);
  if (products.length > 0) {
    const unique = [...new Set(products)].slice(0, 20);
    parts.push(`\n## Affected Products (${unique.length}${products.length > 20 ? ` of ${products.length}` : ""})\n${unique.map(p => `- ${p}`).join("\n")}`);
  }

  return parts.join("\n");
}

// --- MCP Server ---

const server = new McpServer({
  name: "mcp-redhat-knowledge",
  version: "0.1.0",
});

server.registerTool(
  "searchKnowledgeBase",
  {
    description: "Search Red Hat Knowledge Base for solutions and articles. Use error messages or technical keywords. Filter by product or documentType.",
    inputSchema: {
      query: z.string().describe("Search keywords"),
      maxResults: z.number().min(1).max(50).optional().default(10).describe("Max results 1-50 (default: 10)"),
      product: z.string().optional().describe("Product filter: 'OpenShift', 'RHEL' (default: OpenShift)"),
      documentType: z.string().optional().describe("Type: 'Solution', 'Documentation', 'Article'"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ query, maxResults, product, documentType }) => {
    const fq = [];
    if (product) fq.push(`product:"${resolveProduct(product)}"`);
    if (documentType) fq.push(`documentKind:"${documentType}"`);

    const data = await kcsSearch(query, {
      rows: maxResults,
      fields: "id,title,abstract,documentKind,view_uri,product,lastModifiedDate",
      fq: fq.length > 0 ? fq : undefined,
    });

    return {
      content: [{ type: "text", text: formatSearchResults(data) }],
    };
  }
);

server.registerTool(
  "getSolution",
  {
    description: "Get full content of a Knowledge Base article. Use article ID from search results.",
    inputSchema: {
      solutionId: z.string().describe("Article ID (numeric)"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ solutionId }) => {
    const data = await kcsSearch(`id:${solutionId}`, {
      rows: 1,
      fields: "id,title,abstract,documentKind,view_uri,product,issue,solution_environment,solution_rootcause,solution_resolution,solution_diagnosticsteps,lastModifiedDate,createdDate",
    });

    const docs = data?.response?.docs || [];
    if (docs.length === 0) {
      return { content: [{ type: "text", text: `No article found with ID ${solutionId}` }] };
    }

    return {
      content: [{ type: "text", text: formatArticle(docs[0]) }],
    };
  }
);

server.registerTool(
  "searchDocumentation",
  {
    description: "Search Red Hat documentation for how-to guides and best practices.",
    inputSchema: {
      topic: z.string().describe("Topic to search"),
      product: z.string().optional().describe("Product (default: OpenShift)"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ topic, product }) => {
    const fq = ['documentKind:"Documentation"'];
    if (product) fq.push(`product:"${resolveProduct(product)}"`);

    const data = await kcsSearch(topic, {
      rows: 10,
      fields: "id,title,abstract,documentKind,view_uri,product,lastModifiedDate",
      fq,
    });

    return {
      content: [{ type: "text", text: formatSearchResults(data) }],
    };
  }
);

server.registerTool(
  "getErrata",
  {
    description: "Get errata/advisory details by advisory ID (RHSA, RHBA, RHEA). Returns CVEs, severity, affected packages.",
    inputSchema: {
      advisoryId: z.string().describe("Advisory ID (e.g. 'RHSA-2024:1234')"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ advisoryId }) => {
    const data = await getErratumData(advisoryId);
    return {
      content: [{ type: "text", text: formatErrata(data) }],
    };
  }
);

// --- Start server ---

const transport = new StdioServerTransport();
await server.connect(transport);
