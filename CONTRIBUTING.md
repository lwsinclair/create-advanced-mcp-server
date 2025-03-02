# Contributing to create-mcp-server

Thank you for considering contributing to the MCP server scaffolding tool. This document provides guidelines and instructions for development.

## Development Setup

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd create-mcp-server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. Create a symbolic link for local development:

   ```bash
   npm link
   ```

This will make the `create-mcp-server` command available globally, linked to your local development version.

## Testing Your Changes

To test the scaffolding tool:

```bash
# Using the linked command
create-mcp-server test-project

# Or directly from source
node dist/index.js test-project
```

To test with various options:

```bash
# Use default options without prompts
create-mcp-server test-project --yes

# Skip dependency installation
create-mcp-server test-project --skip-install

# Show verbose output
create-mcp-server test-project --verbose
```

## Project Structure

- `src/index.ts` - CLI entry point with command-line parsing
- `src/generator.ts` - Core generation logic for creating project files
- `templates/` - Directory for template files (currently not used, as files are generated dynamically)

## Making Changes

1. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes
3. Build the project to verify your changes:

   ```bash
   npm run build
   ```

4. Test your changes as described above
5. Commit and push your changes

## Adding New Features

When adding new features to the scaffolding tool, consider:

1. **CLI Options**: Add new options to the Commander program in `src/index.ts`
2. **Project Configuration**: Update the configuration interface in `src/generator.ts`
3. **File Generation**: Modify the generator functions to create new files or modify existing ones
4. **Dependencies**: Update the package dependencies in the generated projects

## Submit a Pull Request

Once your changes are ready, submit a pull request with a clear description of:

1. What the changes do
2. Why they're valuable
3. How they've been tested
4. Any potential issues or limitations

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
