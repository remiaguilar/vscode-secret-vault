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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const vaultService_1 = require("./vaultService");
const vaultProvider_1 = require("./vaultProvider");
function activate(context) {
    console.log('Secret Vault extension activada');
    const vaultService = new vaultService_1.VaultService(context, context.secrets);
    const vaultProvider = new vaultProvider_1.VaultProvider(vaultService);
    // Registrar TreeView con Drag & Drop
    const treeView = vscode.window.createTreeView('secretVaultView', {
        treeDataProvider: vaultProvider,
        showCollapseAll: true,
        canSelectMany: false,
        dragAndDropController: vaultProvider
    });
    // Comando: Seleccionar directorio de bóveda
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.selectDirectory', async () => {
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Seleccionar Directorio de Bóveda'
        });
        if (folderUri && folderUri[0]) {
            await vaultService.setVaultDirectory(folderUri[0].fsPath);
            vaultProvider.refresh();
            vscode.window.showInformationMessage(`Directorio de bóveda: ${folderUri[0].fsPath}`);
        }
    }));
    // Comando: Desbloquear bóveda
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.unlock', async () => {
        if (vaultService.isUnlocked()) {
            vscode.window.showInformationMessage('La bóveda ya está desbloqueada');
            return;
        }
        // Verificar si existe contraseña maestra
        const hasMaster = await vaultService.hasMasterPassword();
        if (!hasMaster) {
            // Primera vez - configurar contraseña maestra
            const password = await vscode.window.showInputBox({
                prompt: 'Configura tu contraseña maestra',
                password: true,
                placeHolder: 'Contraseña segura...'
            });
            if (!password)
                return;
            const confirm = await vscode.window.showInputBox({
                prompt: 'Confirma tu contraseña maestra',
                password: true,
                placeHolder: 'Repite la contraseña...'
            });
            if (password !== confirm) {
                vscode.window.showErrorMessage('Las contraseñas no coinciden');
                return;
            }
            await vaultService.setupMasterPassword(password);
            vscode.window.showInformationMessage('🔓 Bóveda creada y desbloqueada');
            vaultProvider.refresh();
        }
        else {
            // Desbloquear con contraseña existente
            const password = await vscode.window.showInputBox({
                prompt: 'Ingresa tu contraseña maestra',
                password: true
            });
            if (!password)
                return;
            const success = await vaultService.unlock(password);
            if (success) {
                vscode.window.showInformationMessage('🔓 Bóveda desbloqueada');
                vaultProvider.refresh();
            }
            else {
                vscode.window.showErrorMessage('Contraseña incorrecta');
            }
        }
    }));
    // Comando: Bloquear bóveda
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.lock', () => {
        vaultService.lock();
        vaultProvider.refresh();
        vscode.window.showInformationMessage('🔒 Bóveda bloqueada');
    }));
    // Comando: Cambiar contraseña maestra
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.changeMasterPassword', async () => {
        const oldPassword = await vscode.window.showInputBox({
            prompt: 'Contraseña maestra actual',
            password: true
        });
        if (!oldPassword)
            return;
        const newPassword = await vscode.window.showInputBox({
            prompt: 'Nueva contraseña maestra',
            password: true
        });
        if (!newPassword)
            return;
        const confirm = await vscode.window.showInputBox({
            prompt: 'Confirma la nueva contraseña',
            password: true
        });
        if (newPassword !== confirm) {
            vscode.window.showErrorMessage('Las contraseñas no coinciden');
            return;
        }
        const success = await vaultService.changeMasterPassword(oldPassword, newPassword);
        if (success) {
            vscode.window.showInformationMessage('Contraseña maestra actualizada');
        }
        else {
            vscode.window.showErrorMessage('Contraseña actual incorrecta');
        }
    }));
    // Comando: Refrescar
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.refresh', () => {
        vaultProvider.refresh();
    }));
    // Comando: Crear carpeta
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.createFolder', async () => {
        await vaultProvider.createFolder();
    }));
    // Comando: Crear contraseña
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.createPassword', async (item) => {
        await vaultProvider.createPassword(item);
    }));
    // Comando: Crear token
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.createToken', async (item) => {
        await vaultProvider.createToken(item);
    }));
    // Comando: Editar item (no implementado en MVP)
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.editItem', async (item) => {
        vscode.window.showInformationMessage('Función de edición disponible próximamente');
    }));
    // Comando: Eliminar item
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.deleteItem', async (item) => {
        await vaultProvider.deleteItem(item);
    }));
    // Comando: Copiar secreto al portapapeles
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.copySecret', async (item) => {
        await vaultProvider.copySecret(item);
    }));
    // Comando: Copiar usuario al portapapeles
    context.subscriptions.push(vscode.commands.registerCommand('secretVault.copyUsername', async (item) => {
        await vaultProvider.copyUsername(item);
    }));
    context.subscriptions.push(treeView);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map