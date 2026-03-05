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

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "redhat-knowledge": {
      "command": "npx",
      "args": ["-y", "@shonstephens/mcp-redhat-knowledge"],
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
      "args": ["-y", "@shonstephens/mcp-redhat-knowledge"],
      "env": {
        "REDHAT_TOKEN": "${REDHAT_TOKEN}"
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
  --command "npx -y @shonstephens/mcp-redhat-knowledge" \
  --tools "*" \
  --app-id redhat-knowledge
```

### Podman (containerized)

Run as a container for use with any MCP client:

```bash
podman run -i --rm \
  --env REDHAT_TOKEN \
  ghcr.io/shonstephens/mcp-redhat-knowledge:latest
```

Point your MCP client at the container using `podman run -i --rm` as the command, similar to the VS Code example above.

## Authentication

The server exchanges your Red Hat offline API token for a short-lived bearer token via Red Hat SSO. Tokens are cached and refreshed automatically. The `getErrata` tool uses the public Security Data API and does not require authentication.

## License

MIT
