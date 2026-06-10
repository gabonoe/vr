# Meta Quest 3 - Aplicación de Escena 3D con Rastreo de Manos

Aplicación WebXR para Meta Quest 3 que permite agarrar y mover objetos 3D (a, b, c) utilizando el rastreo de manos.

## Características

- Carga de escena GLB desde `assets/escena.glb`
- Rastreo de manos para interacción natural
- Capacidad de agarrar y soltar objetos a, b, y c
- Los objetos pueden colocarse en cualquier lugar del mesh "mesa"
- Soporte para controladores XR y manos

## Requisitos

- Meta Quest 3 con navegador Oculus
- Servidor HTTPS o localhost para WebXR

## Instalación

1. Instala las dependencias:
```bash
npm install
```

## Ejecución

1. Inicia el servidor local:
```bash
npm start
```

2. Abre tu navegador en `http://localhost:8080`

3. Para probar en Meta Quest 3:
   - Conecta tu Quest 3 al mismo WiFi que tu computadora
   - Abre el navegador Oculus en tu Quest 3
   - Navega a `http://[TU-IP-LOCAL]:8080` (reemplaza con tu IP local)
   - Habilita WebXR en el navegador Oculus si es necesario
   - Haz clic en "Entrar en VR" para iniciar la experiencia

## Uso

- **Con controladores**: Usa el gatillo para agarrar objetos
- **Con manos**: Haz un gesto de pellizco (pinch) con el pulgar y el índice para agarrar objetos
- Suelta el objeto para dejarlo en la nueva posición

## Estructura del Proyecto

```
ProyectoA/
├── index.html          # Archivo HTML principal
├── style.css           # Estilos CSS
├── app.js              # Lógica JavaScript con Three.js
├── package.json        # Dependencias del proyecto
├── assets/
│   └── escena.glb      # Escena 3D con mesa y objetos a, b, c
└── README.md           # Este archivo
```

## Notas Importantes

- La escena debe contener un mesh llamado "mesa" que actúa como superficie
- Los objetos agarrables deben llamarse "a", "b", y "c"
- WebXR requiere HTTPS o localhost para funcionar
- El rastreo de manos requiere Meta Quest 3 (no funciona en Quest 2)

## Solución de Problemas

- Si WebXR no funciona, asegúrate de estar usando HTTPS o localhost
- Verifica que tu escena GLB tenga los nombres correctos de meshes
- Para obtener tu IP local en Windows: `ipconfig`
