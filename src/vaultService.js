"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultService = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
class VaultService {
    constructor(context, secretStorage) {
        this.context = context;
        this.secretStorage = secretStorage;
        this.vaultPath = null;
        this.masterKey = null;
        this.vault = null;
        // Cargar directorio configurado
        const savedDir = this.context.globalState.get(VaultService.DIRECTORY_KEY);
        if (savedDir && fs.existsSync(savedDir)) {
            this.vaultPath = path.join(savedDir, VaultService.VAULT_FILE);
        }
    }
    /**
     * Configura el directorio donde se guardará la bóveda
     */
    async setVaultDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        await this.context.globalState.update(VaultService.DIRECTORY_KEY, dirPath);
        const oldVaultPath = this.vaultPath;
        this.vaultPath = path.join(dirPath, VaultService.VAULT_FILE);
        // Migrar bóveda existente si había una
        if (oldVaultPath && fs.existsSync(oldVaultPath) && oldVaultPath !== this.vaultPath) {
            fs.copyFileSync(oldVaultPath, this.vaultPath);
            vscode.window.showInformationMessage('Bóveda migrada al nuevo directorio');
        }
    }
    /**
     * Verifica si hay un directorio configurado
     */
    hasVaultDirectory() {
        return this.vaultPath !== null;
    }
    /**
     * Obtiene el directorio actual de la bóveda
     */
    getVaultDirectory() {
        return this.vaultPath ? path.dirname(this.vaultPath) : null;
    }
    /**
     * Configura la contraseña maestra por primera vez
     */
    async setupMasterPassword(password) {
        await this.secretStorage.store(VaultService.MASTER_KEY_ID, password);
        this.masterKey = password;
        // Crear bóveda vacía
        this.vault = { folders: [] };
        await this.saveVault();
    }
    /**
     * Verifica si existe una contraseña maestra
     */
    async hasMasterPassword() {
        const key = await this.secretStorage.get(VaultService.MASTER_KEY_ID);
        return key !== undefined;
    }
    /**
     * Desbloquea la bóveda con la contraseña maestra
     */
    async unlock(password) {
        try {
            const storedKey = await this.secretStorage.get(VaultService.MASTER_KEY_ID);
            if (!storedKey || storedKey !== password) {
                return false;
            }
            this.masterKey = password;
            await this.loadVault();
            return true;
        }
        catch (error) {
            console.error('Error al desbloquear:', error);
            return false;
        }
    }
    /**
     * Bloquea la bóveda
     */
    lock() {
        this.masterKey = null;
        this.vault = null;
    }
    /**
     * Verifica si la bóveda está desbloqueada
     */
    isUnlocked() {
        return this.masterKey !== null && this.vault !== null;
    }
    /**
     * Cambia la contraseña maestra
     */
    async changeMasterPassword(oldPassword, newPassword) {
        const storedKey = await this.secretStorage.get(VaultService.MASTER_KEY_ID);
        if (!storedKey || storedKey !== oldPassword) {
            return false;
        }
        await this.secretStorage.store(VaultService.MASTER_KEY_ID, newPassword);
        this.masterKey = newPassword;
        // Re-guardar bóveda con nueva contraseña
        if (this.vault) {
            await this.saveVault();
        }
        return true;
    }
    /**
     * Obtiene la bóveda actual
     */
    getVault() {
        if (!this.isUnlocked() || !this.vault) {
            throw new Error('La bóveda está bloqueada');
        }
        return this.vault;
    }
    /**
     * Actualiza la bóveda y la guarda
     */
    async updateVault(vault) {
        if (!this.isUnlocked()) {
            throw new Error('La bóveda está bloqueada');
        }
        this.vault = vault;
        await this.saveVault();
    }
    /**
     * Carga la bóveda desde el disco
     */
    async loadVault() {
        if (!this.vaultPath) {
            throw new Error('No hay directorio de bóveda configurado');
        }
        try {
            if (!fs.existsSync(this.vaultPath)) {
                // Primera vez, crear bóveda vacía
                this.vault = { folders: [] };
                await this.saveVault();
                return;
            }
            const encryptedData = fs.readFileSync(this.vaultPath, 'utf-8');
            const decryptedData = this.decryptData(encryptedData, this.masterKey);
            this.vault = JSON.parse(decryptedData);
        }
        catch (error) {
            console.error('Error al cargar bóveda:', error);
            throw new Error('No se pudo descifrar la bóveda. Contraseña incorrecta.');
        }
    }
    /**
     * Guarda la bóveda en el disco
     */
    async saveVault() {
        if (!this.vault || !this.masterKey) {
            throw new Error('No hay bóveda para guardar');
        }
        if (!this.vaultPath) {
            throw new Error('No hay directorio de bóveda configurado');
        }
        const jsonData = JSON.stringify(this.vault, null, 2);
        const encryptedData = this.encryptData(jsonData, this.masterKey);
        fs.writeFileSync(this.vaultPath, encryptedData, 'utf-8');
    }
    /**
     * Cifra datos usando AES-256-GCM
     */
    encryptData(data, key) {
        try {
            // Derivar clave de 32 bytes desde la contraseña
            const keyBuffer = crypto.scryptSync(key, 'salt', 32);
            // IV aleatorio
            const iv = crypto.randomBytes(16);
            // Cifrar
            const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
            let encrypted = cipher.update(data, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            // Tag de autenticación
            const authTag = cipher.getAuthTag();
            // Combinar: iv + authTag + encrypted
            const result = {
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                encrypted
            };
            return JSON.stringify(result);
        }
        catch (error) {
            console.error('Error al cifrar:', error);
            throw error;
        }
    }
    /**
     * Descifra datos usando AES-256-GCM
     */
    decryptData(encryptedData, key) {
        try {
            const { iv, authTag, encrypted } = JSON.parse(encryptedData);
            // Derivar clave de 32 bytes desde la contraseña
            const keyBuffer = crypto.scryptSync(key, 'salt', 32);
            // Descifrar
            const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, Buffer.from(iv, 'hex'));
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            console.error('Error al descifrar:', error);
            throw error;
        }
    }
    /**
     * Elimina completamente la bóveda (reset)
     */
    async deleteVault() {
        if (this.vaultPath && fs.existsSync(this.vaultPath)) {
            fs.unlinkSync(this.vaultPath);
        }
        await this.secretStorage.delete(VaultService.MASTER_KEY_ID);
        this.masterKey = null;
        this.vault = null;
    }
}
exports.VaultService = VaultService;
VaultService.MASTER_KEY_ID = 'secretVault.masterKey';
VaultService.VAULT_FILE = 'vault.json';
VaultService.DIRECTORY_KEY = 'secretVault.vaultDirectory';
//# sourceMappingURL=vaultService.js.map