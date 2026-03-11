# mcp-redhat-knowledge

An [MCP](https://modelcontextprotocol.io/) server for the Red Hat Knowledge Base API. Lets AI assistants search solutions, articles, documentation, and errata from the Red Hat Customer Portal.

## Tools

| Tool | Description |
|------|-------------|
| `searchKnowledgeBase` | Search KB for solutions and articles by keyword, with optional product and document type filters |
| `getSolution` | Get full content of a KB article by ID (environment, issue, root cause, resolution, diagnostic steps) |
| `searchDocumentation` | Search Red Hat product documentation for how-to guides and best practices |
| `getErrata` | Get errata/advisory details by RHSA/RHBA/RHEA ID (CVEs, severity, affected products) |

## Product Name Aliases

The `searchKnowledgeBase` and `searchDocumentation` tools accept shorthand product names that are automatically resolved to the full names used by the KCS API:

| Alias | Resolves To |
|-------|-------------|
| `OpenShift`, `OCP` | Red Hat OpenShift Container Platform |
| `RHEL`, `Enterprise Linux` | Red Hat Enterprise Linux |
| `Ansible`, `AAP` | Red Hat Ansible Automation Platform |
| `Satellite` | Red Hat Satellite |
| `IdM`, `IPA`, `FreeIPA` | Red Hat Enterprise Linux |
| `SSO` | Red Hat Single Sign-On |
| `Keycloak` | Red Hat build of Keycloak |
| `Quay` | Red Hat Quay |
| `ACM` | Red Hat Advanced Cluster Management for Kubernetes |
| `ACS` | Red Hat Advanced Cluster Security for Kubernetes |
| `Service Mesh` | Red Hat OpenShift Service Mesh |
| `Virtualization` | Red Hat OpenShift Virtualization |
| `OpenStack` | Red Hat OpenStack Platform |
| `Ceph` | Red Hat Ceph Storage |
| `Serverless` | Red Hat OpenShift Serverless |
| `Pipelines` | Red Hat OpenShift Pipelines |
| `GitOps` | Red Hat OpenShift GitOps |
| `Logging` | Red Hat OpenShift Logging |

You can also pass the full product name directly if your product is not in this list.

## Prerequisites

- Node.js 18+
- A Red Hat offline API token ([generate one here](https://access.redhat.com/management/api))

## Configuration

Set your Red Hat offline API token in your shell profile:

```bash
export REDHAT_TOKEN="your-offline-token-here"
```

In enterprise environments, provide `REDHAT_TOKEN` through your secrets management solution (e.g. HashiCorp Vault, Kubernetes secrets, or your CI platform's secret variables) rather than shell profiles.

### Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "redhat-knowledge": {
      "command": "npx",
      "args": ["-y", "mcp-redhat-knowledge"],
      "env": {
        "REDHAT_TOKEN": "$REDHAT_TOKEN"
      }
    }
  }
}
```

### watsonx Orchestrate

```bash
# Add a connection for the Red Hat API token
orchestrate connections add --app-id "redhat-knowledge"
orchestrate connections configure --app-id redhat-knowledge --env draft --kind key_value --type team --url "https://access.redhat.com"
orchestrate connections set-credentials --app-id "redhat-knowledge" --env draft -e REDHAT_TOKEN=your-offline-token-here

# Import the MCP toolkit
orchestrate toolkits import --kind mcp \
  --name redhat-knowledge \
  --description "Red Hat Knowledge Base" \
  --command "npx -y mcp-redhat-knowledge" \
  --tools "*" \
  --app-id redhat-knowledge
```

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "redhat-knowledge": {
      "command": "npx",
      "args": ["-y", "mcp-redhat-knowledge"],
      "env": {
        "REDHAT_TOKEN": "${REDHAT_TOKEN}"
      }
    }
  }
}
```

### VS Code / Cursor

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "mcpServers": {
    "redhat-knowledge": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-redhat-knowledge"],
      "env": {
        "REDHAT_TOKEN": "${REDHAT_TOKEN}"
      }
    }
  }
}
```

## Authentication

The server exchanges your Red Hat offline API token for a short-lived bearer token via Red Hat SSO. Tokens are cached and refreshed automatically. The `getErrata` tool uses the public Security Data API and does not require authentication.

## Related MCP Servers

- [mcp-redhat-support](https://github.com/shonstephens/mcp-redhat-support) - Support case management
- [mcp-redhat-account](https://github.com/shonstephens/mcp-redhat-account) - Account management
- [mcp-redhat-subscription](https://github.com/shonstephens/mcp-redhat-subscription) - Subscription management
- [mcp-redhat-manpage](https://github.com/shonstephens/mcp-redhat-manpage) - RHEL man pages

## License

MIT
