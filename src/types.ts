/**
 * Type definitions for Discord plugin
 */

/** Gateway intents for Discord connection */
export enum GatewayIntent {
  GUILDS = 1 << 0,
  GUILD_MEMBERS = 1 << 1,
  GUILD_BANS = 1 << 2,
  GUILD_EMOJIS_AND_STICKERS = 1 << 3,
  GUILD_INTEGRATIONS = 1 << 4,
  GUILD_WEBHOOKS = 1 << 5,
  GUILD_INVITES = 1 << 6,
  GUILD_VOICE_STATES = 1 << 7,
  GUILD_PRESENCES = 1 << 8,
  GUILD_MESSAGES = 1 << 9,
  GUILD_MESSAGE_REACTIONS = 1 << 10,
  GUILD_MESSAGE_TYPING = 1 << 11,
  DIRECT_MESSAGES = 1 << 12,
  DIRECT_MESSAGE_REACTIONS = 1 << 13,
  DIRECT_MESSAGE_TYPING = 1 << 14,
  MESSAGE_CONTENT = 1 << 15,
  GUILD_SCHEDULED_EVENTS = 1 << 16,
  AUTO_MODERATION_CONFIGURATION = 1 << 20,
  AUTO_MODERATION_EXECUTION = 1 << 21,
}

/** Discord Gateway opcodes */
export enum GatewayOpcode {
  DISPATCH = 0,
  HEARTBEAT = 1,
  IDENTIFY = 2,
  PRESENCE_UPDATE = 3,
  VOICE_STATE_UPDATE = 4,
  RESUME = 6,
  RECONNECT = 7,
  REQUEST_GUILD_MEMBERS = 8,
  INVALID_SESSION = 9,
  HELLO = 10,
  HEARTBEAT_ACK = 11,
}

/** Gateway close codes */
export enum GatewayCloseCode {
  UNKNOWN_ERROR = 4000,
  UNKNOWN_OPCODE = 4001,
  DECODE_ERROR = 4002,
  NOT_AUTHENTICATED = 4003,
  AUTHENTICATION_FAILED = 4004,
  ALREADY_AUTHENTICATED = 4005,
  INVALID_SEQUENCE = 4007,
  RATE_LIMITED = 4008,
  SESSION_TIMEOUT = 4009,
  INVALID_SHARD = 4010,
  SHARDING_REQUIRED = 4011,
  INVALID_API_VERSION = 4012,
  INVALID_INTENTS = 4013,
  DISALLOWED_INTENTS = 4014,
}

/** Discord user structure */
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  bot?: boolean;
  system?: boolean;
  mfa_enabled?: boolean;
  banner?: string | null;
  accent_color?: number;
  locale?: string;
  verified?: boolean;
  email?: string;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
}

/** Discord guild structure */
export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  splash?: string | null;
  discovery_splash?: string | null;
  owner?: boolean;
  permissions?: string;
  region?: string;
  afk_channel_id?: string | null;
  afk_timeout?: number;
  verification_level?: number;
  default_message_notifications?: number;
  explicit_content_filter?: number;
  features?: string[];
  mfa_level?: number;
  application_id?: string | null;
  system_channel_id?: string | null;
  system_channel_flags?: number;
  rules_channel_id?: string | null;
  max_presences?: number | null;
  max_members?: number;
  vanity_url_code?: string | null;
  description?: string | null;
  banner?: string | null;
  premium_tier?: number;
  premium_subscription_count?: number;
  preferred_locale?: string;
  public_updates_channel_id?: string | null;
  max_video_channel_users?: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

/** Discord channel structure */
export interface DiscordChannel {
  id: string;
  type: number;
  guild_id?: string;
  position?: number;
  permission_overwrites?: Array<{
    id: string;
    type: number;
    allow: string;
    deny: string;
  }>;
  name?: string;
  topic?: string | null;
  nsfw?: boolean;
  last_message_id?: string | null;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  recipients?: DiscordUser[];
  icon?: string | null;
  owner_id?: string;
  managed?: boolean;
  application_id?: string | null;
  parent_id?: string | null;
  last_pin_timestamp?: string | null;
}

/** Discord message structure */
export interface DiscordMessage {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: DiscordUser;
  member?: {
    nick?: string;
    avatar?: string;
    roles?: string[];
    joined_at?: string;
    premium_since?: string;
    deaf?: boolean;
    mute?: boolean;
    flags?: number;
  };
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  tts: boolean;
  mention_everyone: boolean;
  mentions: Array<DiscordUser & { member?: object }>;
  mention_roles: string[];
  attachments: Array<{
    id: string;
    filename: string;
    description?: string;
    content_type?: string;
    size: number;
    url: string;
    proxy_url: string;
    height?: number;
    width?: number;
  }>;
  embeds: Array<object>;
  reactions?: Array<{
    count: number;
    me: boolean;
    emoji: {
      id: string | null;
      name: string;
    };
  }>;
  nonce?: string | number;
  pinned: boolean;
  webhook_id?: string;
  type: number;
  activity?: object;
  application?: object;
  application_id?: string;
  message_reference?: {
    channel_id: string;
    guild_id?: string;
    message_id: string;
  };
  flags?: number;
}

/** Plugin configuration */
export interface DiscordPluginConfig {
  enabled: boolean;
  token: string;
  proxyUrl?: string;
  intents: GatewayIntent[];
  defaultChannel?: string;
  autoReconnect: boolean;
  heartbeatInterval: number;
}

/** Channel plugin interface */
export interface ChannelPlugin {
  name: string;
  version: string;
  initialize: (options?: { config?: Record<string, unknown> }) => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  onMessage: (callback: (message: DiscordMessage) => void) => void;
}
