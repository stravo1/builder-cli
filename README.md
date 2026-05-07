# builder-cli

A command-line tool for syncing and managing [frappe/builder](https://github.com/frappe/builder) pages between your local workspace and a Frappe server. This tool enables **real-time, bi-directional synchronization**.


## Installation

```bash
git clone https://github.com/stravo1/builder-cli
cd builder
npm install
npm run build
# optionally link for development
npm link
```

## Configuration

The tool uses a `config.json` file to store connection settings:

```json
{
  "siteUrl": "https://sample.m.frappe.cloud",
  "siteName": "sample.m.frappe.cloud",
  "authToken": "key:secret",
  "socketioPort": 3000
}
```

## Commands

### `init` - Initialize Your Workspace

Set up a new local workspace by connecting to your Frappe server and syncing all pages.

```bash
builder init --site-name <name> --site-url <url> --token <token> [options]
```

**Options:**
- `-s, --site-name <name>` (required): Name of the site
- `-u, --site-url <url>` (required): URL of the Frappe server
- `-t, --token <token>` (required): Authentication token for the server
- `-p, --socketio-port <port>` (optional): Socket.IO port (defaults to site URL port)
- `--force`: Force initialization even if config already exists
- `--only-cli`: Skip interactive prompts

**Example:**
```bash
builder init --site-name "sample.m.frappe.cloud" --site-url "https://sample.m.frappe.cloud" --token "key:secret"
```

### `watch` - Sync Changes in Real-time

Monitor local files and server changes, syncing updates bidirectionally in real-time.

```bash
builder watch
```

This command:
- Watches for changes in the `pages/` directory
- Automatically syncs local changes to the server
- Listens for remote server updates via Socket.IO
- Maintains synchronization timestamps to avoid conflicts

### `pull` - Fetch Latest Data from Server

Manually pull the latest pages and data from the server.

```bash
builder pull
```

This will:
- Fetch all pages from the server
- Create or update local page directories
- Remove local directories for pages that no longer exist on the server

### `push` - Push Local Changes to Server

Push your local changes to the remote server.

```bash
builder push
```

## Usage Examples

### Getting Started

1. **Initialize a new workspace:**
   ```bash
   cd my-workspace
   builder init \
     --site-name "sample.m.frappe.cloud" \
     --site-url "https://sample.m.frappe.cloud" \
     --token "key:secret"
   ```

2. **Start watching for changes:**
   ```bash
   builder watch
   ```

3. **Make changes locally** in the `pages/` directory, and they'll automatically sync to the server.

4. **Manually pull updates:**
   ```bash
   builder pull
   ```

## Project Structure

```
builder-cli/
├── src/
│   ├── commands/             # CLI command implementations
│   │   ├── init.ts           # Initialize workspace
│   │   ├── pull.ts           # Pull pages from server
│   │   ├── push.ts           # Push changes to server
│   │   └── watch.ts          # Watch and sync changes
│   ├── queues/               # Queue management for async operations
│   │   ├── PullQueue.ts      # Queue for pull operations
│   │   └── PushQueue.ts      # Queue for push operations
│   ├── services/             # Core business logic services
│   │   ├── buildPage.ts      # Page building logic
│   │   ├── generateGitIgnore.ts # Generate .gitignore files
│   │   ├── writeBlock.ts     # Write block files to filesystem
│   │   └── writePage.ts      # Write page files to filesystem
│   ├── utils/                # Utility functions
│   │   ├── file.ts           # File system operations
│   │   ├── frappeClient.ts   # Frappe Server API client
│   │   ├── logger.ts         # Logging utilities
│   │   └── misc.ts           # Miscellaneous helpers
│   ├── global.d.ts           # Global type definitions
│   └── index.ts              # CLI entry point
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── README.md                 # Project documentation
└── LICENSE                   # License file
```

## Page Structure

Pages are organized in a `pages/` directory with the following structure:

```
pages/
└── page-name_page-id/
    ├── page.json         # Page metadata and configuration
    ├── head.html         # Page head content
    ├── body.html         # Page body content
    ├── data.py           # Page data script
    └── blocks/           # Page blocks directory
        └── block-name_block-id/
            ├── block.json
            ├── client_script.js
            └── data_script.py
```

## Authentication

Obtain an authentication token from your Frappe server:

1. Log in to your Frappe site
2. Navigate to your user profile
3. Scroll to the "API Access" section
4. Generate or copy your API token

## License

This project is licensed under the MIT License - see the LICENSE file for details.

