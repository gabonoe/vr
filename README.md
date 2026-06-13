# Meta Quest 2/3 - Aplicación de Escena 3D con Rastreo de Manos

Aplicación WebXR compatible con Meta Quest 2 y Quest 3 que permite agarrar y mover objetos 3D (a, b, c) utilizando el rastreo de manos o controladores.

## Características

- Carga de escena GLB desde `assets/escena.glb`
- Rastreo de manos para interacción natural (Quest 2/3)
- Capacidad de agarrar y soltar objetos a, b, y c
- Los objetos pueden colocarse en cualquier lugar del mesh "mesa"
- Soporte para controladores XR y manos
- Compatible con Meta Quest 2 y Quest 3
- Iluminación mejorada y renderizado de alta calidad

## Requisitos

- Meta Quest 2 o Quest 3 con navegador Oculus
- **HTTPS obligatorio**: WebXR solo funciona en `localhost` o sobre HTTPS.
  Para probar por WiFi en el visor necesitas HTTPS (incluido un servidor con
  certificado autofirmado, ya provisto en `server.py`).
- Python 3 y el paquete `cryptography` (`python -m pip install cryptography`)

## Ejecución (HTTPS para el Quest)

1. Inicia el servidor HTTPS local (genera el certificado automáticamente):
```bash
python -u server.py 8443
```

2. La consola mostrará la URL de red, por ejemplo:
   `https://192.168.100.10:8443`

3. Para probar en Meta Quest 2 o 3:
   - Conecta tu Quest al mismo WiFi que tu computadora
   - Abre el navegador Oculus en tu Quest
   - Navega a `https://[TU-IP-LOCAL]:8443` (la que muestra la consola)
   - Acepta el aviso de certificado: **Avanzado → Continuar de todos modos**
   - Haz clic en "ENTER VR" para iniciar la experiencia

> Nota: con `http://` (sin S) el botón mostrará "WEBXR NEEDS HTTPS" porque el
> navegador bloquea WebXR en contextos no seguros. Por eso se usa `server.py`.

## Uso

- **Con controladores (mandos Touch)**:
  - Apunta con el rayo láser a un objeto (a, b o c) y mantén el **gatillo** para agarrarlo.
  - También puedes acercar el mando al objeto y agarrar directamente.
  - Suelta el gatillo para dejarlo; el objeto se posa automáticamente sobre la mesa.
- **Con manos (hand tracking)**:
  - Deja los mandos; aparecerán manos articuladas (modelos de Meta).
  - Acerca la mano al objeto y haz el gesto de **pellizco** (pulgar + índice) para agarrarlo.
  - Abre la mano para soltarlo sobre la superficie.
- Los objetos se ajustan (snap) a la superficie del mesh `mesa` al soltarlos.

## Estructura del Proyecto

```
ProyectoA/
├── index.html          # Archivo HTML principal
├── style.css           # Estilos CSS
├── app.js              # Lógica JavaScript con Three.js (WebXR)
├── server.py           # Servidor HTTPS local (cert autofirmado) para WebXR
├── package.json        # Scripts del proyecto
├── assets/
│   ├── escena.glb      # Escena 3D con mesa y objetos a, b, c
│   └── hands/          # Modelos de manos de Meta (left.glb, right.glb)
└── README.md           # Este archivo
```

## Notas Importantes

- La escena debe contener un mesh llamado "mesa" que actúa como superficie
- Los objetos agarrables deben llamarse "a", "b", y "c"
- WebXR requiere HTTPS o localhost para funcionar
- El rastreo de manos funciona en Quest 2 y Quest 3
- Los controladores XR funcionan en ambos dispositivos
- Quest 2 puede tener capacidades de hand tracking más limitadas que Quest 3

## Solución de Problemas

- Si WebXR no funciona, asegúrate de estar usando HTTPS o localhost
- Verifica que tu escena GLB tenga los nombres correctos de meshes
- Para obtener tu IP local en Windows: `ipconfig`
