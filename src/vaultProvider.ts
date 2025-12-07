import * as vscode from 'vscode';
import { Vault, Folder, VaultItem } from './types';
import { VaultService } from './vaultService';

export class VaultTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'folder' | 'secret',
        public readonly folderIndex?: number,
        public readonly itemIndex?: number,
        public readonly item?: VaultItem
    ) {
        super(label, collapsibleState);

        // Context value dinámico basado en los campos disponibles
        if (itemType === 'secret' && item) {
            const parts = ['secret'];
            if (item.username) parts.push('hasUsername');
            if (item.password) parts.push('hasPassword');
            if (item.notes) parts.push('hasNotes');
            this.contextValue = parts.join('.');
        } else {
            this.contextValue = itemType;
        }

        // Iconos según tipo
        if (itemType === 'folder') {
            this.iconPath = new vscode.ThemeIcon('folder-opened');
        } else if (itemType === 'secret') {
            this.iconPath = new vscode.ThemeIcon('key');
        }
    }
}

export class VaultProvider implements 
    vscode.TreeDataProvider<VaultTreeItem>,
    vscode.TreeDragAndDropController<VaultTreeItem> {
    
    private _onDidChangeTreeData: vscode.EventEmitter<VaultTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<VaultTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<VaultTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    // Drag and Drop
    dropMimeTypes = ['application/vnd.code.tree.secretVaultView'];
    dragMimeTypes = ['application/vnd.code.tree.secretVaultView'];

    constructor(private vaultService: VaultService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: VaultTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: VaultTreeItem): Promise<VaultTreeItem[]> {
        if (!this.vaultService.isUnlocked()) {
            // Intentar desbloquear automáticamente
            const hasMaster = await this.vaultService.hasMasterPassword();
            if (hasMaster) {
                // Mostrar prompt para desbloquear
                await vscode.commands.executeCommand('secretVault.unlock');
            } else {
                // Primera vez - configurar
                await vscode.commands.executeCommand('secretVault.unlock');
            }
            return [];
        }

        try {
            const vault = this.vaultService.getVault();

            if (!element) {
                // Root level - mostrar carpetas
                if (vault.folders.length === 0) {
                    return [
                        new VaultTreeItem(
                            'No hay carpetas. Crea una nueva.',
                            vscode.TreeItemCollapsibleState.None,
                            'folder'
                        )
                    ];
                }

                return vault.folders.map((folder, index) =>
                    new VaultTreeItem(
                        `📁 ${folder.name} (${folder.items.length})`,
                        vscode.TreeItemCollapsibleState.Expanded,
                        'folder',
                        index
                    )
                );
            } else if (element.itemType === 'folder' && element.folderIndex !== undefined) {
                // Mostrar items de la carpeta
                const folder = vault.folders[element.folderIndex];
                
                if (!folder || folder.items.length === 0) {
                    return [];
                }

                return folder.items.map((item, index) => {
                    let label = item.name;
                    if (item.username) {
                        label = `${item.name} (${item.username})`;
                    }

                    return new VaultTreeItem(
                        label,
                        vscode.TreeItemCollapsibleState.None,
                        'secret',
                        element.folderIndex,
                        index,
                        item
                    );
                });
            }

            return [];
        } catch (error) {
            console.error('Error al obtener hijos:', error);
            return [];
        }
    }

    // Drag and Drop Implementation
    async handleDrag(
        source: readonly VaultTreeItem[],
        dataTransfer: vscode.DataTransfer,
        token: vscode.CancellationToken
    ): Promise<void> {
        // Solo permitir arrastrar items, no carpetas
        const items = source.filter(item => item.itemType !== 'folder');
        if (items.length === 0) return;

        dataTransfer.set(
            'application/vnd.code.tree.secretVaultView',
            new vscode.DataTransferItem(items)
        );
    }

    async handleDrop(
        target: VaultTreeItem | undefined,
        dataTransfer: vscode.DataTransfer,
        token: vscode.CancellationToken
    ): Promise<void> {
        if (!target || target.itemType !== 'folder') {
            vscode.window.showWarningMessage('Solo puedes soltar items en carpetas');
            return;
        }

        const transferItem = dataTransfer.get('application/vnd.code.tree.secretVaultView');
        if (!transferItem) return;

        const draggedItems = transferItem.value as VaultTreeItem[];
        if (!draggedItems || draggedItems.length === 0) return;

        try {
            const vault = this.vaultService.getVault();
            const targetFolderIndex = target.folderIndex!;

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
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error al mover item: ${error.message}`);
        }
    }

    // CRUD Operations
    async createFolder(folderName?: string): Promise<void> {
        if (!this.vaultService.isUnlocked()) {
            vscode.window.showWarningMessage('Primero desbloquea la bóveda');
            return;
        }

        const name = folderName || await vscode.window.showInputBox({
            prompt: 'Nombre de la carpeta',
            placeHolder: 'Personal, Trabajo, Servicios...'
        });

        if (!name) return;

        try {
            const vault = this.vaultService.getVault();
            vault.folders.push({ name, items: [] });
            await this.vaultService.updateVault(vault);
            this.refresh();
            
            vscode.window.showInformationMessage(`Carpeta "${name}" creada`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }

    async createSecret(targetFolder?: VaultTreeItem): Promise<void> {
        if (!this.vaultService.isUnlocked()) {
            vscode.window.showWarningMessage('Primero desbloquea la bóveda');
            return;
        }

        const vault = this.vaultService.getVault();
        
        // Seleccionar carpeta
        let folderIndex: number;
        if (targetFolder && targetFolder.folderIndex !== undefined) {
            folderIndex = targetFolder.folderIndex;
        } else {
            const folderName = await this.selectFolder(vault);
            if (!folderName) return;
            folderIndex = vault.folders.findIndex(f => f.name === folderName);
        }

        // Pedir datos (todos opcionales excepto nombre)
        const name = await vscode.window.showInputBox({
            prompt: 'Nombre/Título (requerido)',
            placeHolder: 'Gmail, GitHub Token, AWS...'
        });
        if (!name) return;

        const username = await vscode.window.showInputBox({
            prompt: 'Usuario/Email (opcional)',
            placeHolder: 'usuario@email.com'
        });

        const password = await vscode.window.showInputBox({
            prompt: 'Contraseña/Token (opcional)',
            password: true
        });

        const notes = await vscode.window.showInputBox({
            prompt: 'Notas (opcional)',
            placeHolder: 'Información adicional...'
        });

        try {
            const secret: VaultItem = { name };
            if (username) secret.username = username;
            if (password) secret.password = password;
            if (notes) secret.notes = notes;

            vault.folders[folderIndex].items.push(secret);

            await this.vaultService.updateVault(vault);
            this.refresh();
            
            vscode.window.showInformationMessage(`Secreto "${name}" creado`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }

    async deleteItem(item: VaultTreeItem): Promise<void> {
        if (!this.vaultService.isUnlocked()) return;

        const confirm = await vscode.window.showWarningMessage(
            `¿Eliminar "${item.label}"?`,
            'Eliminar', 'Cancelar'
        );

        if (confirm !== 'Eliminar') return;

        try {
            const vault = this.vaultService.getVault();

            if (item.itemType === 'folder' && item.folderIndex !== undefined) {
                vault.folders.splice(item.folderIndex, 1);
            } else if (item.folderIndex !== undefined && item.itemIndex !== undefined) {
                vault.folders[item.folderIndex].items.splice(item.itemIndex, 1);
            }

            await this.vaultService.updateVault(vault);
            this.refresh();
            
            vscode.window.showInformationMessage('Elemento eliminado');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }

    async copyPassword(item: VaultTreeItem): Promise<void> {
        if (!this.vaultService.isUnlocked()) return;
        if (item.folderIndex === undefined || item.itemIndex === undefined) return;

        try {
            const vault = this.vaultService.getVault();
            const vaultItem = vault.folders[item.folderIndex].items[item.itemIndex];

            if (!vaultItem.password) {
                vscode.window.showWarningMessage('Este secreto no tiene contraseña');
                return;
            }

            await vscode.env.clipboard.writeText(vaultItem.password);
            vscode.window.showInformationMessage('Contraseña copiada al portapapeles');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }

    async copyUsername(item: VaultTreeItem): Promise<void> {
        if (!this.vaultService.isUnlocked()) return;
        if (item.folderIndex === undefined || item.itemIndex === undefined) return;

        try {
            const vault = this.vaultService.getVault();
            const vaultItem = vault.folders[item.folderIndex].items[item.itemIndex];

            if (!vaultItem.username) {
                vscode.window.showWarningMessage('Este secreto no tiene usuario');
                return;
            }

            await vscode.env.clipboard.writeText(vaultItem.username);
            vscode.window.showInformationMessage('Usuario copiado al portapapeles');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }

    async copyNotes(item: VaultTreeItem): Promise<void> {
        if (!this.vaultService.isUnlocked()) return;
        if (item.folderIndex === undefined || item.itemIndex === undefined) return;

        try {
            const vault = this.vaultService.getVault();
            const vaultItem = vault.folders[item.folderIndex].items[item.itemIndex];

            if (!vaultItem.notes) {
                vscode.window.showWarningMessage('Este secreto no tiene notas');
                return;
            }

            await vscode.env.clipboard.writeText(vaultItem.notes);
            vscode.window.showInformationMessage('Notas copiadas al portapapeles');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }

    private async selectFolder(vault: Vault): Promise<string | undefined> {
        if (vault.folders.length === 0) {
            vscode.window.showWarningMessage('No hay carpetas. Crea una primero.');
            return undefined;
        }

        return vscode.window.showQuickPick(
            vault.folders.map(f => f.name),
            { placeHolder: 'Selecciona una carpeta' }
        );
    }
}
