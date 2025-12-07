import * as vscode from 'vscode';
import { VaultService } from './vaultService';
import { VaultProvider } from './vaultProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Secret Vault extension activada');

    const vaultService = new VaultService(context, context.secrets);
    const vaultProvider = new VaultProvider(vaultService);

    // Registrar TreeView con Drag & Drop
    const treeView = vscode.window.createTreeView('secretVaultView', {
        treeDataProvider: vaultProvider,
        showCollapseAll: true,
        canSelectMany: false,
        dragAndDropController: vaultProvider
    });

    // Comando: Seleccionar directorio de bóveda
    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.selectDirectory', async () => {
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
        })
    );

    // Comando: Desbloquear bóveda
    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.unlock', async () => {
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

                if (!password) return;

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
            } else {
                // Desbloquear con contraseña existente
                const password = await vscode.window.showInputBox({
                    prompt: 'Ingresa tu contraseña maestra',
                    password: true
                });

                if (!password) return;

                const success = await vaultService.unlock(password);

                if (success) {
                    vscode.window.showInformationMessage('🔓 Bóveda desbloqueada');
                    vaultProvider.refresh();
                } else {
                    vscode.window.showErrorMessage('Contraseña incorrecta');
                }
            }
        })
    );

    // Comando: Bloquear bóveda
    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.lock', () => {
            vaultService.lock();
            vaultProvider.refresh();
            vscode.window.showInformationMessage('🔒 Bóveda bloqueada');
        })
    );

    // Comando: Cambiar contraseña maestra
    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.changeMasterPassword', async () => {
            const oldPassword = await vscode.window.showInputBox({
                prompt: 'Contraseña maestra actual',
                password: true
            });

            if (!oldPassword) return;

            const newPassword = await vscode.window.showInputBox({
                prompt: 'Nueva contraseña maestra',
                password: true
            });

            if (!newPassword) return;

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
            } else {
                vscode.window.showErrorMessage('Contraseña actual incorrecta');
            }
        })
    );

    // Comando: Refrescar
    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.refresh', () => {
            vaultProvider.refresh();
        })
    );

    // Comando: Crear carpeta
    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.createFolder', async () => {
            await vaultProvider.createFolder();
        })
    );

    // Comando: Crear secreto
    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.createSecret', async (item) => {
            await vaultProvider.createSecret(item);
        })
    );

    // Comando: Editar item (no implementado en MVP)
    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.editItem', async (item) => {
            vscode.window.showInformationMessage('Función de edición disponible próximamente');
        })
    );

    // Comando: Eliminar item
    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.deleteItem', async (item) => {
            await vaultProvider.deleteItem(item);
        })
    );

    // Comandos: Copiar al portapapeles
    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.copyPassword', async (item) => {
            await vaultProvider.copyPassword(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.copyUsername', async (item) => {
            await vaultProvider.copyUsername(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('secretVault.copyNotes', async (item) => {
            await vaultProvider.copyNotes(item);
        })
    );

    context.subscriptions.push(treeView);
}

export function deactivate() {}
