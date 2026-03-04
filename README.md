# mcp-redhat-knowledge

An [MCP](https://modelcontextprotocol.io/) server for the Red Hat Knowledge Base API. Lets AI assistants search solutions, articles, and documentation from the Red Hat Customer Portal.

## Planned Tools

| Tool | Description |
|------|-------------|
| `searchKnowledgeBase` | Search for solutions, articles, and errata |
| `getSolution` | Get full content of a KB article by ID |
| `getErrata` | Get errata/advisory details |
| `searchDocumentation` | Search Red Hat product documentation |

## Prerequisites

- Node.js 18+
- A Red Hat offline API token ([generate one here](https://access.redhat.com/management/api))

## Status

Under development. See [mcp-redhat-support](https://github.com/shonstephens/mcp-redhat-support) for the case management MCP which is available now.

## License

MIT
