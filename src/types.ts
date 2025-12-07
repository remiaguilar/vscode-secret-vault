export interface VaultItem {
    name: string;
    username?: string;
    password?: string;
    notes?: string;
}

export interface Folder {
    name: string;
    items: VaultItem[];
}

export interface Vault {
    folders: Folder[];
}
