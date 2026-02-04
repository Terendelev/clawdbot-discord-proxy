/**
 * Command registration utilities
 */

import { CommandDefinition, CommandOptionType } from './types';
import { DiscordApi } from '../api';

/**
 * Convert our option type to Discord's numeric type
 */
function optionTypeToDiscord(type: CommandOptionType): number {
  switch (type) {
    case 'STRING':
      return 3;
    case 'INTEGER':
      return 4;
    case 'BOOLEAN':
      return 5;
    default:
      return 3;
  }
}

/**
 * Register a global application command
 *
 * @param api - Discord API instance
 * @param command - Command definition
 * @param applicationId - Bot application ID
 */
export async function registerCommand(
  api: DiscordApi,
  command: CommandDefinition,
  applicationId: string
): Promise<void> {
  await api.call({
    method: 'POST',
    path: `/applications/${applicationId}/commands`,
    body: {
      name: command.name,
      description: command.description,
      options: command.options?.map((opt) => ({
        name: opt.name,
        description: opt.description,
        type: optionTypeToDiscord(opt.type),
        required: opt.required ?? false,
      })),
    },
  });
}

/**
 * Register all builtin commands
 *
 * @param api - Discord API instance
 * @param applicationId - Bot application ID
 */
export async function registerBuiltinCommands(
  api: DiscordApi,
  applicationId: string
): Promise<void> {
  const commands: CommandDefinition[] = [
    {
      name: 'oc-status',
      description: '查看插件运行状态',
      options: [
        {
          name: 'detail',
          type: 'BOOLEAN',
          description: '显示详细状态信息',
          required: false,
        },
      ],
    },
    {
      name: 'oc-help',
      description: '显示帮助信息和可用命令',
    },
    {
      name: 'oc-reconnect',
      description: '重新连接 Discord Gateway',
    },
  ];

  for (const command of commands) {
    await registerCommand(api, command, applicationId);
  }
}

/**
 * Get all registered commands for an application
 *
 * @param api - Discord API instance
 * @param applicationId - Bot application ID
 */
export async function getRegisteredCommands(
  api: DiscordApi,
  applicationId: string
): Promise<unknown[]> {
  const response = await api.call({
    method: 'GET',
    path: `/applications/${applicationId}/commands`,
  });
  return response as unknown[];
}

/**
 * Delete a command by ID
 *
 * @param api - Discord API instance
 * @param applicationId - Bot application ID
 * @param commandId - Command ID to delete
 */
export async function deleteCommand(
  api: DiscordApi,
  applicationId: string,
  commandId: string
): Promise<void> {
  await api.call({
    method: 'DELETE',
    path: `/applications/${applicationId}/commands/${commandId}`,
  });
}
