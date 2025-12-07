# Secret Vault

Bóveda cifrada de secretos con Zero-Knowledge (AES-256-GCM).

## Funcionalidad

**Vista: Secret Vault**
- Auto-desbloqueo al expandir (pide contraseña maestra)
- Organización en carpetas
- Drag & Drop entre carpetas
- Bloqueo automático al cerrar VS Code

**Secretos (campos opcionales excepto nombre):**
- **Nombre** - Requerido (Gmail, GitHub, AWS...)
- **Usuario** - Opcional (email, username)
- **Contraseña/Token** - Opcional (password, API key)
- **Notas** - Opcional (información adicional)

**Acciones:**
- Copiar campo específico al portapapeles (solo si existe)
- Mover entre carpetas (drag & drop)
- Eliminar secreto/carpeta

## Comandos

**Vista:**
- **Refresh** - Refrescar (icon: ↻)
- **Nueva Carpeta** (icon: 📁)
- **Nuevo Secreto** (icon: 🔑)

**Contexto (click derecho en secreto):**
- **Copiar Contraseña** - Solo si tiene contraseña
- **Copiar Usuario** - Solo si tiene usuario
- **Copiar Notas** - Solo si tiene notas
- **Eliminar**

## Seguridad

- **Cifrado:** AES-256-GCM local
- **Storage:** `vault.json` cifrado en disco
- **Contraseña:** VS Code Secret Storage
- **Zero-Knowledge:** Solo tú tienes acceso

## Primera Vez

1. Abrir vista Secret Vault (icon: 🔒)
2. Click "Desbloquear Bóveda"
3. Crear contraseña maestra
4. ¡Bóveda creada!

## Estructura

```
~/.vscode/extensions/secret-vault/
└── vault.json (cifrado AES-256-GCM)
```

## Autor

**Remi Aguilar**
- Website: [remiaguilar.com](https://remiaguilar.com)
- GitHub: [@remiaguilar](https://github.com/remiaguilar)

## Licencia

MIT License - Ver [LICENSE](LICENSE) para más detalles.

## Contribuciones

Este proyecto es open source. Contribuciones, issues y sugerencias son bienvenidas.

Si encuentras un bug o tienes una idea para mejorar la extensión, por favor abre un [issue](https://github.com/remiaguilar/vs-notes/issues).

## Licencia

MIT
