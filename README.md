# Bus UCR ↔ Coronado

Web app estática para seguimiento comunitario de buses entre la UCR y Coronado.

## Estructura

.
-├── index.html
-├── css/
-│   └── styles.css
-├── js/
-│   ├── footer.js
-│   └── main.js
-└── original_indextest_backup.html

## Funcionalidades

- Horarios por dirección
- Cálculo de próxima salida
- Seguimiento visual del último bus salido
- Reportes comunitarios en tiempo real
- Notificaciones desde Firestore
- GPS para detección de parada más cercana
- Panel de administración

## Deploy

Compatible con cualquier hosting estático (Netlify, Vercel, Firebase Hosting).

## Firebase

La configuración de Firebase está dentro de `js/main.js`.

## Nota importante

Esta versión quedó **sin seguridad en el panel admin**. Cualquier persona que abra la pestaña de admin podrá hacer cambios si además tiene permisos de escritura en Firestore.

## Autor

Desmond  
GitHub: https://github.com/Desmond16170
