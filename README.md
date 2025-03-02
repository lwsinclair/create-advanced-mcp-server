# create-mcp-server

A CLI tool to scaffold a Model Context Protocol (MCP) server with integrated web capabilities.

This package creates a fully structured MCP server project following the architecture documented in the MCP Advanced Node specification, providing a robust foundation for MCP server development.

## Features

- Generates a complete MCP server project structure
- Configurable options for web API, WebSocket, and database integration
- TypeScript-based with modern ES modules
- Includes Prisma ORM integration (optional)
- Express-based web API (optional)
- WebSocket server integration (optional)
- Example implementations for tools, resources, and prompts
- Full error handling and logging infrastructure
- Configuration system with environment variable support

## Installation

```bash
npm install -g create-advanced-mcp-server
```

## Usage

```bash
# Create a new project with interactive prompts
npx create-advanced-mcp-server my-mcp-server

# Create a new project with default options
npx create-advanced-mcp-server my-mcp-server --yes

# Skip dependency installation
npx create-advanced-mcp-server my-mcp-server --skip-install

# Show verbose output
npx create-advanced-mcp-server my-mcp-server --verbose
```

## Generated Project Structure

The generated project follows the structure outlined in the MCP Advanced Node specification:

```
src/
├── index.ts                  # Entry point
├── initialize.ts             # Initialization logic
├── config.ts                 # Configuration management
├── types.ts                  # Type definitions
├── utils/                    # Utility modules
│   ├── index.ts              # Utility exports
│   ├── logging.ts            # Logging utilities
│   ├── errors.ts             # Error classes
│   └── ...                   # Additional utilities
├── tools/                    # Individual tool implementations
│   ├── index.ts              # Tool registration
│   ├── exampleTool.ts        # Example tool implementation
│   └── ...                   # Additional tools
├── resources/                # Resource implementations
│   ├── index.ts              # Resource registration  
│   ├── exampleResource.ts    # Example resource implementation
│   └── ...                   # Additional resources
├── prompts/                  # Prompt implementations
│   ├── index.ts              # Prompt registration
│   ├── examplePrompt.ts      # Example prompt implementation
│   └── ...                   # Additional prompts
├── services/                 # Service layer
│   ├── index.ts              # Service exports
│   ├── exampleService.ts     # Example service implementation
│   └── ...                   # Additional services
```

Depending on your selections, additional directories may be included:

### Web API (if enabled)

```
├── web/                      # Web API components
│   ├── index.ts              # Web server setup
│   ├── middleware/           # Express middleware
│   │   ├── index.ts          # Middleware exports
│   │   ├── errorHandler.ts   # Error handling middleware
│   │   └── ...               # Additional middleware
│   ├── routes/               # API routes
│   │   ├── index.ts          # Route registration
│   │   ├── exampleRoutes.ts  # Example route definitions
│   │   └── ...               # Additional routes
│   └── controllers/          # API controllers
│       ├── index.ts          # Controller exports
│       ├── exampleController.ts # Example controller logic
│       └── ...               # Additional controllers
```

### WebSocket (if enabled)

```
├── websocket/                # WebSocket components
│   ├── index.ts              # WebSocket server setup
│   ├── events/               # Event definitions
│   │   ├── index.ts          # Event exports
│   │   ├── exampleEvents.ts  # Example event handlers
│   │   └── ...               # Additional events
│   └── ...                   # Additional WebSocket components
```

### Prisma (if enabled)

```
├── data/                     # Data access layer
│   ├── index.ts              # Data layer exports
│   ├── client.ts             # Prisma client initialization
│   ├── database.ts           # Database management (migrations)
│   ├── repositories/         # Repository implementations
│   │   ├── index.ts          # Repository exports
│   │   ├── baseRepository.ts # Base repository pattern
│   │   └── ...               # Additional repositories
│   └── ...                   # Additional data components
├── prisma/                   # Prisma configuration
│   ├── schema.prisma         # Database schema definition
```

## License

MIT
