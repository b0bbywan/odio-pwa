export interface OdioServerInfo {
	hostname: string;
	os_platform: string;
	os_version: string;
	api_sw: string;
	api_version: string;
	backends: {
		mpris: boolean;
		pulseaudio: boolean;
		systemd: boolean;
		zeroconf: boolean;
		power?: boolean;
	};
}

export interface OdioInstance {
	id: string;
	host: string;
	port: number;
	label?: string;
	serverInfo?: OdioServerInfo | null;
	status: 'unknown' | 'online' | 'offline' | 'probing' | 'blocked' | 'cors';
	connectedAt?: number;
	// Loaded from URL params; not persisted to localStorage until the user saves.
	transient?: boolean;
	// Live MPRIS players, fed over SSE; never persisted.
	players?: MprisPlayer[];
}

export type PowerEvent = 'reboot' | 'poweroff';

// GET /power, only served when the power backend is enabled. Fixed at
// odio-api startup from the login1 capabilities.
export interface PowerCapabilities {
	reboot: boolean;
	power_off: boolean;
}

// Matches the POST /power/{action} route names (not the SSE event names).
export type PowerAction = keyof PowerCapabilities;

export type PlaybackStatus = 'Playing' | 'Paused' | 'Stopped';

export interface MprisCapabilities {
	can_play: boolean;
	can_pause: boolean;
	can_go_next: boolean;
	can_go_previous: boolean;
	can_seek: boolean;
	can_control: boolean;
}

// Subset of odio-api's MPRIS player, as served by GET /players and the
// player.* SSE events. position and mpris:length are in microseconds;
// position was sampled at position_updated_at.
export interface MprisPlayer {
	bus_name: string;
	identity: string;
	playback_status: PlaybackStatus;
	position?: number;
	position_updated_at: string;
	rate?: number;
	metadata?: Record<string, string>;
	capabilities: MprisCapabilities;
}

export type PlayerAction = 'play_pause' | 'previous' | 'next';

// One entry of a player.position SSE event (5 s heartbeat while playing).
// emitted_at is epoch milliseconds.
export interface PlayerPosition {
	bus_name: string;
	position: number;
	emitted_at: number;
}
