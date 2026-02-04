/**
 * Command parsing utilities
 */

import { ParsedCommand } from './types';

/**
 * Parse a command interaction event data
 *
 * @param data - Interaction event data from Discord
 * @returns Parsed command with name and options
 */
export function parseCommandInteraction(
  data: {
    name: string;
    options?: Array<{
      name: string;
      type: number;
      value?: string | number | boolean;
    }>;
  }
): ParsedCommand {
  const options: Record<string, unknown> = {};

  if (data.options) {
    for (const opt of data.options) {
      // Discord application command option types:
      // 1= SUB_COMMAND, 2= SUB_COMMAND_GROUP, 3= STRING,
      // 4= INTEGER, 5= BOOLEAN, 6= USER, 7= CHANNEL,
      // 8= ROLE, 9= MENTIONABLE, 10= NUMBER
      if (opt.type === 5) { // BOOLEAN
        options[opt.name] = opt.value === 'true' || opt.value === true;
      } else if (opt.type === 4) { // INTEGER
        options[opt.name] = Number(opt.value);
      } else if (opt.type === 3) { // STRING
        options[opt.name] = opt.value;
      } else if (opt.type === 10) { // NUMBER
        options[opt.name] = Number(opt.value);
      } else {
        options[opt.name] = opt.value;
      }
    }
  }

  return { name: data.name, options };
}
