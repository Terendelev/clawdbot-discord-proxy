/**
 * Command type definitions for Native Commands
 */

/** Command option types */
export type CommandOptionType = 'STRING' | 'INTEGER' | 'BOOLEAN';

/** Command option definition */
export interface CommandOption {
  name: string;
  type: CommandOptionType;
  description: string;
  required?: boolean;
}

/** Command definition for registration */
export interface CommandDefinition {
  name: string;
  description: string;
  options?: CommandOption[];
}

/** Command handler function type */
export type CommandHandler = (
  args: Record<string, unknown>
) => Promise<string> | string;

/** Command registry mapping command name to handler */
export interface CommandRegistry {
  [name: string]: CommandHandler;
}

/** Parsed command result */
export interface ParsedCommand {
  name: string;
  options: Record<string, unknown>;
}
