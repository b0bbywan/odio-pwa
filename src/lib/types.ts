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
	status: 'unknown' | 'online' | 'offline' | 'probing';
	connectedAt?: number;
}

export type AppView = 'list' | 'instance';

export type PowerEvent = 'reboot' | 'poweroff';
