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
exports.VaultProvider = exports.VaultTreeItem = void 0;
const vscode = __importStar(require("vscode"));
class VaultTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, itemType, folderIndex, itemIndex) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.itemType = itemType;
        this.folderIndex = folderIndex;
        this.itemIndex = itemIndex;
        this.contextValue = itemType;
        // Iconos según tipo
        if (itemType === 'folder') {
            this.iconPath = new vscode.ThemeIcon('folder-opened');
        }
        else if (itemType === 'password') {
            this.iconPath = new vscode.ThemeIcon('key');
        }
        else if (itemType === 'token') {
            this.iconPath = new vscode.ThemeIcon('symbol-key');
        }
    }
}
exports.VaultTreeItem = VaultTreeItem;
class VaultProvider {
    constructor(vaultService) {
        this.vaultService = vaultService;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Drag and Drop
        this.dropMimeTypes = ['application/vnd.code.tree.secretVaultView'];
        this.dragMimeTypes = ['application/vnd.code.tree.secretVaultView'];
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!this.vaultService.isUnlocked()) {
            return [
                new VaultTreeItem('🔒 Bóveda bloqueada', vscode.TreeItemCollapsibleState.None, 'folder')
            ];
        }
        try {
            const vault = this.vaultService.getVault();
            if (!element) {
                // Root level - mostrar carpetas
                if (vault.folders.length === 0) {
                    return [
                        new VaultTreeItem('No hay carpetas. Crea una nueva.', vscode.TreeItemCollapsibleState.None, 'folder')
                    ];
                }
                return vault.folders.map((folder, index) => new VaultTreeItem(`📁 ${folder.name} (${folder.items.length})`, vscode.TreeItemCollapsibleState.Expanded, 'folder', index));
            }
            else if (element.itemType === 'folder' && element.folderIndex !== undefined) {
                // Mostrar items de la carpeta
                const folder = vault.folders[element.folderIndex];
                if (!folder || folder.items.length === 0) {
                    return [];
                }
                return folder.items.map((item, index) => {
                    let label = '';
                    let itemType = 'password';
                    if (item.type === 'Password') {
                        label = `${item.name} (${item.username})`;
                        itemType = 'password';
                    }
                    else {
                        label = item.name;
                        itemType = 'token';
                    }
                    return new VaultTreeItem(label, vscode.TreeItemCollapsibleState.None, itemType, element.folderIndex, index);
                });
            }
            return [];
        }
        catch (error) {
            console.error('Error al obtener hijos:', error);
            return [];
        }
    }
    // Drag and Drop Implementation
    async handleDrag(source, dataTransfer, token) {
        // Solo permitir arrastrar items, no carpetas
        const items = source.filter(item => item.itemType !== 'folder');
        if (items.length === 0)
            return;
        dataTransfer.set('application/vnd.code.tree.secretVaultView', new vscode.DataTransferItem(items));
    }
    async handleDrop(target, dataTransfer, token) {
        if (!target || target.itemType !== 'folder') {
            vscode.window.showWarningMessage('Solo puedes soltar items en carpetas');
            return;
        }
        const transferItem = dataTransfer.get('application/vnd.code.tree.secretVaultView');
        if (!transferItem)
            return;
        const draggedItems = transferItem.value;
        if (!draggedItems || draggedItems.length === 0)
            return;
        try {
            const vault = this.vaultService.getVault();
            const targetFolderIndex = target.folderIndex;
            for (const draggedItem of draggedItems) {
                if (draggedItem.folderIndex === undefined || draggedItem.itemIndex === undefined) {
                    continue;
                }
                const sourceFolderIndex = draggedItem.folderIndex;
                const sourceItemIndex = draggedItem.itemIndex;
                // No hacer nada si es la misma carpeta
                if (sourceFolderIndex === targetFolderIndex) {
                    continue;
                }
                // Obtener el item
                const item = vault.folders[sourceFolderIndex].items[sourceItemIndex];
                // Eliminar de carpeta origen
                vault.folders[sourceFolderIndex].items.splice(sourceItemIndex, 1);
                // Agregar a carpeta destino
                vault.folders[targetFolderIndex].items.push(item);
            }
            await this.vaultService.updateVault(vault);
            this.refresh();
            vscode.window.showInformationMessage('Item movido exitosamente');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error al mover item: ${error.message}`);
        }
    }
    // CRUD Operations
    async createFolder(folderName) {
        if (!this.vaultService.isUnlocked()) {
            vscode.window.showWarningMessage('Primero desbloquea la bóveda');
            return;
        }
        const name = folderName || await vscode.window.showInputBox({
            prompt: 'Nombre de la carpeta',
            placeHolder: 'Personal, Trabajo, Servicios...'
        });
        if (!name)
            return;
        try {
            const vault = this.vaultService.getVault();
            vault.folders.push({ name, items: [] });
            await this.vaultService.updateVault(vault);
            this.refresh();
            vscode.window.showInformationMessage(`Carpeta "${name}" creada`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }
    async createPassword(targetFolder) {
        if (!this.vaultService.isUnlocked()) {
            vscode.window.showWarningMessage('Primero desbloquea la bóveda');
            return;
        }
        const vault = this.vaultService.getVault();
        // Seleccionar carpeta
        let folderIndex;
        if (targetFolder && targetFolder.folderIndex !== undefined) {
            folderIndex = targetFolder.folderIndex;
        }
        else {
            const folderName = await this.selectFolder(vault);
            if (!folderName)
                return;
            folderIndex = vault.folders.findIndex(f => f.name === folderName);
        }
        // Pedir datos
        const name = await vscode.window.showInputBox({
            prompt: 'Nombre/Título',
            placeHolder: 'Gmail, GitHub, AWS...'
        });
        if (!name)
            return;
        const username = await vscode.window.showInputBox({
            prompt: 'Usuario/Email',
            placeHolder: 'usuario@email.com'
        });
        if (!username)
            return;
        const password = await vscode.window.showInputBox({
            prompt: 'Contraseña',
            password: true
        });
        if (!password)
            return;
        const notes = await vscode.window.showInputBox({
            prompt: 'Notas (opcional)',
            placeHolder: 'Información adicional...'
        });
        try {
            vault.folders[folderIndex].items.push({
                type: 'Password',
                name,
                username,
                password,
                notes
            });
            await this.vaultService.updateVault(vault);
            this.refresh();
            vscode.window.showInformationMessage(`Contraseña "${name}" creada`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }
    async createToken(targetFolder) {
        if (!this.vaultService.isUnlocked()) {
            vscode.window.showWarningMessage('Primero desbloquea la bóveda');
            return;
        }
        const vault = this.vaultService.getVault();
        // Seleccionar carpeta
        let folderIndex;
        if (targetFolder && targetFolder.folderIndex !== undefined) {
            folderIndex = targetFolder.folderIndex;
        }
        else {
            const folderName = await this.selectFolder(vault);
            if (!folderName)
                return;
            folderIndex = vault.folders.findIndex(f => f.name === folderName);
        }
        // Pedir datos
        const name = await vscode.window.showInputBox({
            prompt: 'Nombre del Token',
            placeHolder: 'GitHub Token, AWS Session Token...'
        });
        if (!name)
            return;
        const value = await vscode.window.showInputBox({
            prompt: 'Valor del Token',
            password: true
        });
        if (!value)
            return;
        try {
            vault.folders[folderIndex].items.push({
                type: 'Token',
                name,
                value
            });
            await this.vaultService.updateVault(vault);
            this.refresh();
            vscode.window.showInformationMessage(`Token "${name}" creado`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }
    async deleteItem(item) {
        if (!this.vaultService.isUnlocked())
            return;
        const confirm = await vscode.window.showWarningMessage(`¿Eliminar "${item.label}"?`, 'Eliminar', 'Cancelar');
        if (confirm !== 'Eliminar')
            return;
        try {
            const vault = this.vaultService.getVault();
            if (item.itemType === 'folder' && item.folderIndex !== undefined) {
                vault.folders.splice(item.folderIndex, 1);
            }
            else if (item.folderIndex !== undefined && item.itemIndex !== undefined) {
                vault.folders[item.folderIndex].items.splice(item.itemIndex, 1);
            }
            await this.vaultService.updateVault(vault);
            this.refresh();
            vscode.window.showInformationMessage('Elemento eliminado');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }
    async copySecret(item) {
        if (!this.vaultService.isUnlocked())
            return;
        if (item.folderIndex === undefined || item.itemIndex === undefined)
            return;
        try {
            const vault = this.vaultService.getVault();
            const vaultItem = vault.folders[item.folderIndex].items[item.itemIndex];
            let secret = '';
            if (vaultItem.type === 'Password') {
                secret = vaultItem.password;
            }
            else {
                secret = vaultItem.value;
            }
            await vscode.env.clipboard.writeText(secret);
            vscode.window.showInformationMessage('Secreto copiado al portapapeles');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }
    async copyUsername(item) {
        if (!this.vaultService.isUnlocked())
            return;
        if (item.folderIndex === undefined || item.itemIndex === undefined)
            return;
        try {
            const vault = this.vaultService.getVault();
            const vaultItem = vault.folders[item.folderIndex].items[item.itemIndex];
            if (vaultItem.type === 'Password') {
                await vscode.env.clipboard.writeText(vaultItem.username);
                vscode.window.showInformationMessage('Usuario copiado al portapapeles');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }
    async selectFolder(vault) {
        if (vault.folders.length === 0) {
            vscode.window.showWarningMessage('No hay carpetas. Crea una primero.');
            return undefined;
        }
        return vscode.window.showQuickPick(vault.folders.map(f => f.name), { placeHolder: 'Selecciona una carpeta' });
    }
}
exports.VaultProvider = VaultProvider;
//# sourceMappingURL=vaultProvider.js.map