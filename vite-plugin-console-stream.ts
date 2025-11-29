/**
 * Vite plugin to stream browser console.log to terminal via WebSocket
 */
import type { Plugin, ViteDevServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';

export function consoleStreamPlugin(): Plugin {
  let wss: WebSocketServer | null = null;

  return {
    name: 'console-stream',

    configureServer(server: ViteDevServer) {
      // Create WebSocket server on a different port
      const WS_PORT = 3001;
      wss = new WebSocketServer({ port: WS_PORT });

      console.log(`\n🔌 Console stream WebSocket listening on ws://localhost:${WS_PORT}`);
      console.log('📝 Browser logs will appear below:\n');
      console.log('─'.repeat(60));

      wss.on('connection', (ws: WebSocket) => {
        console.log('🌐 Browser connected to console stream\n');

        ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            const timestamp = new Date().toLocaleTimeString();
            const level = message.level?.toUpperCase() || 'LOG';
            const prefix = getPrefix(level);

            // Format the log output
            const args = message.args || [];
            const formattedArgs = args.map((arg: any) => {
              if (typeof arg === 'object') {
                return JSON.stringify(arg, null, 2);
              }
              return String(arg);
            }).join(' ');

            console.log(`${prefix} [${timestamp}] ${formattedArgs}`);
          } catch (e) {
            console.log(`[RAW] ${data.toString()}`);
          }
        });

        ws.on('close', () => {
          console.log('\n🔌 Browser disconnected from console stream');
        });
      });

      // Cleanup on server close
      server.httpServer?.on('close', () => {
        wss?.close();
      });
    },

    // Inject the client-side console interceptor
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: getClientScript(),
          injectTo: 'head',
        },
      ];
    },
  };
}

function getPrefix(level: string): string {
  switch (level) {
    case 'ERROR': return '❌';
    case 'WARN': return '⚠️ ';
    case 'INFO': return 'ℹ️ ';
    case 'DEBUG': return '🐛';
    default: return '📋';
  }
}

function getClientScript(): string {
  return `
// Console stream client - connects to Vite plugin WebSocket
(function() {
  const WS_PORT = 3001;
  let ws = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 5;
  const messageQueue = [];

  function connect() {
    ws = new WebSocket('ws://localhost:' + WS_PORT);

    ws.onopen = function() {
      console.log('[ConsoleStream] Connected to terminal');
      reconnectAttempts = 0;
      // Flush queued messages
      while (messageQueue.length > 0) {
        ws.send(messageQueue.shift());
      }
    };

    ws.onclose = function() {
      if (reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++;
        setTimeout(connect, 1000);
      }
    };

    ws.onerror = function() {
      // Silent - will reconnect
    };
  }

  function sendLog(level, args) {
    const message = JSON.stringify({
      level: level,
      args: Array.from(args).map(arg => {
        if (arg instanceof Error) {
          return { error: arg.message, stack: arg.stack };
        }
        if (typeof arg === 'object') {
          try {
            return JSON.parse(JSON.stringify(arg));
          } catch {
            return String(arg);
          }
        }
        return arg;
      }),
      timestamp: Date.now()
    });

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    } else {
      messageQueue.push(message);
    }
  }

  // Store original console methods
  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console)
  };

  // Override console methods
  console.log = function(...args) {
    originalConsole.log(...args);
    sendLog('log', args);
  };

  console.warn = function(...args) {
    originalConsole.warn(...args);
    sendLog('warn', args);
  };

  console.error = function(...args) {
    originalConsole.error(...args);
    sendLog('error', args);
  };

  console.info = function(...args) {
    originalConsole.info(...args);
    sendLog('info', args);
  };

  console.debug = function(...args) {
    originalConsole.debug(...args);
    sendLog('debug', args);
  };

  // Connect on load
  connect();
})();
`;
}

export default consoleStreamPlugin;
