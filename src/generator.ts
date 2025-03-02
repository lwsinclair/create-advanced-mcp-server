import path from 'path';
import fs from 'fs-extra';
import ora from 'ora';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';

// Get the directory name for the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define template directory
const templatesDir = path.join(__dirname, '../templates');

/**
 * Utility function to read and normalize template files
 */
async function readTemplate(templatePath: string): Promise<string> {
    console.log(`Reading template from: ${templatePath}`);
    try {
        const content = await fs.readFile(templatePath, 'utf-8');
        // Normalize line endings to LF
        const normalized = content.replace(/\r\n/g, '\n');
        console.log(`Template content length: ${normalized.length}`);
        return normalized;
    } catch (error) {
        console.error(`Error reading template: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Project configuration interface
 */
interface ProjectConfig {
    projectName: string;
    description: string;
    includeWeb: boolean;
    includeWebSocket: boolean;
    includePrisma: boolean;
    databaseType: 'sqlite' | 'postgresql' | 'mysql';
}

/**
 * CLI options interface
 */
interface CliOptions {
    yes: boolean;
    skipInstall: boolean;
    verbose: boolean;
}

/**
 * Create a new MCP server project
 */
export async function createProject(
    projectDir: string,
    config: ProjectConfig,
    options: CliOptions
): Promise<void> {
    // Create project directory if it doesn't exist
    await fs.ensureDir(projectDir);

    const spinner = ora('Creating project structure...').start();

    try {
        // Create project structure
        await createProjectStructure(projectDir, config);
        spinner.succeed('Project structure created');

        // Create package.json
        spinner.start('Creating package.json...');
        await createPackageJson(projectDir, config);
        spinner.succeed('package.json created');

        // Create tsconfig.json
        spinner.start('Creating tsconfig.json...');
        await createTsConfig(projectDir);
        spinner.succeed('tsconfig.json created');

        // Create main files
        spinner.start('Creating main project files...');
        await createMainFiles(projectDir, config);
        spinner.succeed('Main project files created');

        // Create core modules
        spinner.start('Creating core modules...');
        await createCoreModules(projectDir, config);
        spinner.succeed('Core modules created');

        if (config.includeWeb) {
            spinner.start('Creating web API modules...');
            await createWebModules(projectDir, config);
            spinner.succeed('Web API modules created');
        }

        if (config.includeWebSocket) {
            spinner.start('Creating WebSocket modules...');
            await createWebSocketModules(projectDir, config);
            spinner.succeed('WebSocket modules created');
        }

        if (config.includePrisma) {
            spinner.start('Setting up Prisma...');
            await setupPrisma(projectDir, config);
            spinner.succeed('Prisma setup completed');
        }

        // Install dependencies
        if (!options.skipInstall) {
            spinner.start('Installing dependencies...');
            await installDependencies(projectDir, config, options.verbose);
            spinner.succeed('Dependencies installed');
        }

        // Setup git repository
        spinner.start('Setting up git repository...');
        await setupGitRepo(projectDir);
        spinner.succeed('Git repository initialized');

    } catch (error) {
        spinner.fail('Failed to create project');
        throw error;
    }
}

/**
 * Create the basic project structure
 */
async function createProjectStructure(projectDir: string, config: ProjectConfig): Promise<void> {
    // Create src directory and subdirectories
    const directories = [
        'src',
        'src/utils',
        'src/tools',
        'src/resources',
        'src/prompts',
        'src/services',
    ];

    if (config.includeWeb) {
        directories.push(
            'src/web',
            'src/web/middleware',
            'src/web/routes',
            'src/web/controllers'
        );
    }

    if (config.includeWebSocket) {
        directories.push(
            'src/websocket',
            'src/websocket/events'
        );
    }

    if (config.includePrisma) {
        directories.push(
            'src/data',
            'src/data/repositories',
            'prisma'
        );
    }

    for (const dir of directories) {
        await fs.ensureDir(path.join(projectDir, dir));
    }

    // Create empty README.md
    await fs.writeFile(
        path.join(projectDir, 'README.md'),
        `# ${config.projectName}\n\n${config.description}\n`
    );

    // Create .gitignore
    await fs.writeFile(
        path.join(projectDir, '.gitignore'),
        `node_modules/\ndist/\n.env\n*.log\ncoverage/\n.DS_Store\n`
    );

    // Create .env.example
    const envContent = [
        '# Server Configuration',
        'SERVER_NAME=mcp-server',
        'SERVER_VERSION=1.0.0',
        '',
        '# Logging',
        'LOG_LEVEL=info',
        'LOG_FORMAT=text',
        '',
    ];

    if (config.includeWeb) {
        envContent.push(
            '# Web API',
            'WEB_ENABLED=true',
            'WEB_PORT=3000',
            'WEB_STATIC_PATH=public',
            ''
        );
    }

    if (config.includeWebSocket) {
        envContent.push(
            '# WebSocket',
            'WS_ENABLED=true',
            'WS_PORT=3001',
            ''
        );
    }

    if (config.includePrisma) {
        let dbUrl = '';
        switch (config.databaseType) {
            case 'sqlite':
                dbUrl = 'file:./dev.db';
                break;
            case 'postgresql':
                dbUrl = 'postgresql://username:password@localhost:5432/mydatabase';
                break;
            case 'mysql':
                dbUrl = 'mysql://username:password@localhost:3306/mydatabase';
                break;
        }

        envContent.push(
            '# Database',
            `DATABASE_URL=${dbUrl}`,
            'DB_PROVIDER=' + config.databaseType,
            'DB_RUN_MIGRATIONS=true',
            'DB_LOG_QUERIES=false',
            'DB_POOL_SIZE=10',
            ''
        );
    }

    await fs.writeFile(
        path.join(projectDir, '.env.example'),
        envContent.join('\n')
    );

    // Create an actual .env file with the same content
    await fs.writeFile(
        path.join(projectDir, '.env'),
        envContent.join('\n')
    );
}

/**
 * Create package.json for the project
 */
async function createPackageJson(projectDir: string, config: ProjectConfig): Promise<void> {
    const packageJson: any = {
        name: config.projectName,
        version: '1.0.0',
        description: config.description,
        type: 'module',
        main: 'dist/index.js',
        scripts: {
            build: 'tsc',
            start: 'node dist/index.js',
            dev: 'nodemon --exec node --loader ts-node/esm src/index.ts',
            lint: 'eslint . --ext .ts',
            format: 'prettier --write "src/**/*.ts"',
            test: 'jest',
        },
        dependencies: {
            '@modelcontextprotocol/sdk': '^1.5.0',
            'dotenv': '^16.4.5',
            'zod': '^3.24.1',
        },
        devDependencies: {
            '@types/node': '^20.13.3',
            'typescript': '^5.7.3',
            'ts-node': '^10.9.2',
            'nodemon': '^3.1.0',
            'jest': '^29.7.0',
            'ts-jest': '^29.1.2',
            '@types/jest': '^29.5.12',
            'eslint': '^8.57.0',
            '@typescript-eslint/eslint-plugin': '^7.2.0',
            '@typescript-eslint/parser': '^7.2.0',
            'prettier': '^3.2.5'
        },
        engines: {
            'node': '>=16.0.0'
        }
    };

    // Add web dependencies if needed
    if (config.includeWeb) {
        packageJson.dependencies = {
            ...packageJson.dependencies,
            'express': '^4.19.1',
            'cors': '^2.8.5',
            'helmet': '^7.1.0',
            'morgan': '^1.10.0',
            'compression': '^1.7.4',
        };
        packageJson.devDependencies = {
            ...packageJson.devDependencies,
            '@types/express': '^4.17.21',
            '@types/cors': '^2.8.17',
            '@types/morgan': '^1.9.9',
            '@types/compression': '^1.7.5',
        };
    }

    // Add WebSocket dependencies if needed
    if (config.includeWebSocket) {
        packageJson.dependencies = {
            ...packageJson.dependencies,
            'ws': '^8.17.1',
        };
        packageJson.devDependencies = {
            ...packageJson.devDependencies,
            '@types/ws': '^8.5.10',
        };
    }

    // Add Prisma dependencies if needed
    if (config.includePrisma) {
        packageJson.dependencies = {
            ...packageJson.dependencies,
            '@prisma/client': '^5.11.0',
        };
        packageJson.devDependencies = {
            ...packageJson.devDependencies,
            'prisma': '^5.11.0',
        };
        packageJson.scripts = {
            ...packageJson.scripts,
            'prisma:generate': 'prisma generate',
            'prisma:migrate': 'prisma migrate dev',
            'prisma:studio': 'prisma studio',
        };
    }

    await fs.writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );
}

/**
 * Create tsconfig.json for the project
 */
async function createTsConfig(projectDir: string): Promise<void> {
    const tsConfig = {
        compilerOptions: {
            target: 'ES2020',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            esModuleInterop: true,
            forceConsistentCasingInFileNames: true,
            strict: true,
            skipLibCheck: true,
            outDir: 'dist',
            declaration: true,
            resolveJsonModule: true,
            sourceMap: true,
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist', 'coverage']
    };

    await fs.writeFile(
        path.join(projectDir, 'tsconfig.json'),
        JSON.stringify(tsConfig, null, 2)
    );
}

/**
 * Create main project files
 */
async function createMainFiles(projectDir: string, config: ProjectConfig): Promise<void> {
    // Create index.ts
    const indexFileContent = `#!/usr/bin/env node

import { createServer, initializeDatabase } from './initialize.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';
import { registerAllPrompts } from './prompts/index.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config, configPromise } from './config.js';
import { logger } from './utils/logging.js';
${config.includeWeb ? "import { startWebServer } from './web/index.js';" : ''}
${config.includeWebSocket ? "import { startWebSocketServer } from './websocket/index.js';" : ''}

const main = async () => {
    try {
        logger.info("Initializing MCP server...");

        // Wait for configuration to load completely
        await configPromise;

        ${config.includePrisma ? '// Initialize database\n        await initializeDatabase();' : ''}

        // Create and configure the MCP server
        const server = createServer();

        // Register all tools/resources/prompts
        registerAllTools(server);
        registerAllResources(server);
        registerAllPrompts(server);

        // Connect MCP transport
        const transport = new StdioServerTransport();
        await server.connect(transport);
        
        ${config.includeWeb ? `// Start web server if enabled in config
        if (config.web.enabled) {
            await startWebServer();
        }` : ''}
        
        ${config.includeWebSocket ? `// Start WebSocket server if enabled in config
        if (config.websocket.enabled) {
            await startWebSocketServer();
        }` : ''}

        logger.info("MCP server is running!");
    } catch (error) {
        logger.error("Error starting server:", error);
        process.exit(1);
    }
};

// Add error handlers
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
});

process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    ${config.includePrisma ? `try {
        // Close database connection
        // Add any cleanup logic here
        logger.info('Cleanup completed');
    } catch (error) {
        logger.error('Error during cleanup:', error);
    }` : ''}
    process.exit(0);
});

// Run the main function
main();
`;

    await fs.writeFile(
        path.join(projectDir, 'src/index.ts'),
        indexFileContent
    );

    // Create initialize.ts
    const initializeFileContent = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from './config.js';
import { logger } from './utils/logging.js';
${config.includePrisma ? "import { initializeDatabase as initDb, closeDatabaseConnection } from './data/database.js';" : ''}

/**
 * Create and configure the MCP server
 */
export const createServer = (): McpServer => {
    // Create a new MCP server
    const server = new McpServer(
        {
            name: config.server.name,
            version: config.server.version,
        }
    );

    // Set up error handler
    server.server.onerror = (error) => {
        logger.error("MCP server error:", error);
    };

    return server;
};

${config.includePrisma ? `/**
 * Initialize the database
 */
export const initializeDatabase = async (): Promise<void> => {
    try {
        await initDb();
    } catch (error) {
        logger.error("Database initialization error:", error);
        throw error;
    }
};

/**
 * Clean up resources
 */
export const cleanup = async (): Promise<void> => {
    try {
        await closeDatabaseConnection();
    } catch (error) {
        logger.error("Cleanup error:", error);
    }
};` : ''}
`;

    await fs.writeFile(
        path.join(projectDir, 'src/initialize.ts'),
        initializeFileContent
    );

    // Create config.ts
    const configFileContent = `import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory name for the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export interface Config {
    server: {
        name: string;
        version: string;
        description?: string;
    };
    ${config.includePrisma ? `database: {
        provider: '${config.databaseType}' | 'postgresql' | 'mysql' | 'sqlite';
        connectionString: string;
        runMigrations?: boolean;
        logQueries?: boolean;
        poolSize?: number;
    };` : ''}
    ${config.includeWeb ? `web: {
        enabled: boolean;
        port: number;
        staticPath?: string;
    };` : ''}
    ${config.includeWebSocket ? `websocket: {
        enabled: boolean;
        port: number;
    };` : ''}
    logging: {
        level: 'debug' | 'info' | 'warn' | 'error';
        format?: 'json' | 'text';
    };
}

// Default configuration
const defaultConfig: Config = {
    server: {
        name: '${config.projectName}',
        version: '1.0.0',
        description: '${config.description}'
    },
    ${config.includePrisma ? `database: {
        provider: '${config.databaseType}',
        connectionString: 'file:./dev.db',
        runMigrations: false,
        logQueries: false,
        poolSize: 10
    },` : ''}
    ${config.includeWeb ? `web: {
        enabled: false,
        port: 3000
    },` : ''}
    ${config.includeWebSocket ? `websocket: {
        enabled: false,
        port: 3001
    },` : ''}
    logging: {
        level: 'info',
        format: 'text'
    }
};

// Load configuration from environment
function loadEnvConfig(): Partial<Config> {
    return {
        server: {
            name: process.env.SERVER_NAME || defaultConfig.server.name,
            version: process.env.SERVER_VERSION || defaultConfig.server.version,
            description: process.env.SERVER_DESCRIPTION || defaultConfig.server.description
        },
        ${config.includePrisma ? `database: {
            provider: (process.env.DB_PROVIDER as any) || defaultConfig.database.provider,
            connectionString: process.env.DATABASE_URL || defaultConfig.database.connectionString,
            runMigrations: process.env.DB_RUN_MIGRATIONS === 'true' || defaultConfig.database.runMigrations,
            logQueries: process.env.DB_LOG_QUERIES === 'true' || defaultConfig.database.logQueries,
            poolSize: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE) : defaultConfig.database.poolSize
        },` : ''}
        ${config.includeWeb ? `web: {
            enabled: process.env.WEB_ENABLED === 'true' || defaultConfig.web.enabled,
            port: process.env.WEB_PORT ? parseInt(process.env.WEB_PORT) : defaultConfig.web.port,
            staticPath: process.env.WEB_STATIC_PATH || defaultConfig.web.staticPath
        },` : ''}
        ${config.includeWebSocket ? `websocket: {
            enabled: process.env.WS_ENABLED === 'true' || defaultConfig.websocket.enabled,
            port: process.env.WS_PORT ? parseInt(process.env.WS_PORT) : defaultConfig.websocket.port
        },` : ''}
        logging: {
            level: (process.env.LOG_LEVEL as any) || defaultConfig.logging.level,
            format: (process.env.LOG_FORMAT as any) || defaultConfig.logging.format
        }
    };
}

// Deep merge objects
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
    if (!source) return target;
    
    const output = { ...target };
    
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key as keyof typeof source])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key as keyof typeof source] });
                } else {
                    (output as any)[key] = deepMerge(
                        (target as any)[key] as object, 
                        source[key as keyof typeof source] as object
                    );
                }
            } else {
                Object.assign(output, { [key]: source[key as keyof typeof source] });
            }
        });
    }
    
    return output;
}

function isObject(item: any): boolean {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

// Initialize configuration
let config: Config = { ...defaultConfig };

// Load configuration asynchronously
const configPromise = Promise.resolve().then(() => {
    const envConfig = loadEnvConfig();
    config = deepMerge(config, envConfig);
    return config;
});

export { config, configPromise };
`;

    await fs.writeFile(
        path.join(projectDir, 'src/config.ts'),
        configFileContent
    );

    // Create types.ts
    await fs.writeFile(
        path.join(projectDir, 'src/types.ts'),
        `// Add your custom types here\n`
    );
}

/**
 * Create core modules for the project
 */
async function createCoreModules(projectDir: string, config: ProjectConfig): Promise<void> {
    // Create utils/logging.ts
    const loggingContent = `// Simple logging utility
export const logger = {
    debug: (message: string, ...args: any[]) => {
        console.debug(\`[DEBUG] \${message}\`, ...args);
    },
    info: (message: string, ...args: any[]) => {
        console.info(\`[INFO] \${message}\`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
        console.warn(\`[WARN] \${message}\`, ...args);
    },
    error: (message: string, ...args: any[]) => {
        console.error(\`[ERROR] \${message}\`, ...args);
    }
};
`;
    await fs.writeFile(
        path.join(projectDir, 'src/utils/logging.ts'),
        loggingContent
    );

    // Create utils/errors.ts
    const errorsContent = `export class BaseError extends Error {
    public code: string;
    public status: number;
    public details?: any;
    
    constructor(message: string, code: string, status: number, details?: any) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.status = status;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends BaseError {
    constructor(message: string, details?: any) {
        super(message, 'VALIDATION_ERROR', 400, details);
    }
}

export class EntityNotFoundError extends BaseError {
    constructor(message: string) {
        super(message, 'NOT_FOUND', 404);
    }
}

export class DatabaseError extends BaseError {
    constructor(message: string, details?: any) {
        super(message, 'DATABASE_ERROR', 500, details);
    }
}

export class UnauthorizedError extends BaseError {
    constructor(message: string) {
        super(message, 'UNAUTHORIZED', 401);
    }
}

export class ForbiddenError extends BaseError {
    constructor(message: string) {
        super(message, 'FORBIDDEN', 403);
    }
}
`;
    await fs.writeFile(
        path.join(projectDir, 'src/utils/errors.ts'),
        errorsContent
    );

    // Create utils/index.ts
    await fs.writeFile(
        path.join(projectDir, 'src/utils/index.ts'),
        `export * from './logging.js';
export * from './errors.js';
`
    );

    // Create tools/index.ts
    await fs.writeFile(
        path.join(projectDir, 'src/tools/index.ts'),
        `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exampleTool } from "./exampleTool.js";

/**
 * Register all tools with the server
 */
export const registerAllTools = (server: McpServer): void => {
    exampleTool(server);
    // Register additional tools here
};
`
    );

    // Create tools/exampleTool.ts - Read from template file
    const exampleToolPath = path.join(templatesDir, 'tools/exampleTool.ts.template');
    const exampleToolContent = await readTemplate(exampleToolPath);
    await fs.writeFile(
        path.join(projectDir, 'src/tools/exampleTool.ts'),
        exampleToolContent
    );

    // Create resources/index.ts
    await fs.writeFile(
        path.join(projectDir, 'src/resources/index.ts'),
        `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exampleResource } from "./exampleResource.js";

/**
 * Register all resources with the server
 */
export const registerAllResources = (server: McpServer): void => {
    exampleResource(server);
    // Register additional resources here
};
`
    );

    // Create resources/exampleResource.ts - Read from template file
    const exampleResourcePath = path.join(templatesDir, 'resources/exampleResource.ts.template');
    const exampleResourceContent = await readTemplate(exampleResourcePath);
    await fs.writeFile(
        path.join(projectDir, 'src/resources/exampleResource.ts'),
        exampleResourceContent
    );

    // Create prompts/index.ts
    await fs.writeFile(
        path.join(projectDir, 'src/prompts/index.ts'),
        `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { examplePrompt } from "./examplePrompt.js";

/**
 * Register all prompts with the server
 */
export const registerAllPrompts = (server: McpServer): void => {
    examplePrompt(server);
    // Register additional prompts here
};
`
    );

    // Create prompts/examplePrompt.ts - Read from template file
    const examplePromptPath = path.join(templatesDir, 'prompts/examplePrompt.ts.template');
    const examplePromptContent = await readTemplate(examplePromptPath);
    await fs.writeFile(
        path.join(projectDir, 'src/prompts/examplePrompt.ts'),
        examplePromptContent
    );

    // Create services/index.ts
    await fs.writeFile(
        path.join(projectDir, 'src/services/index.ts'),
        `// Export your service implementations
export * from './exampleService.js';
`
    );

    // Create services/exampleService.ts
    const exampleServiceContent = `import { logger } from "../utils/logging.js";
import { EntityNotFoundError } from "../utils/errors.js";

/**
 * Example of a service implementation
 */
export class ExampleService {
    /**
     * Process some data
     */
    public async processData(data: string, options?: { option1?: boolean; option2?: number }): Promise<string> {
        try {
            logger.info(\`Processing data: \${data.substring(0, 50)}...\`);
            
            // Simple example implementation
            const opt1 = options?.option1 ?? true;
            const opt2 = options?.option2 ?? 10;
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 100));
            
            return \`Processed [\${opt1 ? 'Option1' : ''}\${opt2 > 0 ? ', Option2=' + opt2 : ''}]: \${data}\`;
        } catch (error) {
            logger.error(\`Error processing data:\`, error);
            throw error;
        }
    }
    
    /**
     * Get a resource by ID
     */
    public async getResourceData(id: string): Promise<string> {
        try {
            logger.info(\`Getting resource data for \${id}\`);
            
            // Example implementation
            if (id === 'not-found') {
                throw new EntityNotFoundError(\`Resource with ID \${id} not found\`);
            }
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 100));
            
            return \`This is resource data for: \${id}\`;
        } catch (error) {
            logger.error(\`Error getting resource data:\`, error);
            throw error;
        }
    }
}

export const exampleService = new ExampleService();
`;
    await fs.writeFile(
        path.join(projectDir, 'src/services/exampleService.ts'),
        exampleServiceContent
    );
}

/**
 * Create web API modules for the project
 */
async function createWebModules(projectDir: string, config: ProjectConfig): Promise<void> {
    // Create web/index.ts
    const webIndexContent = `import express from 'express';
import { config } from '../config.js';
import { logger } from '../utils/logging.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

const app = express();

export const startWebServer = async (): Promise<void> => {
    // Configure middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors());
    app.use(helmet());
    app.use(compression());
    app.use(morgan('dev'));
    
    // Serve static files if configured
    if (config.web.staticPath) {
        app.use(express.static(config.web.staticPath));
    }
    
    // Register all routes
    registerRoutes(app);
    
    // Add error handling middleware
    app.use(errorHandler);
    
    // Start the server
    return new Promise((resolve) => {
        const server = app.listen(config.web.port, () => {
            logger.info(\`Web server running on port \${config.web.port}\`);
            resolve();
        });
        
        server.on('error', (error) => {
            logger.error('Web server error:', error);
        });
    });
};

export { app };
`;
    await fs.ensureDir(path.join(projectDir, 'src/web'));
    await fs.writeFile(
        path.join(projectDir, 'src/web/index.ts'),
        webIndexContent
    );

    // Create web/middleware/errorHandler.ts
    const errorHandlerContent = `import { Request, Response, NextFunction } from 'express';
import { BaseError } from '../../utils/errors.js';
import { logger } from '../../utils/logging.js';

export const errorHandler = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    logger.error(\`API error: \${error.message}\`, error);
    
    if (error instanceof BaseError) {
        res.status(error.status).json({
            error: error.message,
            code: error.code,
            details: error.details
        });
    } else {
        // For unexpected errors, return a generic error
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'INTERNAL_ERROR'
        });
    }
};
`;
    await fs.ensureDir(path.join(projectDir, 'src/web/middleware'));
    await fs.writeFile(
        path.join(projectDir, 'src/web/middleware/errorHandler.ts'),
        errorHandlerContent
    );

    // Create web/middleware/index.ts
    await fs.writeFile(
        path.join(projectDir, 'src/web/middleware/index.ts'),
        `export * from './errorHandler.js';\n`
    );

    // Create web/routes/index.ts
    const routesIndexContent = `import { Router, Express } from 'express';
import { exampleRoutes } from './exampleRoutes.js';

export const registerRoutes = (app: Express): void => {
    const apiRouter = Router();
    
    // Mount routes
    apiRouter.use('/examples', exampleRoutes);
    
    // Mount API router
    app.use('/api', apiRouter);
    
    // Add health check
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    });
};
`;
    await fs.ensureDir(path.join(projectDir, 'src/web/routes'));
    await fs.writeFile(
        path.join(projectDir, 'src/web/routes/index.ts'),
        routesIndexContent
    );

    // Create web/routes/exampleRoutes.ts
    const exampleRoutesContent = `import { Router } from 'express';
import { exampleController } from '../controllers/exampleController.js';

export const exampleRoutes = Router();

// GET /api/examples
exampleRoutes.get('/', exampleController.getAll);

// GET /api/examples/:id
exampleRoutes.get('/:id', exampleController.getById);

// POST /api/examples
exampleRoutes.post('/', exampleController.create);

// PUT /api/examples/:id
exampleRoutes.put('/:id', exampleController.update);

// DELETE /api/examples/:id
exampleRoutes.delete('/:id', exampleController.delete);
`;
    await fs.writeFile(
        path.join(projectDir, 'src/web/routes/exampleRoutes.ts'),
        exampleRoutesContent
    );

    // Create web/controllers/exampleController.ts
    const exampleControllerContent = `import { Request, Response, NextFunction } from 'express';
import { exampleService } from '../../services/exampleService.js';
import { ValidationError } from '../../utils/errors.js';

export const exampleController = {
    async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Example implementation
            res.json([
                { id: '1', name: 'Example 1' },
                { id: '2', name: 'Example 2' }
            ]);
        } catch (error) {
            next(error);
        }
    },
    
    async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            
            try {
                const data = await exampleService.getResourceData(id);
                res.json({ id, data });
            } catch (error) {
                next(error);
            }
        } catch (error) {
            next(error);
        }
    },
    
    async create(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Validate request body
            if (!req.body.name) {
                throw new ValidationError('Name is required');
            }
            
            // Example implementation
            res.status(201).json({ 
                id: Math.random().toString(36).substring(2, 15),
                ...req.body 
            });
        } catch (error) {
            next(error);
        }
    },
    
    async update(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            
            // Validate request body
            if (!req.body.name) {
                throw new ValidationError('Name is required');
            }
            
            // Example implementation
            res.json({ id, ...req.body });
        } catch (error) {
            next(error);
        }
    },
    
    async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            
            // Example implementation
            res.status(204).end();
        } catch (error) {
            next(error);
        }
    }
};
`;
    await fs.ensureDir(path.join(projectDir, 'src/web/controllers'));
    await fs.writeFile(
        path.join(projectDir, 'src/web/controllers/exampleController.ts'),
        exampleControllerContent
    );

    // Create web/controllers/index.ts
    await fs.writeFile(
        path.join(projectDir, 'src/web/controllers/index.ts'),
        `export * from './exampleController.js';\n`
    );
}

/**
 * Create WebSocket modules for the project
 */
async function createWebSocketModules(projectDir: string, config: ProjectConfig): Promise<void> {
    // Create websocket/index.ts
    const wsIndexContent = `import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../config.js';
import { logger } from '../utils/logging.js';
import { registerEventHandlers } from './events/index.js';
import { EventEmitter } from 'events';

// Create a global event bus for pub-sub pattern
export const eventBus = new EventEmitter();

export class WebSocketManager {
    private wss: WebSocketServer | null = null;
    private connections: Set<WebSocket>;
    
    constructor() {
        this.connections = new Set();
    }
    
    async initialize(): Promise<void> {
        this.wss = new WebSocketServer({ port: config.websocket.port });
        
        this.wss.on('connection', (ws) => {
            this.connections.add(ws);
            logger.info('WebSocket client connected');
            
            ws.on('message', (message) => {
                this.handleMessage(ws, message);
            });
            
            ws.on('close', () => {
                this.connections.delete(ws);
                logger.info('WebSocket client disconnected');
            });
        });
        
        // Register event handlers
        registerEventHandlers(eventBus, this);
        
        logger.info(\`WebSocket server running on port \${config.websocket.port}\`);
    }
    
    private handleMessage(ws: WebSocket, message: WebSocket.Data): void {
        try {
            const parsed = JSON.parse(message.toString());
            logger.info(\`Received WebSocket message: \${JSON.stringify(parsed)}\`);
            
            // Handle different message types
            if (parsed.type) {
                eventBus.emit(\`message:\${parsed.type}\`, parsed.payload, ws);
            }
        } catch (error) {
            logger.error('Error handling WebSocket message:', error);
        }
    }
    
    broadcast(eventType: string, payload: any): void {
        const message = JSON.stringify({ type: eventType, payload });
        
        this.connections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }
    
    sendTo(ws: WebSocket, eventType: string, payload: any): void {
        if (ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ type: eventType, payload });
            ws.send(message);
        }
    }
}

const webSocketManager = new WebSocketManager();

export const startWebSocketServer = async (): Promise<void> => {
    await webSocketManager.initialize();
};
`;
    await fs.ensureDir(path.join(projectDir, 'src/websocket'));
    await fs.writeFile(
        path.join(projectDir, 'src/websocket/index.ts'),
        wsIndexContent
    );

    // Create websocket/events/index.ts
    const wsEventsIndexContent = `import { EventEmitter } from 'events';
import { WebSocketManager } from '../index.js';
import { exampleEvents } from './exampleEvents.js';

export const registerEventHandlers = (eventBus: EventEmitter, wsManager: WebSocketManager): void => {
    // Register all event handlers
    exampleEvents(eventBus, wsManager);
};
`;
    await fs.ensureDir(path.join(projectDir, 'src/websocket/events'));
    await fs.writeFile(
        path.join(projectDir, 'src/websocket/events/index.ts'),
        wsEventsIndexContent
    );

    // Create websocket/events/exampleEvents.ts
    const exampleEventsContent = `import { EventEmitter } from 'events';
import { WebSocketManager } from '../index.js';
import { WebSocket } from 'ws';
import { logger } from '../../utils/logging.js';

export const exampleEvents = (eventBus: EventEmitter, wsManager: WebSocketManager): void => {
    // Handle incoming 'example' messages from clients
    eventBus.on('message:example', (payload: any, sender: WebSocket) => {
        logger.info('Received example message:', payload);
        
        // Process the message and send a response
        wsManager.sendTo(sender, 'example_response', {
            received: payload,
            timestamp: new Date().toISOString()
        });
    });
    
    // Example of a server-initiated event that broadcasts to all clients
    eventBus.on('example_update', (data: any) => {
        logger.info('Broadcasting example update:', data);
        wsManager.broadcast('example_update', data);
    });
};
`;
    await fs.writeFile(
        path.join(projectDir, 'src/websocket/events/exampleEvents.ts'),
        exampleEventsContent
    );
}

/**
 * Set up Prisma for the project
 */
async function setupPrisma(projectDir: string, config: ProjectConfig): Promise<void> {
    // Create prisma/schema.prisma
    let prismaProvider = '';
    switch (config.databaseType) {
        case 'sqlite':
            prismaProvider = 'sqlite';
            break;
        case 'postgresql':
            prismaProvider = 'postgresql';
            break;
        case 'mysql':
            prismaProvider = 'mysql';
            break;
    }

    const schemaContent = `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${prismaProvider}"
  url      = env("DATABASE_URL")
}

// Example models
model Example {
  id          String   @id @default(uuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  role      String   @default("user")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;
    await fs.ensureDir(path.join(projectDir, 'prisma'));
    await fs.writeFile(
        path.join(projectDir, 'prisma/schema.prisma'),
        schemaContent
    );

    // Create data/client.ts
    const clientContent = `import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logging.js';

// Create a global singleton Prisma client
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      'error',
      'info',
      'warn'
    ],
  });
};

// Use globalThis to ensure a single instance across the application
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// Set up logging events
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  
  logger.debug(\`Prisma Query: \${params.model}.\${params.action} took \${after - before}ms\`);
  return result;
});

// Only do this in development to avoid memory leaks in production
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
`;
    await fs.ensureDir(path.join(projectDir, 'src/data'));
    await fs.writeFile(
        path.join(projectDir, 'src/data/client.ts'),
        clientContent
    );

    // Create data/database.ts
    const databaseContent = `import { prisma } from './client.js';
import { logger } from '../utils/logging.js';
import { execSync } from 'child_process';
import { config } from '../config.js';

export const initializeDatabase = async (): Promise<void> => {
  try {
    logger.info('Connecting to database...');
    
    // Test the database connection
    await prisma.$connect();
    
    // In development, optionally run migrations
    if (process.env.NODE_ENV !== 'production' && config.database.runMigrations) {
      logger.info('Running database migrations...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    }
    
    logger.info('Database initialization completed successfully.');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

// Ensure proper cleanup on application shutdown
export const closeDatabaseConnection = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed.');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
};
`;
    await fs.writeFile(
        path.join(projectDir, 'src/data/database.ts'),
        databaseContent
    );

    // Create data/repositories/baseRepository.ts
    const baseRepoContent = `import { prisma } from '../client.js';
import { logger } from '../../utils/logging.js';

export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  protected abstract model: any;
  
  async findById(id: string): Promise<T | null> {
    try {
      return await this.model.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error(\`Error in findById:\`, error);
      throw error;
    }
  }
  
  async findAll(): Promise<T[]> {
    try {
      return await this.model.findMany();
    } catch (error) {
      logger.error(\`Error in findAll:\`, error);
      throw error;
    }
  }
  
  async create(data: CreateInput): Promise<T> {
    try {
      return await this.model.create({
        data,
      });
    } catch (error) {
      logger.error(\`Error in create:\`, error);
      throw error;
    }
  }
  
  async update(id: string, data: UpdateInput): Promise<T> {
    try {
      return await this.model.update({
        where: { id },
        data,
      });
    } catch (error) {
      logger.error(\`Error in update:\`, error);
      throw error;
    }
  }
  
  async delete(id: string): Promise<T> {
    try {
      return await this.model.delete({
        where: { id },
      });
    } catch (error) {
      logger.error(\`Error in delete:\`, error);
      throw error;
    }
  }
}
`;
    await fs.ensureDir(path.join(projectDir, 'src/data/repositories'));
    await fs.writeFile(
        path.join(projectDir, 'src/data/repositories/baseRepository.ts'),
        baseRepoContent
    );

    // Create data/repositories/exampleRepository.ts
    const exampleRepoContent = `import { BaseRepository } from './baseRepository.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../client.js';
import { logger } from '../../utils/logging.js';

type Example = Prisma.ExampleGetPayload<{}>;
type ExampleCreateInput = Prisma.ExampleCreateInput;
type ExampleUpdateInput = Prisma.ExampleUpdateInput;

export class ExampleRepository extends BaseRepository<Example, ExampleCreateInput, ExampleUpdateInput> {
  protected model = prisma.example;
  
  // Add item-specific query methods
  async findByName(name: string): Promise<Example | null> {
    try {
      return await this.model.findFirst({
        where: { name },
      });
    } catch (error) {
      logger.error(\`Error in findByName:\`, error);
      throw error;
    }
  }
  
  async findWithPagination(page: number = 1, pageSize: number = 20): Promise<{ items: Example[], total: number }> {
    try {
      const skip = (page - 1) * pageSize;
      
      const [items, total] = await Promise.all([
        this.model.findMany({
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        this.model.count(),
      ]);
      
      return { items, total };
    } catch (error) {
      logger.error(\`Error in findWithPagination:\`, error);
      throw error;
    }
  }
}

export const exampleRepository = new ExampleRepository();
`;
    await fs.writeFile(
        path.join(projectDir, 'src/data/repositories/exampleRepository.ts'),
        exampleRepoContent
    );

    // Create data/repositories/index.ts
    await fs.writeFile(
        path.join(projectDir, 'src/data/repositories/index.ts'),
        `export * from './exampleRepository.js';\n`
    );

    // Create data/index.ts
    await fs.writeFile(
        path.join(projectDir, 'src/data/index.ts'),
        `export * from './client.js';
export * from './database.js';
export * from './repositories/index.js';
`
    );
}

/**
 * Install dependencies for the project
 */
async function installDependencies(projectDir: string, config: ProjectConfig, verbose: boolean): Promise<void> {
    try {
        const cwd = projectDir;
        const stdio = verbose ? 'inherit' : 'pipe';

        // Log for debugging
        console.log(chalk.blue(`Installing dependencies in ${projectDir}...`));

        try {
            // Install dependencies with timeout
            execSync('npm install', {
                cwd,
                stdio,
                timeout: 300000 // 5 minute timeout
            });

            console.log(chalk.green('Dependency installation completed successfully'));

            // Initialize Prisma if needed
            if (config.includePrisma) {
                console.log(chalk.blue('Generating Prisma client...'));
                execSync('npx prisma generate', {
                    cwd,
                    stdio,
                    timeout: 60000 // 1 minute timeout
                });
                console.log(chalk.green('Prisma client generated successfully'));
            }
        } catch (execError) {
            console.error(chalk.red('Command execution failed:'));
            if (execError instanceof Error) {
                console.error(chalk.red(execError.message));

                // Provide alternative for common errors
                console.log(chalk.yellow('\nTrying alternative approach...'));
                try {
                    // Try using npm ci instead of npm install
                    execSync('npm ci --no-audit --no-fund', {
                        cwd,
                        stdio,
                        timeout: 300000
                    });
                    console.log(chalk.green('Alternative installation method succeeded'));
                    return;
                } catch (altError) {
                    console.error(chalk.red('Alternative approach also failed'));
                    throw new Error(`Failed to install dependencies. Try running 'npm install' manually in the project directory.`);
                }
            }
            throw execError;
        }
    } catch (error) {
        console.error(chalk.red('Detailed error information:'));
        if (error instanceof Error) {
            console.error(chalk.red(error.stack || error.message));
        }
        throw new Error(`Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Set up git repository for the project
 */
async function setupGitRepo(projectDir: string): Promise<void> {
    try {
        // Initialize git repository
        execSync('git init', { cwd: projectDir, stdio: 'ignore' });

        // Add files
        execSync('git add .', { cwd: projectDir, stdio: 'ignore' });

        // Create initial commit
        execSync('git commit -m "Initial commit"', {
            cwd: projectDir,
            stdio: 'ignore',
            env: {
                ...process.env,
                GIT_AUTHOR_NAME: 'MCP Scaffold',
                GIT_AUTHOR_EMAIL: 'mcp-scaffold@example.com',
                GIT_COMMITTER_NAME: 'MCP Scaffold',
                GIT_COMMITTER_EMAIL: 'mcp-scaffold@example.com',
            }
        });
    } catch (error) {
        // Git setup is optional, don't fail if it doesn't work
        console.warn(`Warning: Failed to set up git repository: ${error instanceof Error ? error.message : String(error)}`);
    }
}
