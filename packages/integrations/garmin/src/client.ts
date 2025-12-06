import { spawn, type ChildProcess } from 'child_process';
import { getLogger } from '@lifeos/core';

const logger = getLogger();

import type {
  GarminActivity,
  GarminActivityDetail,
  GarminDailySummary,
  GarminSleepData,
  GarminHRVData,
  GarminBodyComposition,
  GarminConfig,
} from './types.js';


/**
 * JSON-RPC message types for MCP protocol
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Client for communicating with the Garmin MCP server
 * Uses stdio to communicate with the Python MCP server
 */
export class GarminMCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = '';
  private initialized = false;
  private config: GarminConfig;

  constructor(config: GarminConfig = {}) {
    this.config = config;
  }

  /**
   * Start the Garmin MCP server process
   */
  async connect(): Promise<void> {
    if (this.process) {
      logger.debug('Already connected to Garmin MCP');
      return;
    }

    logger.info('Starting Garmin MCP server...');

    // Build environment variables for Garmin credentials
    const env: NodeJS.ProcessEnv = { ...process.env };
    
    if (this.config.email) {
      env.GARMIN_EMAIL = this.config.email;
    } else if (this.config.emailFile) {
      env.GARMIN_EMAIL_FILE = this.config.emailFile;
    }
    
    if (this.config.password) {
      env.GARMIN_PASSWORD = this.config.password;
    } else if (this.config.passwordFile) {
      env.GARMIN_PASSWORD_FILE = this.config.passwordFile;
    }

    return new Promise((resolve, reject) => {
      this.process = spawn('uvx', [
        '--python', '3.12',
        '--from', 'git+https://github.com/Taxuspt/garmin_mcp',
        'garmin-mcp'
      ], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleData(data.toString());
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const message = data.toString();
        // MCP servers often log to stderr, not all are errors
        if (message.includes('error') || message.includes('Error')) {
          logger.error('Garmin MCP stderr', null, { stderr: message });
        } else {
          logger.debug('Garmin MCP output', { stderr: message });
        }
      });

      this.process.on('error', (error) => {
        logger.error('Failed to start Garmin MCP', error);
        reject(error);
      });

      this.process.on('close', (code) => {
        logger.info(`Garmin MCP process exited with code ${code}`);
        this.cleanup();
      });

      // Initialize the MCP connection
      this.initializeMCP()
        .then(() => {
          this.initialized = true;
          resolve();
        })
        .catch(reject);
    });
  }

  /**
   * Initialize MCP protocol handshake
   */
  private async initializeMCP(): Promise<void> {
    // Send initialize request
    const initResult = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'lifeos-garmin-client',
        version: '0.1.0',
      },
    });

    logger.debug('MCP initialized', { result: JSON.stringify(initResult) });

    // Send initialized notification
    await this.sendNotification('notifications/initialized', {});
  }

  /**
   * Disconnect from the Garmin MCP server
   */
  disconnect(): void {
    if (this.process) {
      logger.info('Disconnecting from Garmin MCP...');
      this.process.kill();
      this.cleanup();
    }
  }

  private cleanup(): void {
    this.process = null;
    this.initialized = false;
    this.buffer = '';
    // Reject all pending requests
    for (const [, { reject }] of this.pendingRequests) {
      reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Handle incoming data from the MCP server
   */
  private handleData(data: string): void {
    this.buffer += data;

    // Process complete JSON-RPC messages
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const message = JSON.parse(line) as JsonRpcResponse;
        
        if (message.id !== undefined) {
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            this.pendingRequests.delete(message.id);
            if (message.error) {
              pending.reject(new Error(message.error.message));
            } else {
              pending.resolve(message.result);
            }
          }
        }
      } catch {
        logger.debug('Non-JSON line from MCP', { line });
      }
    }
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  private sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('Not connected to Garmin MCP'));
        return;
      }

      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify(request) + '\n';
      this.process.stdin.write(message, (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          reject(error);
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} timed out`));
        }
      }, 30000);
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('Not connected to Garmin MCP'));
        return;
      }

      const notification = {
        jsonrpc: '2.0',
        method,
        params,
      };

      const message = JSON.stringify(notification) + '\n';
      this.process.stdin.write(message, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Call an MCP tool
   */
  private async callTool<T>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.initialized) {
      throw new Error('Garmin MCP client not initialized. Call connect() first.');
    }

    const result = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    }) as { content: Array<{ type: string; text: string }> };

    // Parse the text content from MCP response
    if (result?.content?.[0]?.type === 'text') {
      try {
        return JSON.parse(result.content[0].text) as T;
      } catch {
        // Return raw text if not JSON
        return result.content[0].text as unknown as T;
      }
    }

    return result as unknown as T;
  }

  // ===========================================
  // Activity Methods
  // ===========================================

  /**
   * List recent activities (uses the list_activities tool)
   */
  async listActivities(_limit = 10): Promise<GarminActivity[]> {
    // Note: Garmin MCP list_activities doesn't support limit parameter
    return this.callTool<GarminActivity[]>('list_activities', {});
  }

  /**
   * Get activities for a specific date
   */
  async getActivitiesForDate(date: string): Promise<GarminActivity[]> {
    return this.callTool<GarminActivity[]>('get_activities_fordate', { date });
  }

  /**
   * Get detailed activity information
   */
  async getActivity(activityId: number): Promise<GarminActivityDetail> {
    return this.callTool<GarminActivityDetail>('get_activity', { activity_id: String(activityId) });
  }

  /**
   * Get activity splits
   */
  async getActivitySplits(activityId: number): Promise<unknown> {
    return this.callTool('get_activity_splits', { activity_id: String(activityId) });
  }

  /**
   * Get activities for a specific date range
   */
  async getActivitiesForDateRange(
    startDate: string,
    endDate: string,
    activityType?: string
  ): Promise<GarminActivity[]> {
    return this.callTool<GarminActivity[]>('get_activities_by_date', {
      start_date: startDate,
      end_date: endDate,
      activity_type: activityType,
    });
  }

  // ===========================================
  // Health Metrics Methods
  // ===========================================

  /**
   * Get daily stats (steps, calories, etc.)
   */
  async getDailySummary(date: string): Promise<GarminDailySummary> {
    return this.callTool<GarminDailySummary>('get_stats', { date });
  }

  /**
   * Get user summary (compatible with garminconnect-ha)
   */
  async getUserSummary(date: string): Promise<unknown> {
    return this.callTool('get_user_summary', { date });
  }

  /**
   * Get sleep data for a date
   */
  async getSleepData(date: string): Promise<GarminSleepData> {
    const raw = await this.callTool<{ dailySleepDTO?: GarminSleepData } & GarminSleepData>('get_sleep_data', { date });
    // Sleep data may be nested under dailySleepDTO
    if (raw?.dailySleepDTO) {
      return { ...raw.dailySleepDTO, ...raw };
    }
    return raw;
  }

  /**
   * Get resting heart rate for a date
   */
  async getRestingHeartRate(date: string): Promise<{ restingHeartRate?: number }> {
    return this.callTool('get_rhr_day', { date });
  }

  /**
   * Get heart rate data for a date
   */
  async getHeartRateData(date: string): Promise<unknown> {
    return this.callTool('get_heart_rates', { date });
  }

  /**
   * Get HRV data (from sleep data which contains HRV)
   */
  async getHRVData(date: string): Promise<GarminHRVData> {
    // HRV data is included in sleep data response
    const sleepData = await this.callTool<{ hrvData?: GarminHRVData; avgOvernightHrv?: number; hrvStatus?: string }>('get_sleep_data', { date });
    return {
      calendarDate: date,
      lastNightAvg: sleepData?.avgOvernightHrv,
      status: sleepData?.hrvStatus,
      ...(sleepData?.hrvData || {}),
    } as GarminHRVData;
  }

  /**
   * Get steps data for a date
   */
  async getSteps(date: string): Promise<unknown> {
    return this.callTool('get_steps_data', { date });
  }

  /**
   * Get body battery data
   */
  async getBodyBattery(startDate: string, endDate?: string): Promise<unknown> {
    return this.callTool('get_body_battery', { 
      start_date: startDate, 
      end_date: endDate || startDate 
    });
  }

  /**
   * Get training readiness
   */
  async getTrainingReadiness(date: string): Promise<unknown> {
    return this.callTool('get_training_readiness', { date });
  }

  /**
   * Get training status
   */
  async getTrainingStatus(date: string): Promise<unknown> {
    return this.callTool('get_training_status', { date });
  }

  // ===========================================
  // Body Composition Methods
  // ===========================================

  /**
   * Get body composition data
   */
  async getBodyComposition(startDate: string, endDate?: string): Promise<GarminBodyComposition> {
    return this.callTool<GarminBodyComposition>('get_body_composition', { 
      start_date: startDate,
      end_date: endDate || startDate,
    });
  }

  // ===========================================
  // Convenience Methods
  // ===========================================

  /**
   * Get comprehensive daily health data
   */
  async getDailyHealth(date: string): Promise<{
    summary: GarminDailySummary | null;
    sleep: GarminSleepData | null;
    hrv: GarminHRVData | null;
    bodyComposition: GarminBodyComposition | null;
  }> {
    const [summary, sleep, hrv, bodyComposition] = await Promise.allSettled([
      this.getDailySummary(date),
      this.getSleepData(date),
      this.getHRVData(date),
      this.getBodyComposition(date),
    ]);

    return {
      summary: summary.status === 'fulfilled' ? summary.value : null,
      sleep: sleep.status === 'fulfilled' ? sleep.value : null,
      hrv: hrv.status === 'fulfilled' ? hrv.value : null,
      bodyComposition: bodyComposition.status === 'fulfilled' ? bodyComposition.value : null,
    };
  }

  /**
   * Check if connected and initialized
   */
  isConnected(): boolean {
    return this.process !== null && this.initialized;
  }
}

/**
 * Create a Garmin MCP client with configuration from environment
 */
export function createGarminClient(config?: Partial<GarminConfig>): GarminMCPClient {
  return new GarminMCPClient({
    email: process.env.GARMIN_EMAIL,
    password: process.env.GARMIN_PASSWORD,
    emailFile: process.env.GARMIN_EMAIL_FILE,
    passwordFile: process.env.GARMIN_PASSWORD_FILE,
    ...config,
  });
}

