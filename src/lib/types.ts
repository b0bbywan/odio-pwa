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
}

export type PowerEvent = 'reboot' | 'poweroff';
